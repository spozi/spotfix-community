package org.spotfix.community.feature.publicportal

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircleOutline
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.viewmodel.initializer
import coil.compose.AsyncImage
import org.spotfix.community.designsystem.SpotFixBadge
import org.spotfix.community.designsystem.SpotFixBottomNav
import org.spotfix.community.designsystem.SpotFixCard
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixFilterChip
import org.spotfix.community.designsystem.SpotFixGradientHeader
import org.spotfix.community.designsystem.SpotFixGradients
import org.spotfix.community.designsystem.SpotFixIconBadge
import org.spotfix.community.designsystem.SpotFixNavItem
import org.spotfix.community.designsystem.SpotFixPrimaryButton
import org.spotfix.community.designsystem.SpotFixRadius
import org.spotfix.community.designsystem.SpotFixSectionHeader
import org.spotfix.community.designsystem.SpotFixSpacing
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.feature.shared.AccountScreen
import org.spotfix.community.model.IssueReport
import java.io.File
import java.text.DateFormat
import java.util.Date

/**
 * Public-user portal redesigned for stitch-syafiq mobile screens.
 *
 * Tabs (bottom navigation):
 *   - Home: gradient header + welcome + Report-an-Issue CTA + Recent reports preview
 *   - Report: composer (location, details, category, photo)
 *   - Account: shared profile screen
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)
@Composable
fun PublicPortalScreen(appViewModel: AppViewModel) {
    val appState by appViewModel.state.collectAsStateWithLifecycle()
    val session = appState.session ?: return

    val reportsViewModel: PublicReportsViewModel = viewModel(
        key = "public-reports-${session.auth.userId}",
        factory = viewModelFactory {
            initializer { PublicReportsViewModel(appViewModel.apiClient, session) }
        }
    )
    val composerViewModel: ReportComposerViewModel = viewModel(
        key = "public-composer-${session.auth.userId}",
        factory = viewModelFactory {
            initializer { ReportComposerViewModel(appViewModel.apiClient, session) }
        }
    )
    val composerState by composerViewModel.state.collectAsStateWithLifecycle()

    var selectedTab by rememberSaveable { mutableStateOf("home") }
    var submittedReport by remember { mutableStateOf<IssueReport?>(null) }
    val items = remember {
        listOf(
            SpotFixNavItem("home", "Home", Icons.Filled.Home),
            SpotFixNavItem("report", "Report", Icons.Filled.AddCircleOutline),
            SpotFixNavItem("account", "Account", Icons.Filled.Person)
        )
    }

    LaunchedEffect(composerViewModel) {
        composerViewModel.submittedReports.collect { report ->
            submittedReport = report
        }
    }

    Scaffold(
        containerColor = SpotFixColors.background,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0),
        bottomBar = {
            SpotFixBottomNav(
                items = items,
                selectedKey = selectedTab,
                onSelected = {
                    if (!composerState.isSubmitting && submittedReport == null) {
                        selectedTab = it
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .semantics { testTagsAsResourceId = true }
        ) {
            when (selectedTab) {
                "home" -> HomeTab(
                    userName = session.auth.name,
                    reportsViewModel = reportsViewModel,
                    onTapReport = { selectedTab = "report" }
                )
                "report" -> ReportComposerTab(composerViewModel)
                else -> AccountScreen(appViewModel)
            }

            if (composerState.isSubmitting) {
                AlertDialog(
                    onDismissRequest = {},
                    confirmButton = {},
                    title = { Text("Submitting report") },
                    text = {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(28.dp))
                            Text(
                                text = "Please wait for the server response. Your report will be submitted once the request completes.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = SpotFixColors.textSecondary
                            )
                        }
                    }
                )
            }

            submittedReport?.let { report ->
                AlertDialog(
                    onDismissRequest = {},
                    confirmButton = {
                        TextButton(
                            onClick = {
                                reportsViewModel.appendOptimistic(report)
                                reportsViewModel.refresh(silent = true)
                                submittedReport = null
                                selectedTab = "home"
                            }
                        ) {
                            Text("OK")
                        }
                    },
                    title = { Text("Report submitted") },
                    text = {
                        Text(
                            text = "Your report ${report.id} has been successfully submitted. Tap OK to open your report status dashboard.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SpotFixColors.textSecondary
                        )
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HomeTab(
    userName: String,
    reportsViewModel: PublicReportsViewModel,
    onTapReport: () -> Unit
) {
    val state by reportsViewModel.state.collectAsStateWithLifecycle()
    var selectedReportId by rememberSaveable { mutableStateOf<String?>(null) }

    PullToRefreshBox(
        isRefreshing = state.isLoading,
        onRefresh = { reportsViewModel.refresh() },
        modifier = Modifier.fillMaxSize()
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = SpotFixSpacing.xLarge),
            verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
        ) {
        item {
            SpotFixGradientHeader(
                title = "Hello, ${userName.substringBefore(' ')} 👋",
                subtitle = "Thanks for keeping campus clean.",
                trailing = {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.20f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = userName.firstOrNull()?.uppercase() ?: "U",
                            color = Color.White,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            ) {
                ReportCallToAction(onClick = onTapReport)
            }
        }

        item {
            Box(modifier = Modifier.padding(horizontal = SpotFixSpacing.medium)) {
                SpotFixSectionHeader(
                    title = "Recent reports",
                    subtitle = "Track the status of issues you raised."
                )
            }
        }

        if (state.isLoading && state.reports.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) { CircularProgressIndicator() }
            }
        } else if (state.reports.isEmpty()) {
            item {
                Box(modifier = Modifier.padding(horizontal = SpotFixSpacing.medium)) {
                    SpotFixCard {
                        Text(
                            text = "No reports yet — tap “Report an Issue” to file your first one.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SpotFixColors.textSecondary
                        )
                    }
                }
            }
        } else {
            items(state.reports, key = { it.id }) { report ->
                Box(modifier = Modifier.padding(horizontal = SpotFixSpacing.medium)) {
                    ReportRow(report, onClick = { selectedReportId = report.id })
                }
            }
        }

        state.errorMessage?.let { msg ->
            item {
                Box(modifier = Modifier.padding(horizontal = SpotFixSpacing.medium)) {
                    Text(msg, color = SpotFixColors.warning, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        }
    }

    state.reports.firstOrNull { it.id == selectedReportId }?.let { report ->
        ReporterReportDetailDialog(
            report = report,
            onDismiss = { selectedReportId = null }
        )
    }
}

@Composable
private fun ReportCallToAction(onClick: () -> Unit) {
    androidx.compose.material3.Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("report-an-issue-button")
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(SpotFixRadius.medium),
        colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = Color.White.copy(alpha = 0.96f)
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
        elevation = androidx.compose.material3.CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SpotFixSpacing.medium),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
        ) {
            SpotFixIconBadge(
                icon = Icons.Filled.AddCircleOutline,
                tint = SpotFixColors.primary,
                size = 48.dp
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(
                    text = "Report an Issue",
                    style = MaterialTheme.typography.titleMedium,
                    color = SpotFixColors.textPrimary
                )
                Text(
                    text = "Spot something? Tell us in seconds.",
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
            }
        }
    }
}

// ---------------- REPORT COMPOSER TAB ----------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReportComposerTab(
    viewModel: ReportComposerViewModel
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // Pending file + URI for camera capture. We hand the system camera a writeable
    // FileProvider URI; once TakePicture returns true we read the JPEG bytes back.
    var pendingCaptureFile by remember { mutableStateOf<File?>(null) }
    var pendingCaptureUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var photoErrorMessage by remember { mutableStateOf<String?>(null) }

    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val bytes = runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
            if (bytes != null) viewModel.addPhoto(bytes)
        }
    }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val file = pendingCaptureFile
        if (success && file != null && file.exists()) {
            val bytes = runCatching { file.readBytes() }.getOrNull()
            if (bytes != null) viewModel.addPhoto(bytes)
        }
        if (!success) {
            runCatching { file?.delete() }
        }
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

    fun launchCameraCapture() {
        photoErrorMessage = null
        runCatching {
            val file = createCaptureFile(context)
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

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(SpotFixSpacing.medium),
        verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
    ) {
        item {
            SpotFixSectionHeader(
                title = "Report an issue",
                subtitle = "Help keep the campus in good condition. Give us the details below."
            )
        }
        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.small + 4.dp)) {
                    org.spotfix.community.designsystem.LocationSelectionMap(
                        selectedCoordinate = state.coordinate,
                        selectedFloor = state.floor,
                        onCoordinateSelected = viewModel::setCoordinate,
                        onFloorSelected = viewModel::setFloor,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.location,
                        onValueChange = viewModel::setLocation,
                        label = { Text("Location description (optional)") },
                        shape = RoundedCornerShape(SpotFixRadius.small + 2.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = SpotFixColors.primary,
                            unfocusedBorderColor = SpotFixColors.border
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("report-location-field")
                    )
                    OutlinedTextField(
                        value = state.details,
                        onValueChange = viewModel::setDetails,
                        label = { Text("Describe the issue") },
                        shape = RoundedCornerShape(SpotFixRadius.small + 2.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = SpotFixColors.primary,
                            unfocusedBorderColor = SpotFixColors.border
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .testTag("report-details-field")
                    )
                    Text(
                        text = "Category",
                        style = MaterialTheme.typography.titleSmall,
                        color = SpotFixColors.textPrimary
                    )
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ReportComposerViewModel.CATEGORIES.forEach { cat ->
                            SpotFixFilterChip(
                                title = cat,
                                selected = state.category == cat,
                                onClick = { viewModel.setCategory(cat) }
                            )
                        }
                    }
                    state.errorMessage?.let {
                        Text(it, color = SpotFixColors.danger, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        item {
            SpotFixCard {
                Column(verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.small + 4.dp)) {
                    Text(
                        text = "Photo evidence (${state.photos.size}/${ReportComposerViewModel.MAX_PHOTOS})",
                        style = MaterialTheme.typography.titleSmall,
                        color = SpotFixColors.textPrimary
                    )
                    Text(
                        text = "Take fresh photos of the issue or pick up to ${ReportComposerViewModel.MAX_PHOTOS} from your gallery.",
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedButton(
                            onClick = { launchCameraCapture() },
                            enabled = state.canAddMorePhotos,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("report-take-photo")
                        ) {
                            Icon(Icons.Filled.PhotoCamera, contentDescription = null)
                            Text("  Take photo")
                        }
                        OutlinedButton(
                            onClick = {
                                photoErrorMessage = null
                                galleryLauncher.launch("image/*")
                            },
                            enabled = state.canAddMorePhotos,
                            modifier = Modifier
                                .weight(1f)
                                .testTag("report-pick-photo")
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
                    if (state.photos.isNotEmpty()) {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            itemsIndexed(state.photos) { index, bytes ->
                                Box(
                                    modifier = Modifier
                                        .size(96.dp)
                                        .clip(RoundedCornerShape(SpotFixRadius.small + 2.dp))
                                        .background(SpotFixColors.background)
                                ) {
                                    AsyncImage(
                                        model = bytes,
                                        contentDescription = "Evidence photo ${index + 1}",
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    Box(
                                        modifier = Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(4.dp)
                                            .size(24.dp)
                                            .clip(CircleShape)
                                            .background(Color.Black.copy(alpha = 0.55f))
                                            .clickable { viewModel.removePhoto(index) }
                                            .testTag("report-remove-photo-$index"),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Filled.Close,
                                            contentDescription = "Remove photo ${index + 1}",
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    if (index == 0) {
                                        Box(
                                            modifier = Modifier
                                                .align(Alignment.BottomStart)
                                                .padding(4.dp)
                                                .clip(RoundedCornerShape(4.dp))
                                                .background(SpotFixColors.primary)
                                                .padding(horizontal = 6.dp, vertical = 2.dp)
                                        ) {
                                            Text(
                                                text = "Evidence",
                                                color = Color.White,
                                                style = MaterialTheme.typography.labelSmall
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            SpotFixPrimaryButton(
                text = if (state.isSubmitting) "Submitting…" else "Submit report",
                enabled = !state.isSubmitting,
                modifier = Modifier.testTag("submit-report-button"),
                onClick = viewModel::submit
            )
        }
    }
}

/** Creates a unique JPEG file in `cacheDir/capture/` for the system camera to write into. */
private fun createCaptureFile(context: Context): File {
    val dir = File(context.cacheDir, "capture").apply { mkdirs() }
    return File(dir, "report-${System.currentTimeMillis()}.jpg")
}

private fun hasCameraPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED

// ---------------- REPORT ROW (shared with admin) ----------------

@Composable
internal fun ReportRow(report: IssueReport, onClick: (() -> Unit)? = null) {
    val cardModifier = if (onClick != null) {
        Modifier.clickable(onClick = onClick).testTag("public-report-${report.id}")
    } else {
        Modifier.testTag("public-report-${report.id}")
    }
    SpotFixCard(modifier = cardModifier) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                SpotFixIconBadge(
                    icon = Icons.Filled.Description,
                    tint = SpotFixColors.primary,
                    size = 36.dp
                )
                Column(
                    modifier = Modifier
                        .padding(start = SpotFixSpacing.small + 4.dp)
                        .weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = report.location,
                        style = MaterialTheme.typography.titleSmall,
                        color = SpotFixColors.textPrimary
                    )
                    Text(
                        text = report.details,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary,
                        maxLines = 2,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                }
                SpotFixBadge(title = report.status.label, color = report.status.color)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SpotFixBadge(title = report.category, color = SpotFixColors.info)
                SpotFixBadge(title = report.priority.label, color = report.priority.color)
            }
            Text(
                text = "Submitted ${
                    DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                        .format(Date(report.submittedAt))
                }",
                style = MaterialTheme.typography.labelSmall,
                color = SpotFixColors.textSecondary
            )
            if (onClick != null) {
                Text(
                    text = "Tap to view progress and photos",
                    style = MaterialTheme.typography.labelSmall,
                    color = SpotFixColors.primary
                )
            }
        }
    }
}

private fun formatPublicCoordinate(coordinate: org.spotfix.community.model.ReportCoordinate): String =
    listOf(coordinate.lat, coordinate.lng)
        .joinToString(", ") { value -> value?.let { String.format("%.5f", it) } ?: "-" }

/**
 * Reporter-facing detail dialog showing the full progress timeline of a report:
 *   Submitted → Assigned → Awaiting Endorsement → Resolved (or Rejected).
 * Renders evidence photos uploaded at submission, the cleaner's resolution photos
 * once submitted for review, supervisor review notes, and timestamps.
 */
@Composable
private fun ReporterReportDetailDialog(
    report: IssueReport,
    onDismiss: () -> Unit
) {
    val evidencePhotos = (listOfNotNull(report.evidencePhotoUrl) +
        report.extraPhotoUrls.filter { it != report.resolutionPhotoUrl }).distinct()
    val resolutionPhotos = listOfNotNull(report.resolutionPhotoUrl)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Report ${report.id}") },
        text = {
            androidx.compose.foundation.lazy.LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Status: ", style = MaterialTheme.typography.bodySmall)
                        SpotFixBadge(title = report.status.label, color = report.status.color)
                    }
                }
                item {
                    Text("Priority: ${report.priority.label}", style = MaterialTheme.typography.bodySmall)
                }
                item {
                    Text("Category: ${report.category}", style = MaterialTheme.typography.bodySmall)
                }
                item {
                    Text("Location: ${report.location}", style = MaterialTheme.typography.bodySmall)
                }
                report.coordinates?.let { coord ->
                    item {
                        Text(
                            "GPS: ${formatPublicCoordinate(coord)}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
                item {
                    Text(
                        text = report.details,
                        style = MaterialTheme.typography.bodyMedium,
                        color = SpotFixColors.textSecondary
                    )
                }
                item {
                    SpotFixSectionHeader(
                        title = "Progress",
                        subtitle = "Track how your report is being handled."
                    )
                }
                item {
                    ProgressTimeline(report = report)
                }
                report.reviewNotes?.takeIf { it.isNotBlank() }?.let {
                    item {
                        Text(
                            text = "Supervisor note: $it",
                            style = MaterialTheme.typography.bodySmall,
                            color = SpotFixColors.textSecondary
                        )
                    }
                }
                if (evidencePhotos.isNotEmpty()) {
                    item {
                        SpotFixSectionHeader(
                            title = "Your evidence",
                            subtitle = "Photos you attached when reporting."
                        )
                    }
                    items(evidencePhotos) { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = "Evidence photo",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                        )
                    }
                }
                if (resolutionPhotos.isNotEmpty()) {
                    item {
                        SpotFixSectionHeader(
                            title = "Resolution evidence",
                            subtitle = "Photos uploaded by the cleaner after completing the task."
                        )
                    }
                    items(resolutionPhotos) { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = "Resolution photo",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )
}

@Composable
private fun ProgressTimeline(report: IssueReport) {
    val formatter = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
    val steps = mutableListOf<Triple<String, String?, Boolean>>()
    // Step 1: Submitted
    steps += Triple(
        "Submitted",
        formatter.format(Date(report.submittedAt)),
        true
    )
    // Step 2: Assigned
    val assignedReached = report.assignedTo != null ||
        report.status == org.spotfix.community.model.IssueStatus.Assigned ||
        report.status == org.spotfix.community.model.IssueStatus.InProgress ||
        report.status == org.spotfix.community.model.IssueStatus.AwaitingEndorsement ||
        report.status == org.spotfix.community.model.IssueStatus.Resolved
    steps += Triple(
        "Assigned to cleaner",
        report.assignedTo?.let { "Cleaner: $it" },
        assignedReached
    )
    // Step 3: Awaiting Endorsement
    val awaitingReached = report.status == org.spotfix.community.model.IssueStatus.AwaitingEndorsement ||
        report.status == org.spotfix.community.model.IssueStatus.Resolved ||
        report.resolutionPhotoUrl != null
    steps += Triple(
        "Resolution submitted",
        if (awaitingReached) "Cleaner submitted evidence for supervisor review." else null,
        awaitingReached
    )
    // Step 4: Endorsed / Resolved
    val resolvedReached = report.status == org.spotfix.community.model.IssueStatus.Resolved
    steps += Triple(
        "Completed",
        when {
            report.isRejected -> "Supervisor rejected the resolution; cleaner is redoing the task."
            resolvedReached && report.reviewedAt != null ->
                "Endorsed by ${report.reviewedBySupervisorName ?: "supervisor"} on ${formatter.format(Date(report.reviewedAt))}"
            resolvedReached -> "Endorsed by supervisor"
            else -> null
        },
        resolvedReached
    )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        steps.forEach { (title, detail, reached) ->
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(
                            if (reached) SpotFixColors.primary
                            else SpotFixColors.border
                        )
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (reached) SpotFixColors.textPrimary else SpotFixColors.textSecondary,
                        fontWeight = if (reached) FontWeight.SemiBold else FontWeight.Normal
                    )
                    detail?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = SpotFixColors.textSecondary
                        )
                    }
                }
            }
        }
    }
}
