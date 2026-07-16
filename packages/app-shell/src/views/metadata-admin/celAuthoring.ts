/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Author-time CEL safety for the RLS policy editor (objectui#2413).
 *
 * Row-Level Security `USING` (read filter) / `CHECK` (write filter) predicates
 * are the highest-risk authoring surface in the permission model: a typo in a
 * predicate silently produces the wrong row scope, and some evaluation paths
 * FAIL OPEN — a malformed read filter can WIDEN access with no visible error.
 * Yet the editor shipped as a bare `<textarea>` with zero validation.
 *
 * This module is the thin bridge from the editor to the framework's canonical
 * CEL engine, `@objectstack/formula` — the SAME parser/validator the server and
 * the `validate_expression` agent tool use — so the GUI, SDK, and CLI reach the
 * identical verdict rather than maintaining a second grammar (ADR-0032). It
 * exposes exactly the three author-time affordances the editor needs:
 *
 *   1. {@link lintCelPredicate}    — parse/field lint (surfaced inline as you type).
 *   2. {@link introspectCelScope}  — the valid field + scope identifiers (autocomplete).
 *   3. {@link testRunCelPredicate} — dry-run a predicate against a sample record.
 *
 * Progressive enhancement (mirrors `preview/capabilityLint.ts`): the engine is
 * loaded LAZILY via dynamic `import()` — it carries the CEL parser (cel-js), so
 * keeping it out of the main bundle matters and this rare admin surface is the
 * right place to pay that cost. Every entry point FEATURE-DETECTS the function
 * it needs and SWALLOWS any failure (import, missing export, throw): author-time
 * assistance must NEVER break or block the editor. A missing engine degrades to
 * "no lint / no suggestions / test-run unavailable", never to an exception.
 */

/** A schema hint for the predicate's target object — powers field-existence lint. */
export interface CelSchemaHint {
  /** The target object api-name (`*` / undefined => no field hints). */
  objectName?: string;
  /** Known field names of {@link objectName}, so `<field>` refs can be checked. */
  fields?: string[];
  /**
   * Which clause is being edited. `USING` is a read filter the server tries to
   * push down to the query; a non-pushdown-able read filter is the fail-open
   * blast-radius the issue calls out, so we advise on it (see {@link lintCelPredicate}).
   */
  clause?: 'using' | 'check';
  /**
   * Evaluation scope of the authoring site (mirrors the engine's
   * `ExprSchemaHint.scope`, objectui#1582):
   *  - `'flattened'` (default) — the record's fields are spread to bare
   *    top-level (RLS predicates, flow conditions), so `organization_id == …`
   *    is legal and an unknown bare identifier is only a warning.
   *  - `'record'` — the record is bound ONLY as the `record` namespace
   *    (field conditional rules `visibleWhen`/`readonlyWhen`/`requiredWhen`,
   *    formulas). A bare field ref silently evaluates to null at runtime, so
   *    the engine flags it as an ERROR with the `record.<field>` fix.
   */
  scope?: 'record' | 'flattened';
  /**
   * Override the scope roots offered by autocomplete. The engine advertises
   * every root ANY predicate site may see (`current_user`, `os`, `vars`, …),
   * but a given authoring surface binds only a subset — field conditional
   * rules bind exactly `record` / `previous` / `parent` (see
   * `@object-ui/core`'s `evalFieldPredicate`). Suggesting an unbound root
   * would author a predicate that silently never fires.
   */
  roots?: string[];
}

/** A single lint finding surfaced inline under the editor. */
export interface CelLintIssue {
  /** `error` blocks save (parse fault); `warning` is advisory (typo / blast-radius). */
  severity: 'error' | 'warning';
  message: string;
}

/** The in-scope identifiers an author may reference — the autocomplete catalog. */
export interface CelScopeInfo {
  /** The target object's field names (referenced BARE, e.g. `organization_id`). */
  fields: string[];
  /** Scope roots: `record`, `current_user`, `user`, `previous`, `input`, `os`, `vars`. */
  roots: string[];
  /** Callable CEL stdlib functions (`now`, `has`, `contains`, …). */
  functions: string[];
}

/** The sample scope an author supplies for a dry-run. */
export interface CelSampleContext {
  /** The candidate row the predicate is evaluated against. */
  record: Record<string, unknown>;
  /** The acting subject, bound verbatim as `current_user` / `user`. */
  currentUser: Record<string, unknown>;
}

/** The verdict of a dry-run — never throws; the UI branches on `status`. */
export type CelTestOutcome =
  /** Predicate returned boolean `true` — the row is IN scope (allowed). */
  | { status: 'allow' }
  /** Predicate returned boolean `false` — the row is OUT of scope (denied). */
  | { status: 'deny' }
  /** Predicate returned a non-boolean — an authoring smell (a filter must be bool). */
  | { status: 'value'; value: unknown }
  /** Parse / type / runtime fault — carries the engine's self-correcting message. */
  | { status: 'error'; kind: string; message: string }
  /** The CEL engine could not be loaded — the affordance is unavailable. */
  | { status: 'unavailable' };

/* ── Lazy engine loader (feature-detected, error-swallowing) ─────────── */

interface FormulaModule {
  validateExpression?: (
    role: string,
    input: unknown,
    schema?: unknown,
  ) => {
    ok: boolean;
    errors?: Array<{ message?: string }>;
    warnings?: Array<{ message?: string }>;
  };
  introspectScope?: (
    role: string,
    schema?: unknown,
  ) => { fields?: string[]; roots?: string[]; functions?: string[] };
  isPushdownableCel?: (
    input: string | { source?: string },
    opts?: { fieldRoots?: readonly string[]; variableRoots?: readonly string[] },
  ) => { ok: true } | { ok: false; reason: string; detail: string };
  ExpressionEngine?: {
    evaluate: (
      expr: { dialect: string; source: string },
      ctx: Record<string, unknown>,
    ) => { ok: true; value: unknown } | { ok: false; error?: { kind?: string; message?: string } };
  };
}

let loaderOverride: (() => Promise<FormulaModule | null>) | null = null;
let cached: Promise<FormulaModule | null> | null = null;

/**
 * Test seam — inject a fake engine (or `null` to simulate an unavailable one).
 * Pass `undefined` to restore the real lazy import. Mirrors the `ruleOverride`
 * seam in `preview/capabilityLint.ts`.
 */
export function __setCelFormulaLoader(
  loader: (() => Promise<FormulaModule | null>) | null | undefined,
): void {
  loaderOverride = loader ?? null;
  cached = null;
}

function loadFormula(): Promise<FormulaModule | null> {
  if (loaderOverride) return Promise.resolve(loaderOverride()).catch(() => null);
  if (!cached) {
    cached = import('@objectstack/formula')
      .then((m) => m as unknown as FormulaModule)
      .catch(() => null);
  }
  return cached;
}

/** Roots that denote a record FIELD path for pushdown analysis (`''` = bare). */
const PUSHDOWN_FIELD_ROOTS = ['record', ''] as const;
/** Roots resolved as scope VALUES for pushdown analysis. */
const PUSHDOWN_VARIABLE_ROOTS = ['current_user', 'user'] as const;

/* ── 1. Lint ─────────────────────────────────────────────────────────── */

/**
 * Validate one RLS predicate. Returns the findings to surface inline: parse
 * faults as `error` (block save), unknown-field near-misses and non-pushdown-able
 * read filters as `warning` (advisory).
 *
 * RLS predicates reference fields BARE (`organization_id == current_user.…`),
 * like a flattened flow condition — so a bare identifier is legal and an
 * unknown one is a non-blocking "did you mean" warning, never a hard error.
 * We never fail-CLOSED on a maybe-typo for a security surface: flag it, don't
 * silently narrow (or, worse, block) the author's row scope.
 *
 * Empty input is always clean.
 */
export async function lintCelPredicate(
  source: string,
  hint: CelSchemaHint = {},
): Promise<CelLintIssue[]> {
  if (!source || !source.trim()) return [];
  try {
    const mod = await loadFormula();
    if (!mod?.validateExpression) return [];
    const res = mod.validateExpression('predicate', source, {
      objectName: hint.objectName,
      fields: hint.fields,
      scope: hint.scope ?? 'flattened',
    });
    const issues: CelLintIssue[] = [];
    for (const e of res?.errors ?? []) {
      if (e?.message) issues.push({ severity: 'error', message: e.message });
    }
    for (const w of res?.warnings ?? []) {
      if (w?.message) issues.push({ severity: 'warning', message: w.message });
    }
    // Blast-radius advisory: a `USING` read filter the runtime can't push down
    // to the query is the fail-open case the issue calls out — the predicate may
    // be dropped and WIDEN access. Only meaningful once the predicate parses
    // (a parse fault already surfaced above), and only for the read clause.
    if (issues.every((i) => i.severity !== 'error') && hint.clause === 'using' && mod.isPushdownableCel) {
      try {
        const pd = mod.isPushdownableCel(source, {
          fieldRoots: PUSHDOWN_FIELD_ROOTS,
          variableRoots: PUSHDOWN_VARIABLE_ROOTS,
        });
        if (pd && pd.ok === false && pd.reason !== 'parse-error') {
          issues.push({
            severity: 'warning',
            message:
              `This read filter isn't a simple field comparison (${pd.detail}), so the ` +
              `server may be unable to push it down to the query — depending on the ` +
              `evaluation path it can be dropped and WIDEN access. Prefer a ` +
              `pushdown-able predicate (field vs. value or scope variable).`,
          });
        }
      } catch {
        /* advisory only — never let it break the lint */
      }
    }
    return issues;
  } catch {
    return [];
  }
}

/* ── 2. Autocomplete scope ───────────────────────────────────────────── */

/**
 * Introspect the identifiers valid in a predicate for {@link hint}'s object:
 * the object fields, the scope roots (`current_user`, `record`, …) and the
 * callable stdlib functions. Feeds the editor's autocomplete so the author
 * doesn't guess an identifier that silently never matches.
 *
 * Degrades to `{ fields: hint.fields, roots: [], functions: [] }` when the
 * engine (or the `introspectScope` export) is unavailable — the author keeps
 * field suggestions from metadata even with an older/absent engine.
 */
export async function introspectCelScope(hint: CelSchemaHint = {}): Promise<CelScopeInfo> {
  const fallback: CelScopeInfo = { fields: hint.fields ?? [], roots: hint.roots ?? [], functions: [] };
  try {
    const mod = await loadFormula();
    if (!mod?.introspectScope) return fallback;
    const res = mod.introspectScope('predicate', {
      objectName: hint.objectName,
      fields: hint.fields,
      scope: hint.scope ?? 'flattened',
    });
    return {
      fields: res?.fields ?? hint.fields ?? [],
      roots: hint.roots ?? res?.roots ?? [],
      functions: res?.functions ?? [],
    };
  } catch {
    return fallback;
  }
}

/* ── Autocomplete token/candidate helpers (pure) ─────────────────────── */

/** What an autocomplete entry represents — drives its badge and insert form. */
export type CelSuggestionKind = 'field' | 'root' | 'function';
export interface CelSuggestion {
  label: string;
  kind: CelSuggestionKind;
}

/** Chars that make up a CEL identifier segment. */
const IDENT_CHAR = /[A-Za-z0-9_$]/;
const IDENT_START = /[A-Za-z_$]/;
/** Cap on suggestions shown at once. */
export const MAX_CEL_SUGGESTIONS = 8;

/**
 * The identifier segment being typed immediately before `caret`, or `null` when
 * there is nothing to complete. A segment preceded by `.` is member access
 * (`current_user.org…`) — we can't know the member shape, so we suppress rather
 * than suggest a wrong top-level identifier (but see {@link memberTokenAt} for
 * the roots whose member shape IS known).
 */
export function tokenAt(
  text: string,
  caret: number,
): { start: number; end: number; text: string } | null {
  let start = caret;
  while (start > 0 && IDENT_CHAR.test(text[start - 1])) start--;
  if (start === caret) return null; // caret not at the end of an identifier run
  const seg = text.slice(start, caret);
  if (!IDENT_START.test(seg[0])) return null; // starts with a digit → not an identifier
  if (start > 0 && text[start - 1] === '.') return null; // member access → suppress
  return { start, end: caret, text: seg };
}

/**
 * The member segment being typed immediately after `<root>.` — e.g. caret at
 * the end of `record.sta` yields `{ root: 'record', text: 'sta' }`, and caret
 * right after `record.` yields `{ root: 'record', text: '' }` (so the full
 * field catalog can surface as soon as the dot is typed). Unlike
 * {@link tokenAt} the segment may be EMPTY, and only a single-level chain
 * qualifies: in `record.owner.name` the `name` segment's root is `owner`
 * (unknown shape), not `record`, so it returns `null` via the root's own
 * preceding-dot check. Returns `null` when the caret is not in a member
 * position (objectui#1582).
 */
export function memberTokenAt(
  text: string,
  caret: number,
): { root: string; start: number; end: number; text: string } | null {
  let start = caret;
  while (start > 0 && IDENT_CHAR.test(text[start - 1])) start--;
  const seg = text.slice(start, caret);
  if (seg && !IDENT_START.test(seg[0])) return null; // digit-led → not an identifier
  if (start === 0 || text[start - 1] !== '.') return null; // not member access
  // The identifier run immediately before the dot is the root.
  let rootStart = start - 1;
  while (rootStart > 0 && IDENT_CHAR.test(text[rootStart - 1])) rootStart--;
  const root = text.slice(rootStart, start - 1);
  if (!root || !IDENT_START.test(root[0])) return null;
  if (rootStart > 0 && text[rootStart - 1] === '.') return null; // deeper chain → unknown shape
  return { root, start, end: caret, text: seg };
}

/** Merge a scope into a single de-duplicated, ordered candidate catalog. */
export function buildCandidates(scope: CelScopeInfo): CelSuggestion[] {
  const seen = new Set<string>();
  const out: CelSuggestion[] = [];
  const push = (label: string, kind: CelSuggestionKind) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    out.push({ label, kind });
  };
  // Fields first (the author's own object), then scope roots, then functions.
  scope.fields.forEach((f) => push(f, 'field'));
  scope.roots.forEach((r) => push(r, 'root'));
  scope.functions.forEach((fn) => push(fn, 'function'));
  return out;
}

/**
 * Prefix-filter the catalog for `query` (case-insensitive), excluding exact
 * hits. An empty query yields nothing unless `allowEmpty` — member completion
 * wants the full (capped) catalog the moment the dot is typed, while bare
 * completion staying quiet until a character is typed avoids a popup on focus.
 */
export function filterCandidates(
  candidates: CelSuggestion[],
  query: string,
  allowEmpty = false,
): CelSuggestion[] {
  const q = query.toLowerCase();
  if (!q && !allowEmpty) return [];
  const out: CelSuggestion[] = [];
  for (const c of candidates) {
    const l = c.label.toLowerCase();
    if (l.startsWith(q) && l !== q) out.push(c);
    if (out.length >= MAX_CEL_SUGGESTIONS) break;
  }
  return out;
}

/* ── 3. Test-run ─────────────────────────────────────────────────────── */

/**
 * Dry-run a predicate against a sample scope and report allow / deny / value /
 * error. The scope is bound to match how the RLS runtime exposes data:
 *
 *   - `record`               the candidate row, as the `record` namespace;
 *   - the row's fields spread to BARE top-level (`organization_id`), so the
 *     flattened authoring convention (`organization_id == …`) resolves; and
 *   - `current_user` / `user` bound VERBATIM from the author's sample (no
 *     canonical renaming — `current_user.organization_id` resolves as typed).
 *
 * Never throws — the engine returns a discriminated result and any thrown
 * loader/eval fault collapses to `error` / `unavailable`.
 */
export async function testRunCelPredicate(
  source: string,
  sample: CelSampleContext,
): Promise<CelTestOutcome> {
  if (!source || !source.trim()) {
    return { status: 'error', kind: 'parse', message: 'The predicate is empty.' };
  }
  let mod: FormulaModule | null;
  try {
    mod = await loadFormula();
  } catch {
    return { status: 'unavailable' };
  }
  if (!mod?.ExpressionEngine?.evaluate) return { status: 'unavailable' };
  try {
    const record = sample.record ?? {};
    const currentUser = sample.currentUser ?? {};
    const ctx = {
      record,
      extra: { ...record, record, current_user: currentUser, user: currentUser },
    };
    const res = mod.ExpressionEngine.evaluate({ dialect: 'cel', source }, ctx);
    if (!res || res.ok !== true) {
      const err = res && res.ok === false ? res.error : undefined;
      return {
        status: 'error',
        kind: err?.kind ?? 'runtime',
        message: err?.message ?? 'Evaluation failed.',
      };
    }
    if (res.value === true) return { status: 'allow' };
    if (res.value === false) return { status: 'deny' };
    return { status: 'value', value: res.value };
  } catch (e) {
    return { status: 'error', kind: 'runtime', message: (e as Error)?.message ?? String(e) };
  }
}
