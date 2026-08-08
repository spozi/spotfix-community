package org.spotfix.community

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import org.spotfix.community.api.LiveGoogleSignInProvider
import org.spotfix.community.api.ServerConnectionMonitor
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.api.SpotFixApiConfiguration
import org.spotfix.community.notifications.PushNotificationManager
import org.spotfix.community.session.SessionStore
import org.osmdroid.config.Configuration

/**
 * Single source of truth for app-scoped singletons. Keeping it manual (no Hilt) keeps build
 * configuration light — the iOS app uses the same approach (`AppViewModel` constructed once at
 * `@main`).
 */
class SpotFixApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        Configuration.getInstance().load(this, getSharedPreferences("osmdroid", MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = packageName
        pushNotificationManager.initialize()
    }

    val appScope: CoroutineScope by lazy { CoroutineScope(SupervisorJob()) }

    val apiClient: SpotFixApiClient by lazy {
        SpotFixApiClient(
            baseUrl = SpotFixApiConfiguration.resolveBaseUrl(this),
            tenantSlug = SpotFixApiConfiguration.resolveTenantSlug(this)
        )
    }

    val sessionStore: SessionStore by lazy { SessionStore(this) }

    val googleSignInProvider by lazy {
        LiveGoogleSignInProvider(this, SpotFixApiConfiguration.resolveGoogleClientId(this))
    }

    val pushNotificationManager: PushNotificationManager by lazy {
        PushNotificationManager(this, sessionStore, appScope)
    }

    val serverMonitor: ServerConnectionMonitor by lazy {
        ServerConnectionMonitor(this, apiClient, appScope)
    }
}
