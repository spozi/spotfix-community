package org.spotfix.community.notifications

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import org.spotfix.community.api.SpotFixApiConfiguration

object FirebaseBootstrap {
    private const val TAG = "FirebaseBootstrap"

    fun ensureInitialized(context: Context): Boolean {
        if (FirebaseApp.getApps(context).isNotEmpty()) {
            return true
        }

        val config = SpotFixApiConfiguration.resolveFirebaseMessagingConfig(context) ?: return false

        return runCatching {
            FirebaseApp.initializeApp(
                context,
                FirebaseOptions.Builder()
                    .setApplicationId(config.applicationId)
                    .setApiKey(config.apiKey)
                    .setProjectId(config.projectId)
                    .setGcmSenderId(config.senderId)
                    .build()
            ) != null
        }.onFailure { error ->
            Log.w(TAG, "Firebase Messaging initialization failed.", error)
        }.getOrDefault(false)
    }
}
