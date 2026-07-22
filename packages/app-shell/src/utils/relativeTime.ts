// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Relative timestamps for notification / activity rows.
 *
 * Both the Home rail and the inbox popover used to hand-roll this as
 * `${n}d` / `${n}h` suffixes, which no translation file could reach — a
 * Chinese console still read "3d". Everything goes through
 * `Intl.RelativeTimeFormat` (via the shared i18n helper) instead.
 *
 * @module
 */
import { formatRelativeTime } from '@object-ui/i18n';

/**
 * Format an ISO timestamp as a locale-aware "3 days ago" / "3天前".
 * Returns an empty string for a missing or unparseable value so callers can
 * drop the meta column without a null check.
 */
export function timeAgo(iso: string | undefined, locale: string): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  return formatRelativeTime(ms, locale);
}
