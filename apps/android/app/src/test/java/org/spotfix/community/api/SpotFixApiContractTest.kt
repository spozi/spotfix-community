package org.spotfix.community.api

import kotlinx.serialization.json.Json
import kotlinx.coroutines.runBlocking
import org.spotfix.community.model.IssueStatus
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test

class SpotFixApiContractTest {

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    @Test
    fun publicStatusReportDto_readsApiPublicReportIdField() {
        val dto = json.decodeFromString(
            PublicStatusReportDto.serializer(),
            """
                {
                  "_id": "database-row-id",
                  "id": "RPT-100001",
                  "status": "Reported",
                  "timestamp": "2026-05-17T08:00:00.000Z",
                  "priority": "Medium"
                }
            """.trimIndent()
        )

        assertEquals("database-row-id", dto.id)
        assertEquals("RPT-100001", dto.publicId)
    }

    @Test
    fun reportedStatus_postsCanonicalApiValue() {
        assertEquals("Reported", IssueStatus.Reported.apiValue)
    }

    @Test
    fun notificationHistory_doesNotDuplicateApiBasePath() = runBlocking {
        val seenUrls = mutableListOf<String>()
        val api = SpotFixApiClient(
            baseUrl = "https://api.example.test/api/v1",
            tenantSlug = "example-campus",
            httpClient = captureClient(seenUrls, "[]")
        )

        api.fetchNotificationHistory(accessToken = "token", limit = 20)

        assertEquals(
            "https://api.example.test/api/v1/notifications?limit=20",
            seenUrls.single()
        )
    }

    @Test
    fun cleanersQuery_doesNotDuplicateApiBasePath() = runBlocking {
        val seenUrls = mutableListOf<String>()
        val api = SpotFixApiClient(
            baseUrl = "https://api.example.test/api/v1",
            tenantSlug = "example-campus",
            httpClient = captureClient(seenUrls, "[]")
        )

        api.fetchCleaners(
            accessToken = "token",
            supervisorId = "supervisor-1",
            workLocation = "Library Lobby"
        )

        assertEquals(
            "https://api.example.test/api/v1/cleaners?supervisorId=supervisor-1&workLocation=Library%20Lobby",
            seenUrls.single()
        )
    }

    private fun captureClient(seenUrls: MutableList<String>, body: String): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor { chain ->
                seenUrls += chain.request().url.toString()
                Response.Builder()
                    .request(chain.request())
                    .protocol(Protocol.HTTP_1_1)
                    .code(200)
                    .message("OK")
                    .body(body.toResponseBody("application/json".toMediaType()))
                    .build()
            }
            .build()
}
