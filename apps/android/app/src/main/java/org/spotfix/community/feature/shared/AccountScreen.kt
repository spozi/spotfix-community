package org.spotfix.community.feature.shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import org.spotfix.community.designsystem.SpotFixBadge
import org.spotfix.community.designsystem.SpotFixCard
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixSecondaryButton
import org.spotfix.community.designsystem.SpotFixSpacing
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.model.NotificationEvent
import java.text.DateFormat
import java.util.Date

/**
 * Mirrors the original iOS client.
 */
@Composable
fun AccountScreen(appViewModel: AppViewModel) {
    val state by appViewModel.state.collectAsStateWithLifecycle()
    val session = state.session ?: return
    val notificationsViewModel: NotificationHistoryViewModel = viewModel(
        key = "notifications-${session.auth.userId}-${session.auth.role}",
        factory = viewModelFactory {
            initializer {
                NotificationHistoryViewModel(
                    apiClient = appViewModel.apiClient,
                    session = session
                )
            }
        }
    )
    val notificationsState by notificationsViewModel.state.collectAsStateWithLifecycle()
    val initials = session.auth.name
        .split(' ')
        .filter { it.isNotBlank() }
        .take(2)
        .joinToString("") { it.first().uppercase() }
        .ifBlank { "UU" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpotFixSpacing.medium),
        verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        item {
            SpotFixCard {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(SpotFixColors.primary.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            style = MaterialTheme.typography.titleLarge,
                            color = SpotFixColors.primary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Text(
                        text = session.auth.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = SpotFixColors.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = session.auth.role,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }
            }
        }

        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Profile details",
                        style = MaterialTheme.typography.titleSmall,
                        color = SpotFixColors.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                    InfoRow("Role", session.auth.role)
                    session.profile.email?.let { InfoRow("Email", it) }
                    session.profile.idNumber?.let { InfoRow("ID", it) }
                    session.profile.phone?.let { InfoRow("Phone", it) }
                    session.profile.authProvider?.let { InfoRow("Sign-in", it) }
                    session.profile.lastLoginAt?.let { InfoRow("Last login", it) }
                }
            }
        }

        item {
            SpotFixSecondaryButton(
                text = "Sign out",
                onClick = { appViewModel.logoutCurrentSession() },
                modifier = Modifier.testTag("sign-out-button")
            )
        }

        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Notification history",
                            style = MaterialTheme.typography.titleSmall,
                            color = SpotFixColors.textPrimary,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        if (notificationsState.isLoading && notificationsState.notifications.isEmpty()) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        }
                    }
                    notificationsState.errorMessage?.let {
                        Text(text = it, style = MaterialTheme.typography.bodySmall, color = SpotFixColors.danger)
                    }
                    if (notificationsState.notifications.isEmpty() && !notificationsState.isLoading) {
                        Text(
                            text = "No notifications yet.",
                            style = MaterialTheme.typography.bodySmall,
                            color = SpotFixColors.textSecondary
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            notificationsState.notifications.take(10).forEach { notification ->
                                NotificationRow(notification)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = SpotFixColors.textSecondary,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium,
                color = SpotFixColors.textPrimary,
                fontWeight = FontWeight.Medium
            )
        }
        HorizontalDivider(color = SpotFixColors.border.copy(alpha = 0.5f))
    }
}

@Composable
private fun NotificationRow(notification: NotificationEvent) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = notification.title,
                style = MaterialTheme.typography.bodyMedium,
                color = SpotFixColors.textPrimary,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            if (notification.isCritical) {
                SpotFixBadge(title = "Critical", color = SpotFixColors.danger)
            }
        }
        Text(
            text = notification.body,
            style = MaterialTheme.typography.bodySmall,
            color = SpotFixColors.textSecondary
        )
        Text(
            text = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(notification.createdAt)),
            style = MaterialTheme.typography.labelSmall,
            color = SpotFixColors.textSecondary
        )
        HorizontalDivider(color = SpotFixColors.border.copy(alpha = 0.4f))
    }
}
