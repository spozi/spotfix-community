package org.spotfix.community.feature.landing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.PublicStatusBoard
import org.spotfix.community.support.startPolling

class PublicStatusBoardViewModel(
    private val apiClient: SpotFixApiClient
) : ViewModel() {

    data class State(
        val board: PublicStatusBoard? = null,
        val isLoading: Boolean = false,
        val errorMessage: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
        startPolling(intervalMs = 30000L) { refresh(silent = true) }
    }

    fun refresh(silent: Boolean = false) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = if (silent && it.board != null) it.isLoading else true,
                    errorMessage = if (silent) it.errorMessage else null
                )
            }
            try {
                val board = apiClient.fetchPublicStatusBoard()
                _state.update { it.copy(board = board, isLoading = false) }
            } catch (error: Throwable) {
                _state.update { it.copy(isLoading = false, errorMessage = error.message) }
            }
        }
    }
}