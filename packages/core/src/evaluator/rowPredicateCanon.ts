/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The row-predicate spelling CANON, and the Phase-1 deprecation warning for the
 * two spellings that are not it (objectui#5330).
 *
 * ## The canon (maintainer ruling, 2026-08-20 — option B)
 *
 * A row predicate — `visible` / `disabled` / `enabled` on an action renderer, a
 * row scope, a `record:alert` — binds the row THREE ways today: canonical
 * `record.status`, bare shorthand `status`, and legacy `data.status`
 * (objectui#4075 / PR #4079 bound all four action renderers all three ways to
 * restore consistency, deliberately without deciding which of them is
 * CONTRACT). This module is where that decision now lives:
 *
 * > **The canon is `record.*`.** The bare shorthand and `data.*` are
 * > client-side tolerances in a deprecation window, kept because stored
 * > metadata carries them, warned about here, and removable only after a
 * > stored-metadata survey sizes the window (⛔ no removal before the survey).
 *
 * It mirrors the objectstack#7917 option-② precedent for the identical shape (a
 * renderer tolerance quietly becoming a second de-facto contract — AGENTS.md
 * #0.1), whose objectui half is `utils/dashboard-filters.ts`' bare-string
 * `options` shorthand: same three phases, same reason the warning is not
 * decoration (ADR-0078 — nothing silently inert; a tolerance nothing ever
 * reports can never be retired, because nothing would ever show that the last
 * document carrying it is gone).
 *
 * ## The canon states the SERVER's accept set, not this client's
 *
 * The ruling made that the dev's first measurement, because a canon that only
 * describes the renderer would be the very thing it exists to end. Measured
 * against `@objectstack/formula@17.1.0` — the engine the server evaluates with,
 * and the one `fieldRules.ts` already delegates to:
 *
 * | spelling | server runtime (`buildScope` + `celEngine`) | server authoring oracle |
 * |---|---|---|
 * | `record.status` | ✅ `{ ok: true, value: true }` | ✅ accepted |
 * | bare `status`   | ❌ `Unknown variable: status` | ❌ refused (`'status'`) |
 * | `data.status`   | ❌ `Unknown variable: data`   | ⚠️ **silently accepted** |
 *
 * `buildScope({ record })` mounts exactly `['record']` — `data` is never bound
 * and the row's fields are never flattened to top level. So **the server
 * accepts `record.*` and nothing else**; both other spellings fault there. The
 * three-way binding is a client tolerance with no server counterpart, which is
 * precisely why it is the client's job to warn.
 *
 * ⚠️ The `data.*` row is the dangerous one and the reason this warning exists
 * at all. `data` IS in `@objectstack/formula`'s `SCOPE_ROOTS`, so the server's
 * bare-identifier oracle waves `data.status` through — that list is a
 * deliberately generous "never faults" LINT BASELINE, not the runtime accept
 * set. A `data.*` row predicate therefore passes every authoring gate the
 * platform has and then binds nothing at runtime: it is not an error, it is a
 * constant `false`, and a `visible` that is constantly false is a button that
 * silently never appears. That is the #4075 fail-closed family's exact
 * signature, and this client is the only layer positioned to catch it.
 *
 * ## `data.*` is DEPRECATED HERE, not everywhere — the canon is layer-scoped
 *
 * `data` is the CANONICAL root one layer over, in a metadata-editing form (the
 * row under edit): objectstack's `CANONICAL_ROOT_BY_LAYER` reads
 * `{ runtime: 'record', metadata: 'data' }` (ADR-0089 D3), and objectui's own
 * `app-shell` metadata-admin `SchemaForm` binds `{ data: row }` on purpose. So
 * `data.*` is not a legacy alias to be deprecated platform-wide — it is a
 * WRONG-LAYER paste on a runtime record surface, and only that is what this
 * module reports. Stating the deprecation unqualified would contradict
 * ADR-0089 D3 and break the metadata-editing layer's own contract.
 *
 * ## Why the detection reuses the server's oracle instead of a regex
 *
 * `collectCelRootIdentifiers` and `firstUndeclaredReference` are
 * `@objectstack/formula` exports — the same two oracles objectstack's
 * `visibility-bare-identifier` gate uses. Reading roots off the canonical AST
 * rather than pattern-matching the source is what keeps this from inventing a
 * second dialect judgement client-side: a string this module cannot parse is
 * NOT this module's verdict to give (syntax belongs to the gates that own it),
 * and it stands down rather than guessing.
 */

import { collectCelRootIdentifiers, firstUndeclaredReference } from '@objectstack/formula';

/** The one canonical row-predicate root. */
export const ROW_PREDICATE_CANONICAL_ROOT = 'record';

/**
 * The metadata-editing-form root (ADR-0089 D3). Canonical on THAT layer, and a
 * wrong-layer paste on a runtime record surface — see the module note.
 */
const METADATA_LAYER_ROOT = 'data';

/** A non-canonical row-predicate spelling, and the edit that fixes it. */
export type NonCanonicalRowSpelling =
  | {
      /** Bare shorthand: `status == 'active'` — a field of THIS row, unrooted. */
      kind: 'bare-shorthand';
      /** The offending identifier (`status`). */
      identifier: string;
      /** What the author should write instead (`record.status`). */
      canonical: string;
    }
  | {
      /** Wrong-layer root: `data.status == 'active'` on a runtime record surface. */
      kind: 'metadata-layer-root';
      identifier: string;
      canonical: string;
    };

/**
 * Detect a non-canonical spelling in ONE row predicate, or `null` when the
 * predicate is already canonical (or is not this module's verdict to give).
 *
 * Deliberately conservative in both arms — every condition below can only
 * REMOVE a finding, never invent one, because a false deprecation warning sends
 * an author to rewrite a predicate that was correct:
 *
 * - **Unparseable source** → `null`. Syntax is another gate's verdict.
 * - **Bare shorthand** is reported only when the undeclared identifier is an own
 *   key of THIS row. That is what makes it unambiguously the #4075 shorthand
 *   rather than a host-scope global this module cannot see (a deployment key
 *   that is simply not in `SCOPE_ROOTS` would otherwise read as a bare field).
 * - **`data.*`** is reported only when the caller confirms `data` names the row
 *   (`dataNamesRow`). A surface whose `data` is the host scope's own — a
 *   `rowless` dialog, a metadata-editing form — is a legitimate `data.*` site
 *   and is left alone.
 *
 * Only the FIRST finding is returned, and the bare-shorthand arm is checked
 * first: it is the arm the server refuses outright (`visibility-bare-identifier`
 * is an `error` there, while a mis-layered root is a `warning`), so when a
 * predicate manages both it is the one the author must fix to have anything
 * evaluate at all.
 *
 * @param source       The predicate's CEL text. Callers must have already
 *                     routed legacy `${…}`-dialect strings elsewhere — in that
 *                     dialect `data.*` is the NORMAL spelling, and reporting it
 *                     here would be a false positive on every legacy predicate.
 * @param row          The row the predicate is bound against.
 * @param dataNamesRow Whether `data` is bound to that same row on this surface.
 */
export function detectNonCanonicalRowSpelling(
  source: string,
  row: Record<string, unknown> | null | undefined,
  dataNamesRow: boolean,
): NonCanonicalRowSpelling | null {
  if (typeof source !== 'string' || !source.trim()) return null;

  const roots = collectCelRootIdentifiers(source);
  // Not parseable through the canonical front end — not our verdict.
  if (!roots || roots.ok !== true) return null;

  // (1) Bare shorthand — the arm the server refuses outright.
  const bare = firstUndeclaredReference(source);
  if (
    typeof bare === 'string' &&
    row != null &&
    typeof row === 'object' &&
    Object.prototype.hasOwnProperty.call(row, bare)
  ) {
    return {
      kind: 'bare-shorthand',
      identifier: bare,
      canonical: `${ROW_PREDICATE_CANONICAL_ROOT}.${bare}`,
    };
  }

  // (2) Wrong-layer `data.*` root — silent at runtime on the server.
  if (dataNamesRow && Array.isArray(roots.roots) && roots.roots.includes(METADATA_LAYER_ROOT)) {
    return {
      kind: 'metadata-layer-root',
      identifier: METADATA_LAYER_ROOT,
      canonical: ROW_PREDICATE_CANONICAL_ROOT,
    };
  }

  return null;
}

/**
 * Dev-mode gate, matching `utils/dashboard-filters.ts` and `actions/actionKeys.ts`
 * — a deprecation warning that floods a production console is a warning that
 * gets muted.
 */
const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.NODE_ENV !== 'production';

/**
 * Warn-once memo, keyed by the `(label, predicate source)` pair — the same
 * identity `warnEvalError` uses, and JSON-encoded for the same reason: the
 * separator that boundary once used was a raw U+0000, which made the file
 * carrying it binary to grep (objectstack#5450). Keying on the source alone
 * would report the first surface carrying a shorthand `status` predicate and
 * stay silent about every other one; the label is what sends the author to the
 * right screen.
 *
 * Module scope, not per-call: these predicates are re-evaluated on every row of
 * every render, so per-call state would warn once per frame — the flood the
 * dedupe exists to prevent.
 */
const warnedSpellings = new Set<string>();

/** Reset the row-predicate spelling warn-once memo. Exported for tests. */
export function resetRowPredicateCanonWarnings(): void {
  warnedSpellings.clear();
}

/**
 * Report a non-canonical row-predicate spelling once, in dev.
 *
 * Phase 1 of the objectui#5330 window: the binding is UNCHANGED and every
 * spelling still resolves — this only says so out loud, so the stored
 * population stops growing and a later survey has something to count. It is a
 * warning and deliberately not a refusal: turning it into one would move the
 * accept/reject set, which this card is explicitly not entitled to do.
 */
export function warnNonCanonicalRowSpelling(
  source: string,
  row: Record<string, unknown> | null | undefined,
  dataNamesRow: boolean,
  label?: string,
): void {
  if (!isDev()) return;
  const finding = detectNonCanonicalRowSpelling(source, row, dataNamesRow);
  if (!finding) return;

  const key = JSON.stringify([label ?? '', source, finding.kind]);
  if (warnedSpellings.has(key)) return;
  warnedSpellings.add(key);

  const where = label ? ` (${label})` : '';
  const detail =
    finding.kind === 'bare-shorthand'
      ? `it references the bare field ${JSON.stringify(finding.identifier)}; ` +
        `the server refuses that spelling outright ("Unknown variable: ${finding.identifier}")`
      : 'it is rooted at `data.`, which is the metadata-editing-form root — on a ' +
        'record surface the server binds no `data` at all, so the predicate is a ' +
        'constant false there rather than an error';

  console.warn(
    `[object-ui] A row predicate${where} uses a DEPRECATED spelling: ` +
      `${JSON.stringify(source)} — ${detail}. The canon is \`record.*\` ` +
      `(objectui#5330, ruled 2026-08-20): write \`${finding.canonical}\`. ` +
      'This still evaluates here for now; the tolerance retires after a ' +
      'stored-metadata survey.',
  );
}
