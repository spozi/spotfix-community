package org.spotfix.community.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.spotfix.community.SpotFixApplication

class SpotFixFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val app = application as? SpotFixApplication
        if (app == null) {
            Log.w(TAG, "SpotFixApplication not available while refreshing FCM token.")
            return
        }
        app.pushNotificationManager.onNewToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"] ?: return
        PushNotificationManager.showNotification(
            context = applicationContext,
            title = title,
            body = body,
            reportId = message.data["reportId"]
        )
    }

    private companion object {
        const val TAG = "SpotFixFcmService"
    }
}
