package org.spotfix.community.feature.staff

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.core.content.FileProvider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import org.spotfix.community.model.WorkforceMember
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.layout.ContentScale
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import coil.compose.AsyncImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.spotfix.community.designsystem.SpotFixBadge
import org.spotfix.community.designsystem.SpotFixBottomNav
import org.spotfix.community.designsystem.SpotFixCard
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixFilterChip
import org.spotfix.community.designsystem.SpotFixGradientHeader
import org.spotfix.community.designsystem.SpotFixGradients
import org.spotfix.community.designsystem.SpotFixNavItem
import org.spotfix.community.designsystem.SpotFixPrimaryButton
import org.spotfix.community.designsystem.SpotFixSpacing
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.Icon
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.feature.shared.AccountScreen
import org.spotfix.community.model.AppRole
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.ReportCoordinate
import java.io.File
import java.text.DateFormat
import java.util.Date
import kotlin.coroutines.resume

/**
 * Mirrors the original iOS client.
 *
 * Tabs are role-aware:
 *   - Cleaner: My Tasks / Account
 *   - Supervisor: Tasks / Reviews / Workforce / Account
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun StaffPortalScreen(role: AppRole, appViewModel: AppViewModel) {
    val appState by appViewModel.state.collectAsStateWithLifecycle()
    val session = appState.session ?: return
    val canManageWorkforce = role == AppRole.Supervisor || appViewModel.hasPermission("cleaners:list")

    val viewModel: StaffDashboardViewModel = viewModel(
        key = "staff-${session.auth.userId}-$role",
        factory = viewModelFactory {
            initializer {
                StaffDashboardViewModel(
                    apiClient = appViewModel.apiClient,
                    session = session,
                    role = role,
                    canManageWorkforce = canManageWorkforce
                )
            }
        }
    )
    val state by viewModel.state.collectAsStateWithLifecycle()

    val navItems = remember(role) {
        if (role == AppRole.Supervisor) listOf(
            SpotFixNavItem("tasks", "Tasks", Icons.Filled.Assignment),
            SpotFixNavItem("reviews", "Reviews", Icons.Filled.History),
            SpotFixNavItem("workforce", "Workforce", Icons.Filled.Groups),
            SpotFixNavItem("account", "Account", Icons.Filled.Person)
        ) else listOf(
            SpotFixNavItem("tasks", "Tasks", Icons.Filled.Assignment),
            SpotFixNavItem("history", "History", Icons.Filled.History),
            SpotFixNavItem("account", "Account", Icons.Filled.Person)
        )
    }
    var selectedTab by rememberSaveable(role) { mutableStateOf("tasks") }
    var statusFilter by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedReport by rememberSaveable { mutableStateOf<String?>(null) }

    val gradient = if (role == AppRole.Supervisor) SpotFixGradients.supervisor else SpotFixGradients.cleaner
    val subtitle = when (role) {
        AppRole.Supervisor -> "Coordinate your team and assign tasks."
        AppRole.Cleaner -> "Stay on top of your assigned tasks."
        else -> ""
    }

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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .semantics { testTagsAsResourceId = true }
        ) {
            SpotFixGradientHeader(
                title = "Hi, ${session.auth.name.substringBefore(' ')}",
                subtitle = subtitle,
                gradient = gradient
            )
            when {
                selectedTab == "tasks" -> TaskBoard(
                    isLoading = state.isLoading,
                    reports = state.reports,
                    role = role,
                    statusFilter = statusFilter,
                    onFilter = { statusFilter = it },
                    onOpenReport = { report -> selectedReport = report.id },
                    onResolveWithPhoto = { report, attachments, coordinate ->
                        viewModel.resolveReport(report, attachments, coordinate)
                    },
                    canResolve = role == AppRole.Cleaner,
                    onRefresh = { viewModel.refresh() }
                )
                selectedTab == "workforce" -> WorkforceTab(
                    state = state,
                    onRefresh = { viewModel.refresh() }
                )
                selectedTab == "reviews" -> TaskBoard(
                    isLoading = state.isLoading,
                    reports = supervisorReviewReports(state.reports),
                    role = role,
                    statusFilter = null,
                    onFilter = {},
                    onOpenReport = { report -> selectedReport = report.id },
                    onResolveWithPhoto = { _, _, _ -> },
                    canResolve = false,
                    onRefresh = { viewModel.refresh() }
                )
                selectedTab == "history" -> TaskBoard(
                    isLoading = state.isLoading,
                    reports = state.reports.filter {
                        it.status == IssueStatus.Resolved ||
                            it.status == IssueStatus.AwaitingEndorsement ||
                            it.status == IssueStatus.Rejected
                    },
                    role = role,
                    statusFilter = null,
                    onFilter = {},
                    onOpenReport = { report -> selectedReport = report.id },
                    onResolveWithPhoto = { _, _, _ -> },
                    canResolve = false,
                    onRefresh = { viewModel.refresh() }
                )
                else -> AccountScreen(appViewModel)
            }
        }
    }

    state.reports.firstOrNull { it.id == selectedReport }?.let { report ->
        ReportDetailDialog(
            report = report,
            role = role,
            workforce = state.workforce,
            errorMessage = state.errorMessage,
            onAssign = { cleanerId ->
                viewModel.assignCleaner(report.id, cleanerId) {
                    selectedReport = null
                }
            },
            onReviewResolution = { endorse, reviewNotes ->
                viewModel.reviewResolution(report, endorse, reviewNotes) {
                    selectedReport = null
                }
            },
            onDismiss = {
                selectedReport = null
                viewModel.clearError()
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskBoard(
    isLoading: Boolean,
    reports: List<org.spotfix.community.model.IssueReport>,
    role: AppRole,
    statusFilter: String?,
    onFilter: (String?) -> Unit,
    onOpenReport: (IssueReport) -> Unit,
    onResolveWithPhoto: (IssueReport, List<ResolvePhotoAttachment>, ReportCoordinate?) -> Unit,
    canResolve: Boolean,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var resolveEvidenceTarget by remember { mutableStateOf<IssueReport?>(null) }
    var pendingResolutionAttachments by remember { mutableStateOf<List<ResolvePhotoAttachment>>(emptyList()) }
    var pendingResolutionCoordinate by remember { mutableStateOf<ReportCoordinate?>(null) }
    var pendingCaptureFile by remember { mutableStateOf<File?>(null) }
    var pendingCaptureUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var isCapturingLocation by remember { mutableStateOf(false) }
    var photoErrorMessage by remember { mutableStateOf<String?>(null) }

    val openResolveEvidence = remember {
        { report: IssueReport ->
            if (resolveEvidenceTarget?.id != report.id) {
                pendingResolutionAttachments = emptyList()
                pendingResolutionCoordinate = null
            }
            resolveEvidenceTarget = report
        }
    }

    fun attachCurrentLocation() {
        isCapturingLocation = true
        scope.launch {
            pendingResolutionCoordinate = captureCurrentLocation(context)
            isCapturingLocation = false
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            attachCurrentLocation()
        } else {
            isCapturingLocation = false
        }
    }

    val requestCurrentLocation = remember(context, scope) {
        {
            val hasPermission =
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            if (hasPermission) {
                attachCurrentLocation()
            } else {
                locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
    }

    val photoLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS)
    ) { uris ->
        val target = resolveEvidenceTarget
        if (target != null) {
            val attachments = uris.mapNotNull { uri ->
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return@mapNotNull null
                val contentType = context.contentResolver.getType(uri)
                    ?.takeIf { it.startsWith("image/") }
                    ?: "image/jpeg"
                ResolvePhotoAttachment(bytes = bytes, contentType = contentType)
            }
            if (attachments.isNotEmpty()) {
                pendingResolutionAttachments = appendResolutionAttachments(
                    existing = pendingResolutionAttachments,
                    added = attachments
                )
            }
        }
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val target = resolveEvidenceTarget
        val file = pendingCaptureFile
        if (success && target != null && file != null && file.exists()) {
            val bytes = runCatching { file.readBytes() }.getOrNull()
            if (bytes != null) {
                pendingResolutionAttachments = appendResolutionAttachments(
                    existing = pendingResolutionAttachments,
                    added = listOf(ResolvePhotoAttachment(bytes = bytes))
                )
            }
        }
        runCatching { file?.delete() }
        pendingCaptureFile = null
        pendingCaptureUri = null
    }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        val uri = pendingCaptureUri
        if (granted && uri != null) {
            runCatching {
                cameraLauncher.launch(uri)
            }.onFailure {
                runCatching { pendingCaptureFile?.delete() }
                pendingCaptureFile = null
                pendingCaptureUri = null
                photoErrorMessage = "Unable to open the camera on this device."
            }
        } else {
            runCatching { pendingCaptureFile?.delete() }
            pendingCaptureFile = null
            pendingCaptureUri = null
            photoErrorMessage = "Camera permission is needed to take a photo."
        }
    }

    fun launchResolveCameraCapture() {
        photoErrorMessage = null
        runCatching {
            val file = createResolveCaptureFile(context)
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            pendingCaptureFile = file
            pendingCaptureUri = uri
            if (hasCameraPermission(context)) {
                cameraLauncher.launch(uri)
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }.onFailure { error ->
            runCatching { pendingCaptureFile?.delete() }
            pendingCaptureFile = null
            pendingCaptureUri = null
            photoErrorMessage = when (error) {
                is ActivityNotFoundException -> "No camera app is available on this device."
                else -> "Unable to open the camera on this device."
            }
        }
    }
    val orderedFilters: List<String?> = listOf(null) + IssueStatus.entries.map { it.label }

    val filtered = reports.filter { statusFilter == null || it.status.label == statusFilter }
    PullToRefreshBox(
        isRefreshing = isLoading,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(SpotFixSpacing.medium),
            verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
        ) {
        item {
            androidx.compose.foundation.lazy.LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 4.dp)
            ) {
                items(orderedFilters) { option ->
                    val label = option ?: "All"
                    SpotFixFilterChip(
                        title = label,
                        selected = statusFilter == option,
                        onClick = { onFilter(option) }
                    )
                }
            }
        }
        items(filtered, key = { it.id }) { report ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                TaskReportRow(report = report, onClick = { onOpenReport(report) })
                if (canResolve && report.status != IssueStatus.Resolved && report.status != IssueStatus.AwaitingEndorsement) {
                    if (role == AppRole.Cleaner) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            SpotFixPrimaryButton(
                                text = "Take Photos",
                                onClick = {
                                    openResolveEvidence(report)
                                    launchResolveCameraCapture()
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("staff-take-photo-resolve-${report.id}")
                            )
                            SpotFixPrimaryButton(
                                text = "Upload Photos",
                                onClick = {
                                    photoErrorMessage = null
                                    openResolveEvidence(report)
                                    photoLauncher.launch(
                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                    )
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("staff-upload-photos-resolve-${report.id}")
                            )
                        }
                    } else {
                        SpotFixPrimaryButton(
                            text = "Mark as resolved",
                            onClick = { onResolveWithPhoto(report, emptyList(), null) }
                        )
                    }
                } else if (role == AppRole.Cleaner && report.status == IssueStatus.AwaitingEndorsement) {
                    Text(
                        text = "Resolution submitted. Waiting for supervisor endorsement.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }
            }
        }
    }
    }

    resolveEvidenceTarget?.let { report ->
        ResolveEvidenceDialog(
            report = report,
            attachments = pendingResolutionAttachments,
            onTakePhoto = {
                launchResolveCameraCapture()
            },
            onPickGallery = {
                photoErrorMessage = null
                photoLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
            onRemovePhoto = { index ->
                pendingResolutionAttachments = pendingResolutionAttachments.filterIndexed { currentIndex, _ ->
                    currentIndex != index
                }
            },
            resolutionCoordinate = pendingResolutionCoordinate,
            photoErrorMessage = photoErrorMessage,
            isCapturingLocation = isCapturingLocation,
            onAttachCurrentLocation = requestCurrentLocation,
            onClearLocation = { pendingResolutionCoordinate = null },
            onResolve = {
                onResolveWithPhoto(report, pendingResolutionAttachments, pendingResolutionCoordinate)
                pendingResolutionAttachments = emptyList()
                pendingResolutionCoordinate = null
                resolveEvidenceTarget = null
            },
            onDismiss = {
                pendingResolutionAttachments = emptyList()
                pendingResolutionCoordinate = null
                isCapturingLocation = false
                resolveEvidenceTarget = null
                runCatching { pendingCaptureFile?.delete() }
                pendingCaptureFile = null
                pendingCaptureUri = null
                photoErrorMessage = null
            }
        )
    }
}

private fun appendResolutionAttachments(
    existing: List<ResolvePhotoAttachment>,
    added: List<ResolvePhotoAttachment>
): List<ResolvePhotoAttachment> = normalizedResolutionAttachments(existing + added)

private fun createResolveCaptureFile(context: android.content.Context): File {
    val dir = File(context.cacheDir, "capture").apply { mkdirs() }
    return File(dir, "resolve-${System.currentTimeMillis()}.jpg")
}

private fun hasCameraPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED

@Composable
private fun ResolveEvidenceDialog(
    report: IssueReport,
    attachments: List<ResolvePhotoAttachment>,
    onTakePhoto: () -> Unit,
    onPickGallery: () -> Unit,
    onRemovePhoto: (Int) -> Unit,
    resolutionCoordinate: ReportCoordinate?,
    photoErrorMessage: String?,
    isCapturingLocation: Boolean,
    onAttachCurrentLocation: () -> Unit,
    onClearLocation: () -> Unit,
    onResolve: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Resolve ${report.id}") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Add up to ${StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS} photos. The first becomes the resolution photo; the rest are stored as extra evidence.",
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
                Text(
                    text = "Selected photos: ${attachments.size}/${StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS}",
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onTakePhoto,
                        enabled = attachments.size < StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.PhotoCamera, contentDescription = null)
                        Text("  Camera")
                    }
                    OutlinedButton(
                        onClick = onPickGallery,
                        enabled = attachments.size < StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Filled.PhotoLibrary, contentDescription = null)
                        Text("  Gallery")
                    }
                }
                photoErrorMessage?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.warning
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onAttachCurrentLocation,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(if (isCapturingLocation) "Locating..." else "Attach location")
                    }
                    OutlinedButton(
                        onClick = onClearLocation,
                        enabled = resolutionCoordinate != null,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Clear location")
                    }
                }
                Text(
                    text = resolutionCoordinate?.let {
                        "Attached location: ${formatCoordinate(it)}"
                    } ?: "Location is optional. Attach your current device position if available.",
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
                if (attachments.isEmpty()) {
                    Text(
                        text = "Take or upload at least one photo before resolving this task.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                } else {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        itemsIndexed(attachments) { index, attachment ->
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                AsyncImage(
                                    model = attachment.bytes,
                                    contentDescription = "Resolution evidence ${index + 1}",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.size(96.dp)
                                )
                                TextButton(onClick = { onRemovePhoto(index) }) {
                                    Icon(Icons.Filled.Close, contentDescription = null)
                                    Text("Remove")
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = onResolve,
                enabled = attachments.isNotEmpty(),
                modifier = Modifier.testTag("staff-confirm-resolve-${report.id}")
            ) {
                Text("Submit for review")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun TaskReportRow(report: IssueReport, onClick: () -> Unit) {
    SpotFixCard(
        modifier = Modifier
            .testTag("staff-report-${report.id}")
            .clickable(onClick = onClick)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = report.location,
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f)
                )
                SpotFixBadge(title = report.status.label, color = report.status.color)
            }
            Text(
                text = report.details,
                style = MaterialTheme.typography.bodyMedium,
                color = SpotFixColors.textSecondary
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SpotFixBadge(title = report.category, color = SpotFixColors.info)
                SpotFixBadge(title = report.priority.label, color = report.priority.color)
            }
            report.reviewNotes?.takeIf { it.isNotBlank() }?.let {
                Text(
                    text = "Review note: $it",
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
            }
            Text(
                text = "Tap to view details and photos",
                style = MaterialTheme.typography.bodySmall,
                color = SpotFixColors.primary
            )
            Text(
                text = "Submitted ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(report.submittedAt))}",
                style = MaterialTheme.typography.bodySmall,
                color = SpotFixColors.textSecondary
            )
        }
    }
}

@Composable
private fun ReportDetailDialog(
    report: IssueReport,
    role: AppRole,
    workforce: List<WorkforceMember>,
    errorMessage: String?,
    onAssign: (cleanerId: String) -> Unit,
    onReviewResolution: (Boolean, String) -> Unit,
    onDismiss: () -> Unit
) {
    val photos = (listOfNotNull(report.evidencePhotoUrl) + report.extraPhotoUrls + listOfNotNull(report.resolutionPhotoUrl)).distinct()
    var cleanerPickerExpanded by remember { mutableStateOf(false) }
    var selectedCleaner by remember { mutableStateOf<WorkforceMember?>(null) }
    var reviewNotes by remember(report.id) { mutableStateOf(report.reviewNotes.orEmpty()) }
    val canAssign = role == AppRole.Supervisor && report.status != IssueStatus.Resolved && report.status != IssueStatus.AwaitingEndorsement
    val canReview = role == AppRole.Supervisor && report.status == IssueStatus.AwaitingEndorsement

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Report ${report.id}") },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Status: ${report.status.label}", style = MaterialTheme.typography.bodySmall)
                Text("Priority: ${report.priority.label}", style = MaterialTheme.typography.bodySmall)
                Text("Category: ${report.category}", style = MaterialTheme.typography.bodySmall)
                Text("Location: ${report.location}", style = MaterialTheme.typography.bodySmall)
                report.coordinates?.let {
                    Text(
                        "Issue GPS: ${formatCoordinate(it)}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Text(
                    "Reported by: ${report.reporterName}",
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    "Submitted: ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(report.submittedAt))}",
                    style = MaterialTheme.typography.bodySmall
                )
                report.assignedTo?.let {
                    Text("Assigned to: $it", style = MaterialTheme.typography.bodySmall)
                }
                report.assignedBySupervisorName?.let {
                    Text("Assigned by: $it", style = MaterialTheme.typography.bodySmall)
                }
                report.reviewedBySupervisorName?.let {
                    Text("Reviewed by: $it", style = MaterialTheme.typography.bodySmall)
                }
                report.reviewedAt?.let {
                    Text(
                        "Reviewed at: ${DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(it))}",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                report.resolutionCoordinates?.let {
                    Text("Resolution location: ${formatCoordinate(it)}", style = MaterialTheme.typography.bodySmall)
                }
                report.resolutionDistanceMeters?.let {
                    Text(
                        "Distance from original pin: ${it.toInt()} m",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Text(report.details, style = MaterialTheme.typography.bodyMedium, color = SpotFixColors.textSecondary)
                report.reviewNotes?.takeIf { it.isNotBlank() }?.let {
                    Text("Latest review note: $it", style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
                }

                errorMessage?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.danger
                    )
                }

                if (canAssign && workforce.isNotEmpty()) {
                    Text("Assign to cleaner", style = MaterialTheme.typography.titleSmall)
                    ExposedDropdownMenuBox(
                        expanded = cleanerPickerExpanded,
                        onExpandedChange = { cleanerPickerExpanded = !cleanerPickerExpanded }
                    ) {
                        OutlinedTextField(
                            value = selectedCleaner?.name ?: "Select cleaner…",
                            onValueChange = {},
                            readOnly = true,
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = cleanerPickerExpanded) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("staff-cleaner-picker")
                                .menuAnchor()
                        )
                        DropdownMenu(
                            expanded = cleanerPickerExpanded,
                            onDismissRequest = { cleanerPickerExpanded = false }
                        ) {
                            workforce.forEach { cleaner ->
                                DropdownMenuItem(
                                    modifier = Modifier.testTag("staff-cleaner-option-${cleaner.id}"),
                                    text = { Text("${cleaner.name} (${if (cleaner.isBusy) "Busy" else "Available"})") },
                                    onClick = {
                                        selectedCleaner = cleaner
                                        cleanerPickerExpanded = false
                                    }
                                )
                            }
                        }
                    }
                    selectedCleaner?.let { cleaner ->
                        SpotFixPrimaryButton(
                            text = "Assign to ${cleaner.name}",
                            onClick = { onAssign(cleaner.id) },
                            modifier = Modifier.testTag("staff-assign-cleaner-button")
                        )
                    }
                } else if (canAssign && workforce.isEmpty()) {
                    Text(
                        "No cleaners available to assign.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }

                if (canReview) {
                    Text("Supervisor review", style = MaterialTheme.typography.titleSmall)
                    OutlinedTextField(
                        value = reviewNotes,
                        onValueChange = { reviewNotes = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Review notes") },
                        placeholder = { Text("Add optional endorsement or rejection notes") }
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { onReviewResolution(false, reviewNotes) },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Reject")
                        }
                        SpotFixPrimaryButton(
                            text = "Endorse",
                            onClick = { onReviewResolution(true, reviewNotes) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                if (photos.isEmpty()) {
                    Text(
                        "No photos attached.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                } else {
                    Text("Photos", style = MaterialTheme.typography.titleSmall)
                    photos.forEachIndexed { index, url ->
                        AsyncImage(
                            model = url,
                            contentDescription = "Report photo ${index + 1}",
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp),
                            contentScale = ContentScale.FillWidth
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        }
    )
}

@Suppress("MissingPermission")
private suspend fun captureCurrentLocation(context: Context): ReportCoordinate? {
    val client = LocationServices.getFusedLocationProviderClient(context.applicationContext)
    return suspendCancellableCoroutine { cont ->
        client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                cont.resume(location?.let { ReportCoordinate(it.latitude, it.longitude) })
            }
            .addOnFailureListener { cont.resume(null) }
    }
}

private fun formatCoordinate(coordinate: ReportCoordinate): String =
    listOf(coordinate.lat, coordinate.lng)
        .joinToString(", ") { value -> value?.let { String.format("%.5f", it) } ?: "-" }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WorkforceTab(state: StaffDashboardViewModel.State, onRefresh: () -> Unit) {
    PullToRefreshBox(
        isRefreshing = state.isLoading,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(SpotFixSpacing.medium),
            verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
        ) {
        if (state.workforce.isEmpty()) {
            item {
                SpotFixCard {
                    Text(
                        text = "No cleaners found under this supervisor yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }
            }
        }
        items(state.workforce, key = { it.id }) { member ->
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = member.name,
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.weight(1f)
                        )
                        SpotFixBadge(
                            title = if (member.isBusy) "Busy" else "Available",
                            color = if (member.isBusy) SpotFixColors.warning else SpotFixColors.success
                        )
                    }
                    Text("ID ${member.workId} • ${member.phone}", style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
                    member.assignedTaskId?.let {
                        Text("Active task: $it", style = MaterialTheme.typography.bodySmall, color = SpotFixColors.textSecondary)
                    }
                }
            }
        }
        }
    }
}
