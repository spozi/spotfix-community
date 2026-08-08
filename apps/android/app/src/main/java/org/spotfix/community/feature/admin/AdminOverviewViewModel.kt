package org.spotfix.community.feature.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.model.DashboardMetric
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.UserSession
import org.spotfix.community.support.startPolling
import org.spotfix.community.support.SampleData

/**
 * Mirrors the original iOS client.
 */
class AdminOverviewViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession
) : ViewModel() {

    data class State(
        val metrics: List<DashboardMetric> = SampleData.adminMetrics,
        val recentReports: List<IssueReport> = emptyList(),
        val isLoading: Boolean = false,
        val errorMessage: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
        startPolling { refresh(silent = true) }
    }

    fun refresh(silent: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = if (silent && it.recentReports.isNotEmpty()) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null
                )
            }
            try {
                val reports = apiClient.fetchAllReports(session.accessToken)
                val cleaners = runCatching { apiClient.fetchCleaners(session.accessToken) }.getOrDefault(emptyList())
                val active = reports.count { it.status != IssueStatus.Resolved }
                val resolved = reports.count { it.status == IssueStatus.Resolved }
                val onDuty = cleaners.count { it.isBusy }
                val metrics = listOf(
                    DashboardMetric("Active Reports", active.toString(), SpotFixColors.warning),
                    DashboardMetric("Resolved", resolved.toString(), SpotFixColors.success),
                    DashboardMetric("Cleaners On Duty", onDuty.toString(), SpotFixColors.info),
                    DashboardMetric("Total Cleaners", cleaners.size.toString(), SpotFixColors.primary)
                )
                _state.update {
                    it.copy(
                        metrics = metrics,
                        recentReports = reports.take(6),
                        isLoading = false
                    )
                }
            } catch (e: Throwable) {
                // Preserve existing recentReports on failure; do not substitute SampleData,
                // which would mask backend issues.
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message
                    )
                }
            }
        }
    }
}
