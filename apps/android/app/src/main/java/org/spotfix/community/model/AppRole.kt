package org.spotfix.community.model

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.CleaningServices
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import org.spotfix.community.designsystem.SpotFixColors

/**
 * 1:1 port of the original iOS client.
 *
 * Member name + ordering matches the Swift enum so cross-platform reviewers can scan diffs.
 * The role names are also part of the JWT payload (`auth.role`); keep [fromApi] in lockstep with
 * the API-side strings.
 */
enum class AppRole(val id: String) {
    PublicUser("publicUser"),
    Supervisor("supervisor"),
    Cleaner("cleaner"),
    MasterAdmin("masterAdmin");

    val isStaff: Boolean get() = this == Supervisor || this == Cleaner

    val title: String
        get() = when (this) {
            PublicUser -> "Public Reporter"
            Supervisor -> "Supervisor"
            Cleaner -> "Cleaner"
            MasterAdmin -> "Master / Admin"
        }

    val subtitle: String
        get() = when (this) {
            PublicUser -> "Submit issues, track progress, and view your report history."
            Supervisor -> "Manage tasks, assign cleaners, and coordinate maintenance work."
            Cleaner -> "Review active tasks and update field progress quickly."
            MasterAdmin -> "Monitor system performance and switch between operational views."
        }

    val icon: ImageVector
        get() = when (this) {
            PublicUser -> Icons.Filled.Campaign
            Supervisor -> Icons.Filled.Group
            Cleaner -> Icons.Filled.CleaningServices
            MasterAdmin -> Icons.Filled.WorkspacePremium
        }

    val accentColor: Color
        get() = when (this) {
            PublicUser -> SpotFixColors.primary
            Supervisor -> SpotFixColors.secondary
            Cleaner -> SpotFixColors.success
            MasterAdmin -> SpotFixColors.master
        }

    val authTitle: String
        get() = when (this) {
            PublicUser -> "Public Access"
            Supervisor -> "Supervisor Access"
            Cleaner -> "Cleaner Access"
            MasterAdmin -> "Master Access"
        }

    val demoName: String
        get() = when (this) {
            PublicUser -> "Aisyah"
            Supervisor -> "Supervisor Nora"
            Cleaner -> "Cleaner Rahman"
            MasterAdmin -> "Master Admin"
        }

    fun acceptsAuthenticatedRole(role: AppRole): Boolean = when (this) {
        PublicUser -> role == PublicUser
        Supervisor, Cleaner -> role.isStaff
        MasterAdmin -> role == MasterAdmin
    }

    companion object {
        fun fromApi(apiRole: String?): AppRole = when (apiRole?.lowercase()) {
            "supervisor" -> Supervisor
            "cleaner", "service_officer" -> Cleaner
            "master" -> MasterAdmin
            else -> PublicUser
        }
    }
}
