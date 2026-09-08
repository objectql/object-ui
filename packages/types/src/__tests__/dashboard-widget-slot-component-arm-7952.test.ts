/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7952 — `DashboardComponentSchema.widgets` carries the component-node
 * arm on the TypeScript face, matching the Zod twin's two-arm slot.
 *
 * ## The gap this closes
 *
 * `zod/complex.zod.ts` has routed a `metric-card` node placed directly in the
 * widget slot to passthrough `BaseSchema` since the 2026-08-14 ruling
 * (objectstack#8593): `widgets: z.array(z.union([DashboardWidgetSlotComponentSchema,
 * DashboardWidgetSchema]))`. The TypeScript declaration stayed one-armed,
 * `DashboardWidgetSchema[]`. Measured at `fc32921` on the six dashboard blocks
 * `plugin-dashboard/README.md` teaches, each annotated `DashboardComponentSchema`:
 * `safeParse` ACCEPT with every authored key preserved; `tsc --strict` 6 × TS2561
 * (`'value' does not exist in type 'DashboardWidgetSchema'. Did you mean to
 * write 'values'?`). No annotation existed for a document the platform accepts
 * and the maintainer ruled legal. Ruled option (a), director seat, decision
 * batch #68 (2026-09-07): the TypeScript face gains the arm; the Zod face is
 * untouched and `DashboardWidgetSchema` is NOT widened.
 *
 * ## What is pinned, and on which face
 *
 *   1. the README's `metric-card` shape annotates and compiles (type level) AND
 *      parses green with its keys kept (runtime) — the two halves of the card's
 *      measurement, now agreeing;
 *   2. the forbidden repair did not happen: `DashboardWidgetSchema` still refuses
 *      `value` — an `@ts-expect-error` that turns into TS2578 if anyone widens it;
 *   3. the arm is CLOSED on `type` and the union still discriminates: a
 *      spec-family widget with an undeclared key is refused on both faces, and a
 *      `type` in neither vocabulary is refused;
 *   4. the measured limit of a TypeScript union with a passthrough arm, recorded
 *      two-faced so it cannot be read as a hatch: a `type`-less legacy envelope
 *      with an undeclared key COMPILES (nothing to discriminate on, so the arm's
 *      index signature satisfies the excess-property check) while the Zod face
 *      refuses it by name;
 *   5. shape identity: the slot's element type IS the two-arm union, the arm's
 *      `type` IS `DashboardComponentWidgetType`, and the arm is assignable to
 *      `DashboardWidgetSchema` — which is why every `(w: DashboardWidgetSchema)`
 *      callback in `plugin-dashboard` compiled unchanged.
 *
 * Type-level lines are erased at runtime and enforced because
 * `packages/types/tsconfig.test.json` is chained from this package's
 * `type-check` script (objectui#3009). Reverse-verified at the PR: with `widgets`
 * restored to `DashboardWidgetSchema[]`, `tsc -p tsconfig.test.json` goes red on
 * the lines marked REVERSE below and nowhere else in this file.
 */

// objectui#8344: the `./zod` barrel must be the FIRST zod module this graph evaluates.
// `base.zod.ts` reads `AnyComponentSchema` as an import binding, so entering at a
// category module puts `BaseSchema` in its temporal dead zone and throws at load.
import '../zod/index.zod.js';
import { describe, it, expect } from 'vitest';
import type {
  DashboardComponentSchema,
  DashboardComponentWidgetType,
  DashboardWidgetSchema,
  DashboardWidgetSlotComponentSchema,
} from '../complex.js';
import { DASHBOARD_COMPONENT_WIDGET_TYPES } from '../complex.js';
import { DashboardComponentSchema as DashboardComponentZod } from '../zod/complex.zod.js';

type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;

/**
 * `packages/plugin-dashboard/README.md`'s "Usage" block, byte-for-byte, with the
 * annotation the card measured it under. The runtime half of the same document
 * is read off the page by `plugin-dashboard`'s
 * `readme-dashboard-examples-spec-valid.test.ts`; this copy exists because a
 * type-level pin cannot read a file.
 */
// REVERSE — TS2561 on `value` with the one-arm declaration.
const usage: DashboardComponentSchema = {
  type: 'dashboard',
  widgets: [
    {
      type: 'metric-card',
      title: 'Total Sales',
      value: '$123,456',
      trend: 'up',
      trendValue: '+12%'
    }
  ]
};

describe('the component-node arm is declared on the TypeScript face (objectui#7952)', () => {
  it('the README shape annotates, compiles, and parses green with every key kept', () => {
    const result = DashboardComponentZod.safeParse(usage);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = (result.data as { widgets: Record<string, unknown>[] }).widgets[0];
    for (const key of Object.keys(usage.widgets[0])) expect(parsed).toHaveProperty(key);
  });

  it('the slot element IS the two-arm union, in the Zod twin\'s order', () => {
    type Element = DashboardComponentSchema['widgets'][number];
    // REVERSE — `Element` collapses to `DashboardWidgetSchema` and this is `false`.
    const twoArm: Equal< Element, DashboardWidgetSlotComponentSchema | DashboardWidgetSchema > = true;
    // The arm's `type` is the closed component set, by reference — not a copy.
    const closedByReference: Equal< DashboardWidgetSlotComponentSchema['type'], DashboardComponentWidgetType > = true;
    // The arm is assignable to the widget type: consumers annotating a widget
    // callback `(w: DashboardWidgetSchema)` keep compiling on the union.
    const armAssignable: DashboardWidgetSlotComponentSchema extends DashboardWidgetSchema ? true : false = true;
    expect(twoArm && closedByReference && armAssignable).toBe(true);
    // The runtime side of "by reference": the set the arm keys on is the one
    // export, and it is the set the Zod arm reads.
    expect(DASHBOARD_COMPONENT_WIDGET_TYPES).toContain(usage.widgets[0].type);
  });
});

describe('the forbidden repair did not happen — DashboardWidgetSchema is not widened', () => {
  it('`value` is still not a widget key on the TypeScript face', () => {
    // `value` / `icon` / `trend` / `trendValue` are `MetricCard`'s registry
    // inputs. The compiler's own suggestion for this line ("Did you mean to
    // write 'values'?") is the repair both declarations forbid; if anyone
    // makes it, this directive goes unused (TS2578) and `type-check` fails.
    // @ts-expect-error — TS2561: 'value' does not exist in type 'DashboardWidgetSchema'.
    const widened: DashboardWidgetSchema = { type: 'metric-card', value: '1' };
    expect(widened.type).toBe('metric-card');
  });

  it('the arm\'s `type` is closed', () => {
    // @ts-expect-error — TS2322: a spec family is not a component type.
    const open: DashboardWidgetSlotComponentSchema = { type: 'bar' };
    expect(open.type).toBe('bar');
  });
});

describe('NOT A HATCH — what the union still refuses, on both faces', () => {
  it('a spec-family widget with an undeclared key is discriminated by `type` and refused', () => {
    const doc: DashboardComponentSchema = {
      type: 'dashboard',
      widgets: [
        // `'bar'` excludes the component arm, so the excess-property check runs
        // against `DashboardWidgetSchema` alone.
        // @ts-expect-error — TS2353: 'bogus' does not exist in type 'DashboardWidgetSchema'.
        { type: 'bar', title: 'x', bogus: 1 },
      ],
    };
    const result = DashboardComponentZod.safeParse(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    const flat = JSON.stringify(result.error.issues);
    expect(flat).toContain('unrecognized_keys');
    expect(flat).toContain('bogus');
  });

  it('a `type` in neither vocabulary is refused', () => {
    const doc: DashboardComponentSchema = {
      type: 'dashboard',
      widgets: [
        // @ts-expect-error — TS2322: not a widget family, not a component type.
        { type: 'not-a-component', value: '1' },
      ],
    };
    expect(DashboardComponentZod.safeParse(doc).success).toBe(false);
  });

  it('a component node with an undeclared key is kept whole — that is the passthrough, by ruling', () => {
    const doc: DashboardComponentSchema = {
      type: 'dashboard',
      widgets: [{ type: 'metric-card', title: 'x', someProp: 1 }],
    };
    const result = DashboardComponentZod.safeParse(doc);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { widgets: Record<string, unknown>[] }).widgets[0]).toHaveProperty('someProp', 1);
  });
});

describe('MEASURED LIMIT of a TypeScript union with a passthrough arm — recorded, not a contract', () => {
  it('a `type`-less legacy envelope with an undeclared key compiles, and the Zod face refuses it by name', () => {
    // Nothing to discriminate on (the legacy `component` envelope has no
    // `type`), so the union's excess-property check accepts any key one arm
    // could hold, and the component arm's index signature holds every key.
    // If tsc ever refuses this literal, the corner has closed: delete this
    // constant and the note on `widgets` in `complex.ts` — ⛔ do not add an
    // `@ts-expect-error` to keep the file green.
    const envelopeStray: DashboardComponentSchema = {
      type: 'dashboard',
      widgets: [{ id: 'w', component: { type: 'metric-card', value: '1' }, bogus: 1 }],
    };
    const result = DashboardComponentZod.safeParse(envelopeStray);
    expect(result.success, 'the runtime is the strict face on this corner').toBe(false);
    if (result.success) return;
    const flat = JSON.stringify(result.error.issues);
    expect(flat).toContain('unrecognized_keys');
    expect(flat).toContain('bogus');
  });

  it('the same envelope without the stray key is legal on both faces', () => {
    const envelope: DashboardComponentSchema = {
      type: 'dashboard',
      widgets: [{ id: 'w', component: { type: 'metric-card', value: '1' }, layout: { x: 0, y: 0, w: 1, h: 1 } }],
    };
    expect(DashboardComponentZod.safeParse(envelope).success).toBe(true);
  });
});
