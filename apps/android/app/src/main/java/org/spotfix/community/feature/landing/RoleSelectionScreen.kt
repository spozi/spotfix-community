package org.spotfix.community.feature.landing

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.PriorityHigh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.designsystem.SpotFixBadge
import org.spotfix.community.R
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixGradientHeader
import org.spotfix.community.designsystem.SpotFixIconBadge
import org.spotfix.community.designsystem.SpotFixPrimaryButton
import org.spotfix.community.designsystem.SpotFixCard
import org.spotfix.community.designsystem.SpotFixSectionHeader
import org.spotfix.community.designsystem.SpotFixSpacing
import org.spotfix.community.model.AppRole
import org.spotfix.community.model.PublicStatusBoard

/**
 * Splash + welcome screen with role dropdown selector.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class, ExperimentalLayoutApi::class)
@Composable
fun RoleSelectionScreen(
    apiClient: SpotFixApiClient,
    onRoleSelected: (AppRole) -> Unit
) {
    val roles = AppRole.entries.toList()
    var selectedRole by remember { mutableStateOf(roles.first()) }
    var rolePickerExpanded by remember { mutableStateOf(false) }
    val statusViewModel: PublicStatusBoardViewModel = viewModel(
        key = "public-status-board",
        factory = viewModelFactory {
            initializer { PublicStatusBoardViewModel(apiClient) }
        }
    )
    val statusState by statusViewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        containerColor = SpotFixColors.background,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0)
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .semantics { testTagsAsResourceId = true },
                contentPadding = PaddingValues(bottom = 96.dp),
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(SpotFixSpacing.medium)
            ) {
                item {
                    SpotFixGradientHeader(
                        title = "SpotFix Community",
                        subtitle = "Klik. Lapor. Bersih."
                    )
                }

                item {
                    Card(
                        modifier = Modifier
                            .padding(horizontal = SpotFixSpacing.medium)
                            .fillMaxWidth()
                            .testTag("role-selection-card"),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = SpotFixColors.surface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, SpotFixColors.border),
                        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(SpotFixSpacing.medium),
                            verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(SpotFixSpacing.medium)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(SpotFixSpacing.small)
                            ) {
                                SpotFixIconBadge(icon = selectedRole.icon, tint = selectedRole.accentColor, size = 44.dp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Splash & Welcome",
                                        style = MaterialTheme.typography.titleSmall,
                                        color = SpotFixColors.textPrimary,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        text = "Select the user role to enter",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = SpotFixColors.textSecondary
                                    )
                                }
                            }

                            HorizontalDivider(color = SpotFixColors.border)

                            ExposedDropdownMenuBox(
                                expanded = rolePickerExpanded,
                                onExpandedChange = { rolePickerExpanded = !rolePickerExpanded }
                            ) {
                                OutlinedTextField(
                                    value = selectedRole.title,
                                    onValueChange = {},
                                    readOnly = true,
                                    singleLine = true,
                                    label = { Text("User role") },
                                    leadingIcon = {
                                        Icon(
                                            imageVector = selectedRole.icon,
                                            contentDescription = null,
                                            tint = selectedRole.accentColor
                                        )
                                    },
                                    trailingIcon = {
                                        Icon(
                                            imageVector = if (rolePickerExpanded) {
                                                Icons.Filled.KeyboardArrowUp
                                            } else {
                                                Icons.Filled.KeyboardArrowDown
                                            },
                                            contentDescription = null
                                        )
                                    },
                                    colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(
                                        focusedBorderColor = SpotFixColors.primary,
                                        unfocusedBorderColor = SpotFixColors.border,
                                        focusedTextColor = SpotFixColors.textPrimary,
                                        unfocusedTextColor = SpotFixColors.textPrimary
                                    ),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .menuAnchor(
                                            type = MenuAnchorType.PrimaryNotEditable,
                                            enabled = true
                                        )
                                )

                                androidx.compose.material3.DropdownMenu(
                                    expanded = rolePickerExpanded,
                                    onDismissRequest = { rolePickerExpanded = false }
                                ) {
                                    roles.forEach { role ->
                                        androidx.compose.material3.DropdownMenuItem(
                                            text = {
                                                Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(2.dp)) {
                                                    Text(
                                                        text = role.title,
                                                        style = MaterialTheme.typography.bodyMedium,
                                                        color = SpotFixColors.textPrimary
                                                    )
                                                    Text(
                                                        text = role.subtitle,
                                                        style = MaterialTheme.typography.labelSmall,
                                                        color = SpotFixColors.textSecondary
                                                    )
                                                }
                                            },
                                            leadingIcon = {
                                                Icon(
                                                    imageVector = role.icon,
                                                    contentDescription = null,
                                                    tint = role.accentColor
                                                )
                                            },
                                            onClick = {
                                                selectedRole = role
                                                rolePickerExpanded = false
                                            }
                                        )
                                    }
                                }
                            }

                            Text(
                                text = selectedRole.subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = SpotFixColors.textSecondary
                            )
                        }
                    }
                }

                item {
                    PublicStatusBoardSection(statusState.board, statusState.isLoading, statusState.errorMessage)
                }

                item {
                    Text(
                        text = "Community Facilities Maintenance",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = SpotFixSpacing.medium, vertical = SpotFixSpacing.medium),
                        style = MaterialTheme.typography.labelSmall,
                        color = SpotFixColors.textSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(SpotFixColors.surface.copy(alpha = 0.98f))
                    .padding(horizontal = SpotFixSpacing.medium, vertical = SpotFixSpacing.small)
                    .navigationBarsPadding()
            ) {
                SpotFixPrimaryButton(
                    text = "Continue as ${selectedRole.authTitle}",
                    onClick = { onRoleSelected(selectedRole) },
                    modifier = Modifier.testTag("continue-selected-role-button"),
                    gradient = Brush.horizontalGradient(
                        colors = listOf(
                            selectedRole.accentColor,
                            selectedRole.accentColor.copy(alpha = 0.82f)
                        )
                    )
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PublicStatusBoardSection(
    board: PublicStatusBoard?,
    isLoading: Boolean,
    errorMessage: String?
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = SpotFixSpacing.medium),
        verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        SpotFixSectionHeader(
            title = "Campus status",
            subtitle = "Live public status from /reports/public/status"
        )

        when {
            isLoading && board == null -> {
                SpotFixCard {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                        Text(
                            text = "Loading current campus status…",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SpotFixColors.textSecondary
                        )
                    }
                }
            }

            board != null -> {
                SpotFixCard {
                    Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(12.dp)) {
                        FlowRow(
                            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
                            verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
                        ) {
                            SpotFixBadge(title = "Open ${board.summary.open}", color = SpotFixColors.warning)
                            SpotFixBadge(title = "Pending ${board.summary.pending}", color = SpotFixColors.info)
                            SpotFixBadge(title = "Resolved ${board.summary.resolved}", color = SpotFixColors.success)
                            SpotFixBadge(title = "Urgent ${board.summary.urgent}", color = SpotFixColors.danger)
                            SpotFixBadge(title = "Cleaners ${board.summary.cleaners}", color = SpotFixColors.secondary)
                        }

                        Text(
                            text = "Recent public reports",
                            style = MaterialTheme.typography.titleSmall,
                            color = SpotFixColors.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )

                        if (board.reports.isEmpty()) {
                            Text(
                                text = "No public reports available yet.",
                                style = MaterialTheme.typography.bodySmall,
                                color = SpotFixColors.textSecondary
                            )
                        } else {
                            board.reports.take(3).forEach { report ->
                                Column(verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(4.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = report.id,
                                            style = MaterialTheme.typography.labelLarge,
                                            color = SpotFixColors.textPrimary,
                                            fontWeight = FontWeight.SemiBold,
                                            modifier = Modifier.weight(1f)
                                        )
                                        SpotFixBadge(title = report.status.label, color = report.status.color)
                                    }
                                    Text(
                                        text = report.location ?: report.details ?: "No description",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = SpotFixColors.textSecondary
                                    )
                                }
                            }
                        }

                        Text(
                            text = "Cleaner availability",
                            style = MaterialTheme.typography.titleSmall,
                            color = SpotFixColors.textPrimary,
                            fontWeight = FontWeight.SemiBold
                        )

                        if (board.cleaners.isEmpty()) {
                            Text(
                                text = "No cleaner roster published yet.",
                                style = MaterialTheme.typography.bodySmall,
                                color = SpotFixColors.textSecondary
                            )
                        } else {
                            board.cleaners.take(3).forEach { cleaner ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = if (cleaner.status.equals("Busy", ignoreCase = true)) {
                                            Icons.Filled.PriorityHigh
                                        } else {
                                            Icons.Filled.CheckCircle
                                        },
                                        contentDescription = null,
                                        tint = if (cleaner.status.equals("Busy", ignoreCase = true)) {
                                            SpotFixColors.warning
                                        } else {
                                            SpotFixColors.success
                                        }
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = cleaner.name,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = SpotFixColors.textPrimary,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            text = cleaner.workLocation ?: cleaner.status,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = SpotFixColors.textSecondary
                                        )
                                    }
                                    SpotFixBadge(
                                        title = cleaner.status,
                                        color = if (cleaner.status.equals("Busy", ignoreCase = true)) {
                                            SpotFixColors.warning
                                        } else {
                                            SpotFixColors.success
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        errorMessage?.let {
            SpotFixCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Groups,
                        contentDescription = null,
                        tint = SpotFixColors.warning
                    )
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.warning
                    )
                }
            }
        }
    }
}
