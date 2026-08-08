package org.spotfix.community.feature.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.SessionProfile
import org.spotfix.community.model.UserSession
import org.spotfix.community.support.startPolling

/**
 * Android counterpart of iOS `UsersListViewModel` + provision action from `ProvisionStaffView`.
 */
class UsersListViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession
) : ViewModel() {

    data class State(
        val users: List<SessionProfile> = emptyList(),
        val isLoading: Boolean = false,
        val isSubmitting: Boolean = false,
        val errorMessage: String? = null,
        val successMessage: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
        startPolling { refresh(silent = true) }
    }

    fun clearMessages() {
        _state.update { it.copy(errorMessage = null, successMessage = null) }
    }

    fun refresh(silent: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = if (silent && it.users.isNotEmpty()) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null,
                    successMessage = if (silent) it.successMessage else null
                )
            }
            try {
                val users = apiClient.fetchUsers(session.accessToken)
                _state.update { it.copy(users = users, isLoading = false) }
            } catch (e: Throwable) {
                _state.update { it.copy(isLoading = false, errorMessage = e.message) }
            }
        }
    }

    fun provisionUser(
        name: String,
        idNumber: String,
        phone: String,
        password: String,
        role: String,
        workLocation: String?,
        email: String?
    ) {
        viewModelScope.launch {
            _state.update { it.copy(isSubmitting = true, errorMessage = null, successMessage = null) }
            try {
                apiClient.provisionUser(
                    name = name,
                    idNumber = idNumber,
                    phone = phone,
                    password = password,
                    role = role,
                    workLocation = workLocation,
                    email = email,
                    accessToken = session.accessToken
                )
                val users = apiClient.fetchUsers(session.accessToken)
                _state.update {
                    it.copy(
                        users = users,
                        isSubmitting = false,
                        successMessage = "User provisioned successfully."
                    )
                }
            } catch (e: Throwable) {
                _state.update { it.copy(isSubmitting = false, errorMessage = e.message) }
            }
        }
    }
}
