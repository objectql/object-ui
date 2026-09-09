/**
 * ObjectUI — object-schema key canonicalization at ingestion
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * ⚠️ The FILE and its exports still say `reference`; the pass no longer does
 * only that. The `reference` / `reference_to` pair was the first tenant, and
 * objectui#7650 added the retired-dialect arm below, which folds ANY undeclared
 * snake twin of a declared `FieldSchema` key. Renaming the exports would be a
 * published-export change across ~20 in-repo citations and belongs to its own
 * card; the two arms are marked so the name cannot mislead a reader who got
 * here from a grep.
 */

import { FieldSchema } from '@objectstack/spec/data';

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
 * ## ⭐ THE RETIRED-DIALECT ARM — objectui#7650
 *
 * The `reference` pair above is one instance of a general problem this file is
 * now the choke point for. objectui#7650 measured the shape of it:
 *
 * > The strict schema gates the WRITE door — `PUT /api/v1/meta/object/:name`
 * > refuses a document carrying an undeclared key. It does not gate the READ
 * > door.
 *
 * `ObjectStackAdapter.getObjectSchema` fetches the object document and returns
 * it with exactly two mutations applied and NO `ObjectSchema.parse` anywhere on
 * the path. So a document stored BEFORE a key was tightened is served, verbatim,
 * to every consumer, forever — it cannot be re-saved through the strict door,
 * but nothing ever asks it to be.
 *
 * That is why "no spec-compliant producer can emit this key" and "this consumer
 * read can never fire" are DIFFERENT claims. Several retirement cards in this
 * family (objectui#7155, #7166, #7435) narrowed consumer reads to the camelCase
 * spelling on the strength of the first claim alone. This arm supplies the
 * second half for them, exactly as objectui#6837 half 2 supplied it for
 * `reference_to`: the legacy spelling is canonicalised ONCE, here, at ingestion,
 * and never at a consumer.
 *
 * ## How the fold is DERIVED, and why it is not a table
 *
 * Maintainer route ruling (2026-09-09, objectui#7650 comment 5605081157): fold
 * by the spec's OWN alias-probe rule — lowercase, strip `_`, `-` and space —
 * matched EXACTLY against `FieldSchema`'s declared key set, which this repo can
 * read off `FieldSchema.shape`.
 *
 * Two properties of that rule are the reason it was chosen over a hand-written
 * three-row table:
 *
 *   - `id_field` needs NO special case. It probes to `idfield`, which matches no
 *     declared key — `FieldSchema` has no `idField`, the spec's only `idField`
 *     sits on `InlineGridColumnSchema` — so it lands in the leave arm on its
 *     own. `title_format` likewise (no declared `titleFormat`).
 *   - A TYPO is not folded. `sortible` probes to `sortible`, which matches no
 *     declared key, so it is left alone. ⛔ This is why the spec's published
 *     `lintAuthoredRecordKeys` is NOT called here: it falls through to a
 *     Levenshtein matcher when no `to` row exists, and would answer "did you
 *     mean `sortable`?" for that typo. A serve path that silently CORRECTS a
 *     typo is worse than the defect it is fixing.
 *
 * ⚠️ "Leave arm", not "drop arm" in the destructive sense: a key this arm does
 * not fold is left on the document EXACTLY as served. Nothing here removes a
 * key or a value. Dropping the legacy key was weighed on objectui#7650 and
 * REFUSED — a stored legacy document would lose the value instead of arriving
 * canonical, and silent data loss on a serve path is the worst of the shapes.
 *
 * ⛔ The `id_field` slice is BLOCKED, and not on a card. `@objectstack/spec`'s
 * `FIELD_KEY_GUIDANCE` grew an `id_field` row explaining why the key has no
 * successor, but that row is in NO PUBLISHED version — measured against 17.3.0
 * (installed) and 17.4.0 (newest on npm), both zero occurrences, with
 * `startingNumber` as the lit control in the same read. What is missing is a
 * RELEASE, not a decision. Quoting that sentence from a local copy here was
 * refused (a second copy of contract prose is the drift AGENTS.md #0.1 exists
 * to stop) and so was reading it optionally with a local fallback (an invisible
 * fallback that silently degrades on an older spec is this card's own defect
 * class). Until the cut lands, `id_field` is simply left alone.
 *
 * ## What this arm deliberately does NOT do
 *
 * ⛔ It never overwrites. A canonical key the producer already set keeps the
 * producer's value, whatever the legacy twin says — the same rule the
 * `reference` arm follows, for the same reason.
 * ⛔ It never folds a key `FieldSchema` already declares: those are canonical by
 * definition and skipping them is what keeps the pass idempotent.
 * ⛔ It folds nothing onto an AMBIGUOUS probe. If two declared keys ever collide
 * under the probe rule, that probe folds nothing rather than picking one.
 * Measured on 17.3.0: 74 declared keys, zero collisions. The guard is here so a
 * later spec addition cannot silently start choosing.
 */
const aliasProbe = (key: string): string => key.toLowerCase().replace(/[_\-\s]/g, '');

/** Memoized `FieldSchema` readings — see {@link fieldKeyFolds}. */
let declaredFieldKeys: ReadonlySet<string> | null = null;
let probeFolds: ReadonlyMap<string, string> | null = null;

/**
 * `probe -> canonical declared key`, derived once from `FieldSchema.shape`.
 *
 * Derived rather than listed on purpose: a table would have to be edited every
 * time the spec grows a camel key whose snake twin is still in stored
 * documents, and the edit that does not happen is the bug.
 *
 * ⛔ Deliberately NOT reset-able and deliberately not exported: the key set is a
 * property of the linked `@objectstack/spec`, so it cannot change while the
 * process runs, and a reset hook would be public API bought for nothing. The
 * collision guard above is therefore unexercised BY CONSTRUCTION today — the
 * pin that keeps it honest asserts the zero-collision precondition against the
 * real spec, so the day a collision appears the pin says so before the guard
 * has to.
 */
function fieldKeyFolds(): ReadonlyMap<string, string> {
  if (probeFolds) return probeFolds;
  const declared = Object.keys(FieldSchema.shape as Record<string, unknown>);
  const seen = new Map<string, string | null>();
  for (const key of declared) {
    const probe = aliasProbe(key);
    seen.set(probe, seen.has(probe) ? null : key);
  }
  const folds = new Map<string, string>();
  for (const [probe, key] of seen) if (key !== null) folds.set(probe, key);
  declaredFieldKeys = new Set(declared);
  probeFolds = folds;
  return folds;
}

/**
 * Warn once per (OBJECT, field, legacy spelling, canonical) — same four-segment
 * reasoning as {@link warnedLegacyOnly}, which the docblock below sets out.
 */
const warnedRetiredSpelling = new Set<string>();

/**
 * Stamp the canonical spelling for every retired-dialect key on one field def.
 *
 * Runs for EVERY field def, not only relational ones: `display_field` and
 * friends live on fields that carry no relationship target at all, so gating
 * this on the reference arm's early return would have covered almost nothing.
 *
 * `Object.keys` snapshots before the loop, so the canonical keys stamped inside
 * it are never themselves re-examined.
 */
function canonicalizeRetiredFieldKeys(
  f: Record<string, unknown>,
  fieldName?: string,
  objectName?: string,
): void {
  const folds = fieldKeyFolds();
  for (const key of Object.keys(f)) {
    if (declaredFieldKeys!.has(key)) continue;
    const canonical = folds.get(aliasProbe(key));
    if (canonical === undefined) continue;
    const value = f[key];
    if (value === undefined) continue;
    if (f[canonical] !== undefined) continue;
    f[canonical] = value;
    if (!isDev()) continue;
    const named = fieldName ?? (typeof f.name === 'string' ? f.name : '(unnamed field)');
    const owner = objectName ?? '(unknown object)';
    const memo = `${owner}:${named}:${key}:${canonical}`;
    if (warnedRetiredSpelling.has(memo)) continue;
    warnedRetiredSpelling.add(memo);
    console.warn(
      `[ObjectUI] Object \`${owner}\`, field \`${named}\` carries the retired spelling ` +
        `\`${key}\`. \`@objectstack/spec\`'s \`FieldSchema\` declares \`${canonical}\` and ` +
        `does not declare \`${key}\`, so a producer emitting it would be refused at the ` +
        `metadata write door. ObjectUI stamps \`${canonical}\` here so this stored def still ` +
        `renders, but the consumers no longer carry a \`${key}\` fallback of their own — fix ` +
        `the PRODUCER, or migrate the stored document. (objectui#7650)`,
    );
  }
}

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

/** Reset the warn-once memos. Exported for tests. */
export function resetReferenceKeyWarnings(): void {
  warnedLegacyOnly.clear();
  warnedRetiredSpelling.clear();
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
  // Runs FIRST and unconditionally: the retired dialect is not relational, so
  // the reference arm's early return below would skip almost every def that
  // needs it (objectui#7650).
  canonicalizeRetiredFieldKeys(f, fieldName, objectName);
  const target = f.reference_to ?? f.reference ?? f.referenceTo;
  if (target == null || target === '') return fieldDef;
  warnOnLegacyOnlyReference(f, fieldName, objectName);
  if (f.reference_to === undefined) f.reference_to = target;
  if (f.reference === undefined) f.reference = target;
  return fieldDef;
}

/**
 * Apply {@link normalizeFieldReferenceKeys} to every field of an object
 * schema — BOTH arms: the `reference` pair and the retired dialect. Accepts
 * both field-container shapes the metadata API serves — a `name → def` map or
 * an array of defs — and tolerates anything else by returning the input
 * untouched. Mutates in place; idempotent.
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
