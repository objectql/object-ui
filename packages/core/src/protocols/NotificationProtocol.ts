/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Notification Protocol Bridge
 *
 * Converts spec-aligned Notification schemas into toast-compatible
 * objects that UI layers can render. Maps severity to variant,
 * position names, and resolves default notification configs.
 *
 * @module protocols/NotificationProtocol
 * @packageDocumentation
 */

import type {
  Notification as SpecNotification,
  NotificationAction,
  NotificationConfig,
  NotificationPosition,
  NotificationSeverity,
} from '@object-ui/types';

// ============================================================================
// Resolved Types
// ============================================================================

/** Fully resolved notification configuration. */
export interface ResolvedNotificationConfig {
  defaultPosition: NotificationPosition;
  defaultDuration: number;
  maxVisible: number;
  stackDirection: 'up' | 'down';
  pauseOnHover: boolean;
}

/** Toast-compatible representation of a spec Notification. */
export interface ToastNotification {
  title?: string;
  description: string;
  variant: string;
  position: string;
  duration: number;
  dismissible: boolean;
  actions: ToastAction[];
}

/** Toast-compatible action button. */
export interface ToastAction {
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'link';
}

// ============================================================================
// Severity → Variant Mapping
// ============================================================================

const SEVERITY_TO_VARIANT: Record<string, string> = {
  info: 'default',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
};

/**
 * Map a spec notification severity to a toast variant string.
 *
 * @param severity - Spec severity (info, success, warning, error)
 * @returns Toast variant (default, success, warning, destructive)
 */
export function mapSeverityToVariant(severity: string): string {
  return SEVERITY_TO_VARIANT[severity] ?? 'default';
}

// ============================================================================
// Position Mapping
// ============================================================================

const POSITION_MAP: Record<string, string> = {
  top_left: 'top-left',
  top_center: 'top-center',
  top_right: 'top-right',
  bottom_left: 'bottom-left',
  bottom_center: 'bottom-center',
  bottom_right: 'bottom-right',
};

/**
 * Map a spec notification position (underscore-separated) to a
 * toast position string (hyphen-separated).
 *
 * @param position - Spec position (e.g. "top_right")
 * @returns Toast position (e.g. "top-right")
 */
export function mapPosition(position: string): string {
  return POSITION_MAP[position] ?? 'top-right';
}

// ============================================================================
// Notification Config Resolution
// ============================================================================

/**
 * Resolve a notification configuration by applying spec defaults.
 *
 * @param config - NotificationConfig from the spec
 * @returns Fully resolved notification configuration
 */
export function resolveNotificationConfig(config: NotificationConfig): ResolvedNotificationConfig {
  return {
    defaultPosition: config.defaultPosition ?? 'top_right',
    defaultDuration: config.defaultDuration ?? 5000,
    maxVisible: config.maxVisible ?? 5,
    stackDirection: config.stackDirection ?? 'down',
    pauseOnHover: config.pauseOnHover ?? true,
  };
}

// ============================================================================
// Spec Notification → Toast
// ============================================================================

/**
 * Extract the display string from a translatable value (string or Translation object).
 */
function resolveTranslatableString(value: string | { key: string; defaultValue?: string } | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return value.defaultValue;
}

/**
 * Convert a spec Notification to a toast-compatible object.
 *
 * @param notification - Spec Notification
 * @returns Toast-compatible notification with title, description, variant, etc.
 */
export function specNotificationToToast(notification: SpecNotification): ToastNotification {
  const actions: ToastAction[] = (notification.actions ?? []).map((a: NotificationAction) => ({
    label: typeof a.label === 'string' ? a.label : a.label?.defaultValue ?? '',
    action: a.action,
    variant: a.variant ?? 'primary',
  }));

  return {
    title: resolveTranslatableString(notification.title),
    description: resolveTranslatableString(notification.message) ?? '',
    variant: mapSeverityToVariant(notification.severity ?? 'info'),
    position: mapPosition(notification.position ?? 'top_right'),
    duration: notification.duration ?? 5000,
    dismissible: notification.dismissible ?? true,
    actions,
  };
}
