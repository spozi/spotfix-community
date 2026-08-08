package org.spotfix.community.api

import android.app.Activity
import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException

/**
 * Mirrors the original iOS client.
 *
 * Backed by AndroidX Credential Manager + the Sign in with Google helper. The returned ID token
 * is sent to the API (`POST /users/google`) which verifies the audience using
 * `GOOGLE_CLIENT_IDS`. The OAuth client ID injected here must be the **Web** application client
 * ID that matches the API's allow-list (Google's recommended pattern for native apps).
 */
interface GoogleSignInProvider {
    val isConfigured: Boolean

    /**
     * Returns a fresh Google ID token. Must be called from a foreground [Activity] because the
     * Credential Manager UI needs an Activity-scoped window.
     */
    suspend fun obtainIdToken(activity: Activity): String
}

class LiveGoogleSignInProvider(
    context: Context,
    private val clientId: String?
) : GoogleSignInProvider {

    private val appContext = context.applicationContext
    private val credentialManager: CredentialManager by lazy { CredentialManager.create(appContext) }

    override val isConfigured: Boolean = !clientId.isNullOrBlank()

    override suspend fun obtainIdToken(activity: Activity): String {
        val serverClientId = clientId
        if (serverClientId.isNullOrBlank()) throw GoogleSignInException.NotConfigured

        // First try the One Tap / bottom-sheet flow that surfaces previously-authorized
        // accounts. If no credential is available (e.g. the user has never linked this app
        // to Google before, or device-side credential state is empty), fall back to the
        // explicit "Sign in with Google" button flow which always presents an account
        // picker as long as Google Play services and at least one Google account exist.
        val oneTapOption = GetGoogleIdOption.Builder()
            .setServerClientId(serverClientId)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(false)
            .build()

        val response = try {
            credentialManager.getCredential(activity, buildRequest(oneTapOption))
        } catch (e: GetCredentialCancellationException) {
            Log.w(TAG, "One Tap cancelled: ${e.message}", e)
            throw GoogleSignInException.Cancelled
        } catch (e: NoCredentialException) {
            Log.i(TAG, "One Tap returned no credential; falling back to explicit Sign in with Google flow.")
            // Fall back to the explicit Sign-in-with-Google flow which mirrors a
            // user-initiated button press and is the recommended path when the One Tap
            // flow has nothing to offer.
            val explicitOption = GetSignInWithGoogleOption.Builder(serverClientId).build()
            try {
                credentialManager.getCredential(activity, buildRequest(explicitOption))
            } catch (ce: GetCredentialCancellationException) {
                // Credential Manager surfaces trust-handshake failures (e.g. the OAuth
                // Android client in Google Cloud Console doesn't have this APK's SHA-1
                // fingerprint registered) as "cancellation" once the user picks an
                // account. Surface the underlying message so the failure is actionable
                // instead of misleadingly silent.
                Log.e(TAG, "Sign in with Google cancelled/aborted after account pick: ${ce.message}", ce)
                val detail = ce.message?.takeIf { it.isNotBlank() }
                if (detail != null && !detail.equals("activity is cancelled by the user.", ignoreCase = true)) {
                    throw GoogleSignInException.Failed("Google Sign-In failed: $detail", ce)
                }
                throw GoogleSignInException.Cancelled
            } catch (ne: NoCredentialException) {
                Log.w(TAG, "Sign in with Google: no credential available.", ne)
                throw GoogleSignInException.NoCredential
            } catch (ge: GetCredentialException) {
                Log.e(TAG, "Sign in with Google failed: ${ge.javaClass.simpleName}: ${ge.message}", ge)
                throw GoogleSignInException.Failed(
                    "Google Sign-In failed (${ge.javaClass.simpleName}): ${ge.message ?: "unknown error"}",
                    ge
                )
            }
        } catch (e: GetCredentialException) {
            Log.e(TAG, "One Tap failed: ${e.javaClass.simpleName}: ${e.message}", e)
            throw GoogleSignInException.Failed(
                "Google Sign-In failed (${e.javaClass.simpleName}): ${e.message ?: "unknown error"}",
                e
            )
        }

        val credential = response.credential
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw GoogleSignInException.Failed("Unexpected credential type: ${credential.type}")
        }

        return try {
            GoogleIdTokenCredential.createFrom(credential.data).idToken
        } catch (e: GoogleIdTokenParsingException) {
            throw GoogleSignInException.Failed("Could not parse Google ID token.", e)
        }
    }

    private fun buildRequest(option: androidx.credentials.CredentialOption): GetCredentialRequest =
        GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()

    private companion object {
        const val TAG = "GoogleSignIn"
    }
}

sealed class GoogleSignInException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause) {
    data object NotConfigured : GoogleSignInException(
        "Google Sign-In is not configured. Set SPOTFIX_GOOGLE_CLIENT_ID in Gradle properties."
    ) { private fun readResolve(): Any = NotConfigured }

    data object Cancelled : GoogleSignInException("Google Sign-In was cancelled.") {
        private fun readResolve(): Any = Cancelled
    }

    data object NoCredential : GoogleSignInException(
        "No Google account is available on this device. Add a Google account in Settings and try again."
    ) { private fun readResolve(): Any = NoCredential }

    class Failed(message: String, cause: Throwable? = null) : GoogleSignInException(message, cause)
}
