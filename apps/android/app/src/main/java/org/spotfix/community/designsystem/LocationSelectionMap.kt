package org.spotfix.community.designsystem

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.graphics.Bitmap
import android.graphics.Canvas
import android.content.pm.PackageManager
import android.graphics.Color as AndroidColor
import android.graphics.Path
import android.graphics.drawable.GradientDrawable
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationSearching
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import org.spotfix.community.model.ReportCoordinate
import kotlin.coroutines.resume
import org.osmdroid.events.MapEventsReceiver
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.CustomZoomButtonsController
import org.osmdroid.views.overlay.MapEventsOverlay
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.mylocation.GpsMyLocationProvider
import org.osmdroid.views.overlay.mylocation.MyLocationNewOverlay

/** Example location used until a deployment provides a campus location. */
private val DEFAULT_CAMPUS_CENTRE = GeoPoint(3.1390, 101.6869)

private val FLOORS = listOf("Ground Level", "Level 1", "Level 2", "Level 3")

/**
 * Mirrors `apps/ios/.../Support/Location/LocationSelectionMap.swift`.
 *
 * Shows an interactive Google Map where the user can:
 *  - Tap anywhere to drop a pin (selectedCoordinate).
 *  - Press "Use current location" to snap to the device GPS position.
 *  - Choose a floor level via horizontal chip row.
 */
@SuppressLint("MissingPermission")
@Composable
fun LocationSelectionMap(
    selectedCoordinate: ReportCoordinate?,
    selectedFloor: String,
    onCoordinateSelected: (ReportCoordinate) -> Unit,
    onFloorSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    val latestCoordinateCallback by rememberUpdatedState(onCoordinateSelected)
    val selectedPoint = selectedCoordinate?.let {
        val lat = it.lat ?: return@let null
        val lng = it.lng ?: return@let null
        GeoPoint(lat, lng)
    }
    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            zoomController.setVisibility(CustomZoomButtonsController.Visibility.NEVER)
            isTilesScaledToDpi = true
            isHorizontalMapRepetitionEnabled = false
            isVerticalMapRepetitionEnabled = false
            controller.setZoom(15.0)
            controller.setCenter(DEFAULT_CAMPUS_CENTRE)
            minZoomLevel = 4.0
            maxZoomLevel = 20.0
        }
    }
    val myLocationOverlay = remember(mapView) {
        MyLocationNewOverlay(GpsMyLocationProvider(context), mapView).apply {
            setDrawAccuracyEnabled(true)
            setPersonIcon(currentLocationBitmap(context))
            setPersonAnchor(0.5f, 0.5f)
        }
    }

    var permissionGranted by remember {
        mutableStateOf(hasLocationPermission(context))
    }
    var focusAfterPermissionGrant by remember { mutableStateOf(false) }
    var isLocating by remember { mutableStateOf(false) }
    var locationMessage by remember { mutableStateOf<String?>(null) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        permissionGranted = hasLocationPermission(context)
        if (!permissionGranted) {
            focusAfterPermissionGrant = false
            locationMessage = "Location permission is needed to use your current position."
        }
    }

    fun captureAndFocusCurrentLocation() {
        if (isLocating) return
        isLocating = true
        locationMessage = null
        scope.launch {
            val location = runCatching { findBestCurrentLocation(context) }.getOrNull()
            if (location != null) {
                val point = GeoPoint(location.latitude, location.longitude)
                latestCoordinateCallback(ReportCoordinate(location.latitude, location.longitude))
                mapView.controller.setZoom(17.0)
                mapView.controller.animateTo(point)
            } else {
                locationMessage = "Unable to find your current location. Check GPS and try again."
            }
            isLocating = false
        }
    }

    val focusCurrentLocation: () -> Unit = {
        permissionGranted = hasLocationPermission(context)
        if (!permissionGranted) {
            focusAfterPermissionGrant = true
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        } else {
            captureAndFocusCurrentLocation()
        }
        Unit
    }

    LaunchedEffect(permissionGranted, focusAfterPermissionGrant) {
        if (permissionGranted && focusAfterPermissionGrant) {
            focusAfterPermissionGrant = false
            captureAndFocusCurrentLocation()
        }
    }

    LaunchedEffect(Unit) {
        if (!permissionGranted) {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    LaunchedEffect(permissionGranted) {
        if (permissionGranted) {
            myLocationOverlay.enableMyLocation()
        } else {
            myLocationOverlay.disableMyLocation()
        }
        mapView.invalidate()
    }

    LaunchedEffect(selectedPoint?.latitude, selectedPoint?.longitude) {
        selectedPoint?.let {
            mapView.controller.animateTo(it)
        }
    }

    DisposableEffect(lifecycleOwner, mapView) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    permissionGranted = hasLocationPermission(context)
                    mapView.onResume()
                }
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            myLocationOverlay.disableMyLocation()
            lifecycleOwner.lifecycle.removeObserver(observer)
            mapView.onDetach()
        }
    }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)) {

        // Floor selector chips
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(FLOORS) { floor ->
                SpotFixFilterChip(
                    title = floor,
                    selected = selectedFloor == floor,
                    onClick = { onFloorSelected(floor) }
                )
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp)
                .clip(MaterialTheme.shapes.medium)
                .background(CardDefaults.cardColors().containerColor)
        ) {
            AndroidView(
                modifier = Modifier.fillMaxWidth().height(240.dp),
                factory = { mapView },
                update = { view ->
                    view.overlays.clear()
                    if (permissionGranted) {
                        view.overlays += myLocationOverlay
                    }
                    view.overlays += MapEventsOverlay(object : MapEventsReceiver {
                        override fun singleTapConfirmedHelper(p: GeoPoint): Boolean {
                            latestCoordinateCallback(ReportCoordinate(p.latitude, p.longitude))
                            return true
                        }

                        override fun longPressHelper(p: GeoPoint): Boolean = false
                    })
                    selectedPoint?.let { point ->
                        view.overlays += Marker(view).apply {
                            position = point
                            icon = selectedMarkerDrawable(context)
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            title = "Selected"
                        }
                    } ?: view.controller.setCenter(DEFAULT_CAMPUS_CENTRE)
                    view.invalidate()
                }
            )
            Surface(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(SpotFixSpacing.small),
                shape = MaterialTheme.shapes.small,
                color = SpotFixColors.surface.copy(alpha = 0.92f),
                shadowElevation = 2.dp
            ) {
                Text(
                    text = if (selectedPoint == null) "Tap to drop a pin" else "Drag map or tap to move pin",
                    modifier = Modifier.padding(horizontal = SpotFixSpacing.small, vertical = 8.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = SpotFixColors.textPrimary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Column(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(SpotFixSpacing.small),
                verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.xSmall)
            ) {
                MapControlButton(
                    icon = Icons.Filled.MyLocation,
                    contentDescription = "Use current location",
                    onClick = focusCurrentLocation,
                    enabled = !isLocating
                )
                MapControlButton(
                    icon = Icons.Filled.LocationSearching,
                    contentDescription = "Recenter to the example campus",
                    onClick = {
                        mapView.controller.setZoom(15.0)
                        mapView.controller.animateTo(DEFAULT_CAMPUS_CENTRE)
                        Unit
                    }
                )
            }
        }

        // Bottom row: button + coordinates label
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)
        ) {
            InlineMapAction(
                icon = Icons.Filled.MyLocation,
                label = if (isLocating) "Locating..." else "Use current location",
                onClick = focusCurrentLocation,
                enabled = !isLocating,
                modifier = Modifier.widthIn(min = 0.dp)
            )

            selectedCoordinate?.let {
                Column {
                    Text(
                        text = selectedFloor,
                        style = MaterialTheme.typography.labelSmall,
                        color = SpotFixColors.textPrimary
                    )
                    Text(
                        text = "%.5f, %.5f".format(it.lat ?: 0.0, it.lng ?: 0.0),
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotFixColors.textSecondary
                    )
                }
            }
        }
        locationMessage?.let {
            Text(
                text = it,
                style = MaterialTheme.typography.bodySmall,
                color = SpotFixColors.warning
            )
        }
    }
}

@Composable
private fun MapControlButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    enabled: Boolean = true
) {
    Surface(
        modifier = Modifier
            .size(42.dp),
        shape = MaterialTheme.shapes.small,
        color = SpotFixColors.surface.copy(alpha = 0.96f),
        border = BorderStroke(1.dp, SpotFixColors.border),
        shadowElevation = 3.dp
    ) {
        IconButton(onClick = onClick, enabled = enabled) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = if (enabled) SpotFixColors.textPrimary else SpotFixColors.textSecondary
            )
        }
    }
}

@Composable
private fun InlineMapAction(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.small,
        color = SpotFixColors.surface.copy(alpha = 0.96f),
        border = BorderStroke(1.dp, SpotFixColors.border),
        shadowElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = SpotFixSpacing.small, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (enabled) SpotFixColors.info else SpotFixColors.textSecondary,
                modifier = Modifier.size(18.dp)
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = if (enabled) SpotFixColors.textPrimary else SpotFixColors.textSecondary,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

private fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private fun hasFineLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

@SuppressLint("MissingPermission")
private suspend fun findBestCurrentLocation(context: Context): Location? {
    val client = LocationServices.getFusedLocationProviderClient(context.applicationContext)
    val priority = if (hasFineLocationPermission(context)) {
        Priority.PRIORITY_HIGH_ACCURACY
    } else {
        Priority.PRIORITY_BALANCED_POWER_ACCURACY
    }
    return client.awaitCurrentLocation(priority) ?: client.awaitLastLocation()
}

private suspend fun FusedLocationProviderClient.awaitCurrentLocation(priority: Int): Location? =
    suspendCancellableCoroutine { cont ->
        val cancellation = CancellationTokenSource()
        cont.invokeOnCancellation { cancellation.cancel() }
        getCurrentLocation(priority, cancellation.token)
            .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
            .addOnFailureListener { if (cont.isActive) cont.resume(null) }
            .addOnCanceledListener { if (cont.isActive) cont.resume(null) }
    }

@SuppressLint("MissingPermission")
private suspend fun FusedLocationProviderClient.awaitLastLocation(): Location? =
    suspendCancellableCoroutine { cont ->
        lastLocation
            .addOnSuccessListener { if (cont.isActive) cont.resume(it) }
            .addOnFailureListener { if (cont.isActive) cont.resume(null) }
            .addOnCanceledListener { if (cont.isActive) cont.resume(null) }
    }

private fun selectedMarkerDrawable(context: Context): BitmapDrawable {
    return BitmapDrawable(context.resources, pinMapMarkerBitmap(
        context = context,
        sizeDp = 32,
        fillColor = SpotFixColors.primary.toArgb(),
        strokeColor = AndroidColor.WHITE,
        innerColor = AndroidColor.WHITE
    )).apply {
        setBounds(0, 0, intrinsicWidth, intrinsicHeight)
    }
}

private fun currentLocationBitmap(context: Context): Bitmap {
    return circularMapMarkerBitmap(
        context = context,
        outerDp = 22,
        fillColor = SpotFixColors.info.toArgb(),
        strokeColor = AndroidColor.WHITE,
        centerColor = SpotFixColors.surface.toArgb(),
        centerDp = 6
    )
}

private fun circularMapMarkerBitmap(
    context: Context,
    outerDp: Int,
    fillColor: Int,
    strokeColor: Int,
    centerColor: Int,
    centerDp: Int
): Bitmap {
    val sizePx = dpToPx(context, outerDp)
    val centerPx = dpToPx(context, centerDp)
    val strokePx = dpToPx(context, 3)
    val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val outerRadius = sizePx / 2f
    val innerRadius = (sizePx - strokePx * 2) / 2f
    val centerRadius = centerPx / 2f

    val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.FILL
    }
    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = fillColor
        style = Paint.Style.FILL
    }
    val centerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = centerColor
        style = Paint.Style.FILL
    }

    canvas.drawCircle(outerRadius, outerRadius, outerRadius, strokePaint)
    canvas.drawCircle(outerRadius, outerRadius, innerRadius, fillPaint)
    canvas.drawCircle(outerRadius, outerRadius, centerRadius, centerPaint)
    return bitmap
}

private fun pinMapMarkerBitmap(
    context: Context,
    sizeDp: Int,
    fillColor: Int,
    strokeColor: Int,
    innerColor: Int
): Bitmap {
    val width = dpToPx(context, sizeDp)
    val height = (width * 1.35f).toInt()
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val centerX = width / 2f
    val headRadius = width * 0.28f
    val headCenterY = width * 0.34f
    val strokeWidth = dpToPx(context, 3).toFloat()

    val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = strokeColor
        style = Paint.Style.FILL
    }
    val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = fillColor
        style = Paint.Style.FILL
    }
    val innerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = innerColor
        style = Paint.Style.FILL
    }

    val outlinePath = Path().apply {
        moveTo(centerX, height.toFloat())
        lineTo(centerX - headRadius * 0.72f, headCenterY + headRadius * 0.9f)
        lineTo(centerX + headRadius * 0.72f, headCenterY + headRadius * 0.9f)
        close()
    }
    val fillPath = Path().apply {
        moveTo(centerX, height - strokeWidth)
        lineTo(centerX - headRadius * 0.52f, headCenterY + headRadius * 0.78f)
        lineTo(centerX + headRadius * 0.52f, headCenterY + headRadius * 0.78f)
        close()
    }

    canvas.drawPath(outlinePath, outlinePaint)
    canvas.drawCircle(centerX, headCenterY, headRadius + strokeWidth / 2f, outlinePaint)
    canvas.drawPath(fillPath, fillPaint)
    canvas.drawCircle(centerX, headCenterY, headRadius, fillPaint)
    canvas.drawCircle(centerX, headCenterY, headRadius * 0.42f, innerPaint)
    return bitmap
}

private fun dpToPx(context: Context, value: Int): Int {
    return (value * context.resources.displayMetrics.density).toInt()
}
