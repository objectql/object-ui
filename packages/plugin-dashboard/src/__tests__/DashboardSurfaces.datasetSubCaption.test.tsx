/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8889 — the sub-caption's BUNDLE limb reaches a DATASET-BOUND KPI tile.
 *
 * `tWidgetSubCaption` has two limbs. objectui#7293 / PR #8887 landed limb 1 —
 * the AUTHORED value, `widget.options.description`, collapsed to the active
 * language — inside `DatasetWidget` itself, and with it the server-overlay
 * path (`translateDashboard` writes the resolved translation ONTO
 * `options.description`, so a platform-served dashboard arrives pre-translated
 * and limb 1 renders it verbatim).
 *
 * Limb 2 — a client i18n BUNDLE entry at
 * `{ns}.dashboards.{dash}.widgets.{id}.subCaption` overriding the authored
 * value — could not follow it down. It needs the dashboard NAME, and neither
 * dispatch site handed `DatasetWidget` anything but `widget` and `dataSource`.
 * So a dashboard loaded from an APP BUNDLE whose sub-caption was written ONLY
 * in the bundle rendered nothing at all — a shape `tWidgetSubCaption`'s own
 * docblock calls legitimate: "A translation with no authored counterpart is
 * legitimate and matches the server."
 *
 * ## What this file measures, and in which direction
 *
 * Every case below was run against the fix and against an ABLATION of it (the
 * two dispatch sites reverted to `<DatasetWidget widget={…} dataSource={…} />`,
 * rebuilt in place). The directions are stated first, per this repo's rule that
 * "it ran, all green" is not a reading:
 *
 *  - **S1/S2 (bundle-only sub-caption, no authored value) — RED before, green
 *    after**, once per surface. These are the card's named probe.
 *  - **S3/S4 (bundle AND authored on one tile) — RED before, green after**,
 *    once per surface. ⚠️ This is a SUBJECT, not a control: "a bundle entry
 *    always wins over an inline map" is exactly what was broken on the dataset
 *    path, so pre-fix the tile renders the AUTHORED English. Anything asserting
 *    bundle-beats-authored on a dataset tile moves with the subject by
 *    construction.
 *  - **C1 (authored only, no bundle entry) — GREEN before AND after.** This is
 *    the real control: it is objectui#7293's limb 1, and an implementation that
 *    delivered limb 2 by REPLACING limb 1 would turn it red. It stays green
 *    under the ablation, so it discriminates.
 *  - **C2 (neither channel) — GREEN before AND after.** No caption node grows;
 *    the resolver answers `undefined`, never `''`.
 *  - **C3 (no dashboard surface at all — `DatasetWidget` rendered directly) —
 *    GREEN before AND after.** The prop is omitted, the component resolves the
 *    authored limb for itself, and `__tests__/DatasetWidget.subCaption.test.tsx`
 *    keeps passing unchanged. Pinned here too because it is the case the new
 *    prop's `undefined` state exists for.
 *
 * S2 and S4 are the objectui#4614 half: BOTH dashboard surfaces route a
 * dataset-bound widget to the same component, so a fix wired into one dispatch
 * site leaves the other silently unchanged. A one-site fix passes S1/S3 and
 * fails S2/S4.
 *
 * No `dist/` is involved: the root `vitest.config.mts` aliases every
 * `@object-ui/*` specifier to that package's `src/`, and this file imports its
 * subjects relatively, so an ablation of the fix reads source directly.
 */

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import type { DashboardComponentSchema } from '@object-ui/types';
// Module scope, never inside a hook — AGENTS.md 测试纪律. Both surfaces render
// their non-dataset widgets through `SchemaRenderer`, which resolves component
// types from the registry these barrels populate as a side effect.
import '@object-ui/components';
import { DashboardRenderer } from '../DashboardRenderer';
import { DashboardGridLayout } from '../DashboardGridLayout';
import { DatasetWidget } from '../DatasetWidget';

afterEach(cleanup);

/**
 * `crm` is discovered as an app namespace because it carries a `dashboards`
 * sub-key — the same discovery every other convention lookup performs.
 *
 * `pipeline` carries a `subCaption` and NOTHING else: it is the card's probe,
 * the "translation with no authored counterpart" shape. `revenue` carries one
 * too, and the widgets below pair it with an authored `options.description` so
 * the precedence direction is observable.
 */
const ZH_BUNDLE = {
  zh: {
    crm: {
      dashboards: {
        sales: {
          widgets: {
            pipeline: { subCaption: '按阶段推进' },
            revenue: { subCaption: '本季度已赢单' },
          },
        },
      },
    },
  },
};

/** A dataset-bound metric tile — `dataset` is what routes it to `DatasetWidget`. */
const datasetMetric = (id: string, options?: Record<string, unknown>) => ({
  id,
  type: 'metric',
  title: 'Revenue',
  dataset: 'sales',
  values: ['revenue'],
  ...(options ? { options } : {}),
});

const dashboard = (...widgets: Record<string, unknown>[]): DashboardComponentSchema =>
  ({ type: 'dashboard', name: 'sales', widgets }) as unknown as DashboardComponentSchema;

const makeSource = () => ({ queryDataset: vi.fn(async () => ({ rows: [{ revenue: 510000 }] })) });

/**
 * The two surfaces, driven identically. Parameterising them is the point: the
 * assertions below are written ONCE and must hold on both, which is what makes
 * a one-dispatch-site fix fail rather than half-pass.
 */
const SURFACES: Array<[string, (schema: DashboardComponentSchema, dataSource: unknown) => React.ReactElement]> = [
  ['DashboardRenderer', (schema, dataSource) => <DashboardRenderer schema={schema} dataSource={dataSource} />],
  ['DashboardGridLayout', (schema, dataSource) => <DashboardGridLayout schema={schema} dataSource={dataSource} />],
];

const renderSurface = async (
  surface: (schema: DashboardComponentSchema, dataSource: unknown) => React.ReactElement,
  schema: DashboardComponentSchema,
) => {
  const src = makeSource();
  const { container } = render(
    <I18nProvider config={{ defaultLanguage: 'zh', detectBrowserLanguage: false, resources: ZH_BUNDLE }}>
      {surface(schema, src)}
    </I18nProvider>,
  );
  // The grid mounts its widgets only after `useContainerWidth` reports, so wait
  // for the resolved measure rather than asserting on the first paint.
  await screen.findByText('510000');
  return container;
};

const captionOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="dataset-metric-subcaption"]');

describe.each(SURFACES)('%s — a dataset-bound KPI tile resolves the sub-caption bundle limb (#8889)', (_name, surface) => {
  // ── Subjects: RED before this change on BOTH surfaces. ───────────────────
  it('S1/S2 renders a bundle sub-caption the author never wrote a counterpart for', async () => {
    const container = await renderSurface(surface, dashboard(datasetMetric('pipeline')));
    expect(captionOf(container)).not.toBeNull();
    expect(captionOf(container)).toHaveTextContent('按阶段推进');
  });

  it('S3/S4 lets the bundle entry win over the authored value', async () => {
    const container = await renderSurface(
      surface,
      dashboard(datasetMetric('revenue', { description: 'Won this quarter' })),
    );
    expect(captionOf(container)).toHaveTextContent('本季度已赢单');
    // The authored English must not survive beside the translation — one tile,
    // one sub-caption, and the bundle owns it.
    expect(container.textContent).not.toContain('Won this quarter');
  });

  it('S3/S4 lets the bundle entry win over an authored inline per-locale map', async () => {
    // The composition order `tWidgetTitle` fixed: the authored map is collapsed
    // to the active language FIRST and offered to the bundle as its fallback,
    // so the bundle still wins. A resolver that checked the bundle only when
    // nothing was authored would render '本季度已赢单' here by accident and
    // '本周已签' if the order were reversed.
    const container = await renderSurface(
      surface,
      dashboard(datasetMetric('revenue', { description: { en: 'Won this quarter', 'zh-CN': '本周已签' } })),
    );
    expect(captionOf(container)).toHaveTextContent('本季度已赢单');
    expect(container.textContent).not.toContain('本周已签');
  });

  // ── Controls: GREEN before AND after. These must not move on ablation. ───
  it('C1 keeps rendering an authored sub-caption that no bundle entry translates', async () => {
    // objectui#7293's limb 1. `untranslated` has no entry in ZH_BUNDLE at all,
    // so limb 2 has nothing to say and the authored value must survive intact.
    // An implementation that delivered limb 2 by replacing limb 1 reds here.
    const container = await renderSurface(
      surface,
      dashboard(datasetMetric('untranslated', { description: 'awaiting confirmation' })),
    );
    expect(captionOf(container)).toHaveTextContent('awaiting confirmation');
  });

  it('C1 keeps collapsing an authored inline per-locale map with no bundle entry', async () => {
    const container = await renderSurface(
      surface,
      dashboard(datasetMetric('untranslated', { description: { en: 'Signed this week', 'zh-CN': '本周已签' } })),
    );
    expect(captionOf(container)).toHaveTextContent('本周已签');
  });

  it('C2 grows no caption node when neither channel says anything', async () => {
    // The resolver must answer `undefined`, never `''`: the caption row is
    // gated on truthiness, so an empty string is the difference between "no
    // node" and "an empty muted node".
    const container = await renderSurface(surface, dashboard(datasetMetric('untranslated')));
    expect(captionOf(container)).toBeNull();
  });
});

describe('#8889 leaves the no-surface path exactly as objectui#7293 left it', () => {
  it('C3 resolves the authored limb when no dashboard surface passed a sub-caption', async () => {
    // The `subCaption` prop is OMITTED here, which is the state that means
    // "nobody upstream resolved this" — there is no dashboard name in
    // existence, hence no bundle key. `DatasetWidget` resolves the authored
    // value for itself, exactly as #7293 landed it.
    const src = makeSource();
    const { container } = render(
      <DatasetWidget
        widget={{ id: 'pipeline', type: 'metric', dataset: 'sales', values: ['revenue'], options: { description: 'awaiting confirmation' } }}
        dataSource={src}
      />,
    );
    await screen.findByText('510000');
    expect(captionOf(container)).toHaveTextContent('awaiting confirmation');
  });

  it('C3 renders nothing for an explicit `null` — a surface resolved it, to nothing', async () => {
    // `null` is NOT the same as the prop being absent. A surface that resolved
    // the sub-caption to nothing has already consulted both channels, and
    // falling back to the authored value here is precisely how the dataset tile
    // and the inline `getComponentSchema()` arms would start to disagree.
    const src = makeSource();
    const { container } = render(
      <DatasetWidget
        widget={{ id: 'pipeline', type: 'metric', dataset: 'sales', values: ['revenue'], options: { description: 'awaiting confirmation' } }}
        dataSource={src}
        subCaption={null}
      />,
    );
    await screen.findByText('510000');
    await waitFor(() => expect(captionOf(container)).toBeNull());
    expect(container.textContent).not.toContain('awaiting confirmation');
  });
});
