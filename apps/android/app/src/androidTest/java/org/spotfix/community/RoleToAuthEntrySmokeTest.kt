package org.spotfix.community

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RoleToAuthEntrySmokeTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun continueSelectedRole_navigatesToAuthEntry() {
        composeRule.onNodeWithTag("continue-selected-role-button", useUnmergedTree = true)
            .assertIsDisplayed()
            .performClick()

        composeRule.onNodeWithTag("id-number-field", useUnmergedTree = true)
            .assertIsDisplayed()
        composeRule.onNodeWithTag("password-field", useUnmergedTree = true)
            .assertIsDisplayed()
        composeRule.onNodeWithTag("auth-submit-button", useUnmergedTree = true)
            .assertIsDisplayed()
    }
}
