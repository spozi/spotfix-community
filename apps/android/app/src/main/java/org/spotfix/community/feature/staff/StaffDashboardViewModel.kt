package org.spotfix.community.feature.staff

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.AppRole
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.UserSession
import org.spotfix.community.model.WorkforceMember
import org.spotfix.community.model.ReportCoordinate
import org.spotfix.community.support.startPolling

data class ResolvePhotoAttachment(
    val bytes: ByteArray,
    val contentType: String = "image/jpeg"
)

internal fun normalizedResolutionAttachments(
    attachments: List<ResolvePhotoAttachment>
): List<ResolvePhotoAttachment> = attachments.take(StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS)

internal fun dashboardReportsForRole(role: AppRole, reports: List<IssueReport>): List<IssueReport> =
    when (role) {
        // `/reports` is already scoped on the API for cleaners via the linked cleaner roster id.
        // Re-filtering on Android by `session.auth.userId` hides valid assignments.
        AppRole.Cleaner -> reports
        else -> reports
    }

internal fun supervisorReviewReports(reports: List<IssueReport>): List<IssueReport> =
    reports.filter { it.status == IssueStatus.AwaitingEndorsement }

/**
 * Mirrors the original iOS client.
 *
 * Cleaners see only their own active work; supervisors see everything plus the cleaner roster.
 */
class StaffDashboardViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession,
    private val role: AppRole,
    private val canManageWorkforce: Boolean
) : ViewModel() {

    data class State(
        val reports: List<IssueReport> = emptyList(),
        val workforce: List<WorkforceMember> = emptyList(),
        val isLoading: Boolean = false,
        val errorMessage: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
        startPolling { refresh(silent = true) }
    }

    fun clearError() {
        _state.update { it.copy(errorMessage = null) }
    }

    fun refresh(silent: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = if (silent && (it.reports.isNotEmpty() || it.workforce.isNotEmpty())) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null
                )
            }
            try {
                val reports = apiClient.fetchAllReports(session.accessToken)
                val filtered = dashboardReportsForRole(role, reports)
                val workforceResult = if (canManageWorkforce) {
                    runCatching {
                        if (role == AppRole.Supervisor) {
                            apiClient.fetchSupervisorCleaners(session.auth.userId, session.accessToken)
                                .ifEmpty { apiClient.fetchCleaners(session.accessToken, supervisorId = session.auth.userId) }
                        } else {
                            apiClient.fetchCleaners(session.accessToken)
                        }
                    }
                } else {
                    Result.success(emptyList())
                }

                val workforce = workforceResult.getOrDefault(emptyList())
                val workforceError = workforceResult.exceptionOrNull()?.message
                _state.update {
                    it.copy(
                        reports = filtered,
                        workforce = workforce,
                        isLoading = false,
                        errorMessage = workforceError
                    )
                }
            } catch (e: Throwable) {
                // Keep whatever real data we already have; do NOT swap in SampleData
                // because it masks real backend issues (e.g. a transient auth or network
                // failure on a poll) and makes new server-side reports look like they
                // never arrived. AppViewModel handles SESSION_REVOKED globally.
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message
                    )
                }
            }
        }
    }

    fun assignCleaner(reportId: String, cleanerObjectId: String, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            _state.update { it.copy(errorMessage = null) }
            try {
                apiClient.assignCleaner(cleanerObjectId, reportId, session.accessToken)
                refresh()
                onSuccess()
            } catch (e: Throwable) {
                _state.update {
                    it.copy(errorMessage = e.message ?: "Unable to assign cleaner right now.")
                }
            }
        }
    }

    fun resolveReport(report: IssueReport, photoBytes: ByteArray? = null) {
        resolveReport(
            report = report,
            attachments = photoBytes?.let { listOf(ResolvePhotoAttachment(it)) }.orEmpty(),
            resolutionCoordinate = null
        )
    }

    fun resolveReport(
        report: IssueReport,
        attachments: List<ResolvePhotoAttachment>,
        resolutionCoordinate: ReportCoordinate?
    ) {
        viewModelScope.launch {
            _state.update { it.copy(errorMessage = null) }
            // Photo uploads are best-effort. If one fails we still flip the status to
            // "Awaiting Endorsement" so the supervisor can see the submission and the
            // cleaner is not silently stuck at "Assigned". Failed photos are surfaced
            // as a non-fatal warning the cleaner can retry.
            val photoFailures = mutableListOf<Throwable>()
            normalizedResolutionAttachments(attachments).forEachIndexed { index, attachment ->
                runCatching {
                    apiClient.uploadReportPhoto(
                        reportId = report.id,
                        kind = if (index == 0) "resolution" else "extra",
                        bytes = attachment.bytes,
                        contentType = attachment.contentType,
                        accessToken = session.accessToken
                    )
                }.onFailure { photoFailures += it }
            }
            try {
                apiClient.resolveReport(report.id, session.accessToken, resolutionCoordinate)
            } catch (e: Throwable) {
                _state.update {
                    it.copy(errorMessage = e.message ?: "Unable to submit resolution. Please try again.")
                }
                return@launch
            }
            refresh()
            if (photoFailures.isNotEmpty()) {
                val detail = photoFailures.first().message?.takeIf { it.isNotBlank() }
                    ?: "Some photos could not be uploaded."
                _state.update {
                    it.copy(
                        errorMessage = "Resolution submitted, but ${photoFailures.size} photo(s) failed to upload: $detail"
                    )
                }
            }
        }
    }

    fun reviewResolution(report: IssueReport, endorse: Boolean, reviewNotes: String?, onSuccess: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                _state.update { it.copy(errorMessage = null) }
                apiClient.updateReport(
                    reportId = report.id,
                    status = if (endorse) IssueStatus.Resolved.label else "Rejected",
                    reviewNotes = reviewNotes?.trim()?.takeIf { it.isNotEmpty() },
                    accessToken = session.accessToken
                )
                refresh()
                onSuccess()
            } catch (e: Throwable) {
                _state.update { it.copy(errorMessage = e.message) }
            }
        }
    }

    companion object {
        const val MAX_RESOLUTION_PHOTOS = 6
    }
}
