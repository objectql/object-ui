/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - UI Action Schema
 * 
 * ObjectStack Spec v2.0.1 compliant action schema with enhanced capabilities:
 * - Location-based action placement
 * - Parameter collection
 * - Conditional visibility and enablement
 * - Rich feedback mechanisms
 * 
 * @module ui-action
 * @packageDocumentation
 */
import type { z } from 'zod';
import type {
  Action as SpecAction,
  ActionLocation,
  ActionParamSchema as SpecActionParamSchema,
  ActionType as SpecActionType,
} from '@objectstack/spec/ui';
import { FieldType as SpecFieldTypeEnum } from '@objectstack/spec/data';
import type { FieldType as SpecFieldType } from '@objectstack/spec/data';

// ============================================================================
// Spec-Canonical Action Sub-types — imported from @objectstack/spec/ui
// ============================================================================

/**
 * Action placement locations — re-exported from `@objectstack/spec/ui`.
 *
 * Single source of truth lives in `@objectstack/spec/ui` as
 * `ACTION_LOCATIONS` + `ActionLocationSchema` + `ActionLocation`. These are now
 * literally those three values rather than a restatement of them (#4074): the
 * comment claimed "re-export" while the code re-*declared* a parallel union,
 * `as const` tuple, and `z.enum`. To add a new location, edit
 * `packages/spec/src/ui/action.zod.ts` — every layer (spec, core, types,
 * Studio designer dropdowns) picks up the new value automatically.
 *
 * `ACTION_LOCATIONS` / `ActionLocationSchema` stay **value** exports: #2561
 * decision (a) drops spec/ui's `…Schema` names from this package's surface, but
 * these two are explicitly kept (asserted in `spec-ui-schema-reexports.test.ts`),
 * so they are re-exported as values — not inside an `export type` block, which
 * would erase them to `undefined` at runtime.
 */
export type { ActionLocation } from '@objectstack/spec/ui';
export { ACTION_LOCATIONS, ActionLocationSchema } from '@objectstack/spec/ui';

/**
 * THE placement rule: does `action` render at `location`?
 *
 * `locations` is an action's placement declaration, and this predicate is the
 * single owner of what it means (objectui#3142). An action renders at a
 * location only if it **declares** that location — a missing or empty
 * `locations` places the action NOWHERE, it does not place it everywhere.
 *
 * That reading is the platform's: ADR-0078 lists "an `action` with no
 * `locations`" as a verified inert shape — metadata that parses, reports
 * success and does nothing — which only holds if omitting the key means "no
 * placement". The engine (`ActionEngine.getActionsForLocation`), the record
 * header (`RecordDetailView`), related lists (`RelatedRecordActionsBridge`),
 * the environment toolbar and `DeclaredActionsBar` all already read it that
 * way. Four renderers disagreed, in three different directions — `action:bar`
 * and metadata-admin showed an undeclared action EVERYWHERE, `page:header`
 * showed it on the header, `action:group` showed it for `undefined` but hid it
 * for `[]` — so the same action appeared or vanished depending on which
 * component happened to render it. #3142 collapsed all four onto this
 * function; add a fifth caller rather than a fifth dialect.
 *
 * A locationless action is still reachable where placement comes from
 * somewhere other than `locations`: the selection bar driven by a view's
 * `bulkActions` / `bulkActionDefs` (naming it there IS the declaration), and
 * the `systemActions` chrome slot, which is placed by the host, not authored.
 *
 * `location: undefined` means the caller is not filtering by location at all
 * (e.g. an `action:bar` rendering an explicitly-supplied list) — every action
 * passes.
 */
export function actionRendersAt(
  // `locations` is deliberately `readonly string[]`, not `ActionLocation[]`:
  // several call sites hold actions straight off the wire (the metadata-admin
  // `/meta/types` feed types them as plain strings), and a narrower parameter
  // would push a cast onto every one of them — which is how a shared predicate
  // grows per-caller variants and stops being shared. An unrecognized string
  // simply matches no location.
  action: { locations?: readonly string[] } | null | undefined,
  location: ActionLocation | undefined,
): boolean {
  if (!location) return true;
  const declared = action?.locations;
  return Array.isArray(declared) && declared.includes(location);
}

// ============================================================================
// Declared action arrays — ONE rule for every surface that authors a list of
// actions by id (objectui#7182)
// ============================================================================

/**
 * Why a declared action array is refused, and where.
 *
 * `index` is the position of the FIRST element that breaks the rule — the
 * first element whose shape disagrees with element 0, or the first element
 * that is neither an action id nor an inline action object. Naming the index
 * is the point: an author who wrote `['convert', { … }]` is told which of the
 * two to change, rather than that "actions" is wrong somewhere.
 */
export interface DeclaredActionsRefusal {
  readonly kind: 'refused';
  readonly index: number;
  readonly message: string;
}

/**
 * The SHAPE of an authored action array, judged before any lookup — the
 * module-internal verdict behind {@link DeclaredActionsResolution}, which is
 * the published face (objectui#7182 contract review: one public function, one
 * public result type).
 *
 * Exactly three verdicts, closed on purpose (objectui#7182, maintainer ruling
 * 2026-09-02, option C): the array is all action IDS, all inline action
 * OBJECTS, or it is refused. A mixed `['convert', { … }]` array is the refused
 * case — it is not "an id with an object beside it" on one surface and "an
 * object with a string that renders nothing" on another. The two renderers
 * that draw these arrays (`page:header`, `record:quick_actions`) used to
 * answer that question each in its own way; this is the one answer.
 *
 * An empty array has nothing to classify and is reported as `objects` with an
 * empty list, so a caller's "do I need a metadata lookup?" question is
 * answered `false` without a special case.
 */
type DeclaredActionsShape =
  | { readonly kind: 'ids'; readonly ids: readonly string[] }
  | { readonly kind: 'objects'; readonly objects: readonly object[] }
  | DeclaredActionsRefusal;

/**
 * What `resolveDeclaredActionIds` hands back: the array's shape verdict — all
 * ids, all inline objects, or refused at an index — with the id arm RESOLVED
 * against the object's registered actions.
 *
 * Called with `registeredActions` `undefined` (no registry yet) the verdict is
 * registry-independent: `kind` and `ids` are final, `actions` is empty and
 * every id is `unresolved`. That is how a renderer decides whether to request
 * a metadata read at all — React hooks run every render, so the read is
 * requested or skipped before the registry exists — without a second public
 * function for the shape alone.
 *
 *   - `ids`: `actions` holds the resolved definitions in AUTHORED order, one
 *     per id that named a registered action; `unresolved` lists every id that
 *     did not, with its index. Whether an unresolved id is a typo or a lookup
 *     still in flight is the caller's to decide (it owns the loading state),
 *     which is why this is data and not a warning.
 *   - `objects`: `actions` is the authored objects, passed through untouched.
 *   - `refused`: nothing is resolved; see {@link DeclaredActionsRefusal}.
 */
export type DeclaredActionsResolution<T> =
  | {
      readonly kind: 'ids';
      readonly ids: readonly string[];
      readonly actions: T[];
      readonly unresolved: ReadonlyArray<{ readonly index: number; readonly id: string }>;
    }
  | { readonly kind: 'objects'; readonly actions: T[] }
  | DeclaredActionsRefusal;

const DECLARED_ACTIONS_RULE =
  'an actions array is either all action ids or all inline action objects — ' +
  'mixed id/object action arrays are refused; use all ids or all objects';

function describeDeclaredActionElement(el: unknown): string {
  if (el === null) return 'null';
  if (Array.isArray(el)) return 'an array';
  return `a ${typeof el}`;
}

/**
 * Classify an authored action array as all ids, all inline objects, or refused
 * — the shape half of {@link resolveDeclaredActionIds}, and module-internal on
 * purpose (objectui#7182 contract review): a renderer that must know whether
 * a lookup is needed BEFORE it has the registry gets the same
 * registry-independent verdict from `resolveDeclaredActionIds(elements,
 * undefined)`, so a second public function would be a permanent surface for
 * a need the first already serves.
 *
 * Element rule, closed: a string is an action id; a non-null, non-array
 * object is an inline action definition; anything else (`null`, a number, a
 * boolean, a nested array) is refused at its index. The array rule: every
 * element must have the shape of element 0.
 *
 * Pure, zero-dependency, and deliberately typed on `unknown[]`: the arrays
 * reach the renderers straight off authored JSON and off host props, and a
 * narrower parameter would push a cast onto every caller — which is how a
 * shared rule grows per-caller variants and stops being shared (the same
 * reasoning `actionRendersAt` records for its `locations` parameter).
 */
function classifyDeclaredActions(elements: readonly unknown[]): DeclaredActionsShape {
  const shapeOf = (el: unknown): 'id' | 'object' | null =>
    typeof el === 'string'
      ? 'id'
      : el !== null && typeof el === 'object' && !Array.isArray(el)
        ? 'object'
        : null;
  if (elements.length === 0) return { kind: 'objects', objects: [] };
  const first = shapeOf(elements[0]);
  for (let index = 0; index < elements.length; index += 1) {
    const el = elements[index];
    const shape = shapeOf(el);
    if (shape === null) {
      return {
        kind: 'refused',
        index,
        message:
          `element ${index} is ${describeDeclaredActionElement(el)}, which is neither an ` +
          `action id (a string) nor an inline action object; ${DECLARED_ACTIONS_RULE}`,
      };
    }
    if (shape !== first) {
      return {
        kind: 'refused',
        index,
        message:
          `element ${index} is ${shape === 'id' ? 'an action id' : 'an inline action object'} ` +
          `but element 0 is ${first === 'id' ? 'an action id' : 'an inline action object'}; ` +
          DECLARED_ACTIONS_RULE,
      };
    }
  }
  return first === 'id'
    ? { kind: 'ids', ids: elements as readonly string[] }
    : { kind: 'objects', objects: elements as readonly object[] };
}

/**
 * Resolve an authored action array against the actions registered on the
 * object — the ONE function `page:header` and `record:quick_actions` both call
 * (objectui#7182, maintainer ruling 2026-09-02, option C), replacing the
 * whole-array switch one had and the per-element normalisation the other had.
 *
 * The array is classified by {@link classifyDeclaredActions} first, so a mixed
 * array is refused HERE, before a single id is looked up. An all-id array is
 * resolved by `name` — the identity the spec makes required and the one both
 * renderers always keyed on; "id" in `PageHeaderProps.actions`' wording is the
 * action's machine name, not a second key. Registration order wins on a
 * duplicate name. An all-object array passes through as authored: that arm is
 * renderer tolerance for the objectstack#11592 migration, still undeclared
 * (the spec's contract is ids), and it is retired on its own card once the
 * last inline array is converted.
 *
 * `registeredActions` may be `null`/`undefined` while the metadata read is in
 * flight; every id is then `unresolved`, and the caller decides whether that
 * is worth saying yet.
 */
export function resolveDeclaredActionIds<T extends { readonly name?: unknown }>(
  elements: readonly unknown[],
  registeredActions: readonly T[] | null | undefined,
): DeclaredActionsResolution<T> {
  const shape = classifyDeclaredActions(elements);
  if (shape.kind === 'refused') return shape;
  if (shape.kind === 'objects') return { kind: 'objects', actions: Array.from(shape.objects) as T[] };
  const byName = new Map<string, T>();
  for (const def of registeredActions ?? []) {
    const key = typeof def?.name === 'string' ? def.name : '';
    if (key && !byName.has(key)) byName.set(key, def);
  }
  const actions: T[] = [];
  const unresolved: Array<{ index: number; id: string }> = [];
  shape.ids.forEach((id, index) => {
    const def = byName.get(id);
    if (def) actions.push(def);
    else unresolved.push({ index, id });
  });
  return { kind: 'ids', ids: shape.ids, actions, unresolved };
}

/**
 * Visual component type for actions — derived from the spec's
 * `ActionSchema.component` enum (#4074; formerly a hand-written union).
 *
 * `action:button` | `action:icon` | `action:menu` | `action:group`
 *
 * Read off `Action` rather than `ActionSchema.shape.component` because the spec
 * exports `ActionSchema` as a `lazySchema` proxy that does not forward `.shape`.
 * `Action` is the spec's own resolved `z.infer`, so this tracks the enum without
 * reaching into zod internals.
 */
export type ActionComponent = NonNullable<SpecAction['component']>;

/**
 * Action execution type — derived from `@objectstack/spec`'s `ActionType` enum
 * (issue #2231/#2901; formerly a hand-written union).
 *
 * `script` | `url` | `modal` | `flow` | `api` | `form`
 *
 * The previous union claimed to be the "canonical definition from
 * @objectstack/spec" and was missing `form` — so a host app typing against
 * `@object-ui/types` got a type error on `type: 'form'` even though
 * `ActionRunner.executeForm` implements it. Derived now, so the claim is
 * enforced by the compiler rather than asserted in a comment.
 */
export type ActionType = z.infer<typeof SpecActionType>;

/**
 * Renderer-local action types — names `ActionRunner` dispatches that the spec's
 * `ActionType` does not contain (#2944 item 3, #2945).
 *
 * `navigation` is an **alias of the spec's `url`**, not a seventh kind: both
 * mean "go to a location". It survives for two reasons.
 * 1. `{ type: 'navigation', to: … }` is a live authored shape — `element:button`
 *    CTAs use it.
 * 2. Dropping the case would not fail loudly. The action would fall through to
 *    `executeActionSchema`, which returns `{ success: true }` — a green toast
 *    that navigates nowhere, which is #2960's exact trap.
 *
 * It is declared here rather than left implicit so that it stops being dialect:
 * an importer can see that `navigation` is objectui's own, and the runner routes
 * it through the same navigator as `url`, so the two can no longer drift the way
 * they had (the `navigation` path did no `${param.X}` interpolation, ignored
 * `openIn`, and skipped the `/api/…` full-page short-circuit that `url` has).
 *
 * Prefer `type: 'url'` + `openIn` in new metadata. If the spec ever adopts
 * `navigation`, the guard in `__tests__/spec-derived-unions.test.ts` fails and
 * points at this alias to retire.
 */
export type ObjectUiLocalActionType = 'navigation';

export const OBJECTUI_LOCAL_ACTION_TYPES = [
  'navigation',
] as const satisfies readonly ObjectUiLocalActionType[];

/**
 * Every action `type` that `ActionRunner` dispatches to a built-in executor:
 * the spec vocabulary plus the declared local aliases above.
 *
 * The runner's dispatch table is typed `Record<RunnableActionType, …>`, so a
 * value the spec ADDS stops compiling until an executor exists for it. That
 * turns the Tier-2 failure — a spec name that validates and then renders
 * nothing (#2942) — into a build error for actions.
 */
export type RunnableActionType = ActionType | ObjectUiLocalActionType;

/**
 * Field type for action parameters — derived from the spec's `FieldType`
 * (#4074; formerly a hand-written 16-member subset).
 *
 * `ActionParamSchema.type` is `FieldType.optional()`, and `FieldType` carries 49
 * members. The old union listed 16 of them, so a spec-valid param typed
 * `lookup` / `multiselect` / `currency` / `user` / `tags` / `json` / … failed
 * `tsc` against this package even though `ActionParamDialog` renders it — the
 * same failure `ActionType` had before #2231/#2901 derived it (it was missing
 * `form` while `ActionRunner.executeForm` implemented it).
 */
export type ActionParamFieldType = SpecFieldType;

/**
 * Runtime witness for {@link ActionParamFieldType} — the spec's own `FieldType`
 * members, by reference.
 *
 * A type alias erases at runtime, so nothing stops a future edit from replacing
 * the alias above with a restated literal union (which is exactly how the 16-member
 * fork got there). This array is what the guard in
 * `__tests__/spec-derived-unions.test.ts` pins by identity against
 * `FieldType.options`, so a hand-listed copy fails. It is also the list a
 * param-type dropdown should render.
 */
export const ACTION_PARAM_FIELD_TYPES = SpecFieldTypeEnum.options;

/**
 * Param-only `type` spellings objectui still resolves that the spec's
 * `FieldType` does NOT contain (#4074).
 *
 * These are the keys of `PARAM_TYPE_ALIASES` in
 * `@object-ui/app-shell`'s `paramToField.ts`, which folds each onto a canonical
 * widget type (`checkbox` → `boolean`, `reference` → `lookup`,
 * `datetime-local` → `datetime`). They are legacy dialect kept for params
 * already authored with them; new params should use spec `FieldType` values.
 *
 * Declared here, next to the vocabulary they extend, for the same reason
 * {@link ObjectUiLocalActionType} is: a dialect hidden inside a
 * `Record<string, string>` in another package cannot be seen by an importer, and
 * silently resolving an unknown spelling to `text` is not a loud failure. If the
 * spec ever adopts one of these names, the guard in
 * `__tests__/spec-derived-unions.test.ts` fails and names the alias to retire.
 */
export type ObjectUiLocalParamFieldType = 'checkbox' | 'reference' | 'datetime-local';

export const OBJECTUI_LOCAL_PARAM_FIELD_TYPES = [
  'checkbox',
  'reference',
  'datetime-local',
] as const satisfies readonly ObjectUiLocalParamFieldType[];

/**
 * Every `type` spelling an authored action param may carry: the spec vocabulary
 * plus the declared local aliases above. This is what a *reader* of param
 * metadata should accept; use {@link ActionParamFieldType} when authoring new
 * metadata.
 */
export type ResolvableParamFieldType = ActionParamFieldType | ObjectUiLocalParamFieldType;

/**
 * Action parameter definition (ObjectStack Spec v2.0.1)
 *
 * The AUTHORING shape of an action param: what a host app WRITES. It is not a
 * mirror of `@object-ui/core`'s `ActionParamDef`, which is what the dialog
 * READS after `resolveActionParams()` has inlined the field reference — see the
 * "authoring ≠ resolved" note below, and objectui#3174 for what conflating them
 * cost.
 *
 * It is aligned with the spec's `ActionParamSchema` input (#4074 steps 2–3):
 * `name` / `label` / `type` are optional because the `field` reference form
 * supplies them from an existing object field. The RESOLVED shape the dialog
 * consumes — after `resolveActionParams()` in `@object-ui/app-shell` inlines
 * the field reference — is `@object-ui/core`'s
 * `ActionParamDef`, which keeps `name`/`label`/`type` required. Authoring and
 * resolved are different types on purpose; conflating them is what made a
 * spec-valid `{ field: 'status' }` param a type error here for as long as this
 * interface required all three.
 *
 * DERIVED from the spec's `ActionParamSchema` (objectstack#4115): every spec
 * key — `name`, `field`, `objectOverride`, `required`, `placeholder`,
 * `helpText`, `defaultValue`, `multiple`, `accept`, `maxSize`, `reference`,
 * `defaultFromRow`, `visible`, `requiresFeature` — flows in **by reference**
 * from `z.input<typeof ActionParamSchema>`, so a key the spec adds cannot go
 * undeclared here again.
 *
 * `z.input`, not `z.infer`: `required` carries a `.default(false)` and `visible`
 * a canonicalizing pipe, so the parsed shape makes `required` mandatory and
 * `visible` an `{ dialect, source }` envelope. This is the authoring side —
 * metadata as written, before the server parses it — which is the `z.input` rule
 * from objectui#3169.
 *
 * The hand copy this replaces omitted three spec keys the authoring surface
 * really uses: `reference` (the inline lookup target `resolveActionParams()`
 * reads), `defaultFromRow` (which the metadata designer's own inspector writes)
 * and `requiresFeature`; and it narrowed `visible` to a bare string even though
 * the resolver has always accepted the envelope form too.
 *
 * ONE key is pinned locally: `type` takes {@link ResolvableParamFieldType} —
 * the spec vocabulary plus objectui's declared legacy spellings
 * (`checkbox` / `reference` / `datetime-local`), which the dialog resolves.
 * `type` is a NARROWING of a key the spec already declares, not an addition:
 * the interface adds no key of its own (objectui#3201 retired the last one).
 *
 * **Authoring ≠ resolved — the resolved-side keys are NOT declared here**
 * (objectui#3174). This interface used to add the whole picker group on top of
 * the spec's keys — `referenceTo`, `displayField`, `idField`,
 * `descriptionField`, `titleFormat`, `lookupColumns`, `lookupFilters`,
 * `lookupPageSize`, `dependsOn` — "for parity with the resolved shape". None of
 * them is authorable:
 *
 *  - `ActionParamSchema` is `.strict()`, so every one of them is a hard PARSE
 *    REJECTION on the server; `referenceTo` is even listed by name in the
 *    schema's alias map, which answers it with "use `reference`".
 *  - `resolveActionParams()` never read any of them. It reads the spec's
 *    `reference` for an inline picker target and inherits the rest from the
 *    referenced object field.
 *
 * So `{ name: 'account_id', type: 'lookup', referenceTo: 'account' }` type-
 * checked, lost its picker target on the way through the resolver, and rendered
 * as a plain record-id text box — while the dev warning that fired told the
 * author to declare `reference`, a key this type did not have. Declaring the
 * resolved spelling here is what made that a *silent* authoring error instead
 * of a compile error, so it is gone: `reference` is the one authorable
 * spelling, and the eight remaining picker keys come from the field a
 * field-backed param names (`{ field: 'account_id' }`). An authored
 * `referenceTo` now fails `tsc` here, and — for the JS/JSON authoring paths
 * `tsc` does not gate — `resolveActionParams()` names it in a dev warning
 * rather than dropping it silently.
 *
 * The rule this leaves behind, pinned by the drift guard: **this interface
 * declares exactly the spec's authorable keys.** A capability the resolved
 * shape has and the authoring shape lacks is either a spec change or a
 * field-backed param — never a key added here.
 *
 * That rule is now literal, with no named exception. `validation?: string` was
 * carried here as the one key this interface added on top of the spec's set,
 * and objectui#3201 retired it: `ActionParamSchema` is `.strict()` and does not
 * list it, so an authored `validation` was a hard PARSE REJECTION on the server
 * (`Unrecognized key(s) on this action param`) while `tsc` accepted it happily;
 * and nothing ever read it — `resolveActionParams()` never had it on
 * `RawActionParam`, `paramToField()` never mapped it, and `buildValidationRules()`
 * in `@object-ui/fields` builds rules from `required` / `minLength` /
 * `maxLength` / `pattern` field metadata with no `validation` branch. It was
 * removed rather than implemented (ADR-0049 enforce-or-remove): giving it
 * meaning would mean first deciding what an "expression" is here (CEL? formula?
 * regex?) and adding it to `@objectstack/spec`, which is where such a capability
 * would have to start.
 *
 * `label` and `options[].label` are NOT pinned: both flow in by reference with
 * the rest of the spec's keys. The comment here used to justify a local
 * override as a widening — "labels take the spec's `I18nLabel` (a string or a
 * per-locale record)" — and then justified deleting that override with a claim
 * about the spec that was never true: "in spec 17 `I18nLabelSchema` is
 * `z.ZodString`, inline per-locale objects were dropped in favour of
 * translation files". The spec never narrowed that way (objectui#4611).
 *
 * What `I18nLabel` admits, stated in as many words by its own doc block in
 * `@objectstack/spec/ui` (objectstack#5728, maintainer ruling 2026-08-06): a
 * display label in one of TWO authorized forms — a plain default-language
 * string, whose translations live in a translation bundle addressed by
 * convention, or an inline locale map keyed by locale tag (`en`, `zh-CN`, ...)
 * picked at render time — closing with "Both are real; neither is deprecated
 * by this schema." The map form is live here, not theoretical: this repo's
 * renderers resolve it through `pickLocalized` (e.g. `schema.title` in
 * `packages/components/src/renderers/layout/containers.tsx`), and the spec
 * ships `resolveI18nLabel` as the matching resolver on its own side.
 *
 * Deleting the override was still right, for a reason that does not depend on
 * which forms the union holds: a plain string is one of the forms `I18nLabel`
 * admits, so a local `string | I18nLabel` collapses to `I18nLabel` — an exact
 * restatement of the inherited type while claiming to be wider than it.
 * Inheriting by reference is what keeps these keys correct as the spec's set of
 * authorized forms moves; an override is what cannot.
 *
 * If you need today's spelling rather than the authorized forms, measure it:
 * against `@objectstack/spec@17.0.0` it is `z.ZodUnion([z.ZodString,
 * z.ZodRecord(z.ZodString, z.ZodString)])` (`dist/ui/index.d.ts:614`). That is
 * a reading of one version, not a standing fact about the schema — which is
 * the distinction the sentence this replaces failed to make.
 *
 * Guarded since objectui#5612, and it was not before: the `it(...)` case in
 * `__tests__/page-nav-misc-spec-parity.test.ts` that calls itself an inverted
 * pin on this decision used to assert only that a plain string is assignable to
 * `I18nLabel` — which holds under either form, so the widening above went
 * through it green. It now asserts BOTH authorized forms are assignable, here
 * and on `options[].label`, and so fails when either is withdrawn.
 *
 * Drift guard: `__tests__/page-nav-misc-spec-parity.test.ts`.
 */
export interface ActionParam
  extends Omit<z.input<typeof SpecActionParamSchema>, 'type'> {
  /**
   * Field type for input. Optional: field-backed params inherit the referenced
   * field's type.
   *
   * Accepts the spec vocabulary plus objectui's declared legacy spellings, which
   * is what the dialog resolves — prefer a canonical
   * {@link ActionParamFieldType} in new metadata.
   */
  type?: ResolvableParamFieldType;
}

/**
 * Enhanced Action Schema (ObjectStack Spec v2.0.1)
 *
 * This is the primary action schema that should be used for all new
 * implementations. The legacy `ActionSchema` in `crud.ts` is maintained for
 * backward compatibility.
 *
 * ⚠️ Named `UIActionSchema`, which is the name `packages/types/src/index.ts`
 * has always PUBLISHED it under. It was declared as `ActionSchema` until
 * objectui#6349 — a second authority for a name `crud.ts` also declares, so an
 * IDE auto-import picked between two structurally unrelated types (9 shared
 * keys out of 28 each; `type` is the literal `'action'` there and
 * {@link ActionType} here) and the wrong pick surfaced as a remote `TS2322`.
 * The declaration now spells the published name; nothing outside this file
 * imported the old one, so the package's public surface is unchanged. See the
 * 2026-08-25 family ruling (objectui#6172, decision 甲/A1) and the recurrence
 * guard `scripts/__tests__/one-authority-per-exported-name-6273.test.ts`.
 */
export interface UIActionSchema {
  /** Unique action identifier (snake_case) */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Optional icon (Lucide icon name) */
  icon?: string;
  
  // === Placement ===
  
  /**
   * Where this action renders. There is NO default: an action that declares
   * no location renders in no located surface (see {@link actionRendersAt}).
   * Placement from a view's `bulkActions` / `bulkActionDefs`, or from a host's
   * `systemActions` slot, is declared there instead and needs no entry here.
   */
  locations?: ActionLocation[];
  
  /** Visual component type (defaults to 'action:button') */
  component?: ActionComponent;

  /**
   * Sort order within a location group (lower = higher / more prominent;
   * defaults to 0). The action:bar stable-sorts actions by `order` before the
   * inline/overflow split, so in `record_header` a lower `order` promotes an
   * action into the primary-button slot and a higher `order` pushes it toward
   * the "More" (⋯) overflow menu. Mirrors `Action.order` in `@objectstack/spec`.
   */
  order?: number;

  // === Behavior ===
  
  /** Action execution type */
  type: ActionType;
  
  /**
   * Target for the action (URL, script name, etc.) — the **only** handler slot.
   *
   * The `execute` alias was removed in `@objectstack/spec` 17 (#3855); this
   * interface no longer declares it, so `execute: '…'` now fails `tsc` at the
   * authoring site instead of binding a second handler nothing agrees on
   * (#3713, #3856). Rename to `target`; the value is unchanged.
   */
  target?: string;

  /**
   * For `type: 'url'`: where to open `target`.
   * - `'new-tab'` — open `target` in a new browser tab/window.
   * - `'self'` — navigate the current page (in-app router when available).
   *
   * When omitted, the legacy heuristic applies: absolute/external URLs
   * (`http(s)://…`) open in a new tab, relative URLs navigate in place.
   *
   * This is a **static execution option**, NOT user input — keep it out of
   * {@link params}, which is exclusively for collecting input before
   * execution. Putting `newTab` inside `params` is rejected at build (an
   * object where an `ActionParam[]` is expected) and, as an array entry,
   * is mis-rendered as a checkbox in the param-collection dialog.
   *
   * Note: this is distinct from the runner-internal `opensInNewTab` /
   * `newTabUrl` pair, which pre-opens `about:blank` synchronously for async
   * handlers that resolve a redirect URL after a fetch (SSO flows). For a
   * static `target`, prefer `openIn`.
   */
  openIn?: 'self' | 'new-tab';

  /**
   * Declared post-success navigation — the spec's closed strict
   * `{ navigate, openIn }` block (`ActionSchema.onSuccess`, authorable since
   * `@objectstack/spec` 17.1.0). All four declared action renderers forward it
   * to the runner (objectui#5493/#6304), which performs the hop through the
   * app's own `navigationHandler`.
   *
   * DERIVED from the spec, never hand-copied — a hand-written duplicate of a
   * spec shape is a second contract that drifts silently. Declared on the
   * renderer view since objectui#5934 retired `ActionRunner`'s legacy
   * chained-callback meaning for the same key: with the spec block as the
   * key's only meaning, the forward sites type-check without an `as any` cast.
   *
   * Note the inner `openIn` spelling is `'self' | 'newTab'` — NOT the
   * top-level {@link openIn}'s `'self' | 'new-tab'`. The spec refuses each
   * crossover spelling; the derivation keeps the two from ever being merged
   * by hand.
   */
  onSuccess?: SpecAction['onSuccess'];

  /** API endpoint (for type: 'api') */
  endpoint?: string;
  
  /** HTTP method (for type: 'api') */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  
  // === Parameters ===
  
  /**
   * Input parameters to collect from the user before execution (renders a
   * dialog). This field is **exclusively** for user-input collection — it is
   * always an `ActionParam[]`. Do NOT use it to carry static execution
   * options (e.g. new-tab behavior — use {@link openIn}); a non-array value
   * fails build validation, and an array entry like
   * `{ name: 'newTab', type: 'checkbox' }` is mis-rendered as a user-facing
   * checkbox instead of being treated as an instruction.
   */
  params?: ActionParam[];

  /**
   * Static request-body fields for a `type: 'api'` action, merged into the
   * outgoing body **last** so constants always win over user-collected params
   * and over `recordIdParam`.
   *
   * This — not {@link params} — is where a payload goes. The two are different
   * concepts that shared one name until objectstack#5777: `params` describes
   * fields to COLLECT (an `ActionParam[]` definition array), `bodyExtra` is data
   * to SEND. The maintainer's 2026-08-06 ruling took direction A (a separate
   * key, no same-name union), so `@objectstack/spec` 17 refuses an object under
   * `params` by name and rewrites sources that still carry it via the
   * `inline-action-api-params-to-body-extra` conversion (ADR-0087 D2).
   *
   * Declared here so the action renderers can forward it off a typed
   * `UIActionSchema` rather than through an `as any` cast — the renderers are the
   * consumers this field exists for (objectstack#6837). Typed off the spec
   * rather than restated, so the shape cannot drift from the contract.
   */
  bodyExtra?: SpecAction['bodyExtra'];

  /**
   * Request-body WRAPPING for a `type: 'api'` action: `'flat'` (the default —
   * collected params ride at the top level) or `{ wrap: key }` to nest the
   * collected params under `key` (better-auth `organization/update` is the
   * shape it exists for).
   *
   * Per the spec's own wording the wrap covers the **collected params only** —
   * `recordIdParam` and every other top-level key stay flat, {@link bodyExtra}
   * among them. Both console read-sites (`useConsoleActionRuntime.apiHandler`,
   * `RecordDetailView.apiHandler`) and the runner's own `executeAPI` implement
   * exactly that, so the key has one meaning everywhere it is honoured.
   *
   * Declared here for the same reason as {@link bodyExtra}: the action
   * renderers forward it off a typed `UIActionSchema` instead of an `as any`
   * cast, and dropping it from those whitelists is what made a declared wrap
   * degrade silently to a flat body (objectstack#6938). Typed by derivation
   * from the spec so the union cannot drift from the contract.
   */
  bodyShape?: SpecAction['bodyShape'];

  // === Feedback ===
  
  /** Confirmation text to show before execution */
  confirmText?: string;
  
  /** Success message to show after execution */
  successMessage?: string;
  
  /** Error message to show on failure */
  errorMessage?: string;
  
  /** Whether to refresh data after execution */
  refreshAfter?: boolean;
  
  /** Toast notification configuration */
  toast?: {
    /** Show toast on success */
    showOnSuccess?: boolean;
    
    /** Show toast on error */
    showOnError?: boolean;
    
    /** Toast duration in milliseconds */
    duration?: number;
  };
  
  // === Conditional ===
  
  /** Expression controlling visibility (e.g., "status === 'draft'") */
  visible?: string;
  
  /** Expression controlling enabled state (e.g., "hasPermission('edit')") */
  enabled?: string;
  
  // === Styling ===
  
  /** Button variant */
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';
  
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  
  /** Custom CSS class */
  className?: string;
  
  // === Metadata ===
  
  /** Action description */
  description?: string;
  
  /** Permission required to execute */
  permission?: string;
  
  /** Tags for categorization */
  tags?: string[];

  /**
   * UI-local escape hatch: synchronous/async callback invoked directly by
   * UI action renderers (e.g., `action:menu`) instead of routing through
   * {@link ActionEngine}. Intended for chrome-level concerns such as
   * toggling inline-edit mode, opening a native Share sheet, or copying the
   * URL to the clipboard — UI side-effects that are not part of the domain
   * action protocol and therefore need not be serialized over the wire.
   *
   * When present, `onClick` takes precedence over `type` / `target`. Prefer
   * {@link ActionEngine}-routed actions for anything that could originate from
   * server-driven metadata.
   */
  onClick?: () => void | Promise<void>;
}

/**
 * Action group for organizing related actions
 */
export interface ActionGroup {
  /** Group name */
  name: string;
  
  /** Display label */
  label: string;
  
  /** Optional icon */
  icon?: string;
  
  /** Actions in this group */
  actions: UIActionSchema[];
  
  /** Group visibility condition */
  visible?: string;
  
  /** Display as dropdown or inline */
  display?: 'dropdown' | 'inline';
}

/**
 * Action execution context
 */
export interface ActionContext {
  /** Current record data */
  record?: Record<string, any>;
  
  /** Selected records (for list actions) */
  selectedRecords?: Record<string, any>[];

  /** Live page-variable snapshot (ADR-0049) published by PageVariableActionBridge —
   *  lets a submit action read page-local form state via `{{page.<var>}}` tokens. */
  pageVariables?: Record<string, any>;
  
  /** Current user */
  user?: Record<string, any>;
  
  /** Additional context data */
  [key: string]: any;
}

/**
 * Action execution result
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  
  /** Result data */
  data?: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Whether to refresh data */
  refresh?: boolean;
  
  /** Whether to close dialog/modal */
  close?: boolean;
}

/**
 * Action executor function type
 */
export type ActionExecutor = (
  action: UIActionSchema,
  context: ActionContext,
  params?: Record<string, any>
) => Promise<ActionResult>;

// ============================================================================
// Batch Operations (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Batch operation configuration */
export interface BatchOperationConfig {
  /** Operation name */
  name: string;
  /** Display label */
  label: string;
  /** Target action to execute on each record */
  action: string;
  /** Whether to run in parallel */
  parallel?: boolean;
  /** Maximum concurrent operations */
  concurrency?: number;
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Progress callback expression */
  onProgress?: string;
  /** Completion callback expression */
  onComplete?: string;
}

/** Batch operation result */
export interface BatchOperationSummary {
  /** Total items processed */
  total: number;
  /** Successfully processed count */
  succeeded: number;
  /** Failed count */
  failed: number;
  /** Individual results */
  results: Array<{
    recordId: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================================================
// Transaction Support (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Transaction isolation level */
export type TransactionIsolationLevel = 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';

/** Transaction configuration */
export interface TransactionConfig {
  /** Transaction name for identification */
  name?: string;
  /** Isolation level */
  isolation?: TransactionIsolationLevel;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Actions to execute within the transaction */
  actions: UIActionSchema[];
  /** Rollback action on failure */
  rollbackAction?: string;
  /** Whether to auto-retry on conflict */
  retryOnConflict?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/** Transaction result */
export interface TransactionResult {
  /** Whether all actions succeeded */
  success: boolean;
  /** Transaction ID */
  transactionId: string;
  /** Individual action results */
  actionResults: ActionResult[];
  /** Error if transaction failed */
  error?: string;
  /** Whether the transaction was rolled back */
  rolledBack?: boolean;
}

// ============================================================================
// Undo/Redo Support (Q2 2026 - Spec v2.0.1 Enhancement)
// ============================================================================

/** Undo/redo operation entry */
export interface UndoRedoEntry {
  /** Entry identifier */
  id: string;
  /** Action that was performed */
  action: string;
  /** Description of the action */
  description: string;
  /** Timestamp */
  timestamp: string;
  /** Data before the action (for undo) */
  previousState: Record<string, unknown>;
  /** Data after the action (for redo) */
  nextState: Record<string, unknown>;
  /** Target object */
  object?: string;
  /** Target record ID */
  recordId?: string;
}

/** Undo/redo configuration */
export interface UndoRedoConfig {
  /** Enable undo/redo */
  enabled: boolean;
  /** Maximum history size */
  maxHistorySize?: number;
  /** Actions that support undo */
  undoableActions?: string[];
  /** Whether to group rapid changes */
  groupChanges?: boolean;
  /** Group timeout in milliseconds */
  groupTimeout?: number;
}

/** Undo/redo state */
export interface UndoRedoState {
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Undo stack */
  undoStack: UndoRedoEntry[];
  /** Redo stack */
  redoStack: UndoRedoEntry[];
  /** Current position in history */
  currentIndex: number;
}
