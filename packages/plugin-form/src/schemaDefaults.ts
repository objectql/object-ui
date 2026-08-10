/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * What an object's declared field `defaultValue`s mean to a CREATE form —
 * which ones it seeds (#4047) and which ones excuse it from the client-side
 * `required` rule (#4069).
 *
 * Both halves hang off ONE classifier, {@link isRuntimeDefault}: a default the
 * server resolves per insert is neither seedable nor missing. Keeping the two
 * consumers on one predicate is the point of this module — a second copy would
 * be free to disagree about, say, a CEL envelope, and then a form would seed a
 * field it also refuses to submit.
 *
 * ## What this is for
 *
 * A CREATE form starts from a blank record, so the values it opens with are
 * whatever the form puts there. `ObjectForm` derived them from the object
 * schema's `defaultValue`s; the sectioned/overlay containers (Modal / Drawer /
 * Tabbed / Split / Wizard) did not, and the console's create dialog is one of
 * those — a field declared `required: true, defaultValue: 'draft'` opened
 * empty, with a required marker, forcing the user to pick a value the system
 * already knew (and putting every neighbouring option one click away).
 *
 * ## Which spelling is honoured, and why only that one
 *
 * `field.defaultValue` — and deliberately NOT a select option's `default: true`,
 * even though `@objectstack/spec`'s `SelectOptionSchema` declares that key.
 * The reason is the producer, not taste: the server's insert path
 * (`ObjectQL.applyFieldDefaults`) resolves `field.defaultValue` and nothing
 * else, which is exactly why omitting the field from a create request stores
 * the declared default (measured on the reporting stack). A console that
 * additionally seeded from option-level `default` would preselect values the
 * server would never have applied — a second, UI-only default contract, which
 * is the renderer-side dialect AGENTS.md #0.1 forbids. If option-level
 * `default` is to mean "the initial value", that belongs at the producer.
 *
 * ## Which defaults are seeded, and why the rest are skipped
 *
 * Only STATIC defaults. A `defaultValue` may also be an *instruction* the
 * server resolves per insert:
 *
 *   - a runtime token — `'NOW()'` / `'current_user'`, the whole
 *     `DEFAULT_VALUE_TOKENS` family from `@objectstack/spec/data`
 *   - a CEL Expression envelope — `{ dialect: 'cel', source: 'today()' }`
 *
 * Seeding those literally is worse than leaving the control empty: the string
 * `NOW()` lands in a datetime input and is then SUBMITTED as that field's
 * value, which suppresses the server-side resolution the declaration asked for
 * (`applyFieldDefaults` only fills fields that arrive empty). Skipping them
 * leaves the field absent from the create payload, which is precisely the case
 * the engine resolves. `ObjectForm` had been seeding them verbatim — that is
 * fixed here along with the missing-seeding half.
 *
 * ## Create only
 *
 * An EDIT form shows a persisted row and must show it as the server holds it.
 * Folding a default in over a column the record leaves unset would arm a silent
 * write of a value the user never chose, on the next save of any other field.
 * Callers gate on create; this module never sees the mode.
 */

import { isRuntimeDefaultToken } from '@objectstack/spec/data';
import { isMissingForRequired } from '@object-ui/core';

/** An object schema as the data source serves it (`{ fields: { [name]: def } }`). */
interface ObjectSchemaLike {
  fields?: Record<string, { defaultValue?: unknown } | undefined>;
}

/**
 * Is `v` a CEL/template Expression envelope rather than a literal value?
 *
 * Same shape test the engine applies before handing a default to
 * `ExpressionEngine` (`{ dialect, source }`), kept structural on purpose: the
 * point is "the server evaluates this", which is true for every dialect.
 */
function isExpressionEnvelope(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { dialect?: unknown }).dialect === 'string' &&
    typeof (v as { source?: unknown }).source === 'string'
  );
}

/**
 * Is this declared `defaultValue` a RUNTIME INSTRUCTION the server resolves per
 * insert, rather than a literal value?
 *
 * True for the `DEFAULT_VALUE_TOKENS` family (`'NOW()'` / `'current_user'`) and
 * for CEL/template Expression envelopes. This is THE classifier for "the
 * producer owns this field's create value" — both consumers in this package
 * read it, and neither may grow a second copy:
 *
 *   1. seeding (#4047 / #4068) — such a default is not seeded, because putting
 *      the literal text `NOW()` into a datetime input and submitting it
 *      suppresses the very resolution the declaration asked for;
 *   2. the create-mode `required` rule (#4069) — see {@link isRequiredInForm}.
 *
 * The two are the same fact seen twice: a field whose value the server supplies
 * is neither seedable nor missing.
 */
export function isRuntimeDefault(v: unknown): boolean {
  return isRuntimeDefaultToken(v) || isExpressionEnvelope(v);
}

/**
 * Can this declared `defaultValue` be used as a form's initial value as-is?
 *
 * True for static literals only — see the module docblock for why runtime
 * tokens and Expression envelopes are left to the server.
 */
export function isSeedableDefault(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  return !isRuntimeDefault(v);
}

/**
 * Does this form have no persisted record behind it — i.e. is it a CREATE form?
 *
 * The one "no persisted record" test, shared by everything that must agree
 * about it: the containers' data-fetch branch, the default seeding (#4047) and
 * the create-mode `required` suppression (#4069). Two spellings of this test
 * WOULD drift — a form seeded as create but validated as edit is exactly the
 * bug #4069 fixes, in mirror image.
 */
export function isCreateFormMode(
  form: { mode?: string | null; recordId?: unknown } | null | undefined,
): boolean {
  return form?.mode === 'create' || !form?.recordId;
}

/**
 * The `required` a form should ENFORCE on this field, given the mode (#4069).
 *
 * A field may declare `required: true` alongside a runtime `defaultValue`:
 *
 * ```ts
 * remind_at: Field.datetime({ required: true, defaultValue: 'NOW()' }),
 * ```
 *
 * That is coherent authoring, not an error — storage-level required, with the
 * value guaranteed by the producer (`ObjectQL.applyFieldDefaults` resolves the
 * token for every field that arrives absent or null). But a CREATE form cannot
 * seed it (see {@link isRuntimeDefault}), so the control opens empty; enforcing
 * `required` there refuses the submit with *nothing sensible for the user to
 * type* — the declaration already said what the value is, and omitting the
 * field is precisely what makes the server supply it. The field is not
 * "missing"; it is server-owned.
 *
 * So in CREATE mode a runtime default suppresses the rule. Three boundaries,
 * each pinned in `createDefaults.test.tsx`:
 *
 *   - **Create only.** An EDIT form shows a persisted row, where the token was
 *     already resolved at insert; blanking a required column there is a real
 *     removal of a value and stays refused.
 *   - **Runtime defaults only.** A STATIC literal default IS seeded into the
 *     control (#4068), so if the user clears it they have removed a value that
 *     was there — `required` still fires.
 *   - **The rule, not the field.** Suppression only removes the "must not be
 *     empty" check. A value the user DOES type is still submitted normally and
 *     wins over the declared default.
 *
 * Note this drops the required MARKER (and `aria-required`) too, since both are
 * driven by this one boolean — which is the honest reading: in create mode the
 * user really is not required to provide the value. Surfacing what the server
 * WILL supply is issue #4069's option B, a separate follow-up card.
 *
 * Deliberately NOT extended to `requiredWhen` (the conditional-required CEL
 * rule): that is resolved downstream in the form renderer against the live
 * record, outside this package.
 */
export function isRequiredInForm(
  field: { required?: unknown; defaultValue?: unknown } | null | undefined,
  isCreateForm: boolean,
): boolean {
  if (!field?.required) return false;
  if (isCreateForm && isRuntimeDefault(field.defaultValue)) return false;
  return true;
}

/**
 * The static `defaultValue`s an object schema declares, as a form-values patch.
 *
 * Returns a fresh object (never shared), and `{}` for a missing/!object schema
 * so callers can spread it unconditionally.
 */
export function schemaDefaultValues(objectSchema: ObjectSchemaLike | null | undefined): Record<string, unknown> {
  const fields = objectSchema?.fields;
  if (!fields || typeof fields !== 'object') return {};
  const defaults: Record<string, unknown> = {};
  for (const name of Object.keys(fields)) {
    const dv = fields[name]?.defaultValue;
    if (isSeedableDefault(dv)) defaults[name] = dv;
  }
  return defaults;
}

/**
 * The initial values a CREATE form opens with: the schema's static defaults,
 * overlaid with whatever the caller supplied.
 *
 * Caller values win — `initialData` / `initialValues` are the more specific
 * instruction (a lookup prefill, a "duplicate this record" seed, a wizard
 * carrying state forward), and an explicit `null` from a caller is a real
 * "leave this blank", not an absence.
 */
export function seedCreateValues(
  objectSchema: ObjectSchemaLike | null | undefined,
  initial?: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...schemaDefaultValues(objectSchema), ...(initial ?? {}) };
}

/**
 * Drop the fields a CREATE payload must leave to the producer (#4069).
 *
 * The other half of {@link isRequiredInForm}: excusing a server-owned field
 * from `required` is only half an answer if the form then submits the key
 * anyway. A rendered control registers with the form whether or not anything
 * seeded it, so an untouched runtime-default field reaches the payload as
 * `undefined` — or as `''` once anything has focused it — and `undefined` is
 * invisible to a `JSON.stringify` check while still being a KEY that a data
 * source is free to translate into an explicit column write.
 *
 * `ObjectQL.applyFieldDefaults` resolves a declared default for a field that
 * arrives absent or null. A blank string is neither, so submitting one stores
 * `''` and silently defeats the declaration — the exact suppression #4068
 * avoided by not seeding the token in the first place. Omitting the key is what
 * makes the server the single authority for the value.
 *
 * Only EMPTY values are dropped, and emptiness is `isMissingForRequired` — the
 * very predicate the required rule uses, so "left empty" cannot come to mean
 * two different things in the two halves of this fix. A value the user actually
 * typed is submitted normally: the suppression is of the rule, not of the
 * field.
 *
 * CREATE only. On an edit form the token was resolved at insert; a cleared
 * column there is a deliberate removal, and dropping the key would silently
 * discard the user's edit.
 */
export function omitServerResolvedDefaults(
  data: Record<string, unknown>,
  objectSchema: ObjectSchemaLike | null | undefined,
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;
  const fields = objectSchema?.fields;
  if (!fields || typeof fields !== 'object') return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isRuntimeDefault(fields[key]?.defaultValue) && isMissingForRequired(value)) continue;
    out[key] = value;
  }
  return out;
}
