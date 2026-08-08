package org.spotfix.community.feature.auth

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.spotfix.community.api.GoogleSignInException
import org.spotfix.community.R
import org.spotfix.community.designsystem.SpotFixColors
import org.spotfix.community.designsystem.SpotFixGradientHeader
import org.spotfix.community.designsystem.SpotFixPrimaryButton
import org.spotfix.community.designsystem.SpotFixRadius
import org.spotfix.community.designsystem.SpotFixSecondaryButton
import org.spotfix.community.designsystem.SpotFixSpacing
import org.spotfix.community.feature.app.AppViewModel
import org.spotfix.community.feature.app.AppViewModel.AuthFormMode
import org.spotfix.community.model.AppRole

/**
 * Sign in / register screen — visual port of the stitch-syafiq Sign In MOBILE design.
 *
 * Structure:
 *   - Indigo→violet gradient hero with role icon, app name, sub-title, and a back chevron.
 *   - White rounded form card overlapping the gradient (parallax feel).
 *   - Form: identifier, password (with eye toggle), forgot password link.
 *   - Optional segmented Login/Register tabs (public users only).
 *   - Optional Google button (public users only).
 */
@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun AuthEntryScreen(
    role: AppRole,
    appViewModel: AppViewModel,
    onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val supportsRegistration = role == AppRole.PublicUser
    val supportsGoogle = role == AppRole.PublicUser && appViewModel.googleSignInProvider.isConfigured

    var mode by rememberSaveable { mutableStateOf(AuthFormMode.Login) }
    var name by rememberSaveable { mutableStateOf("") }
    var identifier by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var showGoogleAccountSettings by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }

    val identifierLabel = when (role) {
        AppRole.MasterAdmin -> "Username"
        AppRole.PublicUser -> if (mode == AuthFormMode.Register) "ID number" else "Email or ID number"
        else -> "ID number"
    }
    val identifierKeyboard = if (role == AppRole.PublicUser && mode == AuthFormMode.Login) {
        KeyboardType.Email
    } else {
        KeyboardType.Text
    }
    val primaryActionTitle = when {
        mode == AuthFormMode.Register -> "Create Account"
        role == AppRole.MasterAdmin -> "Sign In to Master Portal"
        else -> "Sign In"
    }

    val canSubmit = when {
        submitting -> false
        mode == AuthFormMode.Register -> name.isNotBlank() && identifier.isNotBlank() &&
            phone.isNotBlank() && password.isNotBlank() &&
            email.contains('@') && email.contains('.')
        else -> identifier.isNotBlank() && password.isNotBlank()
    }

    Scaffold(
        containerColor = SpotFixColors.background,
        contentWindowInsets = androidx.compose.foundation.layout.WindowInsets(0)
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .semantics { testTagsAsResourceId = true },
            verticalArrangement = Arrangement.spacedBy(0.dp),
            contentPadding = PaddingValues(bottom = SpotFixSpacing.xLarge)
        ) {
            item {
                SpotFixGradientHeader(
                    title = role.authTitle,
                    subtitle = "Sign in to continue to SpotFix Community",
                    leading = {
                        IconButton(onClick = onBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = Color.White
                            )
                        }
                    },
                    trailing = {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color.White.copy(alpha = 0.18f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = role.icon,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                )
            }

            // Overlapping white form card
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .offset(y = (-20).dp)
                        .padding(horizontal = SpotFixSpacing.medium)
                ) {
                    androidx.compose.material3.Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(SpotFixRadius.large),
                        colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = SpotFixColors.surface),
                        border = androidx.compose.foundation.BorderStroke(1.dp, SpotFixColors.border),
                        elevation = androidx.compose.material3.CardDefaults.cardElevation(defaultElevation = 4.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(SpotFixSpacing.medium + 4.dp),
                            verticalArrangement = Arrangement.spacedBy(SpotFixSpacing.medium)
                        ) {
                            // Logo as first row
                            Image(
                                painter = painterResource(id = R.drawable.ic_launcher_foreground),
                                contentDescription = "SpotFix Community logo",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(140.dp)
                                    .clip(RoundedCornerShape(16.dp)),
                                contentScale = ContentScale.Crop
                            )

                            if (supportsRegistration) {
                                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                                    AuthFormMode.entries.forEachIndexed { index, value ->
                                        SegmentedButton(
                                            selected = mode == value,
                                            onClick = { mode = value },
                                            shape = SegmentedButtonDefaults.itemShape(
                                                index = index,
                                                count = AuthFormMode.entries.size
                                            )
                                        ) { Text(value.label) }
                                    }
                                }
                            }

                            Text(
                                text = if (mode == AuthFormMode.Register) "Create your account" else "Welcome back",
                                style = MaterialTheme.typography.titleMedium,
                                color = SpotFixColors.textPrimary,
                                fontWeight = FontWeight.SemiBold
                            )

                            if (mode == AuthFormMode.Register) {
                                AuthField(value = name, onChange = { name = it }, label = "Full name")
                                AuthField(
                                    value = email,
                                    onChange = { email = it },
                                    label = "Email",
                                    keyboardType = KeyboardType.Email
                                )
                                AuthField(
                                    value = phone,
                                    onChange = { phone = it },
                                    label = "Phone number",
                                    keyboardType = KeyboardType.Phone
                                )
                            }

                            AuthField(
                                value = identifier,
                                onChange = { identifier = it },
                                label = identifierLabel,
                                keyboardType = identifierKeyboard,
                                modifier = Modifier.testTag("id-number-field")
                            )

                            OutlinedTextField(
                                value = password,
                                onValueChange = { password = it },
                                label = { Text("Password") },
                                singleLine = true,
                                shape = RoundedCornerShape(SpotFixRadius.small + 2.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = SpotFixColors.primary,
                                    unfocusedBorderColor = SpotFixColors.border
                                ),
                                visualTransformation = if (passwordVisible) VisualTransformation.None
                                    else PasswordVisualTransformation(),
                                keyboardOptions = KeyboardOptions(
                                    keyboardType = KeyboardType.Password,
                                    imeAction = ImeAction.Done
                                ),
                                trailingIcon = {
                                    IconButton(onClick = { passwordVisible = !passwordVisible }) {
                                        Icon(
                                            imageVector = if (passwordVisible) Icons.Filled.VisibilityOff
                                                else Icons.Filled.Visibility,
                                            contentDescription = if (passwordVisible) "Hide password" else "Show password",
                                            tint = SpotFixColors.textSecondary
                                        )
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag("password-field")
                            )

                            if (mode == AuthFormMode.Login) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End
                                ) {
                                    TextButton(onClick = { /* TODO: forgot password */ }) {
                                        Text(
                                            "Forgot password?",
                                            color = SpotFixColors.primary,
                                            style = MaterialTheme.typography.labelMedium,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }

                            error?.let {
                                Text(
                                    text = it,
                                    color = SpotFixColors.danger,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }

                            SpotFixPrimaryButton(
                                text = if (submitting) "Please wait…" else primaryActionTitle,
                                enabled = canSubmit,
                                modifier = Modifier.testTag("auth-submit-button"),
                                onClick = {
                                    error = null
                                    showGoogleAccountSettings = false
                                    submitting = true
                                    scope.launch {
                                        try {
                                            appViewModel.authenticate(
                                                role = role,
                                                mode = mode,
                                                name = name,
                                                identifier = identifier,
                                                email = email,
                                                phone = phone,
                                                password = password
                                            )
                                        } catch (e: Throwable) {
                                            error = e.message ?: "Sign-in failed."
                                        } finally {
                                            submitting = false
                                        }
                                    }
                                }
                            )

                            if (supportsGoogle) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)
                                ) {
                                    androidx.compose.material3.HorizontalDivider(
                                        modifier = Modifier.weight(1f),
                                        color = SpotFixColors.border
                                    )
                                    Text(
                                        text = "or",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = SpotFixColors.textSecondary
                                    )
                                    androidx.compose.material3.HorizontalDivider(
                                        modifier = Modifier.weight(1f),
                                        color = SpotFixColors.border
                                    )
                                }
                                SpotFixSecondaryButton(
                                    text = "Continue with Google",
                                    enabled = !submitting,
                                    modifier = Modifier.testTag("google-sign-in-button"),
                                    onClick = {
                                        error = null
                                        showGoogleAccountSettings = false
                                        submitting = true
                                        scope.launch {
                                            try {
                                                val activity = context as? android.app.Activity
                                                    ?: error("Google Sign-In requires an Activity context.")
                                                appViewModel.signInWithGoogle(activity)
                                            } catch (e: GoogleSignInException.NoCredential) {
                                                error = "No Google account is available on this device yet. Add one in Settings, then try again."
                                                showGoogleAccountSettings = true
                                            } catch (e: Throwable) {
                                                error = e.message ?: "Google Sign-In failed."
                                            } finally {
                                                submitting = false
                                            }
                                        }
                                    }
                                )
                                if (showGoogleAccountSettings) {
                                    SpotFixSecondaryButton(
                                        text = "Open Google Account Settings",
                                        enabled = !submitting,
                                        modifier = Modifier.testTag("google-account-settings-button"),
                                        onClick = {
                                            val addAccountIntent = Intent("android.settings.ADD_ACCOUNT_SETTINGS").apply {
                                                putExtra("account_types", arrayOf("com.google"))
                                            }
                                            val fallbackIntent = Intent(Settings.ACTION_SETTINGS)

                                            runCatching { context.startActivity(addAccountIntent) }
                                                .recoverCatching {
                                                    context.startActivity(fallbackIntent)
                                                }
                                                .onFailure {
                                                    error = "Could not open Settings automatically. Open Settings > Passwords & Accounts and add a Google account."
                                                }
                                        }
                                    )
                                }
                            }

                            if (!supportsRegistration) {
                                Text(
                                    text = "Registration disabled. Ask an administrator to provision your account.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = SpotFixColors.textSecondary
                                )
                            }
                        }
                    }
                }
            }

            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .navigationBarsPadding()
                        .padding(horizontal = SpotFixSpacing.medium, vertical = SpotFixSpacing.small)
                ) {
                    Text(
                        text = "By continuing you agree to our Terms & Privacy Policy",
                        style = MaterialTheme.typography.labelSmall,
                        color = SpotFixColors.textSecondary,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun AuthField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        singleLine = true,
        shape = RoundedCornerShape(SpotFixRadius.small + 2.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = SpotFixColors.primary,
            unfocusedBorderColor = SpotFixColors.border
        ),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = modifier.fillMaxWidth()
    )
}
