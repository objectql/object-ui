/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Declaration pin — the ten gantt keys `ObjectGantt` reads that
 * `ObjectGanttSchema` did not declare (objectui#5903).
 *
 * ## What was wrong
 *
 * All ten were read as `(schema as any).K` in
 * `plugin-gantt/src/ObjectGantt.tsx`. Every one is a real, working, documented
 * feature (they are named in the package README), but nothing connected the
 * read to a declaration: not `tsc`, not the registry `inputs`, not this
 * package's zod mirror. An author following the published type could not
 * discover any of them.
 *
 * Eleven keys were reported. `label` is the eleventh and it needed no
 * declaration — `BaseSchema` already declares it — so only its cast was
 * dropped. `label` is pinned below anyway, because "already declared" is the
 * claim that would silently stop being true.
 *
 * ## What the pin has teeth against, and what it does not
 *
 * `BaseSchema` is `.passthrough()` on the zod side and carries
 * `[key: string]: any` on the TS side (objectui#5155 records that ceiling), so:
 *
 *   - an UNDECLARED key is still accepted, by both halves. Declaring these ten
 *     did NOT buy rejection of a misspelling, and the test below pins that
 *     plainly rather than leaving it to be assumed;
 *   - a DECLARED key IS validated. `readOnly: 'yes'` parsed green before this
 *     card and is refused now — that is the accept-set narrowing landed here,
 *     the same one objectui#5074 landed for `viewMode`;
 *   - on the TS side the index signature means a read site can never be the
 *     detector: `schema.readOnly` type-checks as `any` whether or not the key
 *     is declared. So the compile-time pin is the `@ts-expect-error` block at
 *     the bottom — remove a declaration and its member resolves to `any`, the
 *     wrong-typed assignment starts succeeding, and the now-unused directive
 *     fails the build (TS2578) NAMING the key. `tsconfig.test.json` compiles
 *     this file, so that is real enforcement and not decoration (#3009).
 */

import { describe, it, expect } from 'vitest';
import { ObjectGanttSchema } from '../zod/objectql.zod.js';
import type { ObjectGanttSchema as ObjectGanttSchemaTS } from '../objectql.js';

const MINIMAL = {
  type: 'object-gantt',
  objectName: 'task',
  startDateField: 'start',
  endDateField: 'end',
} as const;

/** The ten keys this card declared, each with a value its declared type refuses. */
const DECLARED: ReadonlyArray<readonly [string, unknown]> = [
  ['skipWeekends', 'yes'],
  ['holidays', [1]],
  ['persistLayout', 'no'],
  ['viewName', 1],
  ['navigation', 'drawer'],
  ['markers', [{ date: 5 }]],
  ['criticalPath', 'on'],
  ['showBaselines', 'off'],
  ['readOnly', 'yes'],
  ['mobileReadOnly', 'yes'],
];

describe('ObjectGanttSchema — the ten cast-read keys are declared (objectui#5903)', () => {
  it('the mirror declares every one of them', () => {
    const shape = Object.keys(ObjectGanttSchema.shape);
    for (const [key] of DECLARED) expect(shape, `mirror is missing ${key}`).toContain(key);
  });

  it('declares them all OPTIONAL — none of the ten may become required', () => {
    // Requiredness is the half the zod-mirror-parity ratchet compares against
    // `../objectql.ts`, where all ten are `?:`. A mirror that required one would
    // reject every gantt already published.
    for (const [key] of DECLARED) {
      const result = ObjectGanttSchema.safeParse(MINIMAL);
      expect(result.success, `omitting ${key} must stay legal`).toBe(true);
    }
  });

  it('materialises NO defaults — an omitted key stays absent after parse', () => {
    // `showBaselines` and `mobileReadOnly` default ON *in the renderer*, which
    // reads `!== false`. A `.default(true)` here would arrive downstream as an
    // explicit author choice; the two spellings are not interchangeable.
    const result = ObjectGanttSchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const [key] of DECLARED) expect(key in result.data, `${key} must stay absent`).toBe(false);
  });

  it('refuses a wrong-typed value on each declared key (declared-key validation under passthrough)', () => {
    for (const [key, bad] of DECLARED) {
      const result = ObjectGanttSchema.safeParse({ ...MINIMAL, [key]: bad });
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
      skipWeekends: true,
      holidays: ['2024-06-05'],
      persistLayout: false,
      viewName: 'shift-plan',
      navigation: { mode: 'page' as const, view: 'task_detail', openNewTab: false },
      markers: [{ date: '2024-06-05', label: 'Release', color: '#ef4444' }],
      criticalPath: true,
      showBaselines: false,
      readOnly: true,
      mobileReadOnly: false,
    };
    const result = ObjectGanttSchema.safeParse(good);
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('`label` needs no declaration here — BaseSchema already carries it', () => {
    // The eleventh reported key. It was cast-read too, but the cast was the only
    // defect: dropping it is the whole fix. Pinned so that "already declared"
    // cannot quietly stop being true.
    const inherited = ObjectGanttSchema.safeParse({ ...MINIMAL, label: 'Shift Plan' });
    expect(inherited.success).toBe(true);
    expect(ObjectGanttSchema.safeParse({ ...MINIMAL, label: 5 }).success).toBe(false);
  });

  it('does NOT reject an undeclared key — objectui#5155’s ceiling, measured not assumed', () => {
    // Declaring the ten bought validation of DECLARED keys, not rejection of
    // undeclared ones: `BaseSchema` is `.passthrough()`. Anyone reading this
    // card as "misspellings now fail" is reading it wrong, and this pin says so
    // in the one place that cannot rot.
    const misspelled = ObjectGanttSchema.safeParse({ ...MINIMAL, readonly: true, skipWeekend: true });
    expect(misspelled.success).toBe(true);
  });
});

describe('ObjectGanttSchema (TS) — compile-time pin on the same ten keys', () => {
  it('refuses a wrong-typed value on every declared key', () => {
    // Each directive below fails the build (TS2578, "unused '@ts-expect-error'")
    // the moment its key stops being declared, because the member then resolves
    // to `any` through `BaseSchema`'s index signature and the assignment starts
    // succeeding. That failure is the signal this card exists to create.

    // @ts-expect-error — declared `boolean | undefined`.
    const skipWeekends: ObjectGanttSchemaTS['skipWeekends'] = 'yes';
    // @ts-expect-error — declared `string[] | undefined`.
    const holidays: ObjectGanttSchemaTS['holidays'] = [1];
    // @ts-expect-error — declared `boolean | undefined`.
    const persistLayout: ObjectGanttSchemaTS['persistLayout'] = 'no';
    // @ts-expect-error — declared `string | undefined`.
    const viewName: ObjectGanttSchemaTS['viewName'] = 1;
    // @ts-expect-error — declared `ViewNavigationConfig | undefined`, an object.
    const navigation: ObjectGanttSchemaTS['navigation'] = 'drawer';
    // @ts-expect-error — `date` is declared `string` (schemas are JSON).
    const markers: ObjectGanttSchemaTS['markers'] = [{ date: 5 }];
    // @ts-expect-error — declared `boolean | undefined`.
    const criticalPath: ObjectGanttSchemaTS['criticalPath'] = 'on';
    // @ts-expect-error — declared `boolean | undefined`.
    const showBaselines: ObjectGanttSchemaTS['showBaselines'] = 'off';
    // @ts-expect-error — declared `boolean | undefined`.
    const readOnly: ObjectGanttSchemaTS['readOnly'] = 'yes';
    // @ts-expect-error — declared `boolean | undefined`.
    const mobileReadOnly: ObjectGanttSchemaTS['mobileReadOnly'] = 'yes';

    expect([
      skipWeekends, holidays, persistLayout, viewName, navigation,
      markers, criticalPath, showBaselines, readOnly, mobileReadOnly,
    ]).toHaveLength(10);
  });

  it('accepts the well-typed value on every declared key', () => {
    // Counter-probe for the directives above: without this, a declaration
    // narrowed to `never` would satisfy all ten of them.
    const ok: ObjectGanttSchemaTS = {
      type: 'object-gantt',
      objectName: 'task',
      skipWeekends: true,
      holidays: ['2024-06-05'],
      persistLayout: false,
      viewName: 'shift-plan',
      navigation: { mode: 'page', view: 'task_detail', openNewTab: false },
      markers: [{ date: '2024-06-05', label: 'Release', color: '#ef4444' }],
      criticalPath: true,
      showBaselines: false,
      readOnly: true,
      mobileReadOnly: false,
    };
    expect(ok.markers?.[0].date).toBe('2024-06-05');
  });
});
