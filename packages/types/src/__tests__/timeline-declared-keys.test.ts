/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Declaration pin — the eight presentational keys `TimelineRenderer` reads that
 * `TimelineSchema` did not declare (objectui#6170).
 *
 * ## What was wrong
 *
 * `TimelineSchema` declared `events` (REQUIRED), `orientation` and `position`,
 * and nothing else. `TimelineRenderer`
 * (`plugin-timeline/src/renderer.tsx:250`) is annotated `schema:
 * TimelineSchema` and reads nine keys off it — `variant`, `items`,
 * `dateFormat`, `onItemClick`, `minDate`, `maxDate`, `rowLabel`, `scale`,
 * `timeScale` — and NONE of the three that were declared. So the exported type
 * matched neither what authors write, nor what the designer offers (the
 * registration's own `inputs`), nor what the renderer reads; those three agreed
 * with each other all along.
 *
 * The divergence was invisible to `tsc` because `BaseSchema` carries
 * `[key: string]: any`, so every undeclared key resolved as `any` and the
 * annotation constrained nothing. Its most visible casualty was the docs page's
 * own TypeScript example, which did not compile — `events` was required and
 * nothing on the page ever writes it. That example is pinned below.
 *
 * Eight of the nine are declared. `onItemClick` is deliberately NOT: it is a
 * runtime slot `ObjectTimeline` installs when it composes the schema it hands
 * to `TimelineRenderer`, and this package keeps callback-shaped keys off the
 * authored surface (`RuntimeOnlyDeclared` in `zod-mirror-parity.test.ts`).
 *
 * ## What the pin has teeth against, and what it does not
 *
 * Same ceiling as objectui#5903's gantt pin, and stated here rather than left
 * to be assumed. `BaseSchema` is `.passthrough()` on the zod side and carries
 * an index signature on the TS side (objectui#5155 / objectui#6269 own that
 * ceiling; this card does not touch it), so:
 *
 *   - an UNDECLARED key is still accepted by both halves. Declaring these eight
 *     did NOT buy rejection of a misspelling;
 *   - a DECLARED key IS validated. `variant: 'diagonal'` type-checked and
 *     parsed green before this card and is refused now — that is the accept-set
 *     narrowing landed here;
 *   - on the TS side a read site can never be the detector, because the index
 *     signature types `schema.variant` as `any` either way. So the compile-time
 *     pin is the `@ts-expect-error` block at the bottom: remove a declaration
 *     and its member resolves to `any`, the wrong-typed assignment starts
 *     succeeding, and the now-unused directive fails the build (TS2578) NAMING
 *     the key. `tsconfig.test.json` compiles this file, so that is real
 *     enforcement and not decoration (objectui#3009).
 *
 * ## The three keys that are still declared and still dead
 *
 * `events` / `orientation` / `position` have zero read points. Their RETIREMENT
 * is routed, not done — objectui#6170's maintainer ruling (2026-08-25) sends
 * them down the ADR-0049 enforce-or-remove route, which is a breaking removal
 * from a published type. `events` went required → OPTIONAL here, which is a
 * strict widening and the smallest change that lets the documented authoring
 * form compile. They are pinned below as STILL DECLARED so the removal, when it
 * comes, is a deliberate edit against a red test rather than a silent drift.
 */

import { describe, it, expect } from 'vitest';
import { TimelineConfigSchema } from '@objectstack/spec/ui';
import { TimelineSchema } from '../zod/data-display.zod.js';
import type { TimelineSchema as TimelineSchemaTS, TimelineScale } from '../data-display.js';

const MINIMAL = { type: 'timeline' } as const;

/** Unwrap ZodOptional/ZodDefault/description wrappers down to the inner enum schema. */
function unwrap(schema: any): any {
  let cur = schema;
  while (cur?._def?.innerType) cur = cur._def.innerType;
  return cur;
}

/**
 * The keys this card declared, each with a value its declared type refuses.
 *
 * `timeScale` was the eighth. objectui#6355 RETIRED it, so it is no longer a
 * declared key carrying a vocabulary — it is a `?: never` / `z.never()`
 * tombstone, for which "refuses a wrong-typed value" and "accepts a well-typed
 * value" are the wrong assertions in both directions: the first would pass for
 * a reason that has nothing to do with this card, and the second cannot pass at
 * all. Its retirement has its own pin, `timeline-timescale-retired.test.ts`,
 * which also
 * carries the counter-probes. Removing it here rather than editing its value in
 * place is deliberate: it is the fixture that pinned the branch that was
 * deleted.
 */
const DECLARED: ReadonlyArray<readonly [string, unknown]> = [
  ['variant', 'diagonal'],
  ['items', 'not-an-array'],
  ['dateFormat', 'medieval'],
  ['scale', 'fortnight'],
  ['rowLabel', 5],
  ['minDate', 20240101],
  ['maxDate', 20241231],
];

describe('TimelineSchema — the eight presentational keys are declared (objectui#6170)', () => {
  it('the mirror declares every one of them', () => {
    const shape = Object.keys(TimelineSchema.shape);
    for (const [key] of DECLARED) expect(shape, `mirror is missing ${key}`).toContain(key);
  });

  it('declares them all OPTIONAL — a bare `{ type: "timeline" }` still parses', () => {
    // Requiredness is the half the zod-mirror-parity ratchet compares against
    // `../data-display.ts`, where all eight are `?:`. A mirror that required one
    // would reject every timeline already published — including the three
    // fixtures in `examples/schema-catalog/src/schemas/plugin-timeline/`.
    const result = TimelineSchema.safeParse(MINIMAL);
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('materialises NO defaults — an omitted key stays absent after parse', () => {
    // `variant` and `dateFormat` default IN THE RENDERER, by destructuring
    // (`variant = 'vertical'`). A `.default()` here would arrive downstream as
    // an explicit author choice; the two spellings are not interchangeable.
    const result = TimelineSchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const [key] of DECLARED) expect(key in result.data, `${key} must stay absent`).toBe(false);
  });

  it('refuses a wrong-typed value on each declared key (declared-key validation under passthrough)', () => {
    for (const [key, bad] of DECLARED) {
      const result = TimelineSchema.safeParse({ ...MINIMAL, [key]: bad });
      expect(result.success, `${key} accepted ${JSON.stringify(bad)}`).toBe(false);
      if (result.success) continue;
      const issue = result.error.issues.find((i) => i.path[0] === key);
      expect(issue, `${key} failed, but not on the ${key} path`).toBeTruthy();
    }
  });

  it('accepts a well-typed value on each declared key', () => {
    // Counter-probe for the assertion above: it must be the VALUE being refused,
    // not the key. A pin that only ever sees red proves nothing.
    const good = {
      ...MINIMAL,
      variant: 'gantt',
      items: [{ label: 'Backend', items: [{ title: 'API', startDate: '2024-01-01', endDate: '2024-01-31' }] }],
      dateFormat: 'iso',
      scale: 'quarter',
      rowLabel: 'Projects',
      minDate: '2024-01-01',
      maxDate: '2024-12-31',
    };
    const result = TimelineSchema.safeParse(good);
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('does NOT reject an undeclared key — objectui#5155’s ceiling, measured not assumed', () => {
    // Declaring the eight bought validation of DECLARED keys, not rejection of
    // undeclared ones: `BaseSchema` is `.passthrough()`. Anyone reading this
    // card as "misspellings now fail" is reading it wrong, and this pin says so
    // in the one place that cannot rot.
    const misspelled = TimelineSchema.safeParse({ ...MINIMAL, varient: 'gantt', timescale: 'month' });
    expect(misspelled.success).toBe(true);
  });
});

describe('TimelineSchema — `scale` is canonical and shares the spec vocabulary', () => {
  // The renderer resolves `scale` and accepts six values (`resolveTimelineScale`,
  // pinned against the spec by
  // `plugin-timeline/src/__tests__/timeline-scale-spec-parity.test.ts`; the
  // `timeScale` alias it used to also read is retired, objectui#6355). This is
  // the third leg of that agreement: the exported TYPE offers the same six.
  const specScales: string[] = unwrap(TimelineConfigSchema.shape.scale).options;

  it('reads a non-empty scale enum from the spec', () => {
    expect(specScales, 'could not read TimelineConfigSchema.shape.scale options').not.toEqual([]);
  });

  it('`scale` accepts exactly the spec vocabulary — and is the only key that does', () => {
    // It used to loop over `['scale', 'timeScale']`. The alias is RETIRED
    // (objectui#6355) and now refuses every one of these values; that half is
    // pinned in `timeline-timescale-retired.test.ts`.
    for (const value of specScales) {
      const result = TimelineSchema.safeParse({ ...MINIMAL, scale: value });
      expect(result.success, `scale refused spec scale '${value}'`).toBe(true);
    }
  });

  it('the registry `inputs` three-value timeScale enum is NOT the contract', () => {
    // Before objectui#6170 the designer offered `timeScale: day | week | month`
    // and the type offered neither key. `hour` / `quarter` / `year` were
    // authorable, rendered correctly, and were undiscoverable from both
    // surfaces. That designer input is gone entirely now — objectui#6355 retired
    // the alias and dropped its control; `scale` offers all six.
    for (const value of ['hour', 'quarter', 'year']) {
      expect(TimelineSchema.safeParse({ ...MINIMAL, scale: value }).success, value).toBe(true);
    }
  });
});

describe('TimelineSchema — the three unread keys are still declared (ADR-0049 route pending)', () => {
  it('`events` / `orientation` / `position` remain in the mirror', () => {
    const shape = Object.keys(TimelineSchema.shape);
    for (const key of ['events', 'orientation', 'position']) {
      expect(shape, `${key} left the mirror — see the ADR-0049 note in data-display.ts`).toContain(key);
    }
  });

  it('`events` is OPTIONAL — this is the widening objectui#6170 landed', () => {
    // It was required. That is why the docs page's own TypeScript example did
    // not compile, and it is the single non-additive change in this card.
    expect(TimelineSchema.safeParse({ type: 'timeline', items: [] }).success).toBe(true);
  });

  it('still validates them when authored, so retirement is a visible edit', () => {
    expect(TimelineSchema.safeParse({ ...MINIMAL, orientation: 'diagonal' }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...MINIMAL, position: 'centre' }).success).toBe(false);
    expect(TimelineSchema.safeParse({ ...MINIMAL, events: 'nope' }).success).toBe(false);
  });
});

describe('TimelineSchema (TS) — compile-time pin on the same keys', () => {
  it('accepts the docs page’s own TypeScript example', () => {
    // `content/docs/plugins/plugin-timeline.mdx` — the "TypeScript Support"
    // block, verbatim. Before objectui#6170 this exact object was
    // `TS2741: Property 'events' is missing … but required in type
    // 'TimelineSchema'`. The page taught an authoring form its own published
    // type refused.
    const timelineSchema: TimelineSchemaTS = {
      type: 'timeline',
      variant: 'vertical',
      items: [
        { time: '2024-01-15', title: 'Event', description: 'Description', variant: 'success' },
      ],
    };
    expect(timelineSchema.items).toHaveLength(1);
  });

  it('refuses a wrong-typed value on every declared key', () => {
    // Each directive below fails the build (TS2578, "unused '@ts-expect-error'")
    // the moment its key stops being declared, because the member then resolves
    // to `any` through `BaseSchema`'s index signature and the assignment starts
    // succeeding. That failure is the signal this card exists to create.

    // @ts-expect-error — `variant` is declared `'vertical' | 'horizontal' | 'gantt' | undefined`.
    const variant: TimelineSchemaTS['variant'] = 'diagonal';
    // @ts-expect-error — `dateFormat` is declared `'short' | 'long' | 'iso' | undefined`.
    const dateFormat: TimelineSchemaTS['dateFormat'] = 'medieval';
    // @ts-expect-error — `scale` is declared `TimelineScale | undefined`.
    const scale: TimelineSchemaTS['scale'] = 'fortnight';
    // `timeScale` used to sit here as the deprecated alias with the same six
    // values. It is RETIRED (objectui#6355) and its directive would now hold for
    // a different reason — `never` refuses `'fortnight'` the way it refuses
    // every value — so keeping it here would read as vocabulary enforcement
    // while measuring the tombstone. The tombstone has its own pin, with its own
    // counter-probe: `timeline-timescale-retired.test.ts`.
    // @ts-expect-error — `rowLabel` is declared `string | undefined`.
    const rowLabel: TimelineSchemaTS['rowLabel'] = 5;
    // @ts-expect-error — `minDate` is declared `string | undefined` (schemas are JSON).
    const minDate: TimelineSchemaTS['minDate'] = 20240101;
    // @ts-expect-error — `maxDate` is declared `string | undefined`.
    const maxDate: TimelineSchemaTS['maxDate'] = 20241231;
    // @ts-expect-error — `orientation` is declared `'vertical' | 'horizontal' | undefined`.
    const orientation: TimelineSchemaTS['orientation'] = 'diagonal';
    // @ts-expect-error — `position` is declared `'left' | 'right' | 'alternate' | undefined`.
    const position: TimelineSchemaTS['position'] = 'centre';

    expect([
      variant, dateFormat, scale, rowLabel, minDate, maxDate, orientation, position,
    ]).toHaveLength(8);
  });

  it('accepts the well-typed value on every declared key', () => {
    // Counter-probe for the directives above: without this, a declaration
    // narrowed to `never` would satisfy all nine of them.
    const ok: TimelineSchemaTS = {
      type: 'timeline',
      variant: 'gantt',
      items: [{ label: 'Backend', items: [{ title: 'API', startDate: '2024-01-01', endDate: '2024-01-31' }] }],
      dateFormat: 'iso',
      scale: 'quarter',
      rowLabel: 'Projects',
      minDate: '2024-01-01',
      maxDate: '2024-12-31',
      orientation: 'vertical',
      position: 'left',
    };
    expect(ok.rowLabel).toBe('Projects');
  });

  it('`TimelineScale` is the one axis vocabulary, not a second spelling', () => {
    const every: TimelineScale[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];
    // @ts-expect-error — the type is closed; a seventh bucket is not authorable.
    const extra: TimelineScale = 'fortnight';
    expect([...every, extra]).toHaveLength(7);
  });
});
