package org.spotfix.community.feature.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.spotfix.community.api.AuthEnvelopeDto
import org.spotfix.community.api.GoogleSignInProvider
import org.spotfix.community.api.MeEnvelopeDto
import org.spotfix.community.api.SpotFixApiException
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.AppRole
import org.spotfix.community.model.UserSession
import org.spotfix.community.notifications.PushNotificationManager
import org.spotfix.community.session.SessionStore

/**
 * Mirrors the original iOS client.
 *
 * Surface parity:
 *  - [state] mirrors `@Published var selectedRole / session / isBusy / globalErrorMessage`
 *  - [chooseRole] / [authenticate] / [signInWithGoogle] / [signOut] / [logoutCurrentSession]
 *    map 1:1 to the Swift methods.
 *  - On init we restore the persisted session blob from EncryptedSharedPreferences (parity with
 *    the iOS Keychain restore in `init` on the main actor).
 */
class AppViewModel(
    val apiClient: SpotFixApiClient,
    private val sessionStore: SessionStore,
    val googleSignInProvider: GoogleSignInProvider,
    private val pushNotificationManager: PushNotificationManager
) : ViewModel() {

    data class State(
        val selectedRole: AppRole? = null,
        val session: UserSession? = null,
        val isBusy: Boolean = false,
        val globalErrorMessage: String? = null
    ) {
        val isAuthenticated: Boolean get() = session != null
        val currentUserName: String get() = session?.auth?.name.orEmpty()
        val currentPermissions: Set<String> get() = session?.permissions?.toSet().orEmpty()
    }

    enum class AuthFormMode(val label: String) { Login("Login"), Register("Register") }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        sessionStore.load()?.let { session ->
            _state.update { it.copy(session = session, selectedRole = session.appRole, isBusy = true) }
            viewModelScope.launch {
                restoreSession(session)
            }
        }
    }

    fun hasPermission(permission: String): Boolean = _state.value.currentPermissions.contains(permission)

    fun chooseRole(role: AppRole) {
        _state.update {
            it.copy(
                selectedRole = role,
                globalErrorMessage = null
            )
        }
    }

    fun clearError() {
        _state.update { it.copy(globalErrorMessage = null) }
    }

    /**
     * Mirrors `authenticate(role:mode:name:identifier:phone:password:)`. Throws a
     * [SpotFixAuthException] with a user-readable message on any failure.
     */
    suspend fun authenticate(
        role: AppRole,
        mode: AuthFormMode,
        name: String,
        identifier: String,
        email: String,
        phone: String,
        password: String
    ) {
        _state.update { it.copy(isBusy = true, globalErrorMessage = null) }
        try {
            val envelope = when {
                role == AppRole.MasterAdmin ->
                    apiClient.loginMaster(identifier.trim(), password)

                mode == AuthFormMode.Register -> {
                    apiClient.registerPublic(
                        name = name.trim(),
                        email = email.trim(),
                        idNumber = identifier.trim(),
                        phone = phone.trim(),
                        password = password
                    )
                    apiClient.loginUser(identifier.trim(), password)
                }

                else -> apiClient.loginUser(identifier.trim(), password)
            }
            val me = apiClient.fetchMe(envelope.accessToken)
            val resolvedRole = AppRole.fromApi(me.auth.role)
            if (!role.acceptsAuthenticatedRole(resolvedRole)) {
                throw SpotFixAuthException(
                    "Account role (${resolvedRole.title}) does not match the requested portal (${role.title})."
                )
            }
            val session = buildSession(envelope, me)
            sessionStore.save(session)
            pushNotificationManager.onSessionAuthenticated(session)
            _state.update { it.copy(session = session, selectedRole = resolvedRole, isBusy = false) }
        } catch (e: Throwable) {
            _state.update { it.copy(isBusy = false, globalErrorMessage = e.message) }
            throw e
        }
    }

    suspend fun signInWithGoogle(activity: android.app.Activity) {
        _state.update { it.copy(isBusy = true, globalErrorMessage = null) }
        try {
            val token = googleSignInProvider.obtainIdToken(activity)
            val envelope = apiClient.signInWithGoogle(token)
            val me = apiClient.fetchMe(envelope.accessToken)
            val session = buildSession(envelope, me)
            sessionStore.save(session)
            pushNotificationManager.onSessionAuthenticated(session)
            _state.update { it.copy(session = session, selectedRole = AppRole.fromApi(me.auth.role), isBusy = false) }
        } catch (e: Throwable) {
            _state.update { it.copy(isBusy = false, globalErrorMessage = e.message) }
            throw e
        }
    }

    fun signOut() {
        val session = _state.value.session
        if (session != null) {
            viewModelScope.launch {
                pushNotificationManager.onSessionEnded(session)
            }
        }
        sessionStore.clear()
        _state.update { State() }
    }

    fun logoutCurrentSession() {
        val session = _state.value.session ?: return signOut()
        viewModelScope.launch {
            pushNotificationManager.onSessionEnded(session)
            runCatching { apiClient.logout(session) }
            sessionStore.clear()
            _state.update { State() }
        }
    }

    private suspend fun restoreSession(session: UserSession) {
        try {
            val restored = validateOrRefresh(session)
            sessionStore.save(restored)
            pushNotificationManager.onSessionAuthenticated(restored)
            _state.update {
                it.copy(
                    session = restored,
                    selectedRole = restored.appRole,
                    isBusy = false,
                    globalErrorMessage = null
                )
            }
        } catch (e: Throwable) {
            if (e.isAuthSessionFailure() || e is SpotFixAuthException) {
                sessionStore.clear()
                _state.update {
                    State(globalErrorMessage = "Your session expired. Please sign in again.")
                }
            } else {
                _state.update { it.copy(isBusy = false, globalErrorMessage = e.message) }
            }
        }
    }

    private suspend fun validateOrRefresh(session: UserSession): UserSession {
        try {
            val me = apiClient.fetchMe(session.accessToken)
            return session.copy(auth = me.auth, permissions = me.permissions, profile = me.profile)
        } catch (e: Throwable) {
            if (!e.isRefreshableAuthFailure()) {
                throw e
            }
        }

        val refreshToken = session.refreshToken?.takeIf { it.isNotBlank() }
            ?: throw SpotFixAuthException("Your session expired. Please sign in again.")
        val envelope = if (session.auth.authType.equals("master", ignoreCase = true)) {
            apiClient.refreshMasterToken(refreshToken)
        } else {
            apiClient.refreshUserToken(refreshToken)
        }
        val me = apiClient.fetchMe(envelope.accessToken)
        return buildSession(envelope, me)
    }

    private fun buildSession(envelope: AuthEnvelopeDto, me: MeEnvelopeDto): UserSession =
        UserSession(
            accessToken = envelope.accessToken,
            refreshToken = envelope.refreshToken,
            tokenType = envelope.tokenType ?: "Bearer",
            expiresIn = envelope.expiresIn,
            refreshExpiresIn = envelope.refreshExpiresIn,
            auth = me.auth,
            permissions = me.permissions,
            profile = me.profile
        )

    private fun Throwable.isAuthSessionFailure(): Boolean =
        this is SpotFixApiException &&
            status == 401 &&
            code in setOf("SESSION_REVOKED", "INVALID_TOKEN", "AUTH_REQUIRED")

    private fun Throwable.isRefreshableAuthFailure(): Boolean =
        this is SpotFixApiException &&
            status == 401 &&
            code in setOf("INVALID_TOKEN", "AUTH_REQUIRED")
}

class SpotFixAuthException(message: String) : RuntimeException(message)
