/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Base Schema Zod Validators
 * 
 * Zod validation schemas for base component types.
 * These schemas follow the @objectstack/spec UI specification format.
 * 
 * @module zod/base
 * @packageDocumentation
 */

import { z } from 'zod';
import { I18nLabelSchema } from '@objectstack/spec/ui';
import { retirementTombstone } from './tombstone.zod.js';
import { ExpressionWireSchema } from './expression.zod.js';

/**
 * A KEYED i18n label — the runtime mirror of `KeyedI18nLabel` in `../base.ts`.
 *
 * ⚠️ This is objectui's OWN label vocabulary, and it is NOT the spec's
 * `I18nLabelSchema` that `label` / `description` below declare. The two are
 * structurally confusable and answer wrongly for each other's input — the
 * objectui#4167 hazard, which #4580's Q2-B ruling turned on:
 *
 *  - KEYED (this schema): `{ key, defaultValue?, params? }`, a reference INTO a
 *    translation bundle, resolved by `resolveKeyedI18nLabel`
 *    (`packages/react/src/utils/i18n.ts`). `ariaLabel` declares this one.
 *  - INLINE (`I18nLabelSchema`): a locale MAP like `{ en: 'Owner' }`, resolved
 *    against a BCP-47 locale by the spec's own `resolveI18nLabel(label,
 *    locale)`. `label` and `description` declare that one.
 *
 * Hand-written rather than taken from the spec because the spec has no keyed
 * form: `I18nLabelSchema` REJECTS `{ key, defaultValue }` at parse time, and
 * objectstack#9925 made both limbs `never` on its type axis for the same
 * reason. The shape here mirrors `KeyedI18nLabel` limb-for-limb.
 */
export const KeyedI18nLabelSchema = z.object({
  key: z.string().describe('Translation-bundle key, e.g. `dialog.close`'),
  defaultValue: z.string().optional().describe('Rendered when the key is missing from the bundle'),
  params: z.record(z.string(), z.any()).optional().describe("Interpolation values for the key's placeholders"),
});

/**
 * Schema Node - Can be a schema object or primitive value
 */
export const SchemaNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    BaseSchemaCore,
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
  ])
);

/**
 * Base Schema - Core validation schema that all components extend
 * 
 * This is the foundation for all UI component schemas in ObjectUI.
 * Following @objectstack/spec UI specification format.
 */
const BaseSchemaCore = z.object({
  /**
   * Component type identifier
   */
  type: z.string().describe('Component type identifier'),

  /**
   * Unique identifier for the component
   */
  id: z.string().optional().describe('Unique component identifier'),

  /**
   * Human-readable name
   */
  name: z.string().optional().describe('Component name'),

  /**
   * Display label.
   *
   * The spec's INLINE locale map (`string | Record<string, string>`), embedded
   * BY REFERENCE so a change to the spec's own label contract is picked up
   * here rather than re-typed — the same property `specFieldsExcept` below
   * relies on. Mirrors `BaseSchema.label: string | I18nLabel` (`../base.ts`),
   * widened by #4580's revised Q1-A ruling.
   */
  label: I18nLabelSchema.optional().describe('Display label (plain string or inline locale map)'),

  /**
   * Description text.
   *
   * Same vocabulary and same resolver as `label` above — see `BaseSchema.description`.
   */
  description: I18nLabelSchema.optional().describe('Description text (plain string or inline locale map)'),

  /**
   * Placeholder text
   */
  placeholder: z.string().optional().describe('Placeholder text'),

  /**
   * Tailwind CSS classes
   */
  className: z.string().optional().describe('Tailwind CSS classes'),

  /**
   * Inline styles
   */
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe('Inline CSS styles'),

  /**
   * Arbitrary data
   */
  data: z.any().optional().describe('Custom data payload'),

  /**
   * Data-scope path, resolved by `useDataScope()`.
   *
   * Mirrors `BaseSchema.bind: string` (`../base.ts`, objectui#6357). The pair
   * `base.zod.ts#BaseSchema` carries no `KnownDrift` / `UnmirroredDeclared`
   * entry, so this member is not optional housekeeping: a key declared on the
   * TS side and missing here reddens `zod-mirror-parity.test.ts` by name.
   *
   * `z.string()` and not `z.any()` because that is what the resolver accepts —
   * `useDataScope` is `(path?: string)` and resolves via `path.split('.')`, so
   * a non-string value threw at render time and this rejects it at parse time.
   */
  bind: z.string().optional().describe('Data-scope binding path (resolved by useDataScope)'),

  /**
   * Child components or content
   */
  body: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components'),

  /**
   * Alternative children property
   */
  children: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Child components (React-style)'),

  /**
   * Visibility control — a boolean, or the predicate STRING the renderer
   * evaluates.
   *
   * Mirrors `BaseSchema.visible: boolean | string` (`../base.ts`), widened by
   * #4581. `SchemaRenderer.tsx` passes this key to
   * `evaluator.evaluateCondition`, which is declared
   * `(condition: string | boolean | undefined, …) => boolean` — so the string
   * form is an implemented, evaluated capability, and this validator was the
   * one surface still refusing it.
   *
   * Widened again by objectui#7530 (ruled 2026-09-04, option A, all three
   * predicate keys at once) to the CEL envelope object: the expression half is
   * now `ExpressionWireSchema` (`./expression.zod.ts`), the one string-or-
   * envelope union `visibleWhen` on form fields already used, imported rather
   * than spelled a second time. Measured before: the envelope this validator
   * refused at path `visible` (`invalid_union`) parsed on `FormField.visibleWhen`
   * one file over, while the renderer evaluated it on both.
   */
  visible: z.union([z.boolean(), ExpressionWireSchema]).optional().describe('Visibility control (boolean, predicate expression string, or CEL envelope object)'),

  /**
   * Canonical conditional-visibility predicate (ADR-0089) — shown when truthy.
   * The spec folds the deprecated `visibleOn` / `visibility` aliases into this.
   */
  visibleWhen: z.string().optional().describe('Canonical conditional-visibility predicate (ADR-0089)'),

  /**
   * Conditional visibility expression
   * @deprecated ADR-0089 — use `visibleWhen`.
   */
  visibleOn: z.string().optional().describe('[DEPRECATED → visibleWhen] Expression for conditional visibility'),

  /**
   * Hidden control -- a boolean, or the predicate STRING the renderer evaluates.
   *
   * Mirrors `BaseSchema.hidden: boolean | string` (`../base.ts`), widened by
   * objectui#7455 (ruled 2026-09-03) on the same evidence that widened
   * `visible` (#4581) and `disabled` (#4580 Q3-A): `SchemaRenderer`'s
   * `shouldHide` chain asks `hasDeclaredPredicate` and then evaluates the
   * value, never reading this key as a boolean. Measured before the widening:
   * `BaseSchema.safeParse({ type, hidden: '${data.status === "draft"}' })`
   * returned `success: false` with `invalid_type` (expected boolean, received
   * string) while the identical string on `visible` parsed -- this validator
   * was the one surface still refusing a shipped, pinned capability.
   *
   * The CEL envelope object form is declared too, since objectui#7530 (ruled
   * 2026-09-04, option A, all three keys at once): the expression half is
   * `ExpressionWireSchema` (`./expression.zod.ts`), shared with `visible`,
   * `disabled` and the form predicate keys. `hasDeclaredPredicate` had accepted
   * `{ dialect: 'cel', source }` on this key all along.
   */
  hidden: z.union([z.boolean(), ExpressionWireSchema]).optional().describe('Hidden control (boolean, predicate expression string, or CEL envelope object)'),

  /**
   * Conditional hidden expression
   */
  hiddenOn: z.string().optional().describe('Expression for conditional hiding'),

  /**
   * Disabled state — a boolean, or the predicate STRING the renderer evaluates.
   *
   * Mirrors `BaseSchema.disabled: boolean | string` (`../base.ts`), widened by
   * #4581 under #4580's Q3-A ruling: the renderer reads this key through the
   * same `evaluateCondition` as `visible`, and the asymmetry between the two
   * was accidental rather than deliberate.
   *
   * Widened again by objectui#7530 (ruled 2026-09-04, option A, all three
   * predicate keys at once) to the CEL envelope object, through the shared
   * `ExpressionWireSchema` (`./expression.zod.ts`).
   */
  disabled: z.union([z.boolean(), ExpressionWireSchema]).optional().describe('Disabled state (boolean, predicate expression string, or CEL envelope object)'),

  /**
   * Conditional disabled expression
   */
  disabledOn: z.string().optional().describe('Expression for conditional disabling'),

  /**
   * Test ID for automated testing
   */
  testId: z.string().optional().describe('Test identifier'),

  /**
   * Accessibility label — a plain string, or the KEYED i18n reference.
   *
   * Mirrors `BaseSchema.ariaLabel: string | KeyedI18nLabel` (`../base.ts`).
   * ⚠️ KEYED, NOT the spec's inline locale map two properties up: the renderer
   * reads this slot with `resolveKeyedI18nLabel`, which returns `undefined`
   * for a locale map and would render an EMPTY aria-label. #4580's Q2-B ruling
   * withdrew the `I18nLabel` spelling as measured-wrong for exactly that.
   */
  ariaLabel: z.union([z.string(), KeyedI18nLabelSchema]).optional().describe('Accessibility label (plain string or keyed i18n reference)'),
}).passthrough(); // Allow additional properties for type-specific extensions

/**
 * Base Schema - Export for use in other schemas
 */
export const BaseSchema = BaseSchemaCore;

/**
 * A spec schema's fields, minus the keys objectui declares locally, as an
 * all-optional shape ready for `BaseSchema.extend(…)` (objectstack#4115).
 *
 * `BaseSchema` is `.passthrough()` while the spec's document schemas are
 * strict, so a renderer node that does not declare the spec's fields lets
 * every one of them ride through *unvalidated*. Spreading this result back in
 * makes them validated again without closing the node to renderer props.
 *
 * Two deliberate properties:
 *  - **by reference** — a field the spec adds is picked up automatically
 *    rather than re-typed (and the per-node drift guard fails if it was never
 *    triaged);
 *  - **`.partial()`** — no future spec field can become required and silently
 *    invalidate payloads objectui has already stored.
 *
 * Reads `.shape` rather than calling `SpecSchema.omit({…}).partial()` because
 * zod 4 refuses `.omit()` on an object carrying refinements — spec's
 * `PageSchema` has one, so the idiomatic form throws at import time.
 */
export function specFieldsExcept<T extends z.ZodRawShape, K extends keyof T & string>(
  shape: T,
  omit: readonly K[],
) {
  const kept = Object.fromEntries(
    Object.entries(shape).filter(([key]) => !omit.includes(key as K)),
  ) as Omit<T, K>;
  return z.object(kept).partial();
}

/**
 * One coarse control kind an input may declare — the enforced half of
 * `ComponentInputControlType` in `../base.ts`. Exported so a consumer that
 * needs the arm vocabulary at runtime reads it from here instead of writing a
 * twelfth copy of the list.
 */
export const ComponentInputControlTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'enum',
  'array',
  'object',
  'color',
  'date',
  'code',
  'file',
  'slot',
]);

/**
 * Component Input Configuration
 */
export const ComponentInputSchema = z.object({
  name: z.string().describe('Property name'),
  /**
   * One coarse kind, or a NON-EMPTY array of distinct kinds for a key whose
   * contract is a union (objectui#3832). Both bounds are enforced rather than
   * tolerated, because this is where an authoring slip is cheapest to catch:
   * an empty array declares an input nothing can satisfy (and the serializer
   * would have to invent an arm for it), and a repeated arm means the author
   * believes they said something they did not. The single-kind form stays
   * valid — it is the canonical spelling for a one-arm key.
   */
  type: z.union([
    ComponentInputControlTypeSchema,
    z.array(ComponentInputControlTypeSchema)
      .min(1)
      .refine((arms) => new Set(arms).size === arms.length, {
        message: 'Input control type arms must be distinct',
      }),
  ]).describe('Input control type, or the arms of a union type'),
  label: z.string().optional().describe('Display label'),
  defaultValue: z.any().optional().describe('Default value'),
  required: z.boolean().optional().describe('Required flag'),
  enum: z.union([
    z.array(z.string()),
    z.array(z.object({
      label: z.string(),
      value: z.any(),
    })),
  ]).optional().describe('Enum options'),
  description: z.string().optional().describe('Help text'),
  advanced: z.boolean().optional().describe('Advanced option flag'),
  /**
   * ADR-0049 RETIREMENT TOMBSTONE (objectui#5905) — the FIFTH key, retired
   * later than the four below and by its own ruling (maintainer, 2026-08-31).
   * It was declared-and-DROPPED rather than declared-and-unread:
   * `plugin-markdown`'s registration really did author it while the serializer
   * dropped it, so retiring it meant ruling on that registration first. The
   * ruling deleted the write as a measured no-op and REFUSED teaching
   * `sdui-parser` to forward the key. See `ComponentInput.inputType` in
   * `../base.ts` for the full record.
   */
  inputType: retirementTombstone(
    'RETIRED (objectui#5905) — `ComponentInput.inputType` was never read, and never published: the manifest '
    + 'serializer forwards `name`/`type`/`required`/`enum`/`binding`/`description` and this is not one of them, '
    + 'so an authored value was silently dropped. Delete the key; put the control hint in `description`, '
    + 'which IS published.',
  ),
  /**
   * ADR-0049 RETIREMENT TOMBSTONES (objectui#5905) — `min` / `max` / `step` /
   * `placeholder`, the four `ComponentInput` keys measured with no reader on
   * either the consumption or the publication path. `inputType` directly above
   * is a fifth tombstone of the same shape, added by a later ruling; everything
   * this block says about the mechanism applies to it too.
   *
   * `retirementTombstone()` (`./tombstone.zod.ts`) writes each guidance string
   * ONCE into both author-facing channels — the parse-time issue message and
   * `.describe()`, which feeds generated JSON-Schema and docs — so the two
   * cannot drift. Without a tombstone the non-strict mirror would SILENTLY
   * STRIP an authored value, trading one silent no-op for another; with it, a
   * write from outside this repository (the half objectui#5905 could not
   * measure) arrives as a NAMED REFUSAL carrying its own remedy.
   *
   * The accept set is the point, not a side effect: issue `code` stays
   * `invalid_type` and the issue `path` names the key. A `refine`-based
   * spelling would report `custom` and was rejected for exactly that reason
   * (objectui#6105).
   */
  min: retirementTombstone(
    'RETIRED (objectui#5905) — `ComponentInput.min` was never read, and never published: the manifest '
    + 'serializer forwards `name`/`type`/`required`/`enum`/`binding`/`description` and this is not one of them, '
    + 'so an authored value was silently dropped. Delete the key; spell the numeric domain out in `description`, '
    + 'which IS published.',
  ),
  max: retirementTombstone(
    'RETIRED (objectui#5905) — `ComponentInput.max` was never read, and never published: the manifest '
    + 'serializer forwards `name`/`type`/`required`/`enum`/`binding`/`description` and this is not one of them, '
    + 'so an authored value was silently dropped. Delete the key; spell the numeric domain out in `description`, '
    + 'which IS published.',
  ),
  step: retirementTombstone(
    'RETIRED (objectui#5905) — `ComponentInput.step` was never read, and never published: the manifest '
    + 'serializer forwards `name`/`type`/`required`/`enum`/`binding`/`description` and this is not one of them, '
    + 'so an authored value was silently dropped. Delete the key; spell the numeric domain out in `description`, '
    + 'which IS published.',
  ),
  placeholder: retirementTombstone(
    'RETIRED (objectui#5905) — `ComponentInput.placeholder` was never read, and never published: the manifest '
    + 'serializer forwards `name`/`type`/`required`/`enum`/`binding`/`description` and this is not one of them, '
    + 'so an authored value was silently dropped. Delete the key; put the hint in `description`, which IS '
    + 'published. `BaseSchema.placeholder`, the node-level prop, is a DIFFERENT key and is unaffected.',
  ),
});

/**
 * Component Metadata
 */
export const ComponentMetaSchema = z.object({
  label: z.string().optional().describe('Display name'),
  icon: z.string().optional().describe('Icon name or SVG'),
  category: z.string().optional().describe('Component category'),
  inputs: z.array(ComponentInputSchema).optional().describe('Configurable properties'),
  defaultProps: z.record(z.string(), z.any()).optional().describe('Default property values'),
  examples: z.record(z.string(), z.any()).optional().describe('Example configurations'),
  isContainer: z.boolean().optional().describe('Can have children'),
  resizable: z.boolean().optional().describe('Can be resized'),
  resizeConstraints: z.object({
    width: z.boolean().optional(),
    height: z.boolean().optional(),
    minWidth: z.number().optional(),
    maxWidth: z.number().optional(),
    minHeight: z.number().optional(),
    maxHeight: z.number().optional(),
  }).optional().describe('Resize constraints'),
  tags: z.array(z.string()).optional().describe('Search tags'),
  description: z.string().optional().describe('Component description'),
});

/**
 * Component Configuration
 */
export const ComponentConfigSchema = ComponentMetaSchema.extend({
  type: z.string().describe('Component type identifier'),
  component: z.any().describe('Component renderer'),
});

/**
 * HTML Attributes (generic)
 */
export const HTMLAttributesSchema = z.record(z.string(), z.any()).describe('HTML attributes');

/**
 * Event Handlers
 */
export const EventHandlersSchema = z.record(z.string(), z.function()).describe('Event handlers');

/**
 * The two CSS passthrough attributes a node exposes: a Tailwind class string and
 * an inline style record.
 *
 * ⚠️ NOT a mirror of `StyleProps` in `../base.ts` (objectui#5928). That
 * declaration is the Tailwind-SCALE vocabulary (`padding`, `margin`, `gap`,
 * `backgroundColor`, …) and shares ZERO keys with this object — the two only ever
 * shared a name, and pairing them by that name reported drift on a mirror
 * relationship that does not exist. The old name is gone: with this const named
 * for its own keys there is no like-named declaration left to pair it with, and
 * the reason it mirrors nothing is recorded against this name in
 * `../__tests__/zod-mirror-parity.test.ts`'s `EXCLUSIONS`.
 *
 * The `.describe()` text below names those same two keys, for the half of #5928
 * the rename could not reach (objectui#7578): `.describe()` is runtime metadata
 * that feeds generated JSON-Schema and docs, where the const name is never in
 * view, so the label is the only thing telling that reader what is in here. The
 * generic wording it carried until #7578 was the one the const was renamed away
 * from, and it left a reader hunting `padding` or `gap` under this schema in
 * exactly the confusion #5928 was filed about, one layer down.
 */
export const ClassNameStylePropsSchema = z.object({
  className: z.string().optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).describe('className and inline style');
