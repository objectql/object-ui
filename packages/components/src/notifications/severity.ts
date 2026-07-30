/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Severity presentation shared by the four notification surfaces.
 *
 * `severity` (info/success/warning/error) and `displayType` are ORTHOGONAL in
 * the spec: severity picks the icon and tone, `displayType` picks the surface.
 * Keeping the tone table here is what lets a `warning` look the same whether it
 * arrives as a banner or as an inline message.
 */

import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react';
import type { NotificationSeverityLevel } from '@object-ui/react';

export interface NotificationSeverityStyle {
  /** Leading icon. */
  Icon: LucideIcon;
  /** Border + surface + text tone for the in-flow surfaces (banner, inline). */
  tone: string;
  /** Icon tint for surfaces that bring their own chrome (snackbar, alert). */
  iconTone: string;
}

/**
 * Typed as `Record<NotificationSeverityLevel, …>` so a new severity in the spec
 * `NotificationSeveritySchema` fails type-check here until it has a tone.
 */
export const NOTIFICATION_SEVERITY_STYLES: Record<
  NotificationSeverityLevel,
  NotificationSeverityStyle
> = {
  info: {
    Icon: Info,
    tone: 'border-border bg-muted/50 text-foreground',
    iconTone: 'text-muted-foreground',
  },
  success: {
    Icon: CheckCircle2,
    tone: 'border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200',
    iconTone: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    Icon: AlertTriangle,
    tone: 'border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200',
    iconTone: 'text-amber-600 dark:text-amber-400',
  },
  error: {
    Icon: XCircle,
    tone: 'border-destructive/50 bg-destructive/10 text-destructive dark:text-destructive-foreground',
    iconTone: 'text-destructive',
  },
};

/** Resolve a severity's presentation, defaulting to the spec default (`info`). */
export function notificationSeverityStyle(
  severity?: NotificationSeverityLevel,
): NotificationSeverityStyle {
  return NOTIFICATION_SEVERITY_STYLES[severity ?? 'info'] ?? NOTIFICATION_SEVERITY_STYLES.info;
}
