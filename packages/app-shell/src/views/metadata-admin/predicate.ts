// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Tiny predicate evaluator for FormView `visibleOn` expressions.
 *
 * This is an interim stand-in for the full CEL runtime
 * (`@objectstack/formula`) — we keep it intentionally small so the
 * Setup admin engine has zero new runtime dependencies. When CEL is
 * unified across the platform (ROADMAP M9), swap `evaluatePredicate`
 * for the real CEL evaluator without touching SchemaForm.tsx.
 *
 * Supported subset (covers everything used in spec `*.form.ts` today):
 *   - `path == 'literal'`       string equality
 *   - `path != 'literal'`       string inequality
 *   - `path == 123`             number equality
 *   - `path == true|false`      boolean equality
 *   - `path in ['a','b']`       membership
 *   - `!path`                   negation (truthy)
 *   - `path`                    truthy check
 *   - `path && expr`            conjunction
 *   - `path || expr`            disjunction
 *
 * Paths support dot notation: `data.type`, `data.config.kind`.
 *
 * On any parse error → returns `true` (fail-open): better to show a
 * field than to silently hide it.
 *
 * ## Unresolvable identifiers also fail OPEN (objectstack#6936)
 *
 * The fail-open promise above used to cover only *thrown* errors. A path whose
 * ROOT identifier does not exist in the evaluation scope took a different route:
 * `resolveValue` returned `undefined`, and then every comparison quietly judged
 * it false — `['text','number'].includes(undefined)`, `undefined === 'text'` —
 * so a predicate referencing a name that isn't there HID the field. Fail-CLOSED,
 * the exact opposite of what this header promised, and undiagnosable: the
 * symptom is "the config item is gone", with nothing in the console.
 *
 * That is not hypothetical. `@objectstack/spec` ≤ 17.0.0-rc.5 spells the
 * `objectForm` sub-field predicates bare (`type in ['text',…]`) while this
 * engine evaluates them against a `{ data: draftRow }` scope, so a frontend
 * upgraded ahead of its backend resolved `type` to nothing and 16 type-
 * conditional Studio sub-fields (Min / Max / Precision / Scale / Max Length /
 * Min Length / reference / deleteBehavior / expression / returnType /
 * autonumberFormat / language …) vanished at once. objectstack#6254 re-spells
 * them `data.type`; this evaluator must not turn the version-skew window into
 * silent feature loss.
 *
 * Maintainer ruling on objectstack#6936 (option C): an unresolvable path makes
 * the predicate evaluate `true`, and dev mode says so, naming the path and the
 * predicate that carried it.
 *
 * ### The boundary this draws — read before widening it
 *
 * "Unresolvable" means **the path's root identifier is not a name this scope
 * declares** (`type`, `record.status`, `page.selectedId` against a scope whose
 * only name is `data`). It does NOT mean "the value came out undefined":
 *
 *   - `data.type == 'text'` on a draft that has no `type` yet → the root `data`
 *     resolves, the draft simply has no value there. That is a legitimate
 *     `undefined` VALUE, it compares false, and the field stays hidden. A draft
 *     is allowed to be empty; treating an unfilled field as "unresolvable"
 *     would show every type-conditional sub-field at once on a fresh row.
 *   - `data.tpye == 'text'` — a typo one segment deep — is indistinguishable
 *     from the above WITHOUT the schema, which this evaluator does not have.
 *     Catching that is the producer's job (publish-time validation of predicate
 *     path references, filed separately), not something the renderer may guess
 *     at. Commandment #0.1: one strict contract at the producer beats a
 *     renderer heuristic.
 *
 * The signal is a thrown {@link UnresolvedPathError}, deliberately not a
 * sentinel value: fail-open is a property of the WHOLE predicate, not of the
 * sub-expression that failed. A sentinel would have to be threaded through
 * `!`, `&&`, `||`, `in` and `==` by hand, and the first spot that missed it
 * would invert the verdict — `!unresolvedPath` would evaluate the inner path to
 * "true-ish" and then negate it back to false, i.e. fail-CLOSED again, which is
 * the bug. Throwing routes every failure to the one fail-open gate that already
 * exists.
 *
 * Two consequences of evaluating in CEL order, both pinned in `predicate.test.ts`:
 * `false && <unresolvable>` is `false` and `true || <unresolvable>` is `true` —
 * the unresolvable half is short-circuited away, absorbed exactly as CEL absorbs
 * an erroring branch, and no warning fires because nothing needed it.
 */

export function evaluatePredicate(
  expr: string | { dialect?: string; source: string } | null | undefined,
  ctx: { data: Record<string, unknown> },
): boolean {
  if (expr == null) return true;
  const source = typeof expr === 'string' ? expr : expr.source;
  if (!source) return true;
  try {
    return evalExpr(source.trim(), ctx);
  } catch (err) {
    // Fail-open either way; an unresolvable path additionally gets a name.
    if (err instanceof UnresolvedPathError) warnUnresolvedPath(err.path, source);
    return true;
  }
}

/**
 * Signalled when a path's root identifier is not a name in the evaluation
 * scope. Carries the path so the top-level handler can name it alongside the
 * predicate source (which only the top level knows).
 */
class UnresolvedPathError extends Error {
  constructor(readonly path: string) {
    super(`unresolved predicate path: ${path}`);
    this.name = 'UnresolvedPathError';
  }
}

// Warn once per (path, predicate) pair, not once per evaluation: these
// predicates run on every keystroke of the form they gate, and a warning that
// floods the console is a warning that gets muted. Keyed by the predicate
// source as well as the path, deliberately — keying on the path alone would
// report the FIRST predicate referencing `type` and stay silent about the other
// fifteen, sending the author to fix one row of a systemic problem. Mirrors
// `warnOnUnknownActionKeys` in `@object-ui/core` (`actions/actionKeys.ts`).
const warnedUnresolvedPaths = new Set<string>();

/** Reset the warn-once memo. Exported for tests. */
export function resetPredicateWarnings(): void {
  warnedUnresolvedPaths.clear();
}

const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV !==
  'production';

function warnUnresolvedPath(path: string, source: string): void {
  if (!isDev()) return;
  const memo = `${path}::${source}`;
  if (warnedUnresolvedPaths.has(memo)) return;
  warnedUnresolvedPaths.add(memo);
  const root = path.split('.')[0];
  console.warn(
    `[metadata-admin] visibility predicate \`${source}\` references \`${path}\`, but \`${root}\` ` +
      'is not a name in this form\'s evaluation scope — the only name is `data` (the current draft). ' +
      'The predicate was treated as TRUE (fail-open) so the field stays visible instead of ' +
      'disappearing without a trace; check the spelling — draft values are addressed as `data.<field>` ' +
      '(e.g. `data.type in [...]`). A predicate served by an older backend is the usual cause ' +
      '(objectstack#6254 re-spelled the bare `objectForm` predicates; objectstack#6936).',
  );
}

function evalExpr(
  expr: string,
  ctx: { data: Record<string, unknown> },
): boolean {
  // Handle || (lowest precedence)
  const orParts = splitTopLevel(expr, '||');
  if (orParts.length > 1) {
    return orParts.some((p) => evalExpr(p.trim(), ctx));
  }
  // Handle &&
  const andParts = splitTopLevel(expr, '&&');
  if (andParts.length > 1) {
    return andParts.every((p) => evalExpr(p.trim(), ctx));
  }
  // Handle negation
  if (expr.startsWith('!')) {
    return !evalExpr(expr.slice(1).trim(), ctx);
  }
  // Handle 'in'
  const inMatch = expr.match(/^(.+?)\s+in\s+(\[.*\])$/);
  if (inMatch) {
    const left = resolveValue(inMatch[1].trim(), ctx);
    const right = parseLiteral(inMatch[2]);
    return Array.isArray(right) && right.includes(left as never);
  }
  // Handle == / != (CEL-style loose equality: null == undefined)
  const eqMatch = expr.match(/^(.+?)\s*(==|!=)\s*(.+)$/);
  if (eqMatch) {
    const left = resolveValue(eqMatch[1].trim(), ctx);
    const right = parseLiteral(eqMatch[3].trim());
    const nullish = (v: unknown) => v === null || v === undefined;
    const equal = nullish(left) && nullish(right) ? true : left === right;
    return eqMatch[2] === '==' ? equal : !equal;
  }
  // Bare truthy check
  return Boolean(resolveValue(expr, ctx));
}

function splitTopLevel(expr: string, op: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let buf = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inStr) {
      buf += ch;
      if (ch === inStr && expr[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inStr = ch;
      buf += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (
      depth === 0 &&
      expr.slice(i, i + op.length) === op &&
      // Not a sub-operator (e.g. == when looking for =)
      expr[i + op.length] !== '='
    ) {
      out.push(buf);
      buf = '';
      i += op.length - 1;
      continue;
    }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function resolveValue(
  path: string,
  ctx: { data: Record<string, unknown> },
): unknown {
  // Allow literals on the left side too.
  if (/^['"]/.test(path) || /^-?\d/.test(path) || path === 'true' || path === 'false' || path === 'null') {
    return parseLiteral(path);
  }
  const segs = path.split('.');
  // The root identifier must be a name the scope actually declares. `hasOwn`,
  // not `in`: `constructor`/`toString` are inherited, and resolving them to
  // `Object`'s members would compare a function against a string literal (false,
  // silently) instead of reporting a path the author cannot have meant.
  if (!Object.prototype.hasOwnProperty.call(ctx, segs[0])) {
    throw new UnresolvedPathError(path);
  }
  let cur: any = ctx;
  for (const seg of segs) {
    // A nullish value part-way down is a VALUE fact, not a resolution failure:
    // `data.config.kind` on a draft with no `config` means the draft has no
    // value there, which compares false. See the header's boundary note.
    if (cur == null) return undefined;
    cur = cur[seg];
  }
  return cur;
}

function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      // JSON-parse after normalising single-quoted strings to double.
      const json = s.replace(/'([^']*)'/g, (_, inner) => JSON.stringify(inner));
      return JSON.parse(json);
    } catch {
      return [];
    }
  }
  return s;
}
