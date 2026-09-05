/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `drillDown` is validated by name wherever a mirror declares it
 * (objectui#7352).
 *
 * `DrillDownConfig` (`../data-display.ts`) is the drill configuration five
 * widgets share, and two mirrored declarations carry `drillDown?: DrillDownConfig`
 * — `ChartSchema` and `ObjectDataTableSchema` (objectui#6576). Neither mirror
 * knew the key: there was no `DrillDownConfigSchema`, so under `BaseSchema`'s
 * `.passthrough()` a `drillDown: { enabled: 'yes' }` parsed GREEN and rode
 * through to a widget that reads `enabled` as truthy. Both pairs were ledgered
 * in `zod-mirror-parity.test.ts` (`UnmirroredDeclared`) as the measured debt.
 *
 * This file is the behaviour pin for the repair: the mirror exists, is
 * exported from `@object-ui/types/zod`, is wired into both declarations, and
 * REFUSES the malformed value by name where nothing refused it before. The
 * ledger side (both `UnmirroredDeclared` rows gone, the new pair registered)
 * is pinned by the parity file's own ratchet.
 *
 * ⚠️ `PivotTableSchema.drillDown` is NOT covered here: that declaration has no
 * zod mirror at all, so it sits in no ledger. The mirror minted here is the home
 * that key will use whenever the pivot pair is mirrored (a separate card).
 *
 * ⚠️ Not the spec's `ChartDrillDownSchema`, deliberately: `@objectstack/spec/ui`
 * models the CHART-ONLY subset (`enabled` / `filter` / `title` / `target` /
 * `columns` / `maxRows`) as a strict object that refuses `mode` and `report` by
 * name, and both of those are real keys on the table / pivot / metric widgets
 * that share `DrillDownConfig`. Referencing it would make the published
 * validator refuse what the published TypeScript declares — the class this
 * card closes, in the other direction.
 */
import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  safeValidateSchema,
  DrillDownConfigSchema,
  ChartSchema,
  ObjectDataTableSchema,
} from '../zod/index.zod.js';
import type { DrillDownConfig } from '../data-display.js';

/* ── Runtime helpers ───────────────────────────────────────────────────────── */

/** Every issue path in the tree, per-arm `errors` included (see the objectui#7363 pin). */
function issuePaths(result: { success: true } | { success: false; error: { issues: readonly z.core.$ZodIssue[] } }): string[] {
  if (result.success) return [];
  const out: string[] = [];
  const walk = (issues: readonly z.core.$ZodIssue[]) => {
    for (const issue of issues) {
      out.push(issue.path.map(String).join('.'));
      const nested = (issue as { errors?: readonly (readonly z.core.$ZodIssue[])[] }).errors;
      if (nested) for (const arm of nested) walk(arm);
    }
  };
  walk(result.error.issues);
  return out;
}

/** A chart document that validates on its own, so a red run is about `drillDown`. */
const chart = (drillDown: unknown) => ({
  type: 'chart',
  chartType: 'bar',
  series: [{ name: 'revenue' }],
  drillDown,
});
const table = (drillDown: unknown) => ({ type: 'object-data-table', objectName: 'contact', drillDown });

/* ── The values hosts actually synthesise ──────────────────────────────────── */

/**
 * Read from the renderers, not invented: `DashboardRenderer.tsx` writes
 * `{ enabled: true }` for drillable charts and `{ enabled: true, mode: 'record' }`
 * for object-backed tables; `ObjectMetricWidget.tsx` writes
 * `{ enabled: true, mode: 'record', target: 'dialog' }`; the drill tests author
 * `{ enabled: false }` and `{ enabled: true, mode: 'filter' }`. `report` takes the
 * two structural forms `DrillDownConfig` declares.
 */
const ACCEPTED: Array<[string, DrillDownConfig]> = [
  ['the empty block', {}],
  ['enabled', { enabled: true }],
  ['disabled', { enabled: false }],
  ['record mode', { enabled: true, mode: 'record' }],
  ['filter mode', { enabled: true, mode: 'filter' }],
  ['record mode in a dialog', { enabled: true, mode: 'record', target: 'dialog' }],
  ['navigate target', { target: 'navigate' }],
  ['the full drill-through shape', {
    enabled: true,
    title: '${event.rowLabel}',
    filter: { status: '${event.rowKey}', owner: 42 },
    columns: ['name', 'amount'],
    maxRows: 50,
  }],
  ['an inline report', { report: { name: 'pipeline', objectName: 'opportunity', type: 'summary', columns: [] } }],
  ['an inline report carrying extra report keys', {
    report: { name: 'pipeline', objectName: 'opportunity', columns: [{ field: 'amount' }], groupBy: ['stage'] },
  }],
  ['a named report reference', { report: { name: 'pipeline' } }],
];

/** Each is a DECLARED key with a value outside its declared type. */
const REFUSED: Array<[string, unknown, string]> = [
  ['enabled as a string', { enabled: 'yes' }, 'enabled'],
  ['an unknown mode', { mode: 'jump' }, 'mode'],
  ['an unknown target', { target: 'popup' }, 'target'],
  ['title as a number', { title: 42 }, 'title'],
  ['filter as a string', { filter: 'status eq open' }, 'filter'],
  ['columns as a string', { columns: 'name' }, 'columns'],
  ['maxRows as a string', { maxRows: '50' }, 'maxRows'],
  ['report as a bare string', { report: 'pipeline' }, 'report'],
  ['an inline report without objectName', { report: { name: 'pipeline', columns: [] } }, 'report'],
  ['a report reference with a non-string name', { report: { name: 42 } }, 'report'],
];

describe('objectui#7352 — DrillDownConfigSchema is the zod mirror of DrillDownConfig', () => {
  it('is exported from the /zod barrel and declares every key the TS interface declares', () => {
    expect(DrillDownConfigSchema).toBeDefined();
    expect(Object.keys(DrillDownConfigSchema.shape).sort()).toEqual(
      ['columns', 'enabled', 'filter', 'maxRows', 'mode', 'report', 'target', 'title'],
    );
  });

  it.each(ACCEPTED)('accepts %s', (_label, value) => {
    const r = DrillDownConfigSchema.safeParse(value);
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it('keeps an inline report\'s extra keys — the declaration has an index signature', () => {
    const r = DrillDownConfigSchema.safeParse({
      report: { name: 'pipeline', objectName: 'opportunity', columns: [], groupBy: ['stage'] },
    });
    expect(r.success).toBe(true);
    expect(r.success && (r.data.report as Record<string, unknown>).groupBy).toEqual(['stage']);
  });

  it.each(REFUSED)('refuses %s, naming the key', (_label, value, key) => {
    const r = DrillDownConfigSchema.safeParse(value);
    expect(r.success).toBe(false);
    expect(issuePaths(r).some((p) => p === key || p.startsWith(`${key}.`))).toBe(true);
  });
});

describe('objectui#7352 — both declaring mirrors read the key', () => {
  it('ChartSchema and ObjectDataTableSchema declare drillDown through the shared mirror', () => {
    expect(ChartSchema.shape.drillDown).toBeDefined();
    expect(ObjectDataTableSchema.shape.drillDown).toBeDefined();
  });

  it.each(ACCEPTED)('a chart carrying %s validates', (_label, value) => {
    const r = safeValidateSchema(chart(value));
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it.each(ACCEPTED)('an object-data-table carrying %s validates', (_label, value) => {
    const r = safeValidateSchema(table(value));
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it('the card\'s own repro is refused where it used to parse green: chart', () => {
    // Under `.passthrough()` this parsed green and the widget read `'yes'` as
    // truthy. `.success === false` is the whole leg here — it was TRUE before.
    const r = safeValidateSchema(chart({ enabled: 'yes' }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain('drillDown.enabled');
  });

  it('the card\'s own repro is refused BY NAME on object-data-table', () => {
    // This node was refused before too — for having NO arm at all (objectui#7363).
    // The by-name path is what did not exist.
    const r = safeValidateSchema(table({ enabled: 'yes' }));
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain('drillDown.enabled');
  });

  it.each(REFUSED)('a chart carrying %s is refused under drillDown', (_label, value, key) => {
    const r = safeValidateSchema(chart(value));
    expect(r.success).toBe(false);
    expect(issuePaths(r).some((p) => p === `drillDown.${key}` || p.startsWith(`drillDown.${key}.`))).toBe(true);
  });

  it('the mirror does not reach beyond the two declaring pairs: a plain data-table has no drillDown arm', () => {
    // `DataTableSchema` does not declare `drillDown` on either face; a value there
    // still rides through on `.passthrough()`, unchanged by this card.
    const r = safeValidateSchema({ type: 'data-table', columns: [], data: [], drillDown: { enabled: 'yes' } });
    expect(r.success).toBe(true);
  });
});
