/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Retirement pin — `DashboardComponentSchema.aria` (objectui#5830).
 *
 * The spec removed `dashboard.aria` at the #3896 audit close-out ("no
 * dashboard renderer ever applied it"): `DashboardSchema.shape.aria` in
 * `@objectstack/spec/ui` is a tombstone that refuses any value and tells
 * authors to delete the key. objectui's Zod twin inherits that refusal by
 * reference (`SpecDashboardFields`, `zod/complex.zod.ts` — `aria` is not in
 * its exclusion list), and `packages/plugin-dashboard/src` has no
 * `schema.aria` read site (pinned by that package's
 * `dashboardAuthoredInputs.test.tsx`). The TS interface was the last surface
 * still DECLARING the key — under a comment claiming alignment with
 * `AriaPropsSchema`, the opposite of the contract: the member-level instance
 * of #4631's "declared surfaces disagree".
 *
 * What the deletion changes at the type level, stated honestly: `BaseSchema`
 * carries `[key: string]: any`, so an authored `aria:` on a dashboard literal
 * still COMPILES after the removal — it falls to the index signature. A
 * `@ts-expect-error` pin on an authored literal therefore cannot stick here
 * (unlike `default-children-retired-contract-twins.test.ts`, whose interface
 * has no index signature). The pinnable effect is that `aria` stops being a
 * DECLARED member: the probe below extracts the interface's literal key set —
 * the index signature is filtered out by `string extends K` — and asserts
 * `aria` is out while its former neighbours stay in. Real enforcement because
 * `packages/types/tsconfig.test.json` is chained from this package's
 * `type-check` script (#3009).
 */

import { describe, it, expect } from 'vitest';
import type { DashboardComponentSchema } from '../complex';
import { DashboardComponentSchema as DashboardComponentZodSchema } from '../zod/index.zod';

// Literal (declared) keys of T: `string extends K` is true only for the index
// signature's key, so mapping it to `never` leaves exactly the authored members.
type DeclaredKeys<T> = { [K in keyof T as string extends K ? never : K]: T[K] };
type Declared = keyof DeclaredKeys<DashboardComponentSchema>;

describe('the TS interface no longer declares `aria` (objectui#5830)', () => {
  it('`aria` is not a declared member; the neighbours it stood beside still are', () => {
    // Type-level pin, erased at runtime: if the member came back, the first
    // annotation would collapse to `false` and this file would fail
    // `type-check`. (Reverse-verified at the PR: with the member restored,
    // `tsc -p tsconfig.test.json` goes red on exactly this line.)
    const ariaNotDeclared: 'aria' extends Declared ? false : true = true;
    // Positive controls through the same extraction: a probe that saw no
    // members at all would also report `aria` absent.
    const widgetsDeclared: 'widgets' extends Declared ? true : false = true;
    const dateRangeDeclared: 'dateRange' extends Declared ? true : false = true;
    expect(ariaNotDeclared && widgetsDeclared && dateRangeDeclared).toBe(true);
  });
});

describe('the Zod twin refuses the key by name — the spec tombstone, inherited by reference', () => {
  const legal = { type: 'dashboard' as const, widgets: [] };

  it('a legal dashboard parses green — the control for the refusal below', () => {
    expect(DashboardComponentZodSchema.safeParse(legal).success).toBe(true);
  });

  it('an arbitrary unknown key does not refuse — the red below is the tombstone, not strictness', () => {
    // BaseSchema is not `.strict()`: an undeclared key rides through (or is
    // stripped) but never refuses. So a red `aria` can only come from the
    // DECLARED tombstone flowing in from the spec — the thing being pinned.
    const r = DashboardComponentZodSchema.safeParse({ ...legal, objectui5830NotAKey: 'x' });
    expect(r.success).toBe(true);
  });

  it('`aria` is refused at its own path, with the removal message', () => {
    const r = DashboardComponentZodSchema.safeParse({ ...legal, aria: { ariaLabel: 'Ops' } });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path.join('.') === 'aria');
    expect(issue, 'no issue at path `aria`').toBeTruthy();
    expect(issue!.message).toMatch(/removed/);
  });
});
