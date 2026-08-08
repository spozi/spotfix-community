package org.spotfix.community

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Smoke flow exercising the slice of the app that is fully renderable on-device
 * without a live backend or a persisted session: RoleSelectionScreen → AuthEntryScreen.
 *
 * Assumes app data was cleared before the run (no persisted session); the gradle task
 * driving these tests pipes a `pm clear org.spotfix.community.debug` first.
 */
@RunWith(AndroidJUnit4::class)
class SmokeFlowTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun roleSelector_isShownOnColdLaunch() {
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("continue-selected-role-button").assertIsDisplayed()
    }

    @Test
    fun roleSelector_continuesIntoAuthEntry() {
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("continue-selected-role-button")
            .assertIsDisplayed()
            .performClick()

        composeRule.waitForIdle()
        composeRule.onNodeWithTag("id-number-field").assertIsDisplayed()
        composeRule.onNodeWithTag("password-field").assertIsDisplayed()
        composeRule.onNodeWithTag("auth-submit-button").assertIsDisplayed()
    }

    @Test
    fun authEntry_acceptsBasicInputFlow() {
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("continue-selected-role-button").performClick()
        composeRule.waitForIdle()

        // Clear any restored form values from previous state before entering data.
        composeRule.onNodeWithTag("id-number-field").performTextReplacement("")
        composeRule.onNodeWithTag("password-field").performTextReplacement("")
        composeRule.onNodeWithTag("id-number-field").performTextInput("123456")
        composeRule.onNodeWithTag("password-field").performTextInput("secret-1234")
        composeRule.waitForIdle()
        composeRule.onNodeWithTag("auth-submit-button").assertIsDisplayed()
    }
}
