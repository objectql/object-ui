/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * date-display - the ONE date/datetime display path behind every field cell,
 * grid card, gantt tooltip and dataset measure in the console.
 *
 * These functions are unchanged; what changed is where they live. They were
 * written in `@object-ui/fields`' barrel (`packages/fields/src/index.tsx`),
 * which is a React package, so `@object-ui/core` could not reach them - and
 * `core`'s `utils/dataset-format.ts` is exactly the caller that needed them:
 * `formatMeasure` returned `String(v)` for any non-numeric value, so a `min` /
 * `max` measure over a date field rendered its raw 24-character ISO string on
 * the metric tile, in chart values, in dataset table cells and in the
 * metadata-admin dataset preview (objectui#7178).
 *
 * The fix is the move, NOT a second formatter here. That choice is the whole
 * point, and it is the lesson of objectui#4576: when the percent convention
 * was duplicated across this same package boundary, a list cell and a
 * dashboard measure drifted apart (`1.234,5 %` beside `1.234,5%` in a German
 * session) while both were "correct". `dataset-format.ts`'s own header records
 * that history, and `number-display.ts` next door is the same remedy applied
 * to numbers: the pure function moves DOWN into the React-free engine and the
 * upper package re-exports it, so there is one home and nothing to drift.
 *
 * `@object-ui/fields` re-exports every symbol below under its original name,
 * so `formatDate` / `formatDateTime` / `formatDateTimeCompactParts` /
 * `formatRelativeDate` / `DateDisplayOptions` keep working unchanged for
 * `ObjectGrid`, `ObjectGantt`, `plugin-dashboard`'s `recordFields` and the
 * `date` cell renderer.
 *
 * The `datetime` CELL face joined this file in objectui#7443. It used to be a
 * second convention inlined in `DateTimeCellRenderer`: two `Intl` option bags
 * for one field type, kept in step by nothing, while `date` had exactly one.
 * It is `formatDateTime`'s `'compact'` style now, byte-identical to what the
 * cell rendered before.
 *
 * Pure by construction (no React, no i18n): the only ambient inputs are `Intl`
 * and the clock, and the one phrase `Intl` cannot produce ("Overdue Nd") comes
 * in through the INJECTED `options.t`, the same way `buildDatasetFieldHelpers`
 * in `dataset-format.ts` takes `fieldLabel`.
 */

/**
 * Options shared by {@link formatDate} / {@link formatRelativeDate} /
 * {@link formatDateTime}. One bag, and each function reads the keys it needs:
 * `dueLike` and `t` only matter on the relative path, `style` is read by
 * `formatDateTime` and by `formatDate` (see below).
 */
export interface DateDisplayOptions {
  dueLike?: boolean;
  /** BCP-47 display locale (ADR-0053 tenant default); falls back to the runtime locale. */
  locale?: string;
  /** i18n translate fn for phrases `Intl` can't produce (the "Overdue Nd" wording). */
  t?: (key: string, params?: Record<string, unknown>) => string;
  /**
   * Named face, read by {@link formatDateTime} and {@link formatDate}. Each
   * reads its own vocabulary: `'compact'` is `formatDateTime`'s dense grid
   * cell face (objectui#7443), `'short'` and `'relative'` are `formatDate`'s;
   * anything else, or absent, is that function's default face.
   *
   * It rides here rather than in a second positional parameter because
   * `formatDateTime(value, options?)` is a PUBLISHED signature with `options`
   * in position two (objectui#4272). A positional `style` would have displaced
   * it: TypeScript would reject the old call, but a JavaScript caller would
   * silently hand its options bag to the style slot and lose its locale —
   * the #4272 defect again.
   *
   * ⚠️ On {@link formatDate} this key COLLIDES with a positional parameter of
   * the same name, so the precedence is PINNED, not left to implementation
   * order: **the positional argument wins**, and this key is consulted only
   * when the positional slot is `undefined` (objectui#7745). See
   * {@link formatDate}'s own note for why that direction and not the other.
   *
   * ⚠️ {@link formatRelativeDate} still does NOT read this key — the
   * maintainer's long-run ruling on objectui#7443 names `formatDate` only, and
   * whether the relative path's out-of-window fallback should honour it is a
   * separate, deliberate call (objectui#7745's report).
   */
  style?: string;
}

/**
 * Localized day-granularity relative phrase ("Tomorrow", "3 days ago", "明天",
 * "3天前"), sentence-cased for locales whose `Intl` output starts lowercase.
 */
function formatRelativeDays(diffDays: number, locale?: string): string {
  try {
    const phrase = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffDays, 'day');
    return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  } catch {
    // Invalid locale tag — degrade to English rather than crash the cell.
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    return diffDays > 0 ? `In ${diffDays} days` : `${Math.abs(diffDays)} days ago`;
  }
}

/**
 * The options bag {@link formatRelativeDate} hands to {@link formatDate} for
 * its out-of-window ABSOLUTE fallback, with `style` neutralised.
 *
 * Two reasons, both load-bearing since objectui#7745 made `formatDate` read
 * `options.style`:
 *
 *   1. **Behaviour preservation.** `formatRelativeDate` does not read
 *      `options.style`, and #7745 does not change that. Without the strip it
 *      would start reading it THROUGH this delegation for dates outside the
 *      ±7-day window only — a face change on a live path (grid cell, gantt
 *      tooltip) that no card authorises.
 *   2. **Termination.** `formatDate` resolves `'relative'` by calling
 *      `formatRelativeDate`, which lands back here. With the style still in
 *      the bag, `formatRelativeDate(v, { style: 'relative' })` on an
 *      out-of-window date would recurse until the stack ran out.
 *
 * The bag is returned UNCHANGED when there is nothing to strip, so the common
 * path allocates nothing.
 */
function absoluteFallbackOptions(options?: DateDisplayOptions): DateDisplayOptions | undefined {
  if (options === undefined || options.style === undefined) return options;
  return { ...options, style: undefined };
}

/**
 * Format date as relative time (e.g., "3 days ago", "Today", "Overdue 3d"),
 * localized via `Intl.RelativeTimeFormat` (objectstack-ai/objectstack#3040).
 *
 * `dueLike` gates the "Overdue" wording — a past `start_date`/`created_at`
 * isn't overdue, only a past due/deadline-semantic field is. Non-due-like
 * past dates render as plain "N days ago" instead. The overdue phrase has no
 * `Intl` equivalent, so it resolves through `options.t` (key
 * `fields.relativeDate.overdue`) with an English fallback.
 */
export function formatRelativeDate(value: string | Date | number, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = startOfDate.getTime() - startOfToday.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Beyond the ±7-day window, fall back to the absolute (already localized) form.
  if (diffDays < -7 || diffDays > 7) return formatDate(date, undefined, absoluteFallbackOptions(options));

  if (diffDays < -1 && options?.dueLike) {
    const absDays = Math.abs(diffDays);
    const key = 'fields.relativeDate.overdue';
    const translated = options.t?.(key, { count: absDays });
    return translated && translated !== key ? translated : `Overdue ${absDays}d`;
  }
  return formatRelativeDays(diffDays, options?.locale);
}

/**
 * Format date value.
 *
 * The named face comes from EITHER spelling — the positional `style`
 * parameter or `options.style` — and the precedence between them is pinned
 * (objectui#7745):
 *
 * > **The positional argument wins. `options.style` is consulted only when the
 * > positional slot is `undefined`.**
 *
 * Before #7745 only the positional spelling was read here, while
 * {@link formatDateTime} read only the `options` one — one shared bag, two
 * spellings for one concept, and on THIS function the options spelling did
 * nothing at all: `formatDate(v, undefined, { style: 'short' })` silently
 * rendered the default face with no diagnostic. Reading the key is the
 * additive half of the maintainer's long-run ruling on objectui#7443.
 *
 * Why the positional wins, and not the newer key:
 *
 *   - It is the ONLY direction that is purely additive. It fires exactly on
 *     the input that is a silent no-op today (positional absent, key present);
 *     every call that renders a face today renders the same face after.
 *   - The bag is SHARED across three functions, so it can legitimately carry a
 *     key meant for a sibling — that is this module's convention (`dueLike`
 *     and `t` are read by `formatRelativeDate` alone). A caller that built
 *     `{ style: 'compact', locale }` for `formatDateTime` and reused the bag
 *     for `formatDate(v, 'short', bag)` must keep its short face. A key aimed
 *     at a sibling function must not outrank an argument written for THIS
 *     call — that is objectui#7694's shape (an alias overwriting the canonical
 *     key), and the silent-override half of objectui#4272.
 *
 * `??`, not `||`, is what "absent" means here: `formatDate(v, '', bag)`
 * renders the default face today and must keep doing so, so an empty string
 * counts as GIVEN and does not fall through to the key.
 */
export function formatDate(value: string | Date | number, style?: string, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  const effectiveStyle = style ?? options?.style;

  if (effectiveStyle === 'short') {
    // Compact format for mobile: "Jan 15, '24" / "1月 15, '24".
    // Only the MONTH token is localized: the surrounding compact shape (day,
    // apostrophe + 2-digit year) is a deliberate fixed layout for narrow
    // cards, not a locale-derived one. The tag comes from `options.locale`
    // like the default branch below — hardcoding `'en-US'` here made this the
    // one branch that ignored a locale its caller had threaded (objectui#4272).
    const month = date.toLocaleDateString(options?.locale, { month: 'short' });
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    return `${month} ${day}, '${year}`;
  }

  if (effectiveStyle === 'relative') {
    return formatRelativeDate(date, options);
  }
  
  // Default format: locale-aware human-readable. Drop the year when it
  // matches the current year — Salesforce / HubSpot / Linear all do this
  // because the year is rarely useful for in-progress records and the
  // verbose "2026年7月21日" form crowds cards and table cells. Past- /
  // future-year dates keep the year so users can disambiguate.
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(options?.locale, {
    year: isCurrentYear ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * The `'compact'` datetime face as the two halves a grid cell paints
 * separately — `7/4/2024` and `7:00 am` for `2024-07-04T07:00:00Z` in `en-US`.
 *
 * `formatDateTime(value, { style: 'compact', ...options })` is exactly
 * `date + ' ' + time` of what this returns, so a caller that wants the face
 * as ONE string and a caller that wants to style the halves differently
 * cannot drift apart. That drift is what objectui#7443 recorded:
 * `DateTimeCellRenderer` inlined these two option bags and never called this
 * module, so `datetime` had two display conventions while `date` had one —
 * the same shape as objectui#4576, which this repo has already paid for once.
 *
 * `null` for a value this module renders as `'—'`; the cell renders its own
 * empty state for those, so it never sees the dash.
 */
export function formatDateTimeCompactParts(
  value: string | Date | number,
  options?: DateDisplayOptions,
): { date: string; time: string } | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;

  return {
    date: date.toLocaleDateString(options?.locale, {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    }),
    // `hour12` stays declared: this is the compact Airtable-style cell, and
    // the 12-hour face is its design, not a locale artefact. Locales that
    // write no am/pm marker simply ignore it.
    time: date.toLocaleTimeString(options?.locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).toLowerCase(),
  };
}

/**
 * Format datetime value.
 *
 * `options.style` selects a named face:
 *
 *   - `'compact'` — the dense grid face, `7/4/2024 7:00 am` in `en-US`. It is
 *     what every `datetime` CELL renders, and what `DateTimeCellRenderer`
 *     used to build from its own inlined `Intl` bags (objectui#7443).
 *   - anything else, including absent — the verbose default,
 *     `Jul 4, 2024, 07:00 AM` in `en-US`. Unchanged, and still what a
 *     non-cell caller (dataset measure, gantt tooltip, data-table) gets.
 *
 * The signature is `(value, options?)`, unchanged: `style` is a key of
 * `options`, not a positional parameter, so every existing call —
 * `formatDateTime(v, { locale })` included — keeps meaning exactly what it
 * meant (see the note on `DateDisplayOptions.style` for why the positional
 * shape `formatDate` uses was refused here).
 *
 * `options` is optional, so a caller that passes nothing keeps the exact
 * runtime-default behavior it had. Before objectui#4272 the parameter did not
 * exist at all, which meant no caller could localize this function however
 * hard it tried — it always handed `Intl` an `undefined` tag, i.e. the
 * MACHINE's locale, which is neither of the repo's two locale channels.
 * Callers should pass the tag from `useDisplayLocale()`.
 */
export function formatDateTime(value: string | Date | number, options?: DateDisplayOptions): string {
  if (value === null || value === undefined || value === '') return '—';
  const date = value instanceof Date ? value : new Date(value as any);
  if (!(date instanceof Date) || isNaN(date.getTime())) return '—';

  if (options?.style === 'compact') {
    const parts = formatDateTimeCompactParts(date, options);
    return parts ? `${parts.date} ${parts.time}` : '—';
  }

  return date.toLocaleDateString(options?.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
