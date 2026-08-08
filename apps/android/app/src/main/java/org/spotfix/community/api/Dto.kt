package org.spotfix.community.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import org.spotfix.community.model.SessionAuthContext
import org.spotfix.community.model.SessionProfile

/**
 * Wire-format DTOs used directly by [SpotFixApiClient].
 *
 * These mirror the schemas in `apps/api/src/openapi/schemas.ts` and the request shapes in
 * `apps/api/src/http/schemas.ts`. The API tolerates additional/loose fields on report objects, so
 * [ReportDto] uses passthrough JSON for unknown keys.
 */

@Serializable
data class ApiServiceStatusDto(
    val name: String? = null,
    val version: String? = null,
    val mode: String? = null
)

@Serializable
data class PublicStatusSummaryDto(
    val total: Int,
    val open: Int,
    val pending: Int,
    val resolved: Int,
    val urgent: Int,
    val cleaners: Int,
    val availableCleaners: Int,
    val busyCleaners: Int
)

@Serializable
data class PublicStatusReportDto(
    @SerialName("_id") val id: String,
    @SerialName("id") val publicId: String? = null,
    val status: String,
    val timestamp: String,
    val priority: String,
    val category: String? = null,
    val location: String? = null,
    val details: String? = null,
    val assignedTo: String? = null,
    val resolutionTimestamp: String? = null
)

@Serializable
data class PublicStatusCleanerDto(
    @SerialName("_id") val id: String,
    val name: String,
    val workLocation: String? = null,
    val status: String,
    val assignedTaskId: String? = null
)

@Serializable
data class PublicStatusBoardDto(
    val generatedAt: String,
    val summary: PublicStatusSummaryDto,
    val reports: List<PublicStatusReportDto> = emptyList(),
    val cleaners: List<PublicStatusCleanerDto> = emptyList()
)

@Serializable
data class AuthEnvelopeDto(
    val accessToken: String,
    val refreshToken: String? = null,
    val tokenType: String? = "Bearer",
    val expiresIn: String? = null,
    val refreshExpiresIn: String? = null,
    val auth: SessionAuthContext? = null,
    val profile: SessionProfile? = null
)

@Serializable
data class MeEnvelopeDto(
    val authenticated: Boolean,
    val auth: SessionAuthContext,
    val permissions: List<String>,
    val profile: SessionProfile
)

@Serializable
internal data class ErrorEnvelopeDto(val error: ErrorBody? = null) {
    @Serializable
    data class ErrorBody(
        val code: String? = null,
        val message: String? = null,
        val requestId: String? = null,
        val details: JsonElement? = null
    )
}

@Serializable
internal data class LoginRequest(
    val idNumber: String? = null,
    val email: String? = null,
    val password: String
)

@Serializable
internal data class RegisterPublicRequest(
    val name: String,
    val email: String,
    val idNumber: String,
    val phone: String,
    val password: String,
    val role: String = "public"
)

@Serializable
internal data class MasterLoginRequest(val username: String, val password: String)

@Serializable
internal data class GoogleSignInRequest(val idToken: String)

@Serializable
internal data class RefreshTokenRequest(val refreshToken: String)

@Serializable
internal data class RegisterDeviceRequest(
    val token: String,
    val platform: String = "android",
    val appVersion: String? = null,
    val deviceId: String? = null,
    val deviceName: String? = null,
    val notificationsEnabled: Boolean = true
)

@Serializable
internal data class UnregisterDeviceRequest(val token: String)

@Serializable
internal data class ProvisionUserRequest(
    val name: String,
    val idNumber: String,
    val phone: String,
    val password: String,
    val role: String,
    val workLocation: String? = null,
    val email: String? = null
)

@Serializable
internal data class AssignCleanerRequest(val reportId: String)

@Serializable
internal data class CreateCleanerRequest(
    val name: String,
    val workId: String,
    val phone: String? = null,
    val workLocation: String? = null,
    val supervisorId: String? = null
)

@Serializable
internal data class ReassignSupervisorRequest(val supervisorId: String? = null)

@Serializable
internal data class CreateMasterRequest(
    val username: String,
    val password: String,
    val name: String
)

@Serializable
internal data class CoordinatesDto(val lat: Double? = null, val lng: Double? = null)

@Serializable
internal data class CreateReportRequest(
    val id: String,
    val status: String,
    val timestamp: String,
    val priority: String,
    val category: String,
    val location: String,
    val details: String,
    val coordinates: CoordinatesDto? = null,
    val reporterPhone: String? = null,
    val photos: List<JsonElement> = emptyList()
)

@Serializable
internal data class ResolveReportRequest(
    val status: String,
    val resolutionPhoto: String? = null,
    val resolutionTimestamp: String? = null,
    val resolutionCoordinates: CoordinatesDto? = null
)

@Serializable
internal data class UpdateReportRequest(
    val status: String? = null,
    val assignedTo: String? = null,
    val assignedToCleanerId: String? = null,
    val resolutionPhoto: String? = null,
    val resolutionTimestamp: String? = null,
    val resolutionCoordinates: CoordinatesDto? = null,
    val reviewNotes: String? = null
)

@Serializable
internal data class PresignPhotoRequest(
    val kind: String,
    val contentType: String,
    val contentLength: Long
)

@Serializable
data class PresignPhotoResponseDto(
    val key: String,
    val uploadUrl: String,
    val method: String = "PUT",
    val headers: Map<String, String> = emptyMap(),
    val expiresIn: Int
)

@Serializable
internal data class ConfirmPhotoRequest(
    val key: String,
    val kind: String,
    val timestamp: String? = null
)

@Serializable
internal data class UploadPhotoRequest(
    val kind: String,
    val dataUrl: String,
    val timestamp: String? = null
)

/**
 * Reports come back as loose JSON objects (legacy fields, snake/camel mix). We keep the raw
 * [JsonObject] and let [org.spotfix.community.api.ReportDtoMapper] parse the fields we actually use.
 */
@Serializable
internal data class WorkforceMemberDto(
    @SerialName("_id") val internalId: String? = null,
    val id: String? = null,
    val publicId: String? = null,
    val name: String? = null,
    val workId: String? = null,
    val username: String? = null,
    val phone: String? = null,
    val isBusy: Boolean? = null,
    val assignedTaskId: String? = null,
    val supervisorName: String? = null,
    val busyUntil: String? = null
)

@Serializable
internal data class NotificationEventDto(
    @SerialName("_id") val id: String,
    val reportId: String? = null,
    val type: String,
    val title: String,
    val body: String,
    val isCritical: Boolean = false,
    val createdAt: String,
    val payload: Map<String, JsonElement> = emptyMap()
)

@Serializable
internal data class LogoutEnvelopeDto(val success: Boolean = true)
