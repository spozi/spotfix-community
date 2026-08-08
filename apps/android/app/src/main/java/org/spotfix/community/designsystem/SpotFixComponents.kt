package org.spotfix.community.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// ---------- Surfaces ----------

/** White card with 12dp corners, hairline border, soft elevation. */
@Composable
fun SpotFixCard(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(SpotFixSpacing.medium),
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(SpotFixRadius.medium),
        colors = CardDefaults.cardColors(containerColor = SpotFixColors.surface),
        border = BorderStroke(1.dp, SpotFixColors.border),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(contentPadding), content = { content() })
    }
}

// ---------- Headers ----------

/**
 * The big indigo→violet gradient header used at the top of every screen in the new design.
 *
 * It draws status-bar inset padding internally so callers don't have to. Pass any of [trailing],
 * [leading] or [content] to add controls (avatar, back chevron, role chip, …).
 */
@Composable
fun SpotFixGradientHeader(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    gradient: Brush = SpotFixGradients.primary,
    leading: @Composable (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null,
    content: @Composable (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(gradient)
            .statusBarsPadding()
            .padding(
                start = SpotFixSpacing.medium,
                end = SpotFixSpacing.medium,
                top = SpotFixSpacing.medium,
                bottom = if (content != null) SpotFixSpacing.large else SpotFixSpacing.medium + 4.dp
            )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(SpotFixSpacing.small)
        ) {
            leading?.invoke()
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = SpotFixColors.textOnPrimary,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleLarge
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        color = SpotFixColors.textOnPrimary.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            trailing?.invoke()
        }
        if (content != null) {
            Spacer(modifier = Modifier.height(SpotFixSpacing.medium))
            content()
        }
    }
}

/** Circular tinted icon badge — used in role cards, avatars, etc. */
@Composable
fun SpotFixIconBadge(
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = 44.dp,
    backgroundAlpha: Float = 0.18f,
    onWhiteBackground: Boolean = true
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(
                if (onWhiteBackground) tint.copy(alpha = backgroundAlpha)
                else Color.White.copy(alpha = 0.20f)
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (onWhiteBackground) tint else Color.White,
            modifier = Modifier.size(size * 0.55f)
        )
    }
}

// ---------- Pills / chips ----------

/** Small status pill (rounded rect, smaller than the round chip). */
@Composable
fun SpotFixBadge(title: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(SpotFixRadius.pill))
            .background(color.copy(alpha = 0.14f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = title,
            color = color,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

/** Solid pill — used when high contrast is needed (e.g. on white card row). */
@Composable
fun SpotFixSolidBadge(title: String, color: Color, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(SpotFixRadius.pill))
            .background(color)
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(
            text = title,
            color = Color.White,
            fontWeight = FontWeight.SemiBold,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

@Composable
fun SpotFixSectionHeader(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    trailing: @Composable (() -> Unit)? = null
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = SpotFixColors.textPrimary
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = SpotFixColors.textSecondary
                )
            }
        }
        trailing?.invoke()
    }
}

@Composable
fun SpotFixFilterChip(
    title: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val containerColor = if (selected) SpotFixColors.primary else SpotFixColors.surface
    val contentColor = if (selected) Color.White else SpotFixColors.textPrimary
    val border = if (selected) null else BorderStroke(1.dp, SpotFixColors.border)
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(SpotFixRadius.pill),
        border = border,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = containerColor,
            contentColor = contentColor
        ),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ---------- Buttons ----------

/** Primary button: indigo→violet gradient, 10dp radius, 52dp tall. */
@Composable
fun SpotFixPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    gradient: Brush = SpotFixGradients.primary,
    leadingIcon: ImageVector? = null
) {
    val shape = RoundedCornerShape(SpotFixRadius.small + 2.dp)
    val bg: Brush = if (enabled) gradient else SolidColor(SpotFixColors.border)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(shape)
            .background(bg)
    ) {
        Button(
            onClick = onClick,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
            shape = shape,
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                contentColor = Color.White,
                disabledContainerColor = Color.Transparent,
                disabledContentColor = Color.White
            ),
            contentPadding = PaddingValues(horizontal = SpotFixSpacing.medium)
        ) {
            if (leadingIcon != null) {
                Icon(imageVector = leadingIcon, contentDescription = null)
                Spacer(modifier = Modifier.size(SpotFixSpacing.small))
            }
            Text(text = text, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Outlined secondary button — same height, 10dp radius. */
@Composable
fun SpotFixSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp),
        shape = RoundedCornerShape(SpotFixRadius.small + 2.dp),
        border = BorderStroke(1.dp, SpotFixColors.border),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = SpotFixColors.surface,
            contentColor = SpotFixColors.textPrimary
        ),
        contentPadding = PaddingValues(horizontal = SpotFixSpacing.medium)
    ) {
        if (leadingIcon != null) {
            Icon(imageVector = leadingIcon, contentDescription = null, tint = SpotFixColors.textPrimary)
            Spacer(modifier = Modifier.size(SpotFixSpacing.small))
        }
        Text(text = text, fontWeight = FontWeight.SemiBold)
    }
}

// ---------- Bottom navigation ----------

data class SpotFixNavItem(
    val key: String,
    val label: String,
    val icon: ImageVector
)

@Composable
fun SpotFixBottomNav(
    items: List<SpotFixNavItem>,
    selectedKey: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier,
        containerColor = SpotFixColors.surface,
        contentColor = SpotFixColors.textSecondary,
        tonalElevation = 6.dp
    ) {
        items.forEach { item ->
            val isSelected = item.key == selectedKey
            NavigationBarItem(
                selected = isSelected,
                onClick = { onSelected(item.key) },
                icon = { Icon(imageVector = item.icon, contentDescription = item.label) },
                label = {
                    Text(
                        item.label,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium
                    )
                },
                alwaysShowLabel = true,
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = SpotFixColors.primary,
                    selectedTextColor = SpotFixColors.primary,
                    unselectedIconColor = SpotFixColors.textSecondary,
                    unselectedTextColor = SpotFixColors.textSecondary,
                    indicatorColor = SpotFixColors.primary.copy(alpha = 0.12f)
                )
            )
        }
    }
}

// ---------- Server status badge ----------

@Composable
fun SpotFixServerStatusBadge(
    title: String,
    detail: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(SpotFixRadius.pill))
            .background(Color.White.copy(alpha = 0.92f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Column {
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.SemiBold
            )
            if (detail.isNotBlank()) {
                Text(
                    text = detail,
                    style = MaterialTheme.typography.labelSmall,
                    color = SpotFixColors.textSecondary
                )
            }
        }
    }
}
