/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The metric tile's SUB-CAPTION — resolved in ONE place, for every dashboard
 * surface (objectui#8889).
 *
 * ## What this module is
 *
 * The sub-caption has two channels, and this hook is the only thing in the repo
 * that composes them:
 *
 *   1. the AUTHORED value, `widget.options.description`, which the spec admits
 *      as a plain string or as an inline per-locale map — collapsed to the
 *      active UI language through the objectui#4208 `pickLocalized` seam;
 *   2. the client i18n BUNDLE entry,
 *      `{ns}.dashboards.{dash}.widgets.{id}.subCaption` (objectui#4032 item 4 /
 *      objectstack#8056, shipped in `@objectstack/spec@17.0.0`), which is
 *      offered the collapsed authored value as its FALLBACK and therefore wins
 *      whenever it exists.
 *
 * The composition ORDER is the one `tWidgetTitle` fixed and this hook inherits
 * verbatim from the `DashboardRenderer` callback it replaces: collapse the
 * authored value FIRST, hand the plain string that falls out to the bundle as
 * its fallback. That is what makes the docblock's invariant true — "a bundle
 * entry always wins over an inline map and the two channels can never disagree
 * about what 'the authored sub-caption' is".
 *
 * ## Why it is a module and not a second copy
 *
 * An invariant of the form "these two channels can never disagree" needs ONE
 * decision point to be worth anything. Before objectui#8889 the composition
 * lived as a private `useCallback` inside `DashboardRenderer`, and it reached
 * only the two INLINE arms of that file's `getComponentSchema()`. Both
 * dashboard surfaces route a DATASET-BOUND widget to `DatasetWidget` instead
 * (`DashboardRenderer` and `DashboardGridLayout`, objectui#4614), so that tile
 * saw neither channel until objectui#7293 taught the component to read the
 * authored one for itself.
 *
 * Finishing the job by teaching `DatasetWidget` to read the BUNDLE too — or by
 * handing `DashboardGridLayout` its own copy of these four lines — would create
 * a SECOND answer to "what is this tile's sub-caption", and two answers can
 * drift apart. That is the per-block divergence class this repo keeps filing
 * (objectui#8767, #8221). So the composition moved here, both surfaces call it,
 * and what travels to `DatasetWidget` is the ANSWER, not the inputs.
 *
 * ## Why `undefined` and never `''`
 *
 * `MetricWidget` and `DatasetWidget` both gate the whole caption row on the
 * value's truthiness, so a widget that declares no sub-caption must grow no
 * node at all. `useObjectLabel().widgetSubCaption` already collapses a miss to
 * `undefined`; the authored limb does the same via `|| undefined`.
 *
 * ## The server-overlay channel is untouched
 *
 * A dashboard served through `/meta` never reaches limb 2 here: the server's
 * `translateDashboard` has already written the resolved `subCaption` INTO
 * `options.description`, so the overlaid string arrives as the authored value
 * and limb 1 renders it verbatim. This hook is the client half of the same
 * convention, for the app bundles objectui loads into `I18nProvider` itself —
 * not a second dialect, and not a competitor to the overlay.
 */

import { useCallback } from 'react';
import { useObjectLabel, useObjectTranslation, pickLocalized } from '@object-ui/i18n';

/**
 * The structural minimum this resolution reads. Deliberately not
 * `DashboardWidgetSchema`: the two surfaces hold their widgets at two different
 * static types (the grid holds the `DashboardWidgetSlotComponentSchema |
 * DashboardWidgetSchema` union its `widgets` slot declares), and both satisfy
 * this shape. `options` is `unknown` because that is what
 * `DashboardWidgetSchema` declares it as.
 */
export interface SubCaptionWidget {
  id?: string;
  options?: unknown;
}

/**
 * Resolve a dataset/metric widget's sub-caption for the active UI language.
 *
 * `dashName` is the dashboard schema's `name` — the segment every convention
 * key on this surface is built from. Without it (or without a widget `id`)
 * there is no key to look up, so the authored limb answers alone; that is the
 * same silent degradation `tWidgetTitle` / `tWidgetDescription` perform, not a
 * new one.
 *
 * Provider-safe: `useObjectLabel` and `useObjectTranslation` both degrade to a
 * no-instance stand-in when no `I18nProvider` is mounted (objectui#5564), which
 * `DashboardGridLayout` depends on — it is registered as the `dashboard-grid`
 * SDUI component and renders standalone.
 */
export function useWidgetSubCaption(
  dashName: string | undefined,
): (widget: SubCaptionWidget) => string | undefined {
  const { widgetSubCaption } = useObjectLabel();
  const { language } = useObjectTranslation();

  return useCallback(
    (widget: SubCaptionWidget): string | undefined => {
      const authored = (widget.options as Record<string, unknown> | undefined)?.description;
      const fallback = pickLocalized(authored, language) || undefined;
      if (!dashName || !widget.id) return fallback;
      return widgetSubCaption(dashName, widget.id, fallback);
    },
    [dashName, widgetSubCaption, language],
  );
}
