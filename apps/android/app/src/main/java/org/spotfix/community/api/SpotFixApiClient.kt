package org.spotfix.community.api

import android.os.Build
import kotlinx.coroutines.Dispatchers
import org.spotfix.community.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.spotfix.community.model.IssuePriority
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.NotificationEvent
import org.spotfix.community.model.PublicStatusBoard
import org.spotfix.community.model.PublicStatusCleaner
import org.spotfix.community.model.PublicStatusReportItem
import org.spotfix.community.model.PublicStatusSummary
import org.spotfix.community.model.ReportCoordinate
import org.spotfix.community.model.UserSession
import org.spotfix.community.model.WorkforceMember
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Pure-Kotlin port of the original iOS client.
 *
 * Endpoint paths, request bodies, and response shapes match the OpenAPI spec generated in P6
 * (`apps/api/src/openapi/registry.ts`). The TypeScript SDK in `packages/api-contract` is the
 * canonical reference for header behavior:
 *  - `Authorization: Bearer <accessToken>` on authenticated calls.
 *  - `X-Tenant-Slug: <slug>` on every call (the API requires it on the public auth endpoints
 *    and ignores it on authenticated ones).
 */
class SpotFixApiClient(
    val baseUrl: String,
    var tenantSlug: String?,
    httpClient: OkHttpClient? = null
) {
    private val client: OkHttpClient = httpClient ?: defaultClient()
    private val json: Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        encodeDefaults = true
        explicitNulls = false
    }
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    // ---------------------------------------------------------------------------------------
    // Health + auth
    // ---------------------------------------------------------------------------------------

    suspend fun fetchServiceStatus(): ApiServiceStatusDto = getJson("", null)

    suspend fun registerPublic(name: String, email: String, idNumber: String, phone: String, password: String) {
        // The endpoint returns the created profile; we discard it and the caller follows up with login().
        postJson<RegisterPublicRequest, JsonObject>(
            path = "/users/register",
            body = RegisterPublicRequest(
                name = name,
                email = email,
                idNumber = idNumber,
                phone = phone,
                password = password
            ),
            accessToken = null
        )
    }

    suspend fun loginUser(identifier: String, password: String): AuthEnvelopeDto {
        val trimmed = identifier.trim()
        val isEmail = trimmed.contains('@')
        return postJson(
            path = "/users/login",
            body = LoginRequest(
                idNumber = if (isEmail) null else trimmed,
                email = if (isEmail) trimmed.lowercase() else null,
                password = password
            ),
            accessToken = null
        )
    }

    suspend fun loginMaster(username: String, password: String): AuthEnvelopeDto =
        postJson("/master/login", MasterLoginRequest(username, password), accessToken = null)

    suspend fun signInWithGoogle(idToken: String): AuthEnvelopeDto =
        postJson("/users/google", GoogleSignInRequest(idToken), accessToken = null)

    suspend fun fetchMe(accessToken: String): MeEnvelopeDto = getJson("/me", accessToken)

    suspend fun refreshUserToken(refreshToken: String): AuthEnvelopeDto =
        postJson("/users/refresh", RefreshTokenRequest(refreshToken), accessToken = null)

    suspend fun refreshMasterToken(refreshToken: String): AuthEnvelopeDto =
        postJson("/master/refresh", RefreshTokenRequest(refreshToken), accessToken = null)

    suspend fun logout(session: UserSession) {
        val path = if (session.auth.authType.equals("master", ignoreCase = true)) {
            "/master/logout"
        } else {
            "/users/logout"
        }
        postJson<Unit, LogoutEnvelopeDto>(path, body = null, accessToken = session.accessToken)
    }

    suspend fun registerDevice(
        token: String,
        accessToken: String,
        appVersion: String? = BuildConfig.VERSION_NAME,
        deviceId: String? = token.takeLast(12),
        deviceName: String? = listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.joinToString(" "),
        notificationsEnabled: Boolean = true
    ) {
        postJson<RegisterDeviceRequest, LogoutEnvelopeDto>(
            "/devices/register",
            RegisterDeviceRequest(
                token = token,
                appVersion = appVersion,
                deviceId = deviceId,
                deviceName = deviceName,
                notificationsEnabled = notificationsEnabled
            ),
            accessToken
        )
    }

    suspend fun unregisterDevice(token: String, accessToken: String) {
        postJson<UnregisterDeviceRequest, LogoutEnvelopeDto>(
            "/devices/unregister",
            UnregisterDeviceRequest(token),
            accessToken
        )
    }

    // ---------------------------------------------------------------------------------------
    // Reports
    // ---------------------------------------------------------------------------------------

    suspend fun fetchReportsForUser(userId: String, accessToken: String): List<IssueReport> =
        getJsonArray("/reports/user/$userId", accessToken).map(::mapReport)

    suspend fun fetchAllReports(accessToken: String): List<IssueReport> =
        getJsonArray("/reports", accessToken).map(::mapReport)

    suspend fun fetchPublicStatusBoard(): PublicStatusBoard {
        val dto: PublicStatusBoardDto = getJson("/reports/public/status", accessToken = null)
        return PublicStatusBoard(
            generatedAt = parseIsoMillis(dto.generatedAt) ?: System.currentTimeMillis(),
            summary = PublicStatusSummary(
                total = dto.summary.total,
                open = dto.summary.open,
                pending = dto.summary.pending,
                resolved = dto.summary.resolved,
                urgent = dto.summary.urgent,
                cleaners = dto.summary.cleaners,
                availableCleaners = dto.summary.availableCleaners,
                busyCleaners = dto.summary.busyCleaners
            ),
            reports = dto.reports.map { report ->
                PublicStatusReportItem(
                    backendObjectId = report.id,
                    id = report.publicId ?: report.id,
                    status = IssueStatus.fromApi(report.status),
                    priority = IssuePriority.fromApi(report.priority),
                    category = report.category,
                    location = report.location,
                    details = report.details,
                    assignedTo = report.assignedTo,
                    submittedAt = parseIsoMillis(report.timestamp) ?: System.currentTimeMillis(),
                    resolutionTimestamp = parseIsoMillis(report.resolutionTimestamp)
                )
            },
            cleaners = dto.cleaners.map { cleaner ->
                PublicStatusCleaner(
                    backendObjectId = cleaner.id,
                    name = cleaner.name,
                    workLocation = cleaner.workLocation,
                    status = cleaner.status,
                    assignedTaskId = cleaner.assignedTaskId
                )
            }
        )
    }

    suspend fun fetchNotificationHistory(accessToken: String, limit: Int = 20): List<NotificationEvent> {
        val path = withQueryParams("/notifications", mapOf("limit" to limit.toString()))
        return getJsonArray(path, accessToken).map(::mapNotificationEvent)
    }

    suspend fun fetchReport(id: String, accessToken: String): IssueReport {
        val raw: JsonObject = getJson("/reports/$id", accessToken)
        return mapReport(raw)
    }

    suspend fun createReport(
        id: String,
        category: String,
        location: String,
        details: String,
        priority: IssuePriority,
        coordinates: ReportCoordinate?,
        reporterPhone: String?,
        accessToken: String
    ): IssueReport {
        val body = CreateReportRequest(
            id = id,
            status = IssueStatus.Reported.apiValue,
            timestamp = isoNow(),
            priority = priority.label,
            category = category,
            location = location,
            details = details,
            coordinates = coordinates?.let { CoordinatesDto(it.lat, it.lng) },
            reporterPhone = reporterPhone
        )
        val raw: JsonObject = postJson("/reports", body, accessToken)
        return mapReport(raw)
    }

    suspend fun resolveReport(
        reportId: String,
        accessToken: String,
        resolutionCoordinate: ReportCoordinate? = null
    ): IssueReport {
        val body = ResolveReportRequest(
            status = IssueStatus.AwaitingEndorsement.apiValue,
            resolutionTimestamp = isoNow(),
            resolutionCoordinates = resolutionCoordinate?.let { CoordinatesDto(it.lat, it.lng) }
        )
        val raw: JsonObject = putJson("/reports/$reportId", body, accessToken)
        return mapReport(raw)
    }

    suspend fun updateReport(
        reportId: String,
        status: String? = null,
        assignedTo: String? = null,
        assignedToCleanerId: String? = null,
        resolutionPhoto: String? = null,
        resolutionTimestamp: String? = null,
        resolutionCoordinates: ReportCoordinate? = null,
        reviewNotes: String? = null,
        accessToken: String
    ): IssueReport {
        val raw: JsonObject = putJson(
            "/reports/$reportId",
            UpdateReportRequest(
                status = status,
                assignedTo = assignedTo,
                assignedToCleanerId = assignedToCleanerId,
                resolutionPhoto = resolutionPhoto,
                resolutionTimestamp = resolutionTimestamp,
                resolutionCoordinates = resolutionCoordinates?.let { CoordinatesDto(it.lat, it.lng) },
                reviewNotes = reviewNotes
            ),
            accessToken
        )
        return mapReport(raw)
    }

    // ---------------------------------------------------------------------------------------
    // Photos: presign → bucket PUT → confirm
    // ---------------------------------------------------------------------------------------

    suspend fun presignReportPhoto(
        reportId: String,
        kind: String,
        contentType: String,
        contentLength: Long,
        accessToken: String
    ): PresignPhotoResponseDto =
        postJson(
            path = "/reports/$reportId/photos/presign",
            body = PresignPhotoRequest(kind = kind, contentType = contentType, contentLength = contentLength),
            accessToken = accessToken
        )

    /** Direct-to-bucket upload. No `Authorization` and no `X-Tenant-Slug` headers — the URL is signed. */
    suspend fun uploadPresignedPhoto(presigned: PresignPhotoResponseDto, bytes: ByteArray, contentType: String) {
        val mediaType = contentType.toMediaType()
        val builder = Request.Builder()
            .url(presigned.uploadUrl)
            .method(presigned.method, bytes.toRequestBody(mediaType))
        presigned.headers.forEach { (name, value) -> builder.header(name, value) }
        if (presigned.headers.keys.none { it.equals("Content-Type", ignoreCase = true) }) {
            builder.header("Content-Type", contentType)
        }
        executeExpectingSuccess(builder.build())
    }

    suspend fun confirmReportPhoto(
        reportId: String,
        key: String,
        kind: String,
        timestamp: String?,
        accessToken: String
    ): IssueReport {
        val raw: JsonObject = postJson(
            path = "/reports/$reportId/photos/confirm",
            body = ConfirmPhotoRequest(key = key, kind = kind, timestamp = timestamp ?: isoNow()),
            accessToken = accessToken
        )
        return mapReport(raw)
    }

    suspend fun uploadLegacyReportPhoto(
        reportId: String,
        kind: String,
        dataUrl: String,
        timestamp: String? = null,
        accessToken: String
    ): IssueReport {
        val raw: JsonObject = postJson(
            path = "/reports/$reportId/photos",
            body = UploadPhotoRequest(kind = kind, dataUrl = dataUrl, timestamp = timestamp ?: isoNow()),
            accessToken = accessToken
        )
        return mapReport(raw)
    }

    /** One-shot presign → PUT → confirm helper, mirrors `SpotFixAPIClient.uploadReportPhoto(image:…)`. */
    suspend fun uploadReportPhoto(
        reportId: String,
        kind: String,
        bytes: ByteArray,
        contentType: String,
        accessToken: String
    ): IssueReport {
        return runCatching {
            withTimeout(PHOTO_DIRECT_UPLOAD_TIMEOUT_MS) {
                val presigned = presignReportPhoto(reportId, kind, contentType, bytes.size.toLong(), accessToken)
                uploadPresignedPhoto(presigned, bytes, contentType)
                confirmReportPhoto(reportId, presigned.key, kind, isoNow(), accessToken)
            }
        }.getOrElse {
            withTimeout(PHOTO_LEGACY_UPLOAD_TIMEOUT_MS) {
                val dataUrl = "data:$contentType;base64,${Base64.getEncoder().encodeToString(bytes)}"
                uploadLegacyReportPhoto(reportId, kind, dataUrl, isoNow(), accessToken)
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Cleaners / supervisors
    // ---------------------------------------------------------------------------------------

    suspend fun fetchCleaners(
        accessToken: String,
        supervisorId: String? = null,
        workLocation: String? = null
    ): List<WorkforceMember> {
        val path = withQueryParams(
            "/cleaners",
            mapOf(
                "supervisorId" to supervisorId,
                "workLocation" to workLocation
            )
        )
        val rows = getJsonArray(path, accessToken)
        return rows.map { mapWorkforce(it) }
    }

    suspend fun fetchSupervisorCleaners(supervisorId: String, accessToken: String): List<WorkforceMember> {
        val rows = getJsonArray("/supervisors/$supervisorId/cleaners", accessToken)
        return rows.map { mapWorkforce(it) }
    }

    suspend fun createCleaner(
        name: String,
        workId: String,
        phone: String? = null,
        workLocation: String? = null,
        supervisorId: String? = null,
        accessToken: String
    ): WorkforceMember {
        val raw: JsonObject = postJson(
            path = "/cleaners",
            body = CreateCleanerRequest(
                name = name,
                workId = workId,
                phone = phone,
                workLocation = workLocation,
                supervisorId = supervisorId
            ),
            accessToken = accessToken
        )
        return mapWorkforce(raw)
    }

    suspend fun reassignCleanerSupervisor(
        cleanerId: String,
        supervisorId: String?,
        accessToken: String
    ): WorkforceMember {
        val raw: JsonObject = patchJson(
            path = "/cleaners/$cleanerId/supervisor",
            body = ReassignSupervisorRequest(supervisorId),
            accessToken = accessToken
        )
        return mapWorkforce(raw)
    }

    suspend fun assignCleaner(cleanerId: String, reportId: String, accessToken: String): WorkforceMember {
        val raw: JsonObject = postJson(
            path = "/cleaners/$cleanerId/assign",
            body = AssignCleanerRequest(reportId = reportId),
            accessToken = accessToken
        )
        return mapWorkforce(raw)
    }

    suspend fun provisionUser(
        name: String,
        idNumber: String,
        phone: String,
        password: String,
        role: String,
        workLocation: String?,
        email: String?,
        accessToken: String
    ): org.spotfix.community.model.SessionProfile {
        return postJson(
            path = "/users/provision",
            body = ProvisionUserRequest(
                name = name,
                idNumber = idNumber,
                phone = phone,
                password = password,
                role = role,
                workLocation = workLocation,
                email = email
            ),
            accessToken = accessToken
        )
    }

    suspend fun fetchUsers(accessToken: String): List<org.spotfix.community.model.SessionProfile> =
        getJson("/users", accessToken)

    suspend fun fetchUser(userId: String, accessToken: String): org.spotfix.community.model.SessionProfile =
        getJson("/users/$userId", accessToken)

    suspend fun createMaster(username: String, password: String, name: String, accessToken: String) {
        postJson<CreateMasterRequest, JsonObject>(
            path = "/master/create",
            body = CreateMasterRequest(username = username, password = password, name = name),
            accessToken = accessToken
        )
    }

    // ---------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------

    private suspend inline fun <reified T> getJson(path: String, accessToken: String?): T {
        val request = baseRequest(path, accessToken).get().build()
        return decode(execute(request))
    }

    private suspend fun getJsonArray(path: String, accessToken: String?): List<JsonObject> {
        val request = baseRequest(path, accessToken).get().build()
        val body = execute(request)
        val element = json.parseToJsonElement(body)
        return element.jsonArray.map { it.jsonObject }
    }

    private suspend inline fun <reified Req, reified Res> postJson(
        path: String,
        body: Req?,
        accessToken: String?
    ): Res {
        val builder = baseRequest(path, accessToken)
        builder.post(toRequestBody(body))
        return decode(execute(builder.build()))
    }

    private suspend inline fun <reified Req, reified Res> putJson(
        path: String,
        body: Req?,
        accessToken: String?
    ): Res {
        val builder = baseRequest(path, accessToken)
        builder.put(toRequestBody(body))
        return decode(execute(builder.build()))
    }

    private suspend inline fun <reified Req, reified Res> patchJson(
        path: String,
        body: Req?,
        accessToken: String?
    ): Res {
        val builder = baseRequest(path, accessToken)
        builder.patch(toRequestBody(body))
        return decode(execute(builder.build()))
    }

    private inline fun <reified T> toRequestBody(body: T?): RequestBody {
        if (body == null || body is Unit) {
            return ByteArray(0).toRequestBody(jsonMediaType)
        }
        val text = json.encodeToString(kotlinx.serialization.serializer<T>(), body)
        return text.toRequestBody(jsonMediaType)
    }

    private inline fun <reified T> decode(text: String): T {
        if (text.isBlank()) {
            // Some endpoints (logout, no-op confirms) may return empty bodies; only safe for nullable T.
            @Suppress("UNCHECKED_CAST")
            return Unit as T
        }
        return json.decodeFromString(kotlinx.serialization.serializer<T>(), text)
    }

    private fun baseRequest(path: String, accessToken: String?): Request.Builder {
        val url = if (path.isEmpty() || path == "/") baseUrl else "${baseUrl.trimEnd('/')}$path"
        val builder = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", "spotfix-community-android/0.1")
        tenantSlug?.let { builder.header("X-Tenant-Slug", it) }
        accessToken?.let { builder.header("Authorization", "Bearer $it") }
        return builder
    }

    private fun withQueryParams(path: String, params: Map<String, String?>): String {
        val cleanPath = if (path.startsWith("/")) path else "/$path"
        val url = "https://spotfix.local$cleanPath".toHttpUrlOrNull() ?: return cleanPath
        val builder = url.newBuilder()
        params.forEach { (key, value) ->
            if (!value.isNullOrBlank()) {
                builder.addQueryParameter(key, value)
            }
        }
        val encoded = builder.build().encodedPath
        val query = builder.build().encodedQuery
        return if (query.isNullOrBlank()) encoded else "$encoded?$query"
    }

    private suspend fun execute(request: Request): String = withContext(Dispatchers.IO) {
        suspendCancellableCoroutine { cont ->
            val call = client.newCall(request)
            cont.invokeOnCancellation { runCatching { call.cancel() } }
            call.enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    cont.resumeWithException(SpotFixApiException(message = e.message ?: "Network error", cause = e))
                }

                override fun onResponse(call: okhttp3.Call, response: Response) {
                    response.use { handleResponse(it, cont) }
                }
            })
        }
    }

    private suspend fun executeExpectingSuccess(request: Request) = withContext(Dispatchers.IO) {
        suspendCancellableCoroutine { cont ->
            val call = client.newCall(request)
            cont.invokeOnCancellation { runCatching { call.cancel() } }
            call.enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    if (cont.isActive) {
                        cont.resumeWithException(SpotFixApiException(message = e.message ?: "Network error", cause = e))
                    }
                }

                override fun onResponse(call: okhttp3.Call, response: Response) {
                    response.use {
                        if (it.isSuccessful) {
                            if (cont.isActive) cont.resume(Unit)
                            return
                        }
                        if (cont.isActive) {
                            cont.resumeWithException(
                                SpotFixApiException(
                                    message = "Upload failed (${it.code})",
                                    status = it.code
                                )
                            )
                        }
                    }
                }
            })
        }
    }

    private fun handleResponse(
        response: Response,
        cont: kotlinx.coroutines.CancellableContinuation<String>
    ) {
        val body = response.body?.string().orEmpty()
        if (response.isSuccessful) {
            cont.resume(body)
            return
        }
        val parsed = runCatching { json.decodeFromString(ErrorEnvelopeDto.serializer(), body) }.getOrNull()
        val message = parsed?.error?.message ?: body.takeIf { it.isNotBlank() } ?: "HTTP ${response.code}"
        cont.resumeWithException(
            SpotFixApiException(
                message = message,
                status = response.code,
                code = parsed?.error?.code,
                requestId = parsed?.error?.requestId,
                headers = response.headers
            )
        )
    }

    // ---------------------------------------------------------------------------------------
    // Mappers (raw JsonObject → domain model)
    // ---------------------------------------------------------------------------------------

    private fun mapReport(node: JsonObject): IssueReport {
        fun str(vararg keys: String): String? {
            for (key in keys) {
                val value = node[key]?.takeIf { it !is kotlinx.serialization.json.JsonNull }
                if (value != null) return runCatching { value.jsonPrimitive.contentOrNull() }.getOrNull()
            }
            return null
        }

        val coordinatesNode = node["coordinates"] as? JsonObject
        val coordinates = coordinatesNode?.let {
            ReportCoordinate(
                lat = (it["lat"] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()?.toDoubleOrNull(),
                lng = (it["lng"] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()?.toDoubleOrNull()
            )
        }
        val resolutionCoordinatesNode = node["resolutionCoordinates"] as? JsonObject
        val resolutionCoordinates = resolutionCoordinatesNode?.let {
            ReportCoordinate(
                lat = (it["lat"] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()?.toDoubleOrNull(),
                lng = (it["lng"] as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()?.toDoubleOrNull()
            )
        }

        val photos = (node["photos"] as? kotlinx.serialization.json.JsonArray)
            ?.toList()
            .orEmpty()
        val evidenceFromPhotos = photos
            .mapNotNull { it as? JsonObject }
            .firstOrNull { (it["kind"]?.jsonPrimitive?.contentOrNull() ?: "") == "evidence" }
            ?.get("url")?.jsonPrimitive?.contentOrNull()
        val resolutionFromPhotos = photos
            .mapNotNull { it as? JsonObject }
            .firstOrNull { (it["kind"]?.jsonPrimitive?.contentOrNull() ?: "") == "resolution" }
            ?.get("url")?.jsonPrimitive?.contentOrNull()
        val extraPhotoUrls = photos.mapNotNull { photo ->
            when (photo) {
                is JsonObject -> photo["url"]?.jsonPrimitive?.contentOrNull()
                is kotlinx.serialization.json.JsonPrimitive -> photo.contentOrNull()
                else -> null
            }
        }

        return IssueReport(
            backendObjectId = str("_id"),
            id = str("id", "publicId", "_id") ?: "",
            category = str("category") ?: "Issue",
            location = str("location") ?: "",
            details = str("details", "description") ?: "",
            status = IssueStatus.fromApi(str("status")),
            priority = IssuePriority.fromApi(str("priority")),
            assignedTo = str("assignedTo"),
            reporterName = str("reporterName") ?: "",
            reporterPhone = str("reporterPhone"),
            submittedAt = parseIsoMillis(str("timestamp", "submittedAt", "createdAt")) ?: System.currentTimeMillis(),
            coordinates = coordinates,
            assignedToCleanerId = str("assignedToCleanerId"),
            assignedBySupervisorId = str("assignedBySupervisorId"),
            assignedBySupervisorName = str("assignedBySupervisorName"),
            evidencePhotoUrl = str("evidencePhoto") ?: evidenceFromPhotos,
            resolutionPhotoUrl = str("resolutionPhoto") ?: resolutionFromPhotos,
            extraPhotoUrls = extraPhotoUrls,
            resolutionCoordinates = resolutionCoordinates,
            resolutionDistanceMeters = str("resolutionDistanceMeters")?.toDoubleOrNull(),
            reviewedAt = parseIsoMillis(str("reviewedAt")),
            reviewedBySupervisorName = str("reviewedBySupervisorName"),
            reviewNotes = str("reviewNotes"),
            isRejected = str("status")?.trim()?.equals("Rejected", ignoreCase = true) == true
        )
    }

    private fun mapNotificationEvent(node: JsonObject): NotificationEvent {
        val dto = json.decodeFromJsonElement(NotificationEventDto.serializer(), node)
        return NotificationEvent(
            id = dto.id,
            reportId = dto.reportId,
            type = dto.type,
            title = dto.title,
            body = dto.body,
            isCritical = dto.isCritical,
            createdAt = parseIsoMillis(dto.createdAt) ?: System.currentTimeMillis(),
            payload = dto.payload.mapNotNull { (key, value) ->
                value.jsonPrimitive.contentOrNull()?.let { key to it }
            }.toMap()
        )
    }

    private fun mapWorkforce(node: JsonObject): WorkforceMember = mapWorkforce(
        json.decodeFromJsonElement(WorkforceMemberDto.serializer(), node)
    )

    private fun mapWorkforce(dto: WorkforceMemberDto): WorkforceMember = WorkforceMember(
        backendId = dto.internalId,
        id = dto.id ?: dto.publicId ?: dto.internalId ?: "",
        name = dto.name ?: dto.username ?: "Cleaner",
        workId = dto.workId ?: dto.publicId ?: "",
        phone = dto.phone ?: "",
        isBusy = dto.isBusy ?: false,
        assignedTaskId = dto.assignedTaskId,
        supervisorName = dto.supervisorName,
        busyUntil = parseIsoMillis(dto.busyUntil)
    )

    private fun parseIsoMillis(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        for (formatter in iso8601Formatters) {
            runCatching { return formatter.parse(value)?.time }
        }
        return null
    }

    private fun isoNow(): String = iso8601Formatters.first().format(Date())

    private fun kotlinx.serialization.json.JsonElement.contentOrNullSafe(): String? = runCatching {
        (this as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()
    }.getOrNull()

    private fun kotlinx.serialization.json.JsonPrimitive.contentOrNull(): String? =
        if (this.isString) this.content else this.content.takeIf { it.isNotEmpty() }

    companion object {
        private val iso8601Formatters: List<SimpleDateFormat> = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            },
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
        )
        private const val PHOTO_DIRECT_UPLOAD_TIMEOUT_MS = 20_000L
        private const val PHOTO_LEGACY_UPLOAD_TIMEOUT_MS = 25_000L

        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(40, TimeUnit.SECONDS)
            .writeTimeout(40, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
                .apply {
                    if (BuildConfig.DEBUG) {
                        addInterceptor(
                            HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY }
                        )
                    }
                }
            .build()
    }
}

class SpotFixApiException(
    message: String,
    val status: Int? = null,
    val code: String? = null,
    val requestId: String? = null,
    val headers: Headers? = null,
    cause: Throwable? = null
) : RuntimeException(message, cause)
