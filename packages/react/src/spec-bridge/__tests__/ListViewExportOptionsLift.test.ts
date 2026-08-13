/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { SpecBridge } from '../SpecBridge';

/**
 * The `exportOptions` lift pin (objectui#4585).
 *
 * The bridge used to copy `spec.exportOptions` across verbatim, so a legacy
 * bare format array reached the `object-grid` node unchanged — and ObjectGrid
 * reads the OBJECT form and only that (`schema.exportOptions?.formats`).
 * `.formats` on an array is `undefined`, so the renderer's `['csv', 'json']`
 * default won: a view declaring `['csv', 'xlsx']` offered csv and json, losing
 * the declared xlsx and gaining an undeclared json, with no error, no warning
 * and no console line. `!!schema.exportOptions` stayed truthy for a non-empty
 * array, so the export button still showed — the failure was silent, not
 * absent.
 *
 * The fix mirrors the spec's OWN parse-time lift and nothing more
 * (`@objectstack/spec` `ui/view.zod.ts`, objectstack#8010):
 *
 *     z.array(ListViewExportFormatSchema).transform((formats) => ({ formats }))
 *
 * so this is one contract applied where `parse` cannot reach, not a second one.
 * The bridge's input is a TypeScript type, never a parsed value — there is no
 * `parse`/`safeParse` anywhere under `spec-bridge/` — which is why bumping the
 * spec pin alone would not have closed #4585.
 *
 * The lifted value is typed `ListViewExportOptions` from `@object-ui/types`
 * (landed objectui#4535 / PR #4584) — one spelling of the spec's five-key
 * shape, no third copy. That half is enforced by `tsc` on the bridge source,
 * not by an assertion here.
 *
 * RESIDUE (recorded, not built — #4585 item 4). objectui pins
 * `@objectstack/spec@17.0.0-rc.6`, where `ListView.exportOptions` is still the
 * bare array and the lift does not exist yet; measured in the pinned dist:
 * `exportOptions: z.array(z.enum(['csv','xlsx','pdf','json'])).optional()`.
 * Once the pin bumps past objectstack#8324 the spec's schema becomes reachable
 * from here, and a stronger assertion replaces the hand-mirroring below: parse
 * the same input through the spec and require `bridge lift === spec parse
 * output`, one contract proven equal rather than copied. Do not block on it.
 */

/** What the bridge writes to the node, through the untyped host boundary. */
function bridgedExportOptions(exportOptions: unknown): unknown {
  return new SpecBridge().transformListView({
    name: 'export_view',
    columns: [{ field: 'name', label: 'Name' }],
    exportOptions,
  }).exportOptions;
}

describe('SpecBridge — exportOptions lift (#4585)', () => {
  it('lifts a legacy bare format array to the spec object form', () => {
    expect(bridgedExportOptions(['csv', 'xlsx'])).toEqual({ formats: ['csv', 'xlsx'] });
  });

  it('lifts an empty array to `{ formats: [] }` verbatim, neither dropped nor defaulted', () => {
    // The spec's `z.array()` carries no `.min(1)`, so `[]` is a legal input and
    // its transform wraps it like any other. Downstream that reads as "this
    // view declares no export format": ObjectGrid's menu comes out empty and
    // the export button is hidden — pinned end-to-end in plugin-grid's
    // `specBridgeExportFormats.test.tsx`.
    expect(bridgedExportOptions([])).toEqual({ formats: [] });
  });

  it('passes the object form through by reference, unread and unrewritten', () => {
    const authored = { formats: ['csv', 'json'], maxRecords: 5000, streaming: false };

    // Identity, not equality: the object spelling is already the contract, so
    // the bridge must not rebuild, re-key or re-order it.
    expect(bridgedExportOptions(authored)).toBe(authored);
  });

  it('leaves the key absent when the view declares no exportOptions', () => {
    const node = new SpecBridge().transformListView({
      name: 'no_export_view',
      columns: [{ field: 'name', label: 'Name' }],
    });

    expect('exportOptions' in node).toBe(false);
  });

  it('carries a pre-retirement `pdf` into the lift instead of filtering it out', () => {
    // The spec REFUSES `'pdf'` at parse with a migration prescription
    // (objectstack#8010; PDF export declined as objectstack#1301 NOT_PLANNED) —
    // it does not silently drop the value, so the mirror of its lift may not
    // either. Stored metadata predating `os migrate meta --from 16` still
    // carries it, and it dies downstream in ObjectGrid's format-agnostic menu
    // filter (objectui#4535) rather than in a `'pdf'`-shaped branch here.
    expect(bridgedExportOptions(['csv', 'pdf'])).toEqual({ formats: ['csv', 'pdf'] });
  });
});
