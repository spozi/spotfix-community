package org.spotfix.community.feature.publicportal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.UserSession
import org.spotfix.community.support.startPolling

/**
 * Mirrors the original iOS client —
 * fetches reports filed by the signed-in public user.
 */
class PublicReportsViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession
) : ViewModel() {

    data class State(
        val reports: List<IssueReport> = emptyList(),
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
                    isLoading = if (silent && it.reports.isNotEmpty()) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null
                )
            }
            try {
                val list = apiClient.fetchReportsForUser(session.auth.userId, session.accessToken)
                _state.update { it.copy(reports = list, isLoading = false) }
            } catch (e: Throwable) {
                // Preserve existing reports on failure; do not substitute SampleData,
                // which would mask backend issues and confuse the user.
                _state.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = e.message
                    )
                }
            }
        }
    }

    fun appendOptimistic(report: IssueReport) {
        _state.update { it.copy(reports = listOf(report) + it.reports) }
    }
}
