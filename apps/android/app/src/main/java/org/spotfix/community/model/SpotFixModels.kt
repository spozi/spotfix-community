package org.spotfix.community.model

import androidx.compose.ui.graphics.Color
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import org.spotfix.community.designsystem.SpotFixColors

/**
 * Domain models mirrored from the original iOS client.
 * Wire-compatible JSON shapes (request/response) live in [org.spotfix.community.api.dto].
 */

@Serializable
data class SessionAuthContext(
    val userId: String,
    val role: String,
    val name: String,
    val authType: String
)

@Serializable
data class SessionProfile(
    @SerialName("_id") val id: String,
    val name: String,
    val username: String? = null,
    val idNumber: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val role: String? = null,
    val verified: Boolean? = null,
    val registeredAt: String? = null,
    val lastLoginAt: String? = null,
    val loginCount: Int? = null,
    val status: String? = null,
    val createdAt: String? = null,
    val authProvider: String? = null
)

/** Persisted to EncryptedSharedPreferences (mirror of the iOS Keychain blob). */
@Serializable
data class UserSession(
    val accessToken: String,
    val refreshToken: String? = null,
    val tokenType: String = "Bearer",
    val expiresIn: String? = null,
    val refreshExpiresIn: String? = null,
    val auth: SessionAuthContext,
    val permissions: List<String>,
    val profile: SessionProfile
) {
    val appRole: AppRole get() = AppRole.fromApi(auth.role)
}

data class ReportCoordinate(val lat: Double?, val lng: Double?)

enum class IssueStatus(val label: String) {
    Reported("Reported"),
    Assigned("Assigned"),
    InProgress("In Progress"),
    AwaitingEndorsement("Awaiting Endorsement"),
    Rejected("Rejected"),
    Resolved("Resolved");

    /** What the API expects in PUT /reports/{id} status field. */
    val apiValue: String
        get() = when (this) {
            Reported -> "Reported"
            Assigned -> "Assigned"
            InProgress -> "In Progress"
            AwaitingEndorsement -> "Awaiting Endorsement"
            Rejected -> "Rejected"
            Resolved -> "Resolved"
        }

    val color: Color
        get() = when (this) {
            Reported -> SpotFixColors.info
            Assigned -> SpotFixColors.secondary
            InProgress -> SpotFixColors.warning
            AwaitingEndorsement -> SpotFixColors.primary
            Rejected -> SpotFixColors.danger
            Resolved -> SpotFixColors.success
        }

    companion object {
        fun fromApi(value: String?): IssueStatus =
            when (value?.trim()?.lowercase()) {
                "assigned" -> Assigned
                "in progress", "inprogress" -> InProgress
                "awaiting endorsement", "awaiting_endorsement" -> AwaitingEndorsement
                "rejected" -> Rejected
                "resolved" -> Resolved
                "pending", "reported" -> Reported
                else -> Reported
            }
    }
}

enum class IssuePriority(val label: String) {
    Low("Low"),
    Medium("Medium"),
    High("High"),
    Critical("Critical");

    val color: Color
        get() = when (this) {
            Low -> SpotFixColors.success
            Medium -> SpotFixColors.info
            High -> SpotFixColors.secondary
            Critical -> SpotFixColors.danger
        }

    companion object {
        fun fromApi(value: String?): IssuePriority =
            when (value?.trim()?.lowercase()) {
                "low" -> Low
                "high" -> High
                "critical" -> Critical
                else -> Medium
            }
    }
}

/** Domain-level report record. The wire DTO lives separately so we can absorb the loose schema. */
data class IssueReport(
    val backendObjectId: String?,
    val id: String,
    val category: String,
    val location: String,
    val details: String,
    val status: IssueStatus,
    val priority: IssuePriority,
    val assignedTo: String? = null,
    val reporterName: String,
    val reporterPhone: String? = null,
    val submittedAt: Long, // epoch millis
    val coordinates: ReportCoordinate? = null,
    val assignedToCleanerId: String? = null,
    val assignedBySupervisorId: String? = null,
    val assignedBySupervisorName: String? = null,
    val evidencePhotoUrl: String? = null,
    val resolutionPhotoUrl: String? = null,
    val extraPhotoUrls: List<String> = emptyList(),
    val resolutionCoordinates: ReportCoordinate? = null,
    val resolutionDistanceMeters: Double? = null,
    val reviewedAt: Long? = null,
    val reviewedBySupervisorName: String? = null,
    val reviewNotes: String? = null,
    val isRejected: Boolean = false
)

data class NotificationEvent(
    val id: String,
    val reportId: String? = null,
    val type: String,
    val title: String,
    val body: String,
    val isCritical: Boolean,
    val createdAt: Long,
    val payload: Map<String, String> = emptyMap()
)

data class WorkforceMember(
    val backendId: String?,
    val id: String,
    val name: String,
    val workId: String,
    val phone: String,
    val isBusy: Boolean,
    val assignedTaskId: String?,
    val supervisorName: String?,
    val busyUntil: Long? // epoch millis
)

data class DashboardMetric(
    val title: String,
    val value: String,
    val tint: Color
)

data class PublicStatusSummary(
    val total: Int,
    val open: Int,
    val pending: Int,
    val resolved: Int,
    val urgent: Int,
    val cleaners: Int,
    val availableCleaners: Int,
    val busyCleaners: Int
)

data class PublicStatusReportItem(
    val backendObjectId: String,
    val id: String,
    val status: IssueStatus,
    val priority: IssuePriority,
    val category: String?,
    val location: String?,
    val details: String?,
    val assignedTo: String?,
    val submittedAt: Long,
    val resolutionTimestamp: Long?
)

data class PublicStatusCleaner(
    val backendObjectId: String,
    val name: String,
    val workLocation: String?,
    val status: String,
    val assignedTaskId: String?
)

data class PublicStatusBoard(
    val generatedAt: Long,
    val summary: PublicStatusSummary,
    val reports: List<PublicStatusReportItem>,
    val cleaners: List<PublicStatusCleaner>
)
