package org.spotfix.community.support

import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.model.DashboardMetric
import org.spotfix.community.model.IssuePriority
import org.spotfix.community.model.IssueReport
import org.spotfix.community.model.ReportCoordinate
import org.spotfix.community.model.IssueStatus
import org.spotfix.community.model.WorkforceMember

/**
 * Mirrors the original iOS client — used only when the
 * backend has not yet returned data (offline-first / first-launch screens).
 */
object SampleData {
    val publicReports: List<IssueReport> = listOf(
        IssueReport(
            backendObjectId = null,
            id = "RPT-241011-1430",
            category = "Spill",
            location = "Library Lobby",
            details = "Wet floor near the entrance after a heavy downpour.",
            status = IssueStatus.InProgress,
            priority = IssuePriority.High,
            assignedTo = "Cleaner Rahman",
            reporterName = "Aisyah",
            reporterPhone = "+60123456789",
            submittedAt = System.currentTimeMillis() - 3_600_000,
            coordinates = ReportCoordinate(6.4654, 100.5054)
        ),
        IssueReport(
            backendObjectId = null,
            id = "RPT-241011-0915",
            category = "Litter",
            location = "DKG 3, Row 4",
            details = "Several drink cups left after a class.",
            status = IssueStatus.Reported,
            priority = IssuePriority.Medium,
            assignedTo = null,
            reporterName = "Aisyah",
            reporterPhone = "+60123456789",
            submittedAt = System.currentTimeMillis() - 86_400_000
        ),
        IssueReport(
            backendObjectId = null,
            id = "RPT-241010-1612",
            category = "Restroom",
            location = "MAS Cafeteria",
            details = "Soap dispenser empty in the male restroom.",
            status = IssueStatus.Resolved,
            priority = IssuePriority.Low,
            assignedTo = "Cleaner Rahman",
            reporterName = "Aisyah",
            reporterPhone = "+60123456789",
            submittedAt = System.currentTimeMillis() - 172_800_000
        )
    )

    val staffReports: List<IssueReport> = publicReports

    val workforce: List<WorkforceMember> = listOf(
        WorkforceMember(null, "STF-01", "Cleaner Rahman", "C-01", "+60198765432", true, "RPT-241011-1430", "Supervisor Nora", null),
        WorkforceMember(null, "STF-02", "Cleaner Aida", "C-02", "+60198765433", false, null, "Supervisor Nora", null),
        WorkforceMember(null, "STF-03", "Cleaner Hadi", "C-03", "+60198765434", false, null, "Supervisor Nora", null)
    )

    val adminMetrics: List<DashboardMetric> = listOf(
        DashboardMetric("Active Reports", "12", SpotFixColors.warning),
        DashboardMetric("Resolved Today", "8", SpotFixColors.success),
        DashboardMetric("Cleaners On Duty", "5", SpotFixColors.info),
        DashboardMetric("Avg. Resolution", "42 min", SpotFixColors.primary)
    )
}
