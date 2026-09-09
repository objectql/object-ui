// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#8894 — a metric tile that drops every measure after `values[0]`
 * must SAY SO. It must not start rendering them.
 *
 * `values` is `z.array(z.string()).min(1)` on `DashboardWidgetSchema`, the
 * query runs every measure the author declared (`measures: values`), and the
 * metric/KPI branch of `DatasetWidget` renders `values[0]` alone. Before this
 * change it did that in complete silence: no warning, no console message, no
 * visual tell — a tile answering a narrower question than its metadata asked,
 * looking like a finished product. That silence is the defect (ADR-0049
 * declared-but-unenforced), and closing it is option (b) on the card.
 *
 * ⛔ What this file does NOT do, on purpose: render `values[1..]`. That is
 * option (a) on the same card — it would give those entries rendering
 * semantics they do not have today, i.e. widen the authoring surface, and it
 * stays open on the manual-floor route. objectui#8887 pins the drop itself
 * ("the measures after the first are still dropped") and the byte-identity of
 * a tile that declares no sub-caption; BOTH of those pins are expected to stay
 * green through this change, and the DOM control at the bottom of this file
 * measures the same thing from this card's side.
 *
 * Subjects vs controls, stated because a control that passes for a subject is
 * how a fix ships untested: every `SUBJECT` below asserts something that is
 * FALSE before this change (there was no warning at all to assert about), and
 * every `CONTROL` is green on both sides of it and is here to catch a fix that
 * overshoots — into silence-by-accident, or into option (a).
 *
 * No `dist/` is involved: the root `vitest.config.mts` aliases every
 * `@object-ui/*` specifier to that package's `src/`, and this file imports
 * `../DatasetWidget` relatively, so an ablation of the fix reads source
 * directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { DatasetWidget } from '../DatasetWidget';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  warn.mockRestore();
});

/** Every `console.warn` argument this render produced, flattened to one string. */
const warnings = (): string[] => warn.mock.calls.map((c: unknown[]) => c.join(' '));

/** The one warning this card is about, or `undefined`. */
const measureWarning = (): string | undefined =>
  warnings().find((m: string) => m.includes('renders only the first'));

const source = (rows: Record<string, unknown>[]) => ({
  queryDataset: vi.fn(async () => ({ rows })),
});

/** The duly#109 tile, verbatim from the card's repro block. */
const THREE_MEASURE_TILE = {
  id: 'list_completeness',
  type: 'metric',
  dataset: 'duly_duty_register',
  values: ['approved_rate', 'duties_to_confirm', 'duties_to_review'],
};

const renderTile = async (
  widget: Record<string, unknown>,
  rows: Record<string, unknown>[],
  awaitText: string,
) => {
  const { container } = render(<DatasetWidget widget={widget} dataSource={source(rows)} />);
  await screen.findByText(awaitText);
  return container;
};

describe('objectui#8894 — the dropped measures speak', () => {
  it('SUBJECT: names every measure it queried and will not display', async () => {
    await renderTile(
      THREE_MEASURE_TILE,
      [{ approved_rate: 82, duties_to_confirm: 7, duties_to_review: 3 }],
      '82',
    );
    const msg = measureWarning();
    expect(msg).toBeDefined();
    // Both dropped measures, by name — a message that named only the count
    // would not tell an author which declarations to move or delete.
    expect(msg).toContain('"duties_to_confirm"');
    expect(msg).toContain('"duties_to_review"');
    // ⚠️ The wording is load-bearing, not decoration. The extra measures are
    // NOT inert: the server computes them, they join the widget's refetch
    // signature, and `options.sortBy` accepts any of them. A message claiming
    // they are "ignored" or "unused" would be a second false statement layered
    // on the first, so what it claims is exactly what is true — they are
    // queried, and then never displayed.
    expect(msg).toContain('Queried and then never displayed');
    expect(msg).not.toMatch(/\bignored\b|\bunused\b|\bno effect\b/i);
  });

  it('SUBJECT: identifies the widget, and which measure DID win', async () => {
    await renderTile(
      THREE_MEASURE_TILE,
      [{ approved_rate: 82, duties_to_confirm: 7, duties_to_review: 3 }],
      '82',
    );
    const msg = measureWarning();
    // A dashboard mounts many tiles into one console. Without the widget id,
    // the dataset and the winning measure, the reader cannot tell WHICH tile
    // is lying to them, which is the whole complaint this card files.
    expect(msg).toContain('"list_completeness"');
    expect(msg).toContain('duly_duty_register');
    expect(msg).toContain('"approved_rate"');
  });

  it('SUBJECT: speaks about the DECLARATION, so a failed query does not mute it', async () => {
    // No `queryDataset` on the source → the widget renders its error state and
    // never reaches the metric branch. The metadata is wrong either way, and an
    // author debugging a broken tile is exactly who needs to hear this.
    render(<DatasetWidget widget={THREE_MEASURE_TILE} dataSource={{}} />);
    await screen.findByRole('alert');
    expect(measureWarning()).toBeDefined();
  });

  it('SUBJECT: covers the dimensionless arm, where any widget type becomes a tile', async () => {
    // `isMetric` is `METRIC_TYPES.has(type) || dimensions.length === 0`, so a
    // `bar` that declares no dimension renders as a tile too and drops the same
    // measures. Keying the signal off the type name alone would miss it.
    await renderTile(
      { id: 'bare_bar', type: 'bar', dataset: 'sales', values: ['revenue', 'cost'] },
      [{ revenue: 510000, cost: 120000 }],
      '510000',
    );
    expect(measureWarning()).toContain('"cost"');
  });

  it('SUBJECT: covers the metric-TYPE-with-dimensions arm', async () => {
    // The other half of `isMetric`: a declared `metric` KEEPS tile shape even
    // with dimensions, renders `rows[0]` only, and still drops measure 2.
    await renderTile(
      { id: 'by_status', type: 'metric', dataset: 'sales', dimensions: ['status'], values: ['revenue', 'cost'] },
      [{ status: 'won', revenue: 510000, cost: 120000 }],
      '510000',
    );
    expect(measureWarning()).toContain('"cost"');
  });

  it('CONTROL (green before and after): a single-measure tile stays silent', async () => {
    // The overwhelming majority of authored metric tiles — the census for this
    // card found 176 of them in this tree and 168 in `objectstack`, against
    // zero multi-measure ones. If this went red, the fix would be shouting at
    // every dashboard in the fleet.
    await renderTile({ id: 'rev', type: 'metric', dataset: 'sales', values: ['revenue'] }, [{ revenue: 510000 }], '510000');
    expect(measureWarning()).toBeUndefined();
  });

  it('CONTROL (green before and after): a chart that DOES render every measure stays silent', async () => {
    // Same three measures, but with a dimension and a charting type: nothing is
    // dropped here, so there is nothing to say. The signal must be about the
    // drop, not about the measure count.
    render(
      <DatasetWidget
        widget={{ id: 'trend', type: 'bar', dataset: 'sales', dimensions: ['month'], values: ['revenue', 'cost', 'margin'] }}
        dataSource={source([{ month: '2026-01', revenue: 510000, cost: 120000, margin: 390000 }])}
      />,
    );
    // The chart itself is a test-env stub, so settle on the loading state
    // clearing rather than on any painted mark.
    await waitFor(() => expect(screen.queryByTestId('dataset-loading')).toBeNull());
    expect(measureWarning()).toBeUndefined();
  });

  it('CONTROL (green before and after): the tile\'s markup is untouched — this is (b), not (a)', async () => {
    // objectui#8894's red line, measured from this card's side: making the drop
    // audible must not make it visible. Byte-for-byte, a three-measure tile
    // still renders exactly one number and one caption — the same markup
    // `DatasetWidget.subCaption.test.tsx` and `DatasetWidget.colorVariant.test.tsx`
    // pin for a one-measure tile. Were this to go red, the change would have
    // grown option (a)'s rendering semantics and would owe the manual floor.
    const container = await renderTile(
      THREE_MEASURE_TILE,
      [{ approved_rate: 82, duties_to_confirm: 7, duties_to_review: 3 }],
      '82',
    );
    expect(container.innerHTML).toBe(
      '<div class="flex h-full w-full flex-col items-start justify-center gap-1 p-2">'
      + '<span class="text-2xl font-semibold tabular-nums">82</span>'
      + '<span class="text-xs text-muted-foreground">approved_rate</span>'
      + '</div>',
    );
  });
});
