package org.spotfix.community.api

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Mirrors the iOS `ServerConnectionMonitor` (Network framework + 20-second polling).
 *
 * - Tracks connectivity changes via [ConnectivityManager].
 * - Pings `GET /` every 20 seconds while the app is in the foreground.
 * - Surfaces a [Status] enum + a `detail` string the UI badge can render.
 */
class ServerConnectionMonitor(
    private val context: Context,
    private val apiClient: SpotFixApiClient,
    private val scope: CoroutineScope
) {
    enum class Status { Checking, Connected, Disconnected, ConfigurationIssue }

    data class State(val status: Status, val detail: String) {
        val title: String
            get() = when (status) {
                Status.Checking -> "Checking server"
                Status.Connected -> if (detail.startsWith("Synthetic")) "Demo data" else "Server connected"
                Status.Disconnected -> "Server unavailable"
                Status.ConfigurationIssue -> "Device API config needed"
            }
    }

    private val _state = MutableStateFlow(State(Status.Checking, SpotFixApiConfiguration.endpointLabel(apiClient.baseUrl)))
    val state: StateFlow<State> = _state.asStateFlow()

    private val connectivity by lazy { context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager }
    private var pollJob: Job? = null
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) { refresh() }
        override fun onLost(network: Network) {
            _state.value = State(Status.Disconnected, "No network connection")
        }
    }

    fun start() {
        runCatching {
            connectivity.registerNetworkCallback(NetworkRequest.Builder().build(), networkCallback)
        }
        SpotFixApiConfiguration.physicalDeviceReadinessWarning(apiClient.baseUrl)?.let {
            _state.value = State(Status.ConfigurationIssue, it)
            return
        }
        pollJob?.cancel()
        pollJob = scope.launch(Dispatchers.IO) {
            while (true) {
                refresh()
                delay(20_000)
            }
        }
    }

    fun stop() {
        runCatching { connectivity.unregisterNetworkCallback(networkCallback) }
        pollJob?.cancel()
    }

    fun refresh() {
        SpotFixApiConfiguration.physicalDeviceReadinessWarning(apiClient.baseUrl)?.let {
            _state.value = State(Status.ConfigurationIssue, it)
            return
        }
        scope.launch(Dispatchers.IO) {
            try {
                val status = apiClient.fetchServiceStatus()
                _state.value = State(
                    Status.Connected,
                    "${status.name ?: "API"} • ${status.version ?: "v?"}"
                )
            } catch (_: Throwable) {
                _state.value = State(
                    Status.Disconnected,
                    SpotFixApiConfiguration.endpointLabel(apiClient.baseUrl)
                )
            }
        }
    }
}
