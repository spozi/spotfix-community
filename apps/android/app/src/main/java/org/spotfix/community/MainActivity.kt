package org.spotfix.community

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import org.spotfix.community.designsystem.SpotFixTheme
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.feature.app.SpotFixRootScreen

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val appViewModel: AppViewModel by viewModels(
        factoryProducer = {
            val app = application as SpotFixApplication
            viewModelFactory {
                initializer {
                    AppViewModel(
                        apiClient = app.apiClient,
                        sessionStore = app.sessionStore,
                        googleSignInProvider = app.googleSignInProvider,
                        pushNotificationManager = app.pushNotificationManager
                    )
                }
            }
        }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = application as SpotFixApplication
        app.serverMonitor.start()
        observeNotificationPermissionPrompt()

        setContent {
            SpotFixTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SpotFixRootScreen(
                        appViewModel = appViewModel,
                        serverMonitor = app.serverMonitor
                    )
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        (application as SpotFixApplication).let {
            it.serverMonitor.refresh()
            if (appViewModel.state.value.session != null) {
                it.pushNotificationManager.refreshRegistration()
            }
        }
    }

    private fun observeNotificationPermissionPrompt() {
        lifecycleScope.launch {
            repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
                appViewModel.state
                    .map { it.session != null }
                    .distinctUntilChanged()
                    .collect { hasSession ->
                        if (hasSession) {
                            maybeRequestNotificationPermission()
                        }
                    }
            }
        }
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return
        }
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
