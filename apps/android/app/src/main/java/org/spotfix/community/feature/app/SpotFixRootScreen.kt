package org.spotfix.community.feature.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.spotfix.community.api.ServerConnectionMonitor
import org.spotfix.community.designsystem.LocalRoleAccent
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixServerStatusBadge
import org.spotfix.community.feature.admin.AdminPortalScreen
import org.spotfix.community.feature.auth.AuthEntryScreen
import org.spotfix.community.feature.landing.RoleSelectionScreen
import org.spotfix.community.feature.publicportal.PublicPortalScreen
import org.spotfix.community.feature.staff.StaffPortalScreen
import org.spotfix.community.model.AppRole

/**
 * Mirrors the original iOS client.
 *
 * Routing rules (kept identical to iOS):
 *   no role         → RoleSelectionScreen
 *   role + signed-in → portal for the resolved role
 *   role + signed-out → AuthEntryScreen
 */
@Composable
fun SpotFixRootScreen(
    appViewModel: AppViewModel,
    serverMonitor: ServerConnectionMonitor
) {
    val state by appViewModel.state.collectAsStateWithLifecycle()
    val monitorState by serverMonitor.state.collectAsStateWithLifecycle()
    val accent = state.selectedRole?.accentColor ?: SpotFixColors.primary

    CompositionLocalProvider(LocalRoleAccent provides accent) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(SpotFixColors.background)
        ) {
            when {
                state.selectedRole == null ->
                    RoleSelectionScreen(
                        apiClient = appViewModel.apiClient,
                        onRoleSelected = appViewModel::chooseRole
                    )

                state.session == null ->
                    AuthEntryScreen(
                        role = state.selectedRole!!,
                        appViewModel = appViewModel,
                        onBack = { appViewModel.signOut() }
                    )

                else -> when (state.selectedRole!!) {
                    AppRole.PublicUser -> PublicPortalScreen(appViewModel)
                    AppRole.Supervisor, AppRole.Cleaner ->
                        StaffPortalScreen(role = state.selectedRole!!, appViewModel = appViewModel)
                    AppRole.MasterAdmin -> AdminPortalScreen(appViewModel)
                }
            }

            SpotFixServerStatusBadge(
                title = monitorState.title,
                detail = monitorState.detail,
                color = when (monitorState.status) {
                    ServerConnectionMonitor.Status.Connected -> SpotFixColors.success
                    ServerConnectionMonitor.Status.Disconnected -> SpotFixColors.danger
                    ServerConnectionMonitor.Status.ConfigurationIssue -> SpotFixColors.warning
                    ServerConnectionMonitor.Status.Checking -> SpotFixColors.info
                },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .statusBarsPadding()
                    .padding(12.dp)
            )
        }
    }
}
