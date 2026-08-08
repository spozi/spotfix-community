package org.spotfix.community.support

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

internal fun ViewModel.startPolling(
    intervalMs: Long = 15000L,
    block: suspend () -> Unit
): Job = viewModelScope.launch {
    while (isActive) {
        delay(intervalMs)
        block()
    }
}