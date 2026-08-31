// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `ListViewExportOptions` ↔ the INSTALLED `@objectstack/spec` (objectui#4535).
 *
 * The card this file closes was filed because a comment claimed alignment with
 * `@objectstack/spec`'s `ListViewSchema.exportOptions` and was false in both
 * directions. objectstack#8010 fixed the upstream half; objectui's half restated
 * the spec's five keys locally, under a NOTE explaining that the object form was
 * not importable from the pin.
 *
 * Both halves have since moved, and that is the hazard this file exists for. The
 * pin bumped to `@objectstack/spec@17.2.0`, which DOES carry the object form —
 * so the NOTE went stale, and the prose went false again, by nobody touching it.
 * A comment that has already gone false twice is not the instrument to trust a
 * third time.
 *
 * So the claim is made falsifiable instead: every assertion below reads the
 * shape out of the spec package that is actually installed, at test time, and
 * compares it to the local declaration. Nothing here restates the contract — a
 * restatement is a third copy, and the copy is what drifts (the lesson
 * `list-view-spec-parity.test.ts` already records for the enclosing schema).
 *
 * Why a mirror at all, rather than `z.infer` of the spec symbol:
 * `ListViewExportOptionsSchema` is internal to the spec bundle and NOT among the
 * package's public exports — measured, not assumed, by the floor test below.
 * Only the enclosing `ListViewSchema` is exported, and its `exportOptions` is a
 * two-branch union (legacy-array lift ∪ object), whose inferred type is a union
 * and not this interface. When upstream exports the symbol, derive from it and
 * delete both the mirror and this file's key-set tests.
 *
 * SCOPE, stated rather than implied: this covers the TypeScript declaration in
 * `objectql.ts`. objectui's own Zod mirror of `ListViewSchema`
 * (`src/zod/objectql.zod.ts`) declares `exportOptions` separately and is NOT
 * measured here — deliberately, because it is a different seat's file surface.
 */

import { describe, it, expect } from 'vitest';
import { ListViewSchema as SpecListViewSchema } from '@objectstack/spec/ui';
import type { ListViewExportFormat, ListViewExportOptions } from '../index';

/* ── The local declaration, as runtime-enumerable data ────────────────────── */

/**
 * `Record<keyof T, true>` is exhaustive BOTH ways at compile time: a key added
 * to the interface and missing here is a TS2741, and a key here that the
 * interface dropped is a TS2353. That makes this object a faithful runtime
 * projection of the type — which the type itself, erased at runtime, cannot be.
 */
const LOCAL_OPTION_KEYS: Record<keyof ListViewExportOptions, true> = {
  formats: true,
  maxRecords: true,
  includeHeaders: true,
  fileNamePrefix: true,
  streaming: true,
};

/** Same device for the format union, so the enum comparison is also exhaustive. */
const LOCAL_FORMATS: Record<ListViewExportFormat, true> = {
  csv: true,
  xlsx: true,
  json: true,
};

/* ── Reaching the spec's object branch ────────────────────────────────────── */

type ZodLike = {
  unwrap?: () => ZodLike;
  options?: ZodLike[];
  shape?: Record<string, ZodLike>;
  element?: ZodLike;
  safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { issues: { message: string }[] } };
  _zod?: { def?: { type?: string; element?: ZodLike; entries?: Record<string, string> } };
};

const specExportOptions = (SpecListViewSchema as unknown as { shape: Record<string, ZodLike> })
  .shape.exportOptions;

/** Peel `.optional()` (and any further wrapper) until the union itself. */
function toUnion(schema: ZodLike): ZodLike {
  let cur = schema;
  for (let i = 0; i < 5 && cur && !cur.options && typeof cur.unwrap === 'function'; i++) {
    cur = cur.unwrap();
  }
  return cur;
}

const specUnion = toUnion(specExportOptions);
/**
 * The object branch — the one with a `shape`. The other branch is the legacy
 * bare-format-array lift, which is a `ZodPipe` and has none.
 */
const specObjectBranch = specUnion.options?.find((o) => o.shape);

function specFormatEnumValues(): string[] {
  let f = specObjectBranch?.shape?.formats;
  for (let i = 0; i < 5 && f && f._zod?.def?.type !== 'array' && typeof f.unwrap === 'function'; i++) {
    f = f.unwrap();
  }
  const element = f?._zod?.def?.element ?? f?.element;
  return Object.keys(element?._zod?.def?.entries ?? {});
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('exportOptions ↔ installed @objectstack/spec (objectui#4535)', () => {
  it('finds the spec shape it is about to compare against', () => {
    // Non-vacuity floor. Every assertion below reads through `specObjectBranch`,
    // and a spec refactor that moved the shape would otherwise turn each of them
    // into a comparison against `undefined` — which some would pass.
    expect(specExportOptions).toBeDefined();
    expect(specUnion.options).toHaveLength(2);
    expect(specObjectBranch).toBeDefined();
    expect(Object.keys(specObjectBranch?.shape ?? {}).length).toBe(5);
    expect(specFormatEnumValues().length).toBeGreaterThan(0);
  });

  it('records WHY the mirror exists: the spec does not export the symbol', async () => {
    // The reason in the doc comment, measured. If this ever fails, the mirror is
    // obsolete: derive `ListViewExportOptions` from the exported symbol and
    // delete it, rather than leaving a hand copy beside an importable schema.
    const specUi = (await import('@objectstack/spec/ui')) as unknown as Record<string, unknown>;
    expect(specUi.ListViewSchema).toBeDefined();
    expect(specUi.ListViewExportOptionsSchema).toBeUndefined();
  });

  it('declares exactly the keys the spec object branch declares', () => {
    expect(Object.keys(LOCAL_OPTION_KEYS).sort())
      .toEqual(Object.keys(specObjectBranch?.shape ?? {}).sort());
  });

  it('offers exactly the formats the spec enum offers — `pdf` is gone from both', () => {
    expect(Object.keys(LOCAL_FORMATS).sort()).toEqual(specFormatEnumValues().sort());
    expect(specFormatEnumValues()).not.toContain('pdf');
  });

  it('is strict upstream: a sixth key is refused, so declaring one here is unauthorable', () => {
    // The other end of the local key-set assertion in `objectql.exportOptions.test.ts`.
    // That one stops a sixth key being DECLARED locally; this one is the reason —
    // the platform would refuse metadata carrying it.
    expect(specExportOptions.safeParse({ formats: ['csv'], compression: 'gzip' }).success).toBe(false);
    expect(specExportOptions.safeParse({
      formats: ['csv'], maxRecords: 1, includeHeaders: true, fileNamePrefix: 'p', streaming: false,
    }).success).toBe(true);
  });

  it('refuses a retired `pdf` format with a migration prescription, not a bare rejection', () => {
    const refused = specExportOptions.safeParse(['csv', 'pdf']);
    expect(refused.success).toBe(false);
    // The prescription is the half that makes the refusal actionable for an
    // author; asserting only `success === false` would stay green if it were
    // reduced to "Invalid input".
    const messages = (refused.error?.issues ?? []).map((i) => i.message).join('\n');
    expect(messages).toMatch(/pdf/);
    expect(messages).toMatch(/8010|1301/);
  });

  it('lifts a bare format array at PARSE — which is why the renderer still needs its own tolerance', () => {
    // objectui#4535 item 4. The lift is real, but it only runs for whoever calls
    // `.parse()`. Nothing on objectui's render path does: `normalizeListViewSchema`
    // (@object-ui/core) does not touch `exportOptions`, and the ListView surface is
    // typed `z.input` precisely because the renderer receives metadata as authored.
    // So a stored bare array still arrives as an array, and `ListView`'s
    // `resolvedExportOptions` fold is load-bearing rather than legacy.
    const lifted = specExportOptions.safeParse(['csv', 'xlsx']);
    expect(lifted.success).toBe(true);
    expect(lifted.data).toEqual({ formats: ['csv', 'xlsx'] });
  });
});
