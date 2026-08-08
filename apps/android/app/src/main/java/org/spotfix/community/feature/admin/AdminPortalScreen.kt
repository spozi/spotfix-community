package org.spotfix.community.feature.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import kotlinx.coroutines.launch
import org.spotfix.community.designsystem.SpotFixBadge
import org.spotfix.community.designsystem.SpotFixBottomNav
import org.spotfix.community.designsystem.SpotFixCard
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixFilterChip
import org.spotfix.community.designsystem.SpotFixGradientHeader
import org.spotfix.community.designsystem.SpotFixGradients
import org.spotfix.community.designsystem.SpotFixIconBadge
import org.spotfix.community.designsystem.SpotFixNavItem
import org.spotfix.community.designsystem.SpotFixSpacing
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Shield
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.feature.publicportal.ReportRow
import org.spotfix.community.feature.shared.AccountScreen
import org.spotfix.community.model.AppRole
import org.spotfix.community.model.DashboardMetric
import org.spotfix.community.model.SessionProfile

/**
 * Mirrors the original iOS client.
 *
 * Four tabs: Overview / Users / Master Control / Account.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminPortalScreen(appViewModel: AppViewModel) {
    val appState by appViewModel.state.collectAsStateWithLifecycle()
    val session = appState.session ?: return

    val viewModel: AdminOverviewViewModel = viewModel(
        key = "admin-${session.auth.userId}",
        factory = viewModelFactory {
            initializer { AdminOverviewViewModel(appViewModel.apiClient, session) }
        }
    )
    val state by viewModel.state.collectAsStateWithLifecycle()

    val usersViewModel: UsersListViewModel = viewModel(
        key = "admin-users-${session.auth.userId}",
        factory = viewModelFactory {
            initializer { UsersListViewModel(appViewModel.apiClient, session) }
        }
    )
    val usersState by usersViewModel.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var selectedTab by rememberSaveable { mutableStateOf("overview") }
    val navItems = remember {
        listOf(
            SpotFixNavItem("overview", "Overview", Icons.Filled.Dashboard),
            SpotFixNavItem("users", "Users", Icons.Filled.Group),
            SpotFixNavItem("master", "Control", Icons.Filled.Shield),
            SpotFixNavItem("account", "Account", Icons.Filled.Person)
        )
    }
    var showProvisionDialog by rememberSaveable { mutableStateOf(false) }
    var showCreateMasterDialog by rememberSaveable { mutableStateOf(false) }
    var masterActionError by rememberSaveable { mutableStateOf<String?>(null) }
    var masterActionSuccess by rememberSaveable { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = SpotFixColors.background,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        bottomBar = {
            SpotFixBottomNav(
                items = navItems,
                selectedKey = selectedTab,
                onSelected = { selectedTab = it }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            SpotFixGradientHeader(
                title = "Master Control",
                subtitle = "Oversee operations across SpotFix Community.",
                gradient = SpotFixGradients.master
            )
            when (selectedTab) {
                "overview" -> OverviewTab(state)
                "users" -> UsersTab(
                    state = usersState,
                    onRefresh = usersViewModel::refresh,
                    onProvisionClick = {
                        usersViewModel.clearMessages()
                        showProvisionDialog = true
                    }
                )
                "master" -> MasterControlTab(
                    permissions = appViewModel.state.value.currentPermissions,
                    actionError = masterActionError,
                    actionSuccess = masterActionSuccess,
                    onCreateMasterClick = { showCreateMasterDialog = true }
                )
                else -> AccountScreen(appViewModel)
            }
        }
    }

    if (showProvisionDialog) {
        ProvisionUserDialog(
            isSubmitting = usersState.isSubmitting,
            onDismiss = { showProvisionDialog = false },
            onSubmit = { form ->
                usersViewModel.provisionUser(
                    name = form.name,
                    idNumber = form.idNumber,
                    phone = form.phone,
                    password = form.password,
                    role = form.role,
                    workLocation = form.workLocation,
                    email = form.email
                )
                showProvisionDialog = false
            }
        )
    }

    if (showCreateMasterDialog) {
        CreateMasterDialog(
            onDismiss = { showCreateMasterDialog = false },
            onSubmit = { username, displayName, password ->
                scope.launch {
                    runCatching {
                        appViewModel.apiClient.createMaster(
                            username = username,
                            password = password,
                            name = displayName,
                            accessToken = session.accessToken
                        )
                    }.onSuccess {
                        masterActionError = null
                        masterActionSuccess = "Master account created."
                        showCreateMasterDialog = false
                        usersViewModel.refresh()
                    }.onFailure { error ->
                        masterActionSuccess = null
                        masterActionError = error.message ?: "Failed to create master account."
                    }
                }
            }
        )
    }
}

@Composable
private fun OverviewTab(state: AdminOverviewViewModel.State) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpotFixSpacing.medium),
        verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = SpotFixSpacing.small),
                verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)
            ) {
                state.metrics.chunked(2).forEach { metricRow ->
                    Row(horizontalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)) {
                        metricRow.forEach { metric ->
                            MetricCard(metric = metric, modifier = Modifier.weight(1f))
                        }
                        if (metricRow.size == 1) {
                            Row(modifier = Modifier.weight(1f)) {}
                        }
                    }
                }
            }
        }
        items(state.recentReports, key = { it.id }) { report -> ReportRow(report) }
    }
}

@Composable
private fun UsersTab(
    state: UsersListViewModel.State,
    onRefresh: () -> Unit,
    onProvisionClick: () -> Unit
) {
    var searchText by rememberSaveable { mutableStateOf("") }
    val filtered = remember(state.users, searchText) {
        if (searchText.isBlank()) {
            state.users
        } else {
            val query = searchText.trim().lowercase()
            state.users.filter { user ->
                user.name.lowercase().contains(query) ||
                    (user.idNumber ?: "").lowercase().contains(query) ||
                    (user.email ?: "").lowercase().contains(query) ||
                    (user.role ?: "").lowercase().contains(query)
            }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpotFixSpacing.medium),
        verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = searchText,
                        onValueChange = { searchText = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Search users") },
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = onRefresh, modifier = Modifier.weight(1f)) { Text("Refresh") }
                        Button(onClick = onProvisionClick, modifier = Modifier.weight(1f)) { Text("Provision") }
                    }
                    if (state.isLoading) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                    state.errorMessage?.let {
                        Text(it, color = SpotFixColors.danger, style = MaterialTheme.typography.bodySmall)
                    }
                    state.successMessage?.let {
                        Text(it, color = SpotFixColors.success, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        if (!state.isLoading && filtered.isEmpty()) {
            item {
                SpotFixCard {
                    Text(
                        "No users found.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }
            }
        }

        items(filtered, key = { it.id }) { user ->
            UserRow(user)
        }
    }
}

@Composable
private fun UserRow(user: SessionProfile) {
    SpotFixCard {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    user.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = SpotFixColors.textPrimary,
                    modifier = Modifier.weight(1f)
                )
                user.role?.let { role ->
                    SpotFixBadge(
                        title = role,
                        color = when (role.lowercase()) {
                            "supervisor" -> SpotFixColors.secondary
                            "cleaner" -> SpotFixColors.success
                            "master", "admin" -> SpotFixColors.master
                            else -> SpotFixColors.primary
                        }
                    )
                }
            }
            user.idNumber?.takeIf { it.isNotBlank() }?.let {
                Text("ID: $it", style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
            }
            user.email?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
            }
            user.phone?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
            }
        }
    }
}

@Composable
private fun MetricCard(metric: DashboardMetric, modifier: Modifier = Modifier) {
    SpotFixCard(modifier = modifier) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(metric.title, style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
            Text(
                metric.value,
                style = MaterialTheme.typography.headlineSmall,
                color = metric.tint,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun MasterControlTab(
    permissions: Set<String>,
    actionError: String?,
    actionSuccess: String?,
    onCreateMasterClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpotFixSpacing.medium),
        verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        items(AppRole.entries.toList(), key = { it.id }) { role ->
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            role.title,
                            style = MaterialTheme.typography.titleMedium,
                            color = SpotFixColors.textPrimary,
                            modifier = Modifier.weight(1f)
                        )
                        SpotFixBadge(title = role.id, color = role.accentColor)
                    }
                    Text(role.subtitle, style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
                }
            }
        }
        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Your permissions",
                        style = MaterialTheme.typography.titleMedium,
                        color = SpotFixColors.textPrimary
                    )
                    if (permissions.isEmpty()) {
                        Text(
                            "No permissions returned by the API yet.",
                            style = MaterialTheme.typography.bodySmall,
                            color = SpotFixColors.textSecondary
                        )
                    } else {
                        permissions.sorted().forEach { perm ->
                            Text("• $perm", style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
                        }
                    }
                }
            }
        }
        actionError?.let { message ->
            item {
                SpotFixCard {
                    Text(message, color = SpotFixColors.danger, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        actionSuccess?.let { message ->
            item {
                SpotFixCard {
                    Text(message, color = SpotFixColors.success, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Button(onClick = onCreateMasterClick, modifier = Modifier.fillMaxWidth()) {
                Text("Create Master Account")
            }
        }
    }
}

private data class ProvisionFormState(
    val name: String,
    val idNumber: String,
    val phone: String,
    val email: String?,
    val password: String,
    val role: String,
    val workLocation: String?
)

@Composable
private fun ProvisionUserDialog(
    isSubmitting: Boolean,
    onDismiss: () -> Unit,
    onSubmit: (ProvisionFormState) -> Unit
) {
    var name by rememberSaveable { mutableStateOf("") }
    var idNumber by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }
    var role by rememberSaveable { mutableStateOf("supervisor") }
    var workLocation by rememberSaveable { mutableStateOf("") }

    val roleOptions = listOf("public", "cleaner", "supervisor")
    val canSubmit = name.isNotBlank() && idNumber.isNotBlank() && phone.isNotBlank() &&
        password.isNotBlank() && password == confirmPassword && !isSubmitting

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Provision Staff") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(name, { name = it }, label = { Text("Full name") }, singleLine = true)
                OutlinedTextField(idNumber, { idNumber = it }, label = { Text("ID / Matrix number") }, singleLine = true)
                OutlinedTextField(phone, { phone = it }, label = { Text("Phone number") }, singleLine = true)
                OutlinedTextField(email, { email = it }, label = { Text("Email (optional)") }, singleLine = true)
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(roleOptions) { option ->
                        SpotFixFilterChip(
                            title = option,
                            selected = role == option,
                            onClick = { role = option }
                        )
                    }
                }
                OutlinedTextField(workLocation, { workLocation = it }, label = { Text("Work location (optional)") }, singleLine = true)
                OutlinedTextField(
                    password,
                    { password = it },
                    label = { Text("Initial password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                OutlinedTextField(
                    confirmPassword,
                    { confirmPassword = it },
                    label = { Text("Confirm password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSubmit(
                        ProvisionFormState(
                            name = name.trim(),
                            idNumber = idNumber.trim(),
                            phone = phone.trim(),
                            email = email.trim().ifBlank { null },
                            password = password,
                            role = role,
                            workLocation = workLocation.trim().ifBlank { null }
                        )
                    )
                },
                enabled = canSubmit
            ) {
                Text(if (isSubmitting) "Please wait..." else "Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isSubmitting) { Text("Cancel") }
        }
    )
}

@Composable
private fun CreateMasterDialog(
    onDismiss: () -> Unit,
    onSubmit: (username: String, displayName: String, password: String) -> Unit
) {
    var username by rememberSaveable { mutableStateOf("") }
    var displayName by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirmPassword by rememberSaveable { mutableStateOf("") }

    val canSubmit = username.isNotBlank() && displayName.isNotBlank() &&
        password.isNotBlank() && password == confirmPassword

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Master Account") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(username, { username = it }, label = { Text("Username") }, singleLine = true)
                OutlinedTextField(displayName, { displayName = it }, label = { Text("Display name") }, singleLine = true)
                OutlinedTextField(
                    password,
                    { password = it },
                    label = { Text("Password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
                OutlinedTextField(
                    confirmPassword,
                    { confirmPassword = it },
                    label = { Text("Confirm password") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSubmit(username.trim(), displayName.trim(), password) },
                enabled = canSubmit
            ) { Text("Create") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
