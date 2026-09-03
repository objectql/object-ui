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
 * is the cheap defence-in-depth pin it named: **keys outside the protocol are
 * not parsed, but not silently.** `@objectstack/spec` 17.2.0's `FieldSchema` is
 * strict and refuses `reference_to`, `referenceTo` and `target` by name with
 * `unrecognized_keys`, each carrying its own "did you mean → `reference`"
 * rename (measured on the installed package, with `reference` as the positive
 * control and a nonsense key as the negative one — the nonsense key gets no
 * rename hint, so the hint is alias-table membership, not boilerplate). So a
 * def that reaches this choke point spelling ONLY a legacy key came from a
 * producer the spec would reject, and the producer is where it gets fixed.
 *
 * ⛔ The stamping itself is deliberately UNCHANGED. It is the only thing
 * standing between a BYO `DataSource` and the break, and retiring it is a
 * separate decision with its own weight — not this card's.
 */

/**
 * Warn once per (field name, legacy spelling) rather than once per call: the
 * adapter re-serves a cached schema and `MetadataProvider` re-normalizes on
 * every metadata refresh, and a warning that floods the console is a warning
 * that gets muted. Keyed by the PAIR rather than by a single global flag so a
 * schema whose producer mis-spells several fields reports each of them — the
 * author has to fix every producer, not just the first one seen. This mirrors
 * `column-identity.ts`'s `warnedConflicts` memo, for the same reason it gives.
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
function warnOnLegacyOnlyReference(f: Record<string, unknown>, fieldName?: string): void {
  if (!isDev()) return;
  if (f.reference !== undefined) return;
  const spelled = LEGACY_REFERENCE_KEYS.filter((k) => f[k] !== undefined && f[k] !== '');
  if (spelled.length === 0) return;
  const named = fieldName ?? (typeof f.name === 'string' ? f.name : '(unnamed)');
  for (const key of spelled) {
    const memo = `${named}:${key}:${String(f[key])}`;
    if (warnedLegacyOnly.has(memo)) continue;
    warnedLegacyOnly.add(memo);
    console.warn(
      `[ObjectUI] Field \`${named}\` declares its relationship target as ` +
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

export function normalizeFieldReferenceKeys<T>(fieldDef: T, fieldName?: string): T {
  if (!fieldDef || typeof fieldDef !== 'object') return fieldDef;
  const f = fieldDef as Record<string, unknown>;
  const target = f.reference_to ?? f.reference ?? f.referenceTo;
  if (target == null || target === '') return fieldDef;
  warnOnLegacyOnlyReference(f, fieldName);
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
 * Field NAMES are forwarded so the dev-mode warning above can name the
 * offending field: the map form keys the def by name, and the array form
 * carries it as `def.name`.
 */
export function normalizeSchemaReferenceKeys<T>(schema: T): T {
  const fields =
    schema && typeof schema === 'object' ? (schema as { fields?: unknown }).fields : null;
  if (!fields || typeof fields !== 'object') return schema;
  if (Array.isArray(fields)) {
    for (const def of fields) normalizeFieldReferenceKeys(def);
  } else {
    for (const [name, def] of Object.entries(fields as Record<string, unknown>)) {
      normalizeFieldReferenceKeys(def, name);
    }
  }
  return schema;
}
