package org.spotfix.community.feature.shared

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.NotificationEvent
import org.spotfix.community.model.UserSession
import org.spotfix.community.support.startPolling

class NotificationHistoryViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession
) : ViewModel() {

    data class State(
        val notifications: List<NotificationEvent> = emptyList(),
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
                    isLoading = if (silent && it.notifications.isNotEmpty()) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null
                )
            }
            try {
                val notifications = apiClient.fetchNotificationHistory(session.accessToken)
                _state.update { it.copy(notifications = notifications, isLoading = false) }
            } catch (e: Throwable) {
                _state.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }
}