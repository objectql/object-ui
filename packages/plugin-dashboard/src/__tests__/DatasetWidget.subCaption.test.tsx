// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#7293 — a dataset-bound KPI tile must render the sub-caption its
 * author declared in `options.description`.
 *
 * Why it never did: the sub-caption slot is wired end to end and terminated
 * nowhere. It has its own translation key
 * (`{ns}.dashboards.{dash}.widgets.{id}.subCaption`, objectui#4032 item 4 /
 * objectstack#8056), the server's `translateDashboard` overlays that
 * translation onto `options.description`, and `DashboardRenderer`'s
 * `tWidgetSubCaption` resolves it — but attaches the resolved value only to the
 * two INLINE arms of `getComponentSchema()`. `dataset` is REQUIRED on
 * `DashboardWidgetSchema` (re-read for this card against the PUBLISHED
 * `@objectstack/spec@17.4.0`: required keys are exactly `id` / `dataset` /
 * `values`), so every spec-legal widget routes to `DatasetWidget` instead, and
 * `grep -n description` in that file returned 0 hits against 25 line-hits for
 * `options` — a real absence, not a misread. Four layers of live plumbing, no
 * consumer: the ADR-0049 declared-but-unenforced shape.
 *
 * The fix reads the key in `DatasetWidget` rather than plumbing it in as a
 * prop, and that is load-bearing: BOTH dashboard surfaces route a dataset-bound
 * widget to this one component (`DashboardRenderer` and `DashboardGridLayout`,
 * objectui#4614), so a prop passed from one dispatch site would have fixed one
 * surface and left the other silently unchanged.
 *
 * The two halves of this file pin OPPOSITE directions on purpose:
 *
 *  - the **no-sub-caption** markup is asserted byte-for-byte. It was green
 *    BEFORE this change and stays green after — it proves the caption row
 *    gained no empty node and no stray spacing. Reverting the change must NOT
 *    turn it red, which is what makes it a control rather than a second copy
 *    of the subject;
 *  - the **declared sub-caption** assertions were RED before (nothing rendered
 *    at all) and are green after. Those are the fix's evidence.
 *
 * Deliberately NOT pinned as a feature: measures after `values[0]`. That is
 * suggestion 2 on the card, it would give `values[1..]` rendering semantics
 * they do not have today, and it is a separate card on the manual-floor route.
 * The one assertion about it here records that this change did not ride it in.
 *
 * No `dist/` is involved: the root `vitest.config.mts` aliases every
 * `@object-ui/*` specifier to that package's `src/`, and this file imports
 * `../DatasetWidget` relatively, so an ablation of the fix reads source
 * directly.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import { DatasetWidget } from '../DatasetWidget';

afterEach(cleanup);

/**
 * The metric tile's markup with NO sub-caption declared, exactly as
 * origin/main@64c3cdd44 renders it. Spelled out in full (not a snapshot file)
 * so a regression shows up as a diff in the test source review. This is the
 * same byte string `DatasetWidget.colorVariant.test.tsx` pins for the same
 * widget — two files measuring the pre-change bytes independently.
 */
const BASELINE_NO_SUBCAPTION =
  '<div class="flex h-full w-full flex-col items-start justify-center gap-1 p-2">'
  + '<span class="text-2xl font-semibold tabular-nums">510000</span>'
  + '<span class="text-xs text-muted-foreground">revenue</span>'
  + '</div>';

/** The baseline with the sub-caption span appended — nothing else may move. */
const withSubCaption = (text: string) =>
  BASELINE_NO_SUBCAPTION.replace(
    '</div>',
    `<span class="text-xs text-muted-foreground" data-testid="dataset-metric-subcaption">${text}</span></div>`,
  );

const renderMetric = async (
  widgetExtras: Record<string, unknown> = {},
  rows: Record<string, unknown>[] = [{ revenue: 510000 }],
) => {
  const src = { queryDataset: vi.fn(async () => ({ rows })) };
  const { container } = render(
    <DatasetWidget
      widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], ...widgetExtras }}
      dataSource={src}
    />,
  );
  await screen.findByText('510000');
  return container;
};

/** Same, under an explicit UI language — the inline per-locale map's axis. */
const renderMetricIn = async (language: string, widgetExtras: Record<string, unknown> = {}) => {
  const src = { queryDataset: vi.fn(async () => ({ rows: [{ revenue: 510000 }] })) };
  const { container } = render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      <DatasetWidget
        widget={{ type: 'metric', dataset: 'sales', values: ['revenue'], ...widgetExtras }}
        dataSource={src}
      />
    </I18nProvider>,
  );
  await screen.findByText('510000');
  return container;
};

describe('DatasetWidget metric tile — the declared sub-caption (#7293)', () => {
  // ── Control half: green BEFORE and after. Must not red on ablation. ──────
  it('renders the pre-change markup byte-for-byte when no sub-caption is declared', async () => {
    const container = await renderMetric();
    expect(container.innerHTML).toBe(BASELINE_NO_SUBCAPTION);
  });

  it.each([
    ['no options bag at all', undefined],
    ['an options bag without the key', { limit: 10 }],
    ['an explicitly empty string', { description: '' }],
    ['a null', { description: null }],
    ['a locale map with no usable entry', { description: {} }],
  ])('injects no node for %s', async (_label, options) => {
    const container = await renderMetric(options === undefined ? {} : { options });
    expect(container.innerHTML).toBe(BASELINE_NO_SUBCAPTION);
    expect(container.querySelector('[data-testid="dataset-metric-subcaption"]')).toBeNull();
  });

  // ── Subject half: RED before this change, green after. ───────────────────
  it('renders the sub-caption an author declared as a plain string', async () => {
    const container = await renderMetric({
      options: { description: 'awaiting confirmation / awaiting approval' },
    });
    expect(screen.getByTestId('dataset-metric-subcaption')).toHaveTextContent(
      'awaiting confirmation / awaiting approval',
    );
    // …and the tile is otherwise untouched: the value, the measure label and
    // the layout are the baseline bytes with exactly one span appended.
    expect(container.innerHTML).toBe(withSubCaption('awaiting confirmation / awaiting approval'));
  });

  it('renders the value the server overlaid onto the key', async () => {
    // `translateDashboard` writes the resolved `widgets.{id}.subCaption`
    // translation onto `options.description` before the document reaches the
    // client, so on a served dashboard the plain string IS the translation.
    // Nothing extra is needed for that path — it is the case above, and this
    // pins that a served document keeps its overlaid text verbatim.
    const container = await renderMetric({
      id: 'list_completeness',
      options: { description: '待确认 7 / 待审批 3' },
    });
    expect(container.innerHTML).toBe(withSubCaption('待确认 7 / 待审批 3'));
  });

  it.each([
    ['zh', '待确认 / 待审批'],
    ['en', 'to confirm / to approve'],
  ])('collapses an authored inline per-locale map under %s', async (language, expected) => {
    const container = await renderMetricIn(language, {
      options: {
        description: { en: 'to confirm / to approve', zh: '待确认 / 待审批' },
      },
    });
    expect(screen.getByTestId('dataset-metric-subcaption')).toHaveTextContent(expected);
    expect(container.innerHTML).toBe(withSubCaption(expected));
  });

  it('reads the map through `pickLocalized`, not a private string-only test', async () => {
    // objectui#4032 is what a private resolver that could not read the inline
    // map already cost this vocabulary: the KPI card rendered the literal
    // string "metric". A `typeof === 'string'` guard here would silently drop
    // the map form and re-create THIS card's own bug class inside its fix, so
    // the map must not merely "not crash" — it must resolve.
    const container = await renderMetricIn('zh', {
      options: { description: { en: 'English only' } },
    });
    // No `zh` entry: `pickLocalized` falls through to `en` rather than missing.
    expect(container.innerHTML).toBe(withSubCaption('English only'));
  });
});

describe('#7293 delivers the sub-caption WITHOUT widening the value vocabulary', () => {
  it("renders the card's own repro: three measures, one sub-caption", async () => {
    // The duly#109 tile, verbatim from the card's repro block.
    const src = {
      queryDataset: vi.fn(async () => ({
        rows: [{ approved_rate: 82, duties_to_confirm: 7, duties_to_review: 3 }],
      })),
    };
    const { container } = render(
      <DatasetWidget
        widget={{
          id: 'list_completeness',
          type: 'metric',
          dataset: 'duly_duty_register',
          values: ['approved_rate', 'duties_to_confirm', 'duties_to_review'],
          options: { description: 'awaiting confirmation / awaiting approval' },
        }}
        dataSource={src}
      />,
    );
    await screen.findByText('82');
    expect(screen.getByTestId('dataset-metric-subcaption')).toHaveTextContent(
      'awaiting confirmation / awaiting approval',
    );
    // Suggestion 2 on the card — rendering `values[1..]` as secondary tile
    // values — is NOT part of this change: it would give those entries
    // rendering semantics they do not have today (a widening, hence a separate
    // card on the manual-floor route). The measures after `values[0]` are still
    // dropped, and this assertion is the evidence that this PR did not ride it
    // in. The successor card is EXPECTED to change this expectation.
    expect(container.textContent).not.toContain('7');
    expect(container.textContent).not.toContain('3');
  });
});
