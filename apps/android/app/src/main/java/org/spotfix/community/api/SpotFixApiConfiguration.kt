package org.spotfix.community.api

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/**
 * Mirrors the original iOS client.
 *
 * Reads `<meta-data>` entries from `AndroidManifest.xml` (populated at build time from Gradle
 * properties). Falls back to the deployed API when nothing is configured.
 */
object SpotFixApiConfiguration {

    const val FALLBACK_BASE_URL_EMULATOR = "http://localhost:5001/api/v1"
    const val FALLBACK_BASE_URL_DEVICE = "http://localhost:5001/api/v1"
    const val FALLBACK_TENANT_SLUG = "example-campus"

    private const val META_BASE_URL = "SPOTFIX_API_BASE_URL"
    private const val META_TENANT_SLUG = "SPOTFIX_TENANT_SLUG"
    private const val META_GOOGLE_CLIENT_ID = "SPOTFIX_GOOGLE_CLIENT_ID"
    private const val META_FIREBASE_APP_ID = "SPOTFIX_FIREBASE_APP_ID"
    private const val META_FIREBASE_API_KEY = "SPOTFIX_FIREBASE_API_KEY"
    private const val META_FIREBASE_PROJECT_ID = "SPOTFIX_FIREBASE_PROJECT_ID"
    private const val META_FIREBASE_SENDER_ID = "SPOTFIX_FIREBASE_SENDER_ID"

    data class FirebaseMessagingConfig(
        val applicationId: String,
        val apiKey: String,
        val projectId: String,
        val senderId: String
    )

    fun resolveBaseUrl(context: Context): String =
        readMeta(context, META_BASE_URL)?.takeIf { it.isNotBlank() } ?: FALLBACK_BASE_URL_EMULATOR

    fun resolveTenantSlug(context: Context): String =
        readMeta(context, META_TENANT_SLUG)?.takeIf { it.isNotBlank() } ?: FALLBACK_TENANT_SLUG

    fun resolveGoogleClientId(context: Context): String? =
        readMeta(context, META_GOOGLE_CLIENT_ID)?.takeIf { it.isNotBlank() }

    fun resolveFirebaseMessagingConfig(context: Context): FirebaseMessagingConfig? {
        val applicationId = readMeta(context, META_FIREBASE_APP_ID)?.takeIf { it.isNotBlank() } ?: return null
        val apiKey = readMeta(context, META_FIREBASE_API_KEY)?.takeIf { it.isNotBlank() } ?: return null
        val projectId = readMeta(context, META_FIREBASE_PROJECT_ID)?.takeIf { it.isNotBlank() } ?: return null
        val senderId = readMeta(context, META_FIREBASE_SENDER_ID)?.takeIf { it.isNotBlank() } ?: return null

        return FirebaseMessagingConfig(
            applicationId = applicationId,
            apiKey = apiKey,
            projectId = projectId,
            senderId = senderId
        )
    }

    fun endpointLabel(baseUrl: String): String {
        val host = runCatching { java.net.URI(baseUrl).host }.getOrNull() ?: return baseUrl
        return when {
            host == "10.0.2.2" || host == "localhost" || host == "127.0.0.1" -> "Local API"
            else -> host
        }
    }

    /**
     * Mirrors the iOS `physicalDeviceReadinessWarning`: cleartext is only acceptable on the
     * emulator loopback. Anything else hitting an http:// origin from a physical device is wrong.
     */
    fun physicalDeviceReadinessWarning(baseUrl: String): String? {
        if (isEmulator()) return null
        if (baseUrl.contains("replace-with-your-deployed-api")) {
            return "API base URL is still the placeholder. Set SPOTFIX_API_BASE_URL in Gradle."
        }
        if (baseUrl.startsWith("http://") && !baseUrl.contains("10.0.2.2")) {
            return "API base URL must be HTTPS on a physical device."
        }
        return null
    }

    private fun isEmulator(): Boolean =
        Build.FINGERPRINT.contains("generic", ignoreCase = true) ||
            Build.MODEL.contains("emulator", ignoreCase = true) ||
            Build.MODEL.contains("Android SDK built for", ignoreCase = true) ||
            Build.HARDWARE.contains("goldfish", ignoreCase = true) ||
            Build.HARDWARE.contains("ranchu", ignoreCase = true)

    private fun readMeta(context: Context, key: String): String? = try {
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.packageManager.getApplicationInfo(
                context.packageName,
                PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
        }
        info.metaData?.getString(key)
    } catch (_: PackageManager.NameNotFoundException) {
        null
    }
}
