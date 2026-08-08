package org.spotfix.community.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.spotfix.community.MainActivity
import org.spotfix.community.R
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.api.SpotFixApiConfiguration
import org.spotfix.community.model.UserSession
import org.spotfix.community.session.SessionStore
import kotlin.coroutines.resume

class PushNotificationManager(
    context: Context,
    private val sessionStore: SessionStore,
    private val scope: CoroutineScope
) {
    private val appContext = context.applicationContext
    private val apiClient = SpotFixApiClient(
        baseUrl = SpotFixApiConfiguration.resolveBaseUrl(appContext),
        tenantSlug = SpotFixApiConfiguration.resolveTenantSlug(appContext)
    )

    fun initialize() {
        createNotificationChannel(appContext)
        refreshRegistration()
    }

    fun refreshRegistration() {
        val session = sessionStore.load() ?: return
        scope.launch {
            onSessionAuthenticated(session)
        }
    }

    suspend fun onSessionAuthenticated(session: UserSession) {
        if (!FirebaseBootstrap.ensureInitialized(appContext)) {
            return
        }

        val token = currentToken() ?: return
        registerToken(session, token)
    }

    suspend fun onSessionEnded(session: UserSession?) {
        if (session == null || !FirebaseBootstrap.ensureInitialized(appContext)) {
            return
        }

        val token = currentToken() ?: return
        runCatching {
            apiClient.unregisterDevice(token = token, accessToken = session.accessToken)
        }.onFailure { error ->
            Log.w(TAG, "Failed to unregister FCM token from API.", error)
        }
    }

    fun onNewToken(token: String) {
        val session = sessionStore.load() ?: return
        scope.launch {
            registerToken(session, token)
        }
    }

    private suspend fun registerToken(session: UserSession, token: String) {
        runCatching {
            apiClient.registerDevice(
                token = token,
                accessToken = session.accessToken
            )
        }.onFailure { error ->
            Log.w(TAG, "Failed to register FCM token with API.", error)
        }
    }

    private suspend fun currentToken(): String? = suspendCancellableCoroutine { continuation ->
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!continuation.isActive) {
                return@addOnCompleteListener
            }

            if (task.isSuccessful) {
                continuation.resume(task.result?.takeIf { it.isNotBlank() })
            } else {
                Log.w(TAG, "Failed to fetch current FCM token.", task.exception)
                continuation.resume(null)
            }
        }
    }

    companion object {
        const val CHANNEL_ID = "spotfix-report-updates"
        private const val CHANNEL_NAME = "Report updates"
        private const val TAG = "PushNotificationMgr"

        fun createNotificationChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                return
            }

            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notifications for report assignments and status updates."
            }
            manager.createNotificationChannel(channel)
        }

        fun showNotification(context: Context, title: String, body: String, reportId: String? = null) {
            createNotificationChannel(context)

            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                return
            }

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                reportId?.let { putExtra("spotfix_report_id", it) }
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                (reportId ?: "$title:$body").hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            NotificationManagerCompat.from(context).notify((reportId ?: "$title:$body").hashCode(), notification)
        }
    }
}
