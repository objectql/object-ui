/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Declaration pin — the flattened `GanttConfig` face, plus the query keys, that
 * `ObjectGantt` reads off the node and `ObjectGanttSchema` did not declare
 * (objectui#6051).
 *
 * ## The concealment is an INDEX SIGNATURE, not a cast
 *
 * objectui#5903's ten keys were hidden by `(schema as any).K` — a syntax a regex
 * can find. These are hidden by `BaseSchema`'s `[key: string]: any`
 * (objectui#5155's structural ceiling) reached through a parameter typed
 * `ObjectGridSchema | any`: `schema.colorField` type-checked as `any` with no cast
 * anywhere. Same outcome, no syntax to grep for.
 *
 * The consequence for anyone re-measuring this: "annotate the parameter and see
 * what errors" DOES NOT WORK here. The index signature absorbs every literal name,
 * so the annotation compiles clean while enforcing nothing — the same blind
 * instrument objectui#6373 records. The census behind this card is therefore an
 * AST enumeration of every top-level key read off the `schema` prop in
 * `packages/plugin-gantt/src/**` (non-test), stripping `as` / parenthesis /
 * non-null wrappers and following local aliases.
 *
 * ## The measurement, re-derived on the post-#5903 tree
 *
 * The card reported 24 keys. #5903 landed (PR #6053) between the filing and this
 * work, so the population was re-derived rather than inherited:
 *
 *   - 47 distinct top-level keys are read (the card's 47, reproduced);
 *   - 19 of them are declared — `ObjectGanttSchema`'s own plus `BaseSchema`'s
 *     `label`/`data`, and the ten #5903 added;
 *   - 28 are the residue. #5903 absorbed NONE of the card's 24: its ten
 *     (`skipWeekends`, `holidays`, `persistLayout`, `viewName`, `navigation`,
 *     `markers`, `criticalPath`, `showBaselines`, `readOnly`, `mobileReadOnly`)
 *     are disjoint from them.
 *
 * The residue is four LARGER than the card's list, and #5903 is why. The card
 * scored "declared by neither `ObjectGanttSchema` nor `ObjectGridSchema`" over
 * `getGanttConfig`'s flat branch only. #5903 retyped `ObjectGanttProps.schema`
 * from `ObjectGridSchema` to `ObjectGanttSchema` — correct, and it is what makes
 * these reads resolve against THIS interface — but `staticData`, `filter` and
 * `sort` were declared on `ObjectGridSchema` and are not on this one. `gantt`, the
 * block face, was outside the line range the card cited and is declared by
 * neither. All four have live read sites; all four are declared here.
 *
 * ## Every key is DERIVED, so the two faces cannot fork
 *
 * The 24 flattened members take their type from {@link GanttConfig} — the same
 * type the `gantt` block carries — rather than restating it. The invariant that
 * keeps that true as either side moves is the type-level pin at the bottom:
 * every key of `GanttConfig` is declared on the node's flat face.
 *
 * ## `gantt` is the one key whose VALUES get stricter, and it was already enforced
 *
 * The other 27 are new optional members: additive on both sides. `gantt` is a new
 * optional member too, but it carries a TYPE where the mirror previously had no
 * entry at all, so a block that used to ride through `.passthrough()` unvalidated
 * is now parsed. `GanttConfig` derives from the spec's `GanttConfigSchema`, which
 * REQUIRES `startDateField`, `endDateField` and `titleField` — so a block missing
 * one is refused where it used to pass.
 *
 * That is not a new contract. `getGanttConfig`'s block branch already fed the
 * block to `GanttConfigSchema.safeParse` and logged `[ObjectGantt] Invalid gantt
 * configuration` when it failed; the flat branch returns before reaching it.
 * Declaring `gantt` as `GanttConfig` makes the declared face equal the face the
 * renderer was already checking, rather than inventing a stricter one.
 *
 * ## What the pin has teeth against, and what it does not
 *
 * Unchanged from #5903, and worth restating because it is the half people read
 * wrongly: `BaseSchema` is `.passthrough()` on the zod side and carries
 * `[key: string]: any` on the TS side, so declaring these keys does NOT buy
 * rejection of a misspelling. What it buys is that a DECLARED key is validated
 * (`capacity: 'one'` is refused where it used to parse green), that the published
 * types now TEACH the vocabulary, and that the type-level pins below fail when a
 * declaration is removed.
 */

import { describe, it, expect } from 'vitest';
import { ObjectGanttSchema } from '../zod/objectql.zod.js';
import type { GanttConfig, ObjectGanttSchema as ObjectGanttSchemaTS } from '../objectql.js';

const MINIMAL = {
  type: 'object-gantt',
  objectName: 'task',
  startDateField: 'start',
  endDateField: 'end',
} as const;

/**
 * The 28 keys this card declared, each with a value its declared type refuses.
 *
 * 24 flattened `GanttConfig` members, the `gantt` block, and the three query keys
 * (`staticData` / `filter` / `sort`).
 */
const DECLARED: ReadonlyArray<readonly [string, unknown]> = [
  // — the flattened GanttConfig face —
  ['colorField', 5],
  ['borderColorField', 5],
  ['dependenciesField', 5],
  ['parentField', 5],
  ['typeField', 5],
  ['lockField', 5],
  ['objectField', 5],
  ['summaryExtent', 'parent'],
  ['defaultCollapsedDepth', '2'],
  ['tooltipFields', 'name'],
  ['baselineStartField', 5],
  ['baselineEndField', 5],
  ['groupByField', 5],
  ['resourceView', 'yes'],
  ['assigneeField', 5],
  ['effortField', 5],
  ['capacity', 'one'],
  ['quickFilters', [{ label: 'Owner' }]],
  ['autoZoomToFilter', 'yes'],
  ['timeSegments', { bands: [{ label: 'Day' }] }],
  ['interactions', 'none'],
  ['exportFileName', 5],
  ['timeZone', 5],
  ['dependencyTypes', 'yes'],
  // — the block face —
  ['gantt', 'flat'],
  // — the query keys the fetch path reads —
  ['staticData', { id: 1 }],
  ['filter', 'name = 1'],
  ['sort', 5],
];

/** One well-typed value per declared key — the counter-probe for the block above. */
const GOOD = {
  colorField: 'status',
  borderColorField: 'alert',
  dependenciesField: 'predecessors',
  parentField: 'parent',
  typeField: 'kind',
  lockField: 'locked',
  objectField: 'object_name',
  summaryExtent: 'self' as const,
  defaultCollapsedDepth: 2,
  tooltipFields: ['owner', { field: 'stage', label: 'Stage' }],
  baselineStartField: 'plan_start',
  baselineEndField: 'plan_end',
  groupByField: 'owner',
  resourceView: true,
  assigneeField: 'owner',
  effortField: 'effort',
  capacity: 2,
  quickFilters: [{ field: 'owner', label: 'Owner' }],
  autoZoomToFilter: false,
  timeSegments: {
    dayStart: '08:00',
    bands: [{ key: 'day', label: 'Day shift', start: '08:00', end: '20:00' }],
    showMidnight: true,
  },
  interactions: { move: true, resize: false, progress: true, link: false },
  exportFileName: 'Shift Plan',
  timeZone: 'Asia/Shanghai',
  dependencyTypes: false,
  gantt: {
    // `startDateField` / `endDateField` / `titleField` are REQUIRED by the spec's
    // `GanttConfigSchema`, so they are required inside this block — and they were
    // already enforced at runtime: `getGanttConfig`'s block branch feeds the block
    // to `GanttConfigSchema.safeParse` and warns when it fails. Declaring `gantt`
    // as `GanttConfig` makes the declared face equal that already-enforced face.
    startDateField: 'start',
    endDateField: 'end',
    titleField: 'name',
    lockField: 'locked',
    timeSegments: { bands: [{ label: 'Day shift', start: '08:00', end: '20:00' }] },
  },
  staticData: [{ id: 1, name: 'Task' }],
  filter: [['name', '=', 'Task']],
  sort: 'name desc',
};

describe('ObjectGanttSchema — the flattened gantt config is declared (objectui#6051)', () => {
  it('the mirror declares every one of the 28', () => {
    const shape = Object.keys(ObjectGanttSchema.shape);
    for (const [key] of DECLARED) expect(shape, `mirror is missing ${key}`).toContain(key);
  });

  it('the census is the measured 28, not a shorter list that drifted', () => {
    // Non-vacuity for the loops below: they iterate DECLARED, so a truncated
    // DECLARED would pass everything while checking less. The number is the
    // measured residue stated in this file's header.
    expect(DECLARED).toHaveLength(28);
    expect(new Set(DECLARED.map(([k]) => k)).size).toBe(28);
    expect(Object.keys(GOOD).sort()).toEqual(DECLARED.map(([k]) => k).sort());
  });

  it('declares them all OPTIONAL — none of the 28 may become required', () => {
    // Requiredness is the half the zod-mirror-parity ratchet compares against
    // `../objectql.ts`, where all 28 are `?:`. A mirror that required one would
    // reject every gantt already published.
    const result = ObjectGanttSchema.safeParse(MINIMAL);
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('materialises NO defaults — an omitted key stays absent after parse', () => {
    // `autoZoomToFilter` and `dependencyTypes` default ON *in the renderer*, which
    // reads `!== false`. A `.default(true)` here would arrive downstream as an
    // explicit author choice; the two spellings are not interchangeable.
    const result = ObjectGanttSchema.safeParse(MINIMAL);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const [key] of DECLARED) expect(key in result.data, `${key} must stay absent`).toBe(false);
  });

  it('refuses a wrong-typed value on each declared key', () => {
    for (const [key, bad] of DECLARED) {
      const result = ObjectGanttSchema.safeParse({ ...MINIMAL, [key]: bad });
      expect(result.success, `${key} accepted ${JSON.stringify(bad)}`).toBe(false);
      if (result.success) continue;
      const issue = result.error.issues.find((i) => i.path[0] === key);
      expect(issue, `${key} failed, but not on the ${key} path`).toBeTruthy();
    }
  });

  it('accepts a well-typed value on every declared key', () => {
    // Counter-probe for the assertion above: it must be the VALUE being refused,
    // not the key. A pin that only ever sees red proves nothing.
    const result = ObjectGanttSchema.safeParse({ ...MINIMAL, ...GOOD });
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('the block face accepts the same vocabulary as the flat face', () => {
    // Both are built from one field map in the mirror. Feed the whole flat payload
    // to `gantt` and it must parse — the property this card exists to make true.
    const flatOnly = { ...GOOD } as Record<string, unknown>;
    delete flatOnly.gantt;
    delete flatOnly.staticData;
    delete flatOnly.filter;
    delete flatOnly.sort;
    // Plus the three the spec requires of a `GanttConfig` (see `GOOD.gantt`).
    const block = { ...flatOnly, startDateField: 'start', endDateField: 'end', titleField: 'name' };
    const result = ObjectGanttSchema.safeParse({ ...MINIMAL, gantt: block });
    expect(result.success ? null : result.error.issues).toBe(null);
  });

  it('does NOT reject an undeclared key — objectui#5155 ceiling, measured not assumed', () => {
    // Declaring the 28 bought validation of DECLARED keys, not rejection of
    // undeclared ones: `BaseSchema` is `.passthrough()`. Anyone reading this card
    // as "misspellings now fail" is reading it wrong, and this pin says so in the
    // one place that cannot rot.
    const misspelled = ObjectGanttSchema.safeParse({ ...MINIMAL, colourField: 'status', lockFeild: 'locked' });
    expect(misspelled.success).toBe(true);
  });
});

/* ── The derived invariant: the two authoring faces are one vocabulary ─────── */

/**
 * A declaration's OWN declared members, with any index signature stripped.
 *
 * Same construction as `zod-mirror-parity.test.ts` and for the same measured
 * reason: `keyof ObjectGanttSchema` resolves to bare `string`, because
 * `BaseSchema`'s `[key: string]: any` absorbs every literal name. A homomorphic
 * mapped type maps declared members and index signatures separately, so remapping
 * the index-signature keys to `never` leaves the literal members.
 */
type WithoutIndexSignature<D> = {
  [K in keyof D as string extends K ? never : number extends K ? never : K]: D[K];
};
type DeclaredKeys<D> = Extract<keyof WithoutIndexSignature<D>, string>;

/**
 * Keys of the BLOCK face that the FLAT face does not declare. `never` is the contract.
 *
 * `DeclaredKeys` is applied to BOTH sides, and that is load-bearing rather than
 * symmetry for its own sake: the spec's `GanttConfigSchema` is `$loose`, so
 * `GanttConfig` carries `[x: string]: unknown` of its own and bare
 * `keyof GanttConfig` resolves to `string` — measured, when this pin was first
 * written that way, and it made the `Exclude` unconditionally `string`. Two index
 * signatures, two chances for the same vacuity; the non-vacuity test below pins
 * both.
 */
type FlatFaceGaps = Exclude<DeclaredKeys<GanttConfig>, DeclaredKeys<ObjectGanttSchemaTS>>;

describe('ObjectGanttSchema (TS) — the flat face declares the whole block vocabulary', () => {
  it('every GanttConfig key is declared at the top level too', () => {
    // Derived, with no key list to maintain: add a member to `GanttConfig` (or to
    // the spec's `GanttConfigSchema`, which it derives from) without declaring the
    // flattened spelling and this line stops compiling, NAMING the missing key.
    const noGaps: FlatFaceGaps extends never ? true : FlatFaceGaps = true;
    expect(noGaps).toBe(true);
  });

  it('the invariant above is not vacuous', () => {
    // Two ways `FlatFaceGaps` could be `never` while proving nothing.
    //
    // 1. `DeclaredKeys<ObjectGanttSchemaTS>` degenerating to `string` — the exact
    //    index-signature trap this card is about — would `Exclude` everything.
    const notWidened: string extends DeclaredKeys<ObjectGanttSchemaTS> ? never : true = true;
    // 2. the SAME degeneration on the other side would make the `Exclude` source
    //    `string`, which is what happened before `DeclaredKeys` was applied here.
    const blockNotWidened: string extends DeclaredKeys<GanttConfig> ? never : true = true;
    // 3. `DeclaredKeys<GanttConfig>` resolving to `never` would leave nothing to
    //    exclude, and both the spec's members and objectui's must be in it.
    const blockHasSpecKeys: 'colorField' extends DeclaredKeys<GanttConfig> ? true : never = true;
    const blockHasLocalKeys: 'summaryExtent' extends DeclaredKeys<GanttConfig> ? true : never = true;
    // 4. ...and the flat face must really carry the derived members, not `any`.
    const flatHasKeys: 'summaryExtent' extends DeclaredKeys<ObjectGanttSchemaTS> ? true : never = true;
    expect([notWidened, blockNotWidened, blockHasSpecKeys, blockHasLocalKeys, flatHasKeys])
      .toEqual([true, true, true, true, true]);
  });
});

describe('ObjectGanttSchema (TS) — compile-time pin on every declared key', () => {
  it('refuses a wrong-typed value on every declared key', () => {
    // Each directive below fails the build (TS2578, "unused '@ts-expect-error'")
    // the moment its key stops being declared, because the member then resolves to
    // `any` through `BaseSchema`'s index signature and the assignment starts
    // succeeding. That failure is the signal this card exists to create, and
    // `tsconfig.test.json` compiles this file, so it is real enforcement (#3009).

    // @ts-expect-error — `colorField` is declared `string | undefined`.
    const colorField: ObjectGanttSchemaTS['colorField'] = 5;
    // @ts-expect-error — `borderColorField` is declared `string | undefined`.
    const borderColorField: ObjectGanttSchemaTS['borderColorField'] = 5;
    // @ts-expect-error — `dependenciesField` is declared `string | undefined`.
    const dependenciesField: ObjectGanttSchemaTS['dependenciesField'] = 5;
    // @ts-expect-error — `parentField` is declared `string | undefined`.
    const parentField: ObjectGanttSchemaTS['parentField'] = 5;
    // @ts-expect-error — `typeField` is declared `string | undefined`.
    const typeField: ObjectGanttSchemaTS['typeField'] = 5;
    // @ts-expect-error — `lockField` is declared `string | undefined`.
    const lockField: ObjectGanttSchemaTS['lockField'] = 5;
    // @ts-expect-error — `objectField` is declared `string | undefined`.
    const objectField: ObjectGanttSchemaTS['objectField'] = 5;
    // @ts-expect-error — `summaryExtent` is declared `'children' | 'self' | undefined`.
    const summaryExtent: ObjectGanttSchemaTS['summaryExtent'] = 'parent';
    // @ts-expect-error — `defaultCollapsedDepth` is declared `number | undefined`.
    const defaultCollapsedDepth: ObjectGanttSchemaTS['defaultCollapsedDepth'] = '2';
    // @ts-expect-error — `tooltipFields` is declared an ARRAY of field refs.
    const tooltipFields: ObjectGanttSchemaTS['tooltipFields'] = 'name';
    // @ts-expect-error — `baselineStartField` is declared `string | undefined`.
    const baselineStartField: ObjectGanttSchemaTS['baselineStartField'] = 5;
    // @ts-expect-error — `baselineEndField` is declared `string | undefined`.
    const baselineEndField: ObjectGanttSchemaTS['baselineEndField'] = 5;
    // @ts-expect-error — `groupByField` is declared `string | undefined`.
    const groupByField: ObjectGanttSchemaTS['groupByField'] = 5;
    // @ts-expect-error — `resourceView` is declared `boolean | undefined`.
    const resourceView: ObjectGanttSchemaTS['resourceView'] = 'yes';
    // @ts-expect-error — `assigneeField` is declared `string | undefined`.
    const assigneeField: ObjectGanttSchemaTS['assigneeField'] = 5;
    // @ts-expect-error — `effortField` is declared `string | undefined`.
    const effortField: ObjectGanttSchemaTS['effortField'] = 5;
    // @ts-expect-error — `capacity` is declared `number | undefined`.
    const capacity: ObjectGanttSchemaTS['capacity'] = 'one';
    // @ts-expect-error — `quickFilters[].field` is required.
    const quickFilters: ObjectGanttSchemaTS['quickFilters'] = [{ label: 'Owner' }];
    // @ts-expect-error — `autoZoomToFilter` is declared `boolean | undefined`.
    const autoZoomToFilter: ObjectGanttSchemaTS['autoZoomToFilter'] = 'yes';
    // @ts-expect-error — `timeSegments.bands[]` requires `start` and `end`.
    const timeSegments: ObjectGanttSchemaTS['timeSegments'] = { bands: [{ label: 'Day' }] };
    // @ts-expect-error — `interactions` is declared an object of switches.
    const interactions: ObjectGanttSchemaTS['interactions'] = 'none';
    // @ts-expect-error — `exportFileName` is declared `string | undefined`.
    const exportFileName: ObjectGanttSchemaTS['exportFileName'] = 5;
    // @ts-expect-error — `timeZone` is declared `string | undefined`.
    const timeZone: ObjectGanttSchemaTS['timeZone'] = 5;
    // @ts-expect-error — `dependencyTypes` is declared `boolean | undefined`.
    const dependencyTypes: ObjectGanttSchemaTS['dependencyTypes'] = 'yes';
    // @ts-expect-error — `gantt` is declared `GanttConfig | undefined`, an object.
    const gantt: ObjectGanttSchemaTS['gantt'] = 'flat';
    // @ts-expect-error — `staticData` is declared `any[] | undefined`.
    const staticData: ObjectGanttSchemaTS['staticData'] = { id: 1 };
    // @ts-expect-error — `filter` is declared `any[] | undefined`.
    const filter: ObjectGanttSchemaTS['filter'] = 'name = 1';
    // @ts-expect-error — `sort` is declared `string | SortConfig[] | undefined`.
    const sort: ObjectGanttSchemaTS['sort'] = 5;

    expect([
      colorField, borderColorField, dependenciesField, parentField, typeField,
      lockField, objectField, summaryExtent, defaultCollapsedDepth, tooltipFields,
      baselineStartField, baselineEndField, groupByField, resourceView, assigneeField,
      effortField, capacity, quickFilters, autoZoomToFilter, timeSegments,
      interactions, exportFileName, timeZone, dependencyTypes, gantt,
      staticData, filter, sort,
    ]).toHaveLength(28);
  });

  it('accepts the well-typed value on every declared key', () => {
    // Counter-probe for the directives above: without this, a declaration narrowed
    // to `never` would satisfy every one of them.
    const ok: ObjectGanttSchemaTS = { ...MINIMAL, ...GOOD };
    expect(ok.summaryExtent).toBe('self');
    expect(ok.gantt?.lockField).toBe('locked');
    expect(ok.interactions?.resize).toBe(false);
  });
});
