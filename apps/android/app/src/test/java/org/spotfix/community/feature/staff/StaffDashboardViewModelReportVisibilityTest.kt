package org.spotfix.community.feature.staff

import org.spotfix.community.model.AppRole
import org.spotfix.community.model.IssuePriority
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.IssueStatus
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class StaffDashboardViewModelReportVisibilityTest {

    @Test
    fun cleanerDashboard_keepsServerScopedAssignmentsVisible() {
        val report = IssueReport(
            backendObjectId = "report-row-1",
            id = "RPT-1",
            category = "Spill",
            location = "Level 1 - Corridor",
            details = "Wet floor near the stairs",
            status = IssueStatus.InProgress,
            priority = IssuePriority.Medium,
            assignedTo = "Cleaner A",
            reporterName = "Reporter A",
            reporterPhone = "0123456789",
            submittedAt = 0L,
            assignedToCleanerId = "cleaner-roster-7"
        )

        val visible = dashboardReportsForRole(AppRole.Cleaner, listOf(report))

        assertEquals(listOf(report), visible)
    }

    @Test
    fun supervisorReviewReports_onlyIncludesAwaitingEndorsement() {
        val awaiting = report("RPT-1", IssueStatus.AwaitingEndorsement)
        val assigned = report("RPT-2", IssueStatus.Assigned)
        val resolved = report("RPT-3", IssueStatus.Resolved)

        val visible = supervisorReviewReports(listOf(awaiting, assigned, resolved))

        assertEquals(listOf(awaiting), visible)
    }

    @Test
    fun normalizedResolutionAttachments_capsAtSixAndPreservesOrder() {
        val attachments = (1..8).map { index ->
            ResolvePhotoAttachment(
                bytes = byteArrayOf(index.toByte()),
                contentType = if (index % 2 == 0) "image/png" else "image/jpeg"
            )
        }

        val normalized = normalizedResolutionAttachments(attachments)

        assertEquals(StaffDashboardViewModel.MAX_RESOLUTION_PHOTOS, normalized.size)
        assertArrayEquals(byteArrayOf(1), normalized.first().bytes)
        assertEquals("image/jpeg", normalized.first().contentType)
        assertArrayEquals(byteArrayOf(6), normalized.last().bytes)
        assertEquals("image/png", normalized.last().contentType)
    }

    private fun report(id: String, status: IssueStatus): IssueReport =
        IssueReport(
            backendObjectId = "row-$id",
            id = id,
            category = "Cleaning",
            location = "Library",
            details = "Details",
            status = status,
            priority = IssuePriority.Medium,
            reporterName = "Reporter A",
            reporterPhone = "0123456789",
            submittedAt = 0L
        )
}
