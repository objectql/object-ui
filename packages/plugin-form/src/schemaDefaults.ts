/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Create-mode seeding of an object's declared field defaults (#4047).
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
 * Can this declared `defaultValue` be used as a form's initial value as-is?
 *
 * True for static literals only — see the module docblock for why runtime
 * tokens and Expression envelopes are left to the server.
 */
export function isSeedableDefault(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (isRuntimeDefaultToken(v)) return false;
  if (isExpressionEnvelope(v)) return false;
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
