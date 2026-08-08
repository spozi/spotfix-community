package org.spotfix.community.feature.publicportal

import org.spotfix.community.api.SpotFixApiClient
import org.spotfix.community.model.SessionAuthContext
import org.spotfix.community.model.SessionProfile
import org.spotfix.community.model.UserSession
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReportComposerViewModelPhotoLimitTest {

    private val session = UserSession(
        accessToken = "token",
        auth = SessionAuthContext(
            userId = "user-1",
            role = "public",
            name = "Test User",
            authType = "user"
        ),
        permissions = emptyList(),
        profile = SessionProfile(
            id = "profile-1",
            name = "Test User",
            phone = "0123456789"
        )
    )

    private fun createViewModel(): ReportComposerViewModel {
        val apiClient = SpotFixApiClient(
            baseUrl = "https://example.invalid/api/v1",
            tenantSlug = "example-campus"
        )
        return ReportComposerViewModel(apiClient = apiClient, session = session)
    }

    @Test
    fun addPhoto_capsAtSixAndDisablesFurtherAdditions() {
        val vm = createViewModel()

        val photos = (1..(ReportComposerViewModel.MAX_PHOTOS + 2)).map { index ->
            byteArrayOf(index.toByte(), (index + 1).toByte())
        }
        photos.forEach(vm::addPhoto)

        val state = vm.state.value
        assertEquals(ReportComposerViewModel.MAX_PHOTOS, state.photos.size)
        assertFalse(state.canAddMorePhotos)

        // Verify the extra insertions after six are ignored.
        assertArrayEquals(photos[0], state.photos[0])
        assertArrayEquals(photos[ReportComposerViewModel.MAX_PHOTOS - 1], state.photos.last())
    }

    @Test
    fun removePhoto_handlesBoundsAndReenablesAddAfterDropBelowMax() {
        val vm = createViewModel()
        val first = byteArrayOf(1, 2, 3)
        val second = byteArrayOf(4, 5, 6)

        vm.addPhoto(first)
        vm.addPhoto(second)

        vm.removePhoto(-1)
        vm.removePhoto(99)
        assertEquals(2, vm.state.value.photos.size)

        vm.removePhoto(0)
        val state = vm.state.value
        assertEquals(1, state.photos.size)
        assertTrue(state.canAddMorePhotos)
        assertArrayEquals(second, state.photos.single())
    }
}
