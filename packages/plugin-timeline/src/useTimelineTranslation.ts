/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createSafeTranslation } from '@object-ui/i18n';

/**
 * Default English translations for ObjectTimeline. Mirrors the
 * createSafeTranslationHook pattern used by plugin-detail / plugin-list so
 * the timeline keeps working when rendered standalone (unit tests,
 * embed) without an I18nProvider on the React tree.
 */
export const TIMELINE_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'timeline.bucket.overdue': 'Overdue',
  'timeline.bucket.today': 'Today',
  'timeline.bucket.tomorrow': 'Tomorrow',
  'timeline.bucket.thisWeek': 'This week',
  'timeline.bucket.nextWeek': 'Next week',
  'timeline.bucket.later': 'Later',
  'timeline.bucket.noDate': 'No date',
  'timeline.bucket.unassigned': 'Unassigned',
  'timeline.relative.today': 'Today',
  'timeline.relative.tomorrow': 'Tomorrow',
  'timeline.relative.yesterday': 'Yesterday',
  'timeline.relative.inDays': 'In {{n}} days',
  'timeline.relative.daysAgo': '{{n}} days ago',
  // Gantt axis vocabulary (objectui#4520). These were `Week ${n}` and
  // `Q${q} ${year}` template literals in `renderer.tsx`, so a zh session read
  // an English bucket label beside the Chinese date axis objectui#4513 had just
  // fixed. The numbers are `{{holes}}` rather than concatenation because the
  // word order is the translation's to choose: `zh` puts the year first
  // (`2026年第3季度`), which no `Q${q} ${year}` template can produce.
  'timeline.scale.week': 'Week {{n}}',
  'timeline.scale.quarter': 'Q{{quarter}} {{year}}',
  'timeline.gantt.rowLabel': 'Items',
  // objectui#6655 — the object-bound path REFUSES `variant: 'gantt'`.
  //
  // It composes one flat FEED item per record; the renderer's gantt branch
  // reads gantt ROWS (`row.items[].startDate`), so `calculateDateRange` used to
  // reduce an empty list and throw `RangeError: Invalid time value` mid-render.
  // The maintainer ruling (2026-08-29) chose to refuse loudly rather than to
  // compose rows from records, so this string IS the feature on that path and
  // has to name the limitation, not just report a failure.
  //
  // `{{variants}}` is a hole rather than prose because the list is derived from
  // the component's own declaration of what it can render — see
  // `OBJECT_BOUND_TIMELINE_VARIANTS` in `ObjectTimeline.tsx`.
  'timeline.unsupported.objectBoundGantt':
    'Unsupported variant "gantt" — an object-bound timeline renders the feed variants ({{variants}}). Gantt needs literal rows, each with its own nested items, so the gantt axis (scale) has no effect here.',
};

const TEST_KEY = 'timeline.bucket.today';

/**
 * The translate fn shape this package threads into its pure helpers.
 *
 * `generateTimeScaleHeaders` is a module-level function and cannot host a hook,
 * so the component reads the channel and passes `t` down — the same seam
 * objectui#4513 opened for the resolved `locale` string, for the same reason.
 */
export type TimelineTranslate = (key: string, params?: Record<string, unknown>) => string;

/**
 * The English last resort for call sites that have no `t` to hand: the exported
 * helper's default parameter, and nothing else.
 *
 * It is the same lookup `createSafeTranslation` serves on a provider-less host,
 * spelled here because that one is a hook and this is a pure function. Both
 * halves are deliberate mirrors of `useSafeTranslation.ts` and must stay that
 * way — a divergence would only ever show up on hosts with no `I18nProvider`,
 * where we are least likely to see it:
 *
 *   - `||` (not `??`) for the chain, so an empty string falls through to the
 *     key exactly as the hook's `defaults[key] || …` chain does.
 *   - `split().join()` (not `replace`/`replaceAll`) for interpolation, which is
 *     literal on both sides and substitutes EVERY occurrence — i18next's own
 *     behaviour, and the objectui#3418 fix.
 */
export const translateTimelineDefault: TimelineTranslate = (key, params) =>
  Object.entries(params ?? {}).reduce(
    (value, [name, v]) => value.split(`{{${name}}}`).join(String(v)),
    TIMELINE_DEFAULT_TRANSLATIONS[key] || key,
  );

/**
 * Was a local re-implementation that wrapped the hook in try/catch — a
 * rules-of-hooks violation (objectui#2879, same class as #2595/#2596).
 * `useObjectTranslation` is provider-safe, so the probe alone is enough.
 */
export const useTimelineTranslation = createSafeTranslation(
  TIMELINE_DEFAULT_TRANSLATIONS,
  TEST_KEY,
);
