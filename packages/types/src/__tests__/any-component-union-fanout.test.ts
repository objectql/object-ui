/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `AnyComponentSchema` discriminates on `type` (objectui#8498).
 *
 * ## The defect these pin
 *
 * As a flat `z.union`, a refusal reported EVERY arm's issues under one
 * `invalid_union`, and Zod's `$ZodError` initializer `JSON.stringify`s that
 * whole tree into `.message` EAGERLY — `zod/v4/core/errors.js:13`, in the
 * constructor, not behind a getter. So the cost was paid whether or not anyone
 * read the message, and it compounded per level of nesting until `safeParse`
 * itself threw `RangeError: Invalid string length` — out of `safeValidateSchema`,
 * which `index.zod.ts` documents as validating "without throwing errors".
 *
 * ⚠️ Every bound below is written to FAIL on the flat union, and each one was
 * run against it to check that it does. The readings, same documents, same zod
 * 4.4.3, flat -> discriminated:
 *
 *     known-type leaf refusal    14,624 -> 164 chars   (13 arm subtrees -> none)
 *     unknown `type` refusal     14,855 -> 2,178 chars
 *     refused node 4 deep        19,311 -> 4,330 chars
 *
 * A bound that also passed on the flat union would assert nothing, which is the
 * failure mode this card is most exposed to: `AnyComponentSchema` does not yet
 * recurse into child slots (objectui#7869 / objectui#8344), so a nested document
 * is simply ACCEPTED and a naive "does not throw at depth 4" test is green for
 * the wrong reason. The depth case below is therefore built on `MenuItemSchema`,
 * which ALREADY refuses at depth on this tree.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AnyComponentSchema, safeValidateSchema } from '../zod/index.zod.js';
import { CRUDComponentSchema } from '../zod/crud.zod.js';
import { ObjectQLComponentSchema } from '../zod/objectql.zod.js';

/** A leaf node whose `type` selects exactly one arm, failing on that arm's key. */
const OFF_SPEC_ICON = { type: 'icon', icon: 'check', size: 'huge' };

/** A `type` no arm claims. */
const FOREIGN_DOCUMENT = { type: 'module', main: './index.js' };

/**
 * A menu item nested `depth` levels down whose `type` is an ADR-0049 retirement
 * tombstone. `MenuItemSchema` (`overlay.zod.ts`) recurses through `children`,
 * and `dropdown-menu` reaches it from the document root — so this refuses AT
 * DEPTH on the flat union too, which is what makes the bound below a reading
 * rather than a formality.
 */
function menuWithRefusedItemAt(depth: number) {
  const item = (n: number): Record<string, unknown> =>
    n === 0 ? { label: 'bad', type: 'separator' } : { label: 'ok', children: [item(n - 1)] };
  return { type: 'dropdown-menu', trigger: 'x', items: [item(depth)] };
}

/** Every issue in the tree, counting the per-arm lists a flat union hangs off. */
function issueNodeCount(issues: readonly { errors?: readonly (readonly unknown[])[] }[]): number {
  return issues.reduce((n, issue) => {
    const arms = Array.isArray(issue.errors) ? issue.errors : [];
    return n + 1 + arms.reduce((m, arm) => m + issueNodeCount(arm as never), 0);
  }, 0);
}

/** The `type` literals a schema declares to Zod's discriminator dispatch. */
function literalsOf(schema: unknown): string[] {
  const values = (schema as { _zod?: { propValues?: { type?: Set<string> } } })._zod?.propValues
    ?.type;
  return values === undefined ? [] : [...values];
}

describe('AnyComponentSchema — the property discriminating rests on', () => {
  it('claims every `type` literal exactly once across the arms', () => {
    // Stated as a property, not as a count: the number of arms and literals
    // moves every time a component lands, the distinctness does not — and it is
    // the distinctness that makes "the arm the literal selects" the ONLY arm
    // that could have accepted the document. `union-arm-diagnostics.ts` states
    // the same invariant as its fact 4.
    const literals = literalsOf(AnyComponentSchema);
    expect(literals.length).toBeGreaterThan(0);
    expect(new Set(literals).size).toBe(literals.length);
  });

  it('detects a collision when there is one', () => {
    // The firing control for the assertion above: two arms claiming `div` must
    // read as a duplicate, or the check above proves nothing.
    const a = z.object({ type: z.literal('div') });
    const b = z.object({ type: z.literal('div'), other: z.string() });
    const literals = [...literalsOf(a), ...literalsOf(b)];
    expect(new Set(literals).size).not.toBe(literals.length);
  });

  it('lets both nested unions declare their literals too', () => {
    // Zod 4.4.3 REFUSES a plain `z.union` as a discriminated member — it
    // computes no `propValues`, so it declares nothing to dispatch on
    // (measured: `Invalid discriminated union option at index "9"`). These two
    // were the last flat sites, and `AnyComponentSchema` cannot discriminate
    // while either of them is one.
    expect(literalsOf(ObjectQLComponentSchema)).toContain('object-grid');
    expect(literalsOf(CRUDComponentSchema)).toContain('action');
    // `ActionSchema` reaches its literal through a `z.lazy` its maintainer-ruled
    // `z.ZodType<…>` annotation hides from `tsc` — the fact the cast at that arm
    // asserts, pinned here so the cast cannot rot into a lie unnoticed.
    expect(literalsOf(CRUDComponentSchema)).toEqual(
      expect.arrayContaining(['action', 'detail', 'crud-dialog']),
    );
  });
});

describe('AnyComponentSchema — a refusal costs one arm, not every arm', () => {
  it('hangs no per-arm subtree off a refusal whose `type` selects an arm', () => {
    const result = AnyComponentSchema.safeParse(OFF_SPEC_ICON);
    expect(result.success).toBe(false);
    if (result.success) return;
    // THE mechanism assertion. On the flat union this was 13 arm lists — one
    // per member — and it is that array, stringified per level, that grew ~25x
    // per level of nesting. Discriminated, the selected arm's issues ARE the
    // top-level issues, so there is no array to multiply.
    for (const issue of result.error.issues) {
      expect((issue as { errors?: unknown[] }).errors ?? []).toHaveLength(0);
    }
    expect(issueNodeCount(result.error.issues as never)).toBeLessThanOrEqual(4);
    expect(result.error.message.length).toBeLessThanOrEqual(1_000);
  });

  it('leaves a non-object root its own diagnosis', () => {
    // The message override is scoped to `invalid_union`; an unconditional one is
    // scoped to the whole schema and swallowed this, leaving a bare "Invalid
    // input" for every non-component document.
    const result = AnyComponentSchema.safeParse(42);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].code).toBe('invalid_type');
    expect(result.error.issues[0].message).toContain('expected object, received number');
  });

  it('bounds the message when no arm claims the authored `type`', () => {
    const result = AnyComponentSchema.safeParse(FOREIGN_DOCUMENT);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message.length).toBeLessThanOrEqual(4_000);
    // The literals stay ON the issue, which is where `@object-ui/cli`'s
    // `union-arm-diagnostics` reads them to build the CAPPED candidate list the
    // 2026-09-02 maintainer ruling requires. Only the default MESSAGE — which
    // spelled all of them out inline — was replaced.
    const [issue] = result.error.issues as { options?: unknown[]; note?: string }[];
    expect(issue.note).toBe('No matching discriminator');
    expect(issue.options?.length).toBeGreaterThan(50);
  });
});

describe('safeValidateSchema — a refused node deep in a document', () => {
  it('stays bounded four levels down, where the flat union did not', () => {
    // The card's title case. `safeValidateSchema` is documented as validating
    // "without throwing errors"; the flat union broke that promise by building
    // a message no `String` can hold. A bound is the durable form of the same
    // claim — it fires long before `RangeError` does.
    const result = safeValidateSchema(menuWithRefusedItemAt(4));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message.length).toBeLessThanOrEqual(8_000);
    expect(issueNodeCount(result.error.issues as never)).toBeLessThanOrEqual(40);
    // The diagnosis still reaches the author — a bound met by reporting
    // NOTHING would be the wrong repair.
    expect(result.error.message).toContain('RETIRED (objectui#6523)');
  });

  it('still accepts the same document with a legal item at that depth', () => {
    // The control that keeps the bound honest about WHERE the cost was: the
    // green path was never expensive, and must still be green.
    const legal = (n: number): Record<string, unknown> =>
      n === 0 ? { label: 'leaf' } : { label: 'ok', children: [legal(n - 1)] };
    expect(
      safeValidateSchema({ type: 'dropdown-menu', trigger: 'x', items: [legal(4)] }).success,
    ).toBe(true);
  });
});
