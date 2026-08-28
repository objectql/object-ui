/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4032 item 4 — the KPI card's SUB-CAPTION.
 *
 * The metric card renders two authored strings, and they are two DIFFERENT
 * authored fields with two DIFFERENT convention keys (objectstack#5428 item-4
 * ruling, 2026-08-06: 「两个作者字段两个 key」):
 *
 *   | authored field         | rendered as              | bundle key                                    |
 *   |------------------------|--------------------------|-----------------------------------------------|
 *   | `widget.description`   | the SHARED card header   | `dashboards.<d>.widgets.<id>.description`      |
 *   | `options.description`  | the KPI card sub-caption | `dashboards.<d>.widgets.<id>.subCaption`       |
 *
 * `subCaption` is the member objectstack#8056 added to the widget translation
 * node (shipped in `@objectstack/spec@17.0.0`, the version this repo pins).
 * PR #4358 landed items 1-3 and deliberately STOPPED here, because at the time
 * every candidate segment was rejected by the spec and the only accepted key
 * was `description` — the shared key the ruling forbids.
 *
 * The server half already exists: `translateDashboard` overlays `subCaption`
 * onto `options.description` on the `/meta` path. These tests pin the CLIENT
 * half — the same key path, resolved through the #4358 seam, for the app
 * bundles objectui loads into `I18nProvider` itself.
 *
 * DIRECTIONS, written before the reverse verification was run:
 *
 *  - **(a) bundle `subCaption` → sub-caption: RED before the change.** Nothing
 *    in the renderer reads `subCaption`; the metric dispatch spreads
 *    `...options` straight through, so `options.description` reaches
 *    `MetricWidget` as the raw authored English.
 *  - **(c) bundle `subCaption` AND `description` on ONE widget: HALF-RED.** The
 *    shared card header already translates from `description` (#4358), so that
 *    half is GREEN before the change; the sub-caption half is RED. This is the
 *    separation pin, and the asymmetry is the point — the two keys must land in
 *    two different places, and a future tidy-up that collapses them to one key
 *    would turn (b)/(c) red rather than passing quietly.
 *  - **(f) bundle beats an inline per-locale map: RED before the change.**
 *  - **(b) `description` must NOT reach the sub-caption: GREEN on both sides.**
 *    Nothing routes it today; the pin exists so nothing starts to.
 *  - **(d) no `subCaption` entry → untouched: GREEN on both sides.** Same
 *    reference semantics as `title`: an app with no translations keeps the exact
 *    bytes it renders today, and a widget with no authored sub-caption grows no
 *    caption row (the resolver must answer `undefined`, never `''`).
 *  - **(e) inline per-locale map alone: GREEN on both sides.** `MetricWidget`
 *    already collapses it via `pickLocalized` (#4208's seam). The fix must
 *    compose the two channels in the SAME fixed order `tWidgetTitle` uses —
 *    collapse the authored value to the active language FIRST, then offer the
 *    plain string to the bundle as its fallback — not replace this channel.
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import type { DashboardComponentSchema } from '@object-ui/types';
// Module scope, never a hook — AGENTS.md §测试纪律. The dashboard renders each
// widget through `SchemaRenderer`, which resolves `metric` / `kpi` from the
// registry, populated as a side effect of this barrel.
import { DashboardRenderer } from '../index';

afterEach(cleanup);

/**
 * `crm` is discovered as an app namespace because it carries a `dashboards`
 * sub-key — the same discovery every other convention lookup performs.
 *
 * `revenue` carries BOTH keys with visibly different values, which is what
 * makes the separation assertions in (c) meaningful: if the two ever collapse
 * onto one key, one of the two strings goes missing.
 */
const ZH_BUNDLE = {
  zh: {
    crm: {
      dashboards: {
        sales: {
          widgets: {
            revenue: {
              title: '总收入',
              description: '卡片头部描述',
              subCaption: '本季度已赢单',
            },
            // A widget whose bundle entry has `description` but NO
            // `subCaption` — the (b) direction.
            winrate: {
              title: '赢单率',
              description: '只属于卡片头部',
            },
            // Sub-caption only, no `description` — used by (e)'s precedence
            // control is NOT this one; this one pins that a `subCaption`
            // entry alone is enough.
            pipeline: {
              subCaption: '按阶段推进',
            },
          },
        },
      },
    },
  },
};

function dashboard(...widgets: Record<string, unknown>[]): DashboardComponentSchema {
  return {
    type: 'dashboard',
    name: 'sales',
    widgets,
  } as unknown as DashboardComponentSchema;
}

function renderIn(language: string, schema: DashboardComponentSchema) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false, resources: ZH_BUNDLE }}>
      <DashboardRenderer schema={schema} />
    </I18nProvider>,
  );
}

describe('DashboardRenderer — the KPI sub-caption translates from its OWN convention key (#4032 item 4)', () => {
  it('(a) renders the bundle `subCaption` on a self-contained metric card', () => {
    renderIn('zh', dashboard({
      id: 'revenue',
      type: 'metric',
      title: 'Total Revenue',
      options: { value: 1930000, description: 'Won this quarter' },
    }));

    expect(screen.getByText('本季度已赢单')).toBeTruthy();
    // The authored English must not survive beside the translation.
    expect(screen.queryByText('Won this quarter')).toBeNull();
  });

  it('(a2) resolves a `subCaption`-only bundle entry (no `description` sibling)', () => {
    renderIn('zh', dashboard({
      id: 'pipeline',
      type: 'metric',
      title: 'Pipeline',
      options: { value: 42, description: 'Advancing by stage' },
    }));

    expect(screen.getByText('按阶段推进')).toBeTruthy();
    expect(screen.queryByText('Advancing by stage')).toBeNull();
  });

  it('(b) SEPARATION — the `description` key never reaches `options.description`', () => {
    // `winrate` has a `description` entry and NO `subCaption`. The sub-caption
    // must stay the authored English: the card header's translation is not a
    // substitute for the sub-caption's, and borrowing it is exactly the shared
    // key the item-4 ruling forbids.
    renderIn('zh', dashboard({
      id: 'winrate',
      type: 'metric',
      title: 'Win Rate',
      options: { value: '42%', description: 'Closed-won share' },
    }));

    expect(screen.getByText('Closed-won share')).toBeTruthy();
    expect(screen.queryByText('只属于卡片头部')).toBeNull();
  });

  it('(c) SEPARATION — one widget, both keys, two destinations', () => {
    // `kpi` is metric-family but NOT self-contained, so it takes the shared
    // Card header (fed by `widget.description` → the `description` key) AND
    // renders a metric card inside it (fed by `options.description` → the
    // `subCaption` key). Both are visible at once, which is the only place the
    // two-fields-two-keys contract can be observed end to end in the renderer.
    renderIn('zh', dashboard({
      id: 'revenue',
      type: 'kpi',
      title: 'Total Revenue',
      description: 'Card header caption',
      options: { value: 1930000, description: 'Won this quarter' },
    }));

    // Header half — already green since #4358.
    expect(screen.getByText('卡片头部描述')).toBeTruthy();
    expect(screen.queryByText('Card header caption')).toBeNull();
    // Sub-caption half — this card.
    expect(screen.getByText('本季度已赢单')).toBeTruthy();
    expect(screen.queryByText('Won this quarter')).toBeNull();
    // And they are DISTINCT strings in distinct nodes: a collapse onto one key
    // would render one of them twice and drop the other.
    expect(screen.getAllByText('卡片头部描述')).toHaveLength(1);
    expect(screen.getAllByText('本季度已赢单')).toHaveLength(1);
  });

  it('(d) leaves a metric with no `subCaption` entry exactly as authored', () => {
    renderIn('zh', dashboard({
      id: 'untranslated',
      type: 'metric',
      title: 'Bookings',
      options: { value: 12, description: 'Signed this week' },
    }));

    expect(screen.getByText('Signed this week')).toBeTruthy();
  });

  it('(d2) grows no caption row when nothing authored one and nothing translates it', () => {
    // The resolver must answer `undefined`, not `''`: `MetricWidget` gates the
    // whole caption row on `(trend || description)`, so an empty string is the
    // difference between "no row" and "an empty row with the muted styling".
    const { container } = renderIn('zh', dashboard({
      id: 'untranslated',
      type: 'metric',
      title: 'Win Rate',
      options: { value: '42%' },
    }));

    expect(container.textContent).toBe('Win Rate42%');
  });

  it('(e) still collapses an inline per-locale map on `options.description`', () => {
    // The #4208 channel `MetricWidget` already owns. It must survive: the fix
    // composes the two channels, it does not replace this one.
    renderIn('zh', dashboard({
      id: 'untranslated',
      type: 'metric',
      title: 'Bookings',
      options: {
        value: 12,
        description: { en: 'Signed this week', 'zh-CN': '本周已签' },
      },
    }));

    expect(screen.getByText('本周已签')).toBeTruthy();
    expect(screen.queryByText('Signed this week')).toBeNull();
  });

  it('(f) prefers the bundle `subCaption` over an inline per-locale map', () => {
    // Same fixed composition order `tWidgetTitle` applies: the authored value
    // is collapsed to the active language FIRST and handed to the bundle as its
    // fallback, so a bundle entry always wins.
    renderIn('zh', dashboard({
      id: 'revenue',
      type: 'metric',
      title: 'Total Revenue',
      options: {
        value: 1930000,
        description: { en: 'Won this quarter', 'zh-CN': '内联副标题' },
      },
    }));

    expect(screen.getByText('本季度已赢单')).toBeTruthy();
    expect(screen.queryByText('内联副标题')).toBeNull();
  });

  it('(g) falls back to the authored sub-caption when the dashboard has no name', () => {
    // No `name` → no convention key to build. The authored value is all there
    // is, and it must still render.
    render(
      <I18nProvider config={{ defaultLanguage: 'zh', detectBrowserLanguage: false, resources: ZH_BUNDLE }}>
        <DashboardRenderer
          schema={{
            type: 'dashboard',
            widgets: [{
              id: 'revenue',
              type: 'metric',
              title: 'Total Revenue',
              options: { value: 1930000, description: 'Won this quarter' },
            }],
          } as unknown as DashboardComponentSchema}
        />
      </I18nProvider>,
    );

    expect(screen.getByText('Won this quarter')).toBeTruthy();
    expect(screen.queryByText('本季度已赢单')).toBeNull();
  });
});
