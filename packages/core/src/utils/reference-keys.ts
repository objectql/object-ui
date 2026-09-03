/**
 * ObjectUI — reference-key canonicalization
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Backend object schemas follow the ObjectStack convention and name a
 * relational field's target object `reference`
 * (e.g. `{ type: 'lookup', reference: 'showcase_account' }`), while ObjectUI's
 * types — and most in-repo consumers — historically read `reference_to`
 * (some legacy configs also carry camelCase `referenceTo`). A consumer that
 * reads only one key silently loses the relation under the other convention:
 * the exact bug HeaderHighlight had (#2407 / PR #2587), where a served
 * `reference`-keyed lookup rendered a raw id.
 *
 * `normalizeFieldReferenceKeys` stamps BOTH snake_case keys onto the field
 * definition whenever any of the three spellings is present, so downstream
 * reads work regardless of which single key they check. It mutates the field
 * in place — the ObjectStack adapter caches the schema object and re-serves
 * it, so the one pass must stick — and is idempotent. Keys that are already
 * set are never overwritten.
 *
 * ## ⭐ Why this file also WARNS — objectui#6837 half 2
 *
 * Maintainer ruling, 2026-08-31 (第 6 场总监席决裁批 #14), 原文照录:
 *
 * > objectui不是前端的项目吗?后端的元数据只要对,前端按协议执行就行了呀
 *
 * Protocol normalization belongs on the SERVER; the front end just executes
 * the protocol. objectstack#13847 landed that half: a `field-reference-to-alias`
 * conversion rewrites stored `reference_to` → `reference` on the serve path and
 * in `os migrate meta`, so a spec-compliant backend now emits `reference` only.
 * This repo's half deleted the per-reader `reference_to` fallback arms that
 * existed to absorb the un-normalized shape.
 *
 * The ruling asked for that deletion to be AUDIBLE rather than silent, and this
 * is the cheap defence-in-depth pin it named, placed here as dispatched.
 * `@objectstack/spec` 17.2.0's `FieldSchema` is strict and refuses
 * `reference_to`, `referenceTo` and `target` by name with `unrecognized_keys`,
 * each carrying its own "did you mean → `reference`" rename (measured on the
 * installed package, with `reference` as the positive control and a nonsense
 * key as the negative one — the nonsense key gets no rename hint, so the hint
 * is alias-table membership, not boilerplate). So a def that reaches this choke
 * point spelling ONLY a legacy key came from a producer the spec would reject,
 * and the producer is where it gets fixed.
 *
 * ## ⛔ WHAT THIS WARNING DOES NOT COVER — state it, do not overclaim it
 *
 * This warning fires ONLY where this file runs, and this file runs at exactly
 * two production call sites, both of them ingestion choke points:
 *
 *   packages/app-shell/src/providers/MetadataProvider.tsx  (metadata type `object`)
 *   packages/data-objectstack/src/index.ts                 (ObjectStackAdapter.getObjectSchema)
 *
 * Both of those STAMP the def, so a def that triggers this warning is also a
 * def that still resolves. ⇒ The warning fires precisely where nothing is
 * broken.
 *
 * ⚠️ The BREAK surface is the complement of that: `getObjectSchema` is a
 * required member of the published `DataSource` interface and the readers call
 * it on the generic `dataSource`, so a hand-written schema served through ANY
 * other `DataSource` reaches a reader RAW — it neither passes through here nor
 * warns. On that path the failure is exactly as silent as it was before.
 * Reader-side or shared-resolver diagnostics, which would cover it, remain an
 * open question on objectui#6837 (options B and C of its table §5).
 *
 * ⛔ Do not describe this pin as making the BYO break audible. It does not.
 *
 * ⛔ The stamping itself is deliberately UNCHANGED. It is the only thing
 * standing between a BYO `DataSource` and the break, and retiring it is a
 * separate decision with its own weight — not this card's.
 */

/**
 * Warn once per (OBJECT name, field name, legacy spelling, target VALUE) rather
 * than once per call: the adapter re-serves a cached schema and
 * `MetadataProvider` re-normalizes on every metadata refresh, and a warning
 * that floods the console is a warning that gets muted.
 *
 * All four segments are load-bearing, and each is here because dropping it
 * makes the warning name less than a whole producer site:
 *
 *   - OBJECT — the same field name (`owner`, `account_id`) lives on many
 *     objects, and each is a SEPARATE place to fix. Keyed on the field alone
 *     the memo reports the first object and goes quiet for every other one,
 *     while the message names a field the reader then has to go hunting for.
 *     `normalizeSchemaReferenceKeys` has `schema.name` in hand, so the whole
 *     address is available for free.
 *   - FIELD and SPELLING — one line per mis-spelled key, so a producer with
 *     three broken fields gets three fixes, not one and a silence.
 *   - VALUE — a field carrying two different stale targets reports both. This
 *     mirrors `column-identity.ts`'s `warnedConflicts` memo, which keys on the
 *     value for exactly this reason.
 *
 * ⚠️ A def normalized OUTSIDE a schema (a bare `normalizeFieldReferenceKeys`
 * call) has no object to name; it warns under a placeholder rather than being
 * silently merged with a real object's entry.
 */
const warnedLegacyOnly = new Set<string>();

/** Reset the warn-once memo. Exported for tests. */
export function resetReferenceKeyWarnings(): void {
  warnedLegacyOnly.clear();
}

const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV !==
  'production';

/** The two spellings no contract declares, in the order the stamp prefers them. */
const LEGACY_REFERENCE_KEYS = ['reference_to', 'referenceTo'] as const;

/**
 * Dev-mode only: say out loud that a def arrived spelling ONLY a legacy key.
 *
 * Non-breaking by construction: changes no types, rejects nothing, drops no
 * key, and is a no-op under `NODE_ENV=production`. The stamp still runs, so the
 * def renders exactly as it did before — this only makes the producer's bug
 * visible instead of absorbing it silently.
 */
function warnOnLegacyOnlyReference(
  f: Record<string, unknown>,
  fieldName?: string,
  objectName?: string,
): void {
  if (!isDev()) return;
  if (f.reference !== undefined) return;
  const spelled = LEGACY_REFERENCE_KEYS.filter((k) => f[k] !== undefined && f[k] !== '');
  if (spelled.length === 0) return;
  const named = fieldName ?? (typeof f.name === 'string' ? f.name : '(unnamed field)');
  const owner = objectName ?? '(unknown object)';
  for (const key of spelled) {
    const memo = `${owner}:${named}:${key}:${String(f[key])}`;
    if (warnedLegacyOnly.has(memo)) continue;
    warnedLegacyOnly.add(memo);
    console.warn(
      `[ObjectUI] Object \`${owner}\`, field \`${named}\` declares its relationship target as ` +
        `\`${key}: '${String(f[key])}'\` and does NOT carry \`reference\`. ` +
        `\`reference\` is the only spelling the protocol declares: ` +
        `\`@objectstack/spec\`'s \`FieldSchema\` refuses \`${key}\` by name with ` +
        `\`unrecognized_keys\` ("Did you mean \`${key}\` -> \`reference\`?"). ` +
        `ObjectUI stamps \`reference\` here so this def still renders, but the ` +
        `readers no longer carry a \`${key}\` fallback of their own — fix the ` +
        `PRODUCER to emit \`reference\`, or serve the def through a backend that ` +
        `normalizes it (objectstack#13847 does this on the serve path and in ` +
        `\`os migrate meta\`). Maintainer ruling 2026-08-31: protocol ` +
        `normalization belongs on the server, the front end just executes the ` +
        `protocol. (objectui#6837)`,
    );
  }
}

export function normalizeFieldReferenceKeys<T>(
  fieldDef: T,
  fieldName?: string,
  objectName?: string,
): T {
  if (!fieldDef || typeof fieldDef !== 'object') return fieldDef;
  const f = fieldDef as Record<string, unknown>;
  const target = f.reference_to ?? f.reference ?? f.referenceTo;
  if (target == null || target === '') return fieldDef;
  warnOnLegacyOnlyReference(f, fieldName, objectName);
  if (f.reference_to === undefined) f.reference_to = target;
  if (f.reference === undefined) f.reference = target;
  return fieldDef;
}

/**
 * Apply {@link normalizeFieldReferenceKeys} to every field of an object
 * schema. Accepts both field-container shapes the metadata API serves —
 * a `name → def` map or an array of defs — and tolerates anything else by
 * returning the input untouched. Mutates in place; idempotent.
 *
 * This is meant to run at the choke point where object schemas enter the
 * client (`ObjectStackAdapter.getObjectSchema`, the app-shell metadata
 * provider) so per-consumer dual-key fallbacks can't drift.
 *
 * Field NAMES and the OBJECT name are forwarded so the dev-mode warning above
 * can name the whole producer site rather than half of it: the map form keys
 * the def by name, the array form carries it as `def.name`, and the object name
 * comes off `schema.name`.
 */
export function normalizeSchemaReferenceKeys<T>(schema: T): T {
  const fields =
    schema && typeof schema === 'object' ? (schema as { fields?: unknown }).fields : null;
  if (!fields || typeof fields !== 'object') return schema;
  const objectName =
    typeof (schema as { name?: unknown }).name === 'string'
      ? ((schema as { name?: string }).name as string)
      : undefined;
  if (Array.isArray(fields)) {
    for (const def of fields) normalizeFieldReferenceKeys(def, undefined, objectName);
  } else {
    for (const [name, def] of Object.entries(fields as Record<string, unknown>)) {
      normalizeFieldReferenceKeys(def, name, objectName);
    }
  }
  return schema;
}
