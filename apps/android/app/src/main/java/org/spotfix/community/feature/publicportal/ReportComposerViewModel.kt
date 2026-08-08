package org.spotfix.community.feature.publicportal

import android.content.Context
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.IssuePriority
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.ReportCoordinate
import org.spotfix.community.model.UserSession
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

/**
 * Mirrors the original iOS client.
 *
 * Categories list is intentionally identical to iOS so analytics line up across platforms.
 */
class ReportComposerViewModel(
    private val apiClient: SpotFixApiClient,
    private val session: UserSession
) : ViewModel() {

    data class State(
        val category: String = CATEGORIES.first(),
        val location: String = "",
        val floor: String = FLOORS.first(),
        val details: String = "",
        val priority: IssuePriority = IssuePriority.Medium,
        val coordinate: ReportCoordinate? = null,
        val photos: List<ByteArray> = emptyList(),
        val isSubmitting: Boolean = false,
        val errorMessage: String? = null
    ) {
        val canAddMorePhotos: Boolean get() = photos.size < MAX_PHOTOS
    }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    private val _submittedReports = MutableSharedFlow<IssueReport>(extraBufferCapacity = 1)
    val submittedReports: SharedFlow<IssueReport> = _submittedReports.asSharedFlow()

    fun setCategory(value: String) = _state.update { it.copy(category = value) }
    fun setLocation(value: String) = _state.update { it.copy(location = value) }
    fun setFloor(value: String) = _state.update { it.copy(floor = value) }
    fun setCoordinate(value: ReportCoordinate) = _state.update { it.copy(coordinate = value) }
    fun setDetails(value: String) = _state.update { it.copy(details = value) }
    fun setPriority(value: IssuePriority) = _state.update { it.copy(priority = value) }
    fun addPhoto(bytes: ByteArray) = _state.update {
        if (it.photos.size >= MAX_PHOTOS) it else it.copy(photos = it.photos + bytes)
    }
    fun removePhoto(index: Int) = _state.update {
        if (index !in it.photos.indices) it
        else it.copy(photos = it.photos.toMutableList().apply { removeAt(index) })
    }
    fun clearError() = _state.update { it.copy(errorMessage = null) }

    @Suppress("MissingPermission")
    fun captureCurrentLocation(context: Context) {
        viewModelScope.launch {
            val client = LocationServices.getFusedLocationProviderClient(context.applicationContext)
            val location: Location? = suspendCancellableCoroutine { cont ->
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { cont.resume(it) }
                    .addOnFailureListener { cont.resume(null) }
            }
            if (location != null) {
                _state.update { it.copy(coordinate = ReportCoordinate(location.latitude, location.longitude)) }
            }
        }
    }

    /**
     * Submits the form and emits the persisted [IssueReport] once the server responds.
     * The request is launched from [viewModelScope] so it is not cancelled if the composable
     * tree recomposes while the request is still in flight.
     */
    fun submit() {
        val current = _state.value
        if (current.isSubmitting) {
            return
        }
        if (current.location.isBlank() || current.details.isBlank()) {
            _state.update { it.copy(errorMessage = "Location and details are required.") }
            return
        }

        _state.update { it.copy(isSubmitting = true, errorMessage = null) }

        viewModelScope.launch {
            try {
                val publicId = "RPT-${TIMESTAMP_FORMAT.format(Date())}"
                val locationLabel = if (current.location.isNotBlank()) "${current.floor} – ${current.location.trim()}" else current.floor
                val saved = withTimeout(REPORT_CREATE_TIMEOUT_MS) {
                    apiClient.createReport(
                        id = publicId,
                        category = current.category,
                        location = locationLabel,
                        details = current.details.trim(),
                        priority = current.priority,
                        coordinates = current.coordinate,
                        reporterPhone = session.profile.phone,
                        accessToken = session.accessToken
                    )
                }
                withTimeoutOrNull(PHOTO_UPLOAD_BUDGET_MS) {
                    current.photos.forEachIndexed { index, bytes ->
                        runCatching {
                            apiClient.uploadReportPhoto(
                                reportId = saved.id,
                                kind = if (index == 0) "evidence" else "extra",
                                bytes = bytes,
                                contentType = "image/jpeg",
                                accessToken = session.accessToken
                            )
                        }
                    }
                }
                _state.value = State()
                _submittedReports.tryEmit(saved)
            } catch (e: Throwable) {
                _state.update {
                    it.copy(
                        isSubmitting = false,
                        errorMessage = e.message ?: "Unable to submit report right now."
                    )
                }
            }
        }
    }

    companion object {
        const val MAX_PHOTOS = 6
        val CATEGORIES = listOf("Litter", "Spill", "Restroom", "Floor", "Damage")
        val FLOORS = listOf("Ground Level", "Level 1", "Level 2", "Level 3")
        private val TIMESTAMP_FORMAT = SimpleDateFormat("yyMMddHHmmss", Locale.US)
        private const val REPORT_CREATE_TIMEOUT_MS = 45_000L
        private const val PHOTO_UPLOAD_BUDGET_MS = 45_000L
    }
}
