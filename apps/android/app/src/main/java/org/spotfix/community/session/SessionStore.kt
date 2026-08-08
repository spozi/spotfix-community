package org.spotfix.community.session

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.serialization.json.Json
import org.spotfix.community.model.UserSession

/**
 * Android equivalent of the iOS Keychain-backed `SessionStore`.
 *
 * Uses [EncryptedSharedPreferences] (AES-256-GCM via the Tink library bundled with
 * androidx.security.crypto). The blob is JSON-encoded the same way the iOS app encodes the
 * Swift `UserSession` Codable, so the wire format is reviewable cross-platform.
 *
 * Key parity table:
 *   iOS Keychain service  →  `org.spotfix.community.session`     (here: prefs file `spotfix_secure_session`)
 *   iOS Keychain account  →  `current-session`             (here: pref key `current-session`)
 */
class SessionStore(context: Context) {
    private val prefs: SharedPreferences = run {
        val masterKey = MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context.applicationContext,
            FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun load(): UserSession? {
        val raw = prefs.getString(KEY_SESSION, null) ?: return null
        return runCatching { json.decodeFromString(UserSession.serializer(), raw) }.getOrNull()
    }

    fun save(session: UserSession) {
        val raw = json.encodeToString(UserSession.serializer(), session)
        prefs.edit().putString(KEY_SESSION, raw).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_SESSION).apply()
    }

    private companion object {
        const val FILE_NAME = "spotfix_secure_session"
        const val KEY_SESSION = "current-session"
    }
}
