package org.spotfix.community.designsystem

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Refreshed design tokens derived from the stitch-syafiq MOBILE screens.
 *
 * Highlights:
 *  - Pale-slate background (#FCF8FF) with white surfaces
 *  - Indigo primary with indigo→violet gradient header used across screens
 *  - Card radius 12dp, button radius 10dp (no longer full pills, matches Material You feel)
 *  - 4–8–16–24–32 spacing scale
 */
object SpotFixColors {
    val primary = Color(0xFF4F46E5)        // Indigo 600
    val primaryDark = Color(0xFF4338CA)    // Indigo 700
    val primaryLight = Color(0xFF818CF8)   // Indigo 400
    val violet = Color(0xFF7C3AED)         // Violet 600 (gradient end)
    val secondary = Color(0xFFF59E0B)
    val success = Color(0xFF10B981)
    val warning = Color(0xFFF97316)
    val danger = Color(0xFFEF4444)
    val info = Color(0xFF3B82F6)
    val background = Color(0xFFFCF8FF)     // Pale slate / lavender white
    val surface = Color.White
    val surfaceMuted = Color(0xFFF3F1FA)
    val textPrimary = Color(0xFF1E1B4B)
    val textSecondary = Color(0xFF64748B)
    val textOnPrimary = Color.White
    val border = Color(0xFFE5E7EB)
    val master = Color(0xFF7C3AED)
}

object SpotFixRadius {
    val small: Dp = 8.dp
    val medium: Dp = 12.dp
    val large: Dp = 20.dp
    val pill: Dp = 999.dp
}

object SpotFixSpacing {
    val xSmall: Dp = 4.dp
    val small: Dp = 8.dp
    val medium: Dp = 16.dp
    val large: Dp = 24.dp
    val xLarge: Dp = 32.dp
}

object SpotFixGradients {
    val primary: Brush = Brush.linearGradient(
        colors = listOf(SpotFixColors.primary, SpotFixColors.violet)
    )
    val master: Brush = Brush.linearGradient(
        colors = listOf(SpotFixColors.primaryDark, SpotFixColors.master)
    )
    val supervisor: Brush = Brush.linearGradient(
        colors = listOf(Color(0xFFEA580C), Color(0xFFF59E0B))
    )
    val cleaner: Brush = Brush.linearGradient(
        colors = listOf(Color(0xFF059669), Color(0xFF10B981))
    )
}

private val SpotFixColorScheme = lightColorScheme(
    primary = SpotFixColors.primary,
    onPrimary = SpotFixColors.textOnPrimary,
    primaryContainer = SpotFixColors.primaryLight.copy(alpha = 0.18f),
    onPrimaryContainer = SpotFixColors.primaryDark,
    secondary = SpotFixColors.secondary,
    onSecondary = Color.White,
    tertiary = SpotFixColors.master,
    onTertiary = Color.White,
    background = SpotFixColors.background,
    onBackground = SpotFixColors.textPrimary,
    surface = SpotFixColors.surface,
    onSurface = SpotFixColors.textPrimary,
    surfaceVariant = SpotFixColors.surfaceMuted,
    onSurfaceVariant = SpotFixColors.textSecondary,
    outline = SpotFixColors.border,
    error = SpotFixColors.danger,
    onError = Color.White
)

private val SpotFixTypography = Typography(
    displaySmall = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold),
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
    titleSmall = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp),
    bodySmall = TextStyle(fontSize = 13.sp),
    labelLarge = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
)

private val SpotFixShapes = Shapes(
    extraSmall = RoundedCornerShape(SpotFixRadius.small),
    small = RoundedCornerShape(SpotFixRadius.small),
    medium = RoundedCornerShape(SpotFixRadius.medium),
    large = RoundedCornerShape(SpotFixRadius.large),
    extraLarge = RoundedCornerShape(SpotFixRadius.large)
)

@Composable
fun SpotFixTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SpotFixColorScheme,
        typography = SpotFixTypography,
        shapes = SpotFixShapes,
        content = content
    )
}

val LocalRoleAccent = staticCompositionLocalOf { SpotFixColors.primary }
