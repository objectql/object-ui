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
};

const TEST_KEY = 'timeline.bucket.today';

/**
 * Was a local re-implementation that wrapped the hook in try/catch — a
 * rules-of-hooks violation (objectui#2879, same class as #2595/#2596).
 * `useObjectTranslation` is provider-safe, so the probe alone is enough.
 */
export const useTimelineTranslation = createSafeTranslation(
  TIMELINE_DEFAULT_TRANSLATIONS,
  TEST_KEY,
);
