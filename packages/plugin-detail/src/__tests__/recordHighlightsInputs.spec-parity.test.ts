/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:highlights` — the published authoring surface stays in parity with
 * `@objectstack/spec` RecordHighlights* (objectui#3407, objectstack#5176).
 *
 * The registry `inputs` ARE the published contract: `gen-manifest.ts`
 * serializes them into `sdui.manifest.json` (the save-gate + parser whitelist)
 * and into `sdui-intrinsics.d.ts` (the JSX authoring type surface). Nothing in
 * the repo cross-checks them against the spec, so both drift directions are
 * silent and both are harmful:
 *
 *   - a spec ENTRY key that no input mentions is a key an AI author cannot
 *     discover (the complaint that opened #3407: `readonly` was enforced by the
 *     HeaderHighlight gate and honoured by the renderer, but the `fields`
 *     description still spelled the entry shape `{name,label?,icon?,type?}`);
 *   - a top-level input the spec does not declare is worse than undocumented,
 *     it is actively misleading. `RecordHighlightsProps` is a plain `z.object`,
 *     so an unknown top-level key is STRIPPED on parse with no error, the
 *     manifest gate only validates top-level props and raises no diagnostic,
 *     and the renderer never sees it. The manifest would be telling authors to
 *     write something the platform throws away.
 *
 * Both assertions derive their expectation from the spec at runtime rather than
 * restating today's key list, so a spec change fails here instead of quietly
 * widening the gap.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { RecordHighlightsField, RecordHighlightsProps } from '@objectstack/spec/ui';
import '../index';

/** Keys of the object arm of the spec's `RecordHighlightsField` union. */
function specEntryKeys(): string[] {
  const union = RecordHighlightsField as unknown as {
    def?: { options?: unknown[] };
    _def?: { options?: unknown[] };
  };
  const arms = union.def?.options ?? union._def?.options ?? [];
  for (const arm of arms) {
    const shape = (arm as { shape?: unknown; _def?: { shape?: unknown } }).shape
      ?? (arm as { _def?: { shape?: unknown } })._def?.shape;
    const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
    if (resolved && typeof resolved === 'object') return Object.keys(resolved);
  }
  return [];
}

/** Top-level keys of the spec's `RecordHighlightsProps`. */
function specTopLevelKeys(): string[] {
  const obj = RecordHighlightsProps as unknown as {
    shape?: unknown;
    _def?: { shape?: unknown };
  };
  const shape = obj.shape ?? obj._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

const config = () => ComponentRegistry.getConfig('record:highlights');
const inputs = () => config()?.inputs ?? [];
const fieldsInput = () => inputs().find((i) => i.name === 'fields');

describe('record:highlights — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputs().length).toBeGreaterThan(0);
    expect(inputs().map((i) => i.name)).toContain('fields');
  });

  it('the spec really carries `readonly` per ENTRY, not top-level', () => {
    // Guards the premise the rest of the file rests on. If a future spec moves
    // `readonly` up to the props object, this fails and the `inputs` shape
    // above should be revisited — a top-level input would then be correct.
    expect(specEntryKeys()).toContain('readonly');
    expect(specTopLevelKeys()).not.toContain('readonly');
  });

  it('a top-level `readonly` is silently stripped by the spec, so it must not be published', () => {
    // The concrete harm: no throw, no diagnostic, key gone.
    const parsed = RecordHighlightsProps.parse({ fields: ['amount'], readonly: true });
    expect(parsed).not.toHaveProperty('readonly');
    // …while the per-entry spelling survives, which is the one authors need.
    const perEntry = RecordHighlightsProps.parse({ fields: [{ name: 'amount', readonly: true }] });
    expect(perEntry.fields[0]).toMatchObject({ name: 'amount', readonly: true });
  });

  it('every spec entry key is discoverable from the `fields` input description', () => {
    const description = fieldsInput()?.description ?? '';
    expect(description).not.toBe('');
    const undocumented = specEntryKeys().filter((key) => !description.includes(key));
    expect(undocumented).toEqual([]);
    // The key this issue was filed for, named explicitly so the regression is
    // legible if the derived check above is ever loosened.
    expect(description).toContain('readonly');
  });

  it('declares no top-level input the spec does not accept', () => {
    const allowed = new Set(specTopLevelKeys());
    const offSpec = inputs().map((i) => i.name).filter((name) => !allowed.has(name));
    expect(offSpec).toEqual([]);
  });
});
