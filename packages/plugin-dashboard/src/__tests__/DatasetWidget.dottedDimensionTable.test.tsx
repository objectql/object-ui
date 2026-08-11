// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Regression for objectui#4263 — the half of the dotted-dimension gap that
 * objectui#4053 (PR #4261) deliberately did not reach.
 *
 * #4053 fixed the client-side label safety net so a DOTTED dimension path
 * (`crm_account.industry`) resolves its select options against the
 * relationship's target object. That net never runs for table / pivot / metric
 * widgets: the effect opens with `if (isMetric || isTable) { …; return; }`, and
 * the relabeling it feeds is applied only on the chart branch. So on a `table`
 * or `pivot` a dotted dimension still rendered the raw stored enum
 * (`education`), which is exactly the symptom #4053 reports for charts.
 *
 * The ruling on #4263 is a DOTTED-ONLY GAP-FILL, and these pins are shaped to
 * hold both halves of it apart:
 *
 *  - For a LOCAL dimension the server resolves the display label (ADR-0021) —
 *    that is why #4053's widget B (a `table`) rendered `Education` correctly.
 *    The client net must stay OFF there, or a table would double-resolve a
 *    label the server already produced. Pinned by `renders a LOCAL dimension
 *    exactly as the server sent it` and by the local column of the mixed test.
 *  - For a DOTTED dimension the server is silent too (that is #4053's premise),
 *    so the value reaches the table unresolved and the client net is the only
 *    resolution available. Pinned red-first below.
 *
 * The mixed test puts BOTH on ONE table widget for the same reason the #4053
 * suite does: the two dimensions carry the SAME option set, so any difference
 * between the two rendered cells is the bug and nothing else — and an
 * implementation that simply switched the early return off (resolving local
 * dimensions on tables too) fails it, which a dotted-only fixture could not
 * detect.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { DatasetWidget } from '../DatasetWidget';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The one option set the dimensions below resolve against. */
const INDUSTRY_OPTIONS = [
  { value: 'education', label: 'Education' },
  { value: 'finance', label: 'Finance' },
];
const TYPE_OPTIONS = [
  { value: 'partner', label: 'Partner' },
  { value: 'direct', label: 'Direct' },
];

/** Base object: a local `industry` select + the `crm_account` relationship. */
const OPPORTUNITY = {
  name: 'crm_opportunity',
  fields: {
    industry: { type: 'select', options: INDUSTRY_OPTIONS },
    crm_account: { type: 'lookup', reference: 'crm_account' },
  },
};
/** The relationship's TARGET object, where the dotted paths' options live. */
const ACCOUNT = {
  name: 'crm_account',
  fields: {
    industry: { type: 'select', options: INDUSTRY_OPTIONS },
    type: { type: 'select', options: TYPE_OPTIONS },
    owner: { type: 'lookup', reference: 'crm_user' },
  },
};

/**
 * Route `GET /api/v1/meta/object/<name>` to a per-object document, recording
 * the object names asked for (so "no resolution was attempted at all" is
 * observable, not just "no relabeling happened"). Mirrors the #4053 suite.
 */
function installMetaRouter(docs: Record<string, unknown>) {
  const requested: string[] = [];
  const fn = vi.fn(async (input: unknown) => {
    const url = String(input);
    const m = /\/api\/v1\/meta\/object\/(.+)$/.exec(url);
    const name = m ? decodeURIComponent(m[1]) : '';
    requested.push(name);
    const doc = docs[name];
    if (!doc) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ item: doc }) };
  });
  global.fetch = fn as any;
  return { requested };
}

const sourceOf = (result: unknown) => ({ queryDataset: vi.fn(async () => result) });

/** Cell texts of the flat table's first body row, in column order. */
const firstRowCells = (): string[] =>
  Array.from(document.querySelectorAll('tbody tr')[0]?.querySelectorAll('td') ?? []).map(
    (td) => td.textContent ?? '',
  );

describe('DatasetWidget dotted-dimension labels on table / pivot (objectui#4263)', () => {
  it('resolves a DOTTED dimension on a table, and leaves the LOCAL one exactly as it arrived', async () => {
    // Both dimensions carry the SAME option set. The server sent both
    // value-keyed — for the local one that is the server's own business
    // (ADR-0021 resolution is its job and this fixture models a server that
    // did not do it), for the dotted one it is the #4053 premise.
    const { requested } = installMetaRouter({ crm_opportunity: OPPORTUNITY, crm_account: ACCOUNT });
    render(
      <DatasetWidget
        widget={{
          type: 'table',
          dataset: 'd',
          dimensions: ['industry', 'account_industry'],
          values: ['total_amount'],
        }}
        dataSource={sourceOf({
          rows: [{ industry: 'education', account_industry: 'education', total_amount: 10 }],
          fields: [
            { name: 'industry', type: 'select', label: 'Industry' },
            { name: 'account_industry', type: 'select', label: 'Account Industry' },
            { name: 'total_amount', type: 'number', label: 'Total Amount' },
          ],
          object: 'crm_opportunity',
          dimensionFields: { industry: 'industry', account_industry: 'crm_account.industry' },
        })}
      />,
    );

    // THE GAP: the dotted dimension resolves to its option label. Pre-fix this
    // cell held the raw stored `education`.
    await waitFor(() => expect(firstRowCells()[1]).toBe('Education'));

    // THE BOUNDARY: the local dimension is untouched in the same render. The
    // server owns that label on a table; resolving it here would be a second
    // resolution of the same value.
    expect(firstRowCells()[0]).toBe('education');

    // It got there through the same `GET /meta/object/:name` channel #4261
    // already uses, walking to the relationship target.
    expect(requested).toEqual(['crm_opportunity', 'crm_account']);
  });

  it('renders a LOCAL-only table exactly as the server sent it, resolving nothing', async () => {
    // Control for the acceptance boundary: a table whose dimensions are all
    // local must render byte-identically to today. The server-resolved label
    // passes through untouched AND no object metadata is fetched at all — the
    // early return still holds for this widget, so there is no resolution that
    // could double-apply.
    const { requested } = installMetaRouter({ crm_opportunity: OPPORTUNITY, crm_account: ACCOUNT });
    render(
      <DatasetWidget
        widget={{ type: 'table', dataset: 'd', dimensions: ['industry'], values: ['total_amount'] }}
        dataSource={sourceOf({
          // The server DID resolve it (ADR-0021) — this is #4053's widget B.
          rows: [{ industry: 'Education', total_amount: 10 }],
          fields: [
            { name: 'industry', type: 'select', label: 'Industry' },
            { name: 'total_amount', type: 'number', label: 'Total Amount' },
          ],
          object: 'crm_opportunity',
          dimensionFields: { industry: 'industry' },
        })}
      />,
    );

    await waitFor(() => expect(firstRowCells()[0]).toBe('Education'));
    expect(requested).toEqual([]);
  });

  it('resolves BOTH the row and the column dimension of a dotted pivot, keeping server totals aligned', async () => {
    // A pivot's row/column bucket IDS are derived from the same values as its
    // header LABELS, while the server's marginal totals arrive keyed by the raw
    // values. Relabeling one side only would silently break the total lookup —
    // the headers would read `Education` while the row-total cell fell back to
    // `—`. The totals here are what pins that.
    installMetaRouter({ crm_opportunity: OPPORTUNITY, crm_account: ACCOUNT });
    render(
      <DatasetWidget
        widget={{
          type: 'pivot',
          dataset: 'd',
          dimensions: ['acct_industry', 'acct_type'],
          values: ['total'],
        }}
        dataSource={sourceOf({
          rows: [
            { acct_industry: 'education', acct_type: 'partner', total: 5 },
            { acct_industry: 'finance', acct_type: 'direct', total: 7 },
          ],
          fields: [
            { name: 'acct_industry', type: 'select', label: 'Industry' },
            { name: 'acct_type', type: 'select', label: 'Type' },
            { name: 'total', type: 'number', label: 'Total' },
          ],
          object: 'crm_opportunity',
          dimensionFields: {
            acct_industry: 'crm_account.industry',
            acct_type: 'crm_account.type',
          },
          totals: [
            {
              dimensions: ['acct_industry'],
              rows: [
                { acct_industry: 'education', total: 5 },
                { acct_industry: 'finance', total: 7 },
              ],
            },
            {
              dimensions: ['acct_type'],
              rows: [
                { acct_type: 'partner', total: 5 },
                { acct_type: 'direct', total: 7 },
              ],
            },
            { dimensions: [], rows: [{ total: 12 }] },
          ],
        })}
      />,
    );

    const matrix = await screen.findByTestId('dataset-matrix');
    // Row dimension (down the side) resolves.
    await waitFor(() => {
      const rowCells = Array.from(matrix.querySelectorAll('tbody tr td')).map((td) => td.textContent);
      expect(rowCells).toContain('Education');
      expect(rowCells).toContain('Finance');
    });
    // Column dimension (across the top) resolves too.
    const headers = Array.from(matrix.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toContain('Partner');
    expect(headers).toContain('Direct');
    expect(headers).not.toContain('partner');

    // …and the server's row totals still find their bucket after the relabel.
    const rowTotals = within(matrix).getAllByTestId('matrix-row-total').map((td) => td.textContent);
    expect(rowTotals).toEqual(['5', '7']);
    expect(within(matrix).getByTestId('matrix-grand-total').textContent).toBe('12');
  });

  it('walks a MULTI-HOP dotted path on a table (a.b.field)', async () => {
    // ADR-0071: the dataset designer emits `relationship.relationship.field`,
    // and #4261's resolver walks per-segment. One pin that the table path gets
    // the same walk, not a single-hop special case.
    const { requested } = installMetaRouter({
      crm_opportunity: OPPORTUNITY,
      crm_account: ACCOUNT,
      crm_user: {
        name: 'crm_user',
        fields: {
          department: { type: 'select', options: [{ value: 'rnd', label: 'Research & Development' }] },
        },
      },
    });
    render(
      <DatasetWidget
        widget={{ type: 'table', dataset: 'd', dimensions: ['owner_dept'], values: ['total'] }}
        dataSource={sourceOf({
          rows: [{ owner_dept: 'rnd', total: 1 }],
          fields: [
            { name: 'owner_dept', type: 'select', label: 'Department' },
            { name: 'total', type: 'number', label: 'Total' },
          ],
          object: 'crm_opportunity',
          dimensionFields: { owner_dept: 'crm_account.owner.department' },
        })}
      />,
    );

    await waitFor(() => expect(firstRowCells()[0]).toBe('Research & Development'));
    expect(requested).toEqual(['crm_opportunity', 'crm_account', 'crm_user']);
  });

  it('exports the resolved label for a dotted column and the untouched value for a local one', async () => {
    // The CSV is the table's data, so it follows the table's cells: a dotted
    // dimension exports what the table now shows. For a LOCAL dimension the
    // export is unchanged for the same reason the cell is.
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    const blobs: any[] = [];
    (URL as any).createObjectURL = (b: any) => { blobs.push(b); return 'blob:x'; };
    (URL as any).revokeObjectURL = () => {};
    try {
      installMetaRouter({ crm_opportunity: OPPORTUNITY, crm_account: ACCOUNT });
      render(
        <DatasetWidget
          widget={{
            type: 'table',
            dataset: 'd',
            dimensions: ['industry', 'account_industry'],
            values: ['total_amount'],
          }}
          dataSource={sourceOf({
            rows: [{ industry: 'education', account_industry: 'education', total_amount: 10 }],
            fields: [
              { name: 'industry', type: 'select', label: 'Industry' },
              { name: 'account_industry', type: 'select', label: 'Account Industry' },
              { name: 'total_amount', type: 'number', label: 'Total Amount' },
            ],
            object: 'crm_opportunity',
            dimensionFields: { industry: 'industry', account_industry: 'crm_account.industry' },
          })}
        />,
      );
      // Wait for the resolution to land before exporting.
      await waitFor(() => expect(firstRowCells()[1]).toBe('Education'));
      fireEvent.click(await screen.findByTestId('dataset-export'));
      expect(blobs).toHaveLength(1);
      // downloadCsv prepends a UTF-8 BOM so Excel reads non-ASCII labels.
      const text: string = (await blobs[0].text()).replace(/^\uFEFF/, '');
      const [, body] = text.split('\r\n');
      expect(body).toBe('education,Education,10');
    } finally {
      (URL as any).createObjectURL = origCreate;
      (URL as any).revokeObjectURL = origRevoke;
    }
  });

  it('METRIC: the branch renders no dimension value at all, so there is nothing to resolve', async () => {
    // Measured verdict for the metric third of this card. `METRIC_TYPES`
    // (metric/kpi/gauge/solid-gauge/bullet) renders ONE measure value plus the
    // measure's header label — a dimension's value never reaches the DOM, in
    // any spelling. So a dotted dimension on a metric has no raw value on
    // screen to resolve: the gap the issue describes for table/pivot is empty
    // here, and turning the resolution on would be a metadata fetch whose
    // result nothing reads.
    const { requested } = installMetaRouter({ crm_opportunity: OPPORTUNITY, crm_account: ACCOUNT });
    const { container } = render(
      <DatasetWidget
        widget={{ type: 'metric', dataset: 'd', dimensions: ['acct_industry'], values: ['total'] }}
        dataSource={sourceOf({
          rows: [{ acct_industry: 'education', total: 5 }],
          fields: [
            { name: 'acct_industry', type: 'select', label: 'Industry' },
            { name: 'total', type: 'number', label: 'Total' },
          ],
          object: 'crm_opportunity',
          dimensionFields: { acct_industry: 'crm_account.industry' },
        })}
      />,
    );

    await waitFor(() => expect(container.textContent).toContain('5'));
    // Neither the raw value nor its label is rendered — the dimension is not
    // part of this branch's output.
    expect(container.textContent).not.toContain('education');
    expect(container.textContent).not.toContain('Education');
    // And no resolution was attempted for it.
    expect(requested).toEqual([]);
  });
});
