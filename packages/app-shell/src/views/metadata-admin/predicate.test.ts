// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectstack#6936 — an unresolvable predicate path must fail OPEN, loudly.
 *
 * `predicate.ts` promised fail-open in its header and delivered it only for
 * *thrown* errors. A path whose root identifier did not exist in the scope
 * resolved to `undefined`, and then `['text'].includes(undefined)` /
 * `undefined === 'text'` judged the predicate false — the field disappeared with
 * no diagnostic. Maintainer ruling (option C, 2026-08-09): unresolvable path →
 * `true`, plus a dev-mode warning naming the path and the predicate.
 *
 * The tests below pin the SEMANTIC BOUNDARY as much as the new verdict, because
 * the boundary is the part that is easy to get wrong in either direction:
 *
 *   unresolvable ROOT identifier   → fail-open `true` + one warning
 *   root resolves, value is absent → ordinary comparison (usually `false`), silent
 *
 * Widening the first case to "any undefined value" would show every
 * type-conditional sub-field at once on a fresh draft; narrowing it away again
 * restores the silent-hide bug. Both directions are asserted here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { objectForm } from '@objectstack/spec/data';
import { evaluatePredicate, resetPredicateWarnings } from './predicate';

/**
 * The `unit` vitest project runs with `isolate: false`, so this module-global
 * warn-once memo outlives a single test file. Reset before every test or the
 * second assertion on a given (path, predicate) pair sees no warning.
 */
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetPredicateWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

const scope = (data: Record<string, unknown>) => ({ data });

/** All console.warn text emitted so far, joined — order-independent matching. */
const warnings = () => warn.mock.calls.map((c) => c.join(' ')).join('\n');

/* ── 1. unresolvable root identifier → true, and it says so ──────────────── */

describe('unresolvable path → fail-open true + dev warning (objectstack#6936)', () => {
  it('a bare `type in [...]` against a `{ data }` scope shows the field instead of hiding it', () => {
    const row = { type: 'currency' };
    expect(evaluatePredicate("type in ['number','currency','percent']", scope(row))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    // The warning has to name BOTH the unresolved path and the predicate that
    // carried it — a warning that says only "something did not resolve" sends
    // nobody anywhere.
    expect(warnings()).toContain('`type`');
    expect(warnings()).toContain("type in ['number','currency','percent']");
  });

  it('bare `type == literal` too', () => {
    expect(evaluatePredicate("type == 'formula'", scope({ type: 'text' }))).toBe(true);
    expect(warnings()).toContain("type == 'formula'");
  });

  it('a bare truthy check on an unresolvable name', () => {
    expect(evaluatePredicate('createOpportunity', scope({ type: 'text' }))).toBe(true);
    expect(warnings()).toContain('`createOpportunity`');
  });

  it('NEGATION does not invert the fail-open — `!unresolvable` is still true', () => {
    // The reason resolution failure is thrown rather than returned as a
    // sentinel. A sentinel would make the inner path "true-ish" and `!` would
    // negate it straight back to false — fail-CLOSED, i.e. the bug, reached by
    // a different route.
    expect(evaluatePredicate('!type', scope({ type: 'text' }))).toBe(true);
    expect(warnings()).toContain('`type`');
  });

  it('a wrong scope root (`record`, `page`) fails open and names the whole path', () => {
    expect(evaluatePredicate("record.status == 'open'", scope({ status: 'closed' }))).toBe(true);
    expect(warnings()).toContain('`record.status`');
    expect(evaluatePredicate("page.selectedId != ''", scope({}))).toBe(true);
    expect(warnings()).toContain('`page.selectedId`');
  });

  it('an inherited name is unresolvable, not a resolvable Object member', () => {
    // `hasOwn`, not `in`: `'constructor' in ctx` is true, and resolving it would
    // compare a function against a string — false, silently, forever.
    expect(evaluatePredicate("constructor == 'x'", scope({}))).toBe(true);
    expect(warnings()).toContain('`constructor`');
  });

  it('warns ONCE per (path, predicate) pair, not once per evaluation', () => {
    for (let i = 0; i < 5; i++) evaluatePredicate("type == 'formula'", scope({ type: 'text' }));
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('but a DIFFERENT predicate on the same path gets its own warning', () => {
    // Keying the memo on the path alone would report the first of the 16 skewed
    // `objectForm` predicates and stay silent about the other fifteen.
    evaluatePredicate("type == 'formula'", scope({ type: 'text' }));
    evaluatePredicate("type == 'code'", scope({ type: 'text' }));
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warnings()).toContain("type == 'formula'");
    expect(warnings()).toContain("type == 'code'");
  });

  it('reads the object predicate form as well as the string form', () => {
    expect(evaluatePredicate({ dialect: 'cel', source: "type == 'formula'" }, scope({}))).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/* ── 2. resolved and genuinely false → false, silently ───────────────────── */

describe('a resolved path that is genuinely unequal still hides the field', () => {
  it.each([
    ["data.type == 'currency'", { type: 'text' }],
    ["data.type in ['number','currency']", { type: 'text' }],
    ["data.type != 'text'", { type: 'text' }],
    ['!data.flag', { flag: true }],
    ["data.config.kind == 'json'", { config: { kind: 'yaml' } }],
  ])('%s over %j → false', (expr, row) => {
    expect(evaluatePredicate(expr, scope(row as Record<string, unknown>))).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a true predicate is still true (and silent)', () => {
    expect(evaluatePredicate("data.type in ['number','currency']", scope({ type: 'currency' }))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

/* ── 3. resolved-to-undefined / null is a VALUE fact, unchanged ──────────── */

describe('an absent draft value is not an unresolvable path (boundary pin)', () => {
  // Each case: the root `data` resolves, the draft simply carries nothing at
  // that key. Behaviour must be exactly what it was before objectstack#6936 —
  // ordinary comparison, no warning. A fresh row must not light up with every
  // type-conditional sub-field at once.
  it.each([
    ["data.type == 'text'", {}, false],
    ["data.type in ['text','textarea']", {}, false],
    ['data.type', {}, false],
    ['data.type', { type: null }, false],
    ['!data.type', {}, true],
    ["data.type != 'text'", {}, true],
    // CEL-style loose nullish equality, live before this change and after it.
    ['data.type == null', {}, true],
    ['data.type == null', { type: null }, true],
    ['data.type != null', {}, false],
    // Nullish part-way down the path: still a value fact, one level deeper.
    ["data.config.kind == 'json'", {}, false],
    ["data.config.kind == 'json'", { config: null }, false],
    ['data.config.kind == null', {}, true],
  ])('%s over %j → %s, silently', (expr, row, expected) => {
    expect(evaluatePredicate(expr as string, scope(row as Record<string, unknown>))).toBe(expected);
    expect(warn).not.toHaveBeenCalled();
  });

  it('`data` itself resolves — a scope-shaped predicate is not "unresolvable"', () => {
    expect(evaluatePredicate('data', scope({ type: 'text' }))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });
});

/* ── 4. the pre-existing parse-error fail-open, unchanged ────────────────── */

describe('the documented parse-error fail-open is untouched (regression pin)', () => {
  it('a throwing property access still fails open — and stays silent', () => {
    // The catch-all branch this file has always had. It must keep failing open,
    // and it must NOT borrow the unresolved-path warning: the path resolved
    // fine, reading it blew up, which is a different fact.
    const row = {};
    Object.defineProperty(row, 'type', {
      get() {
        throw new Error('boom');
      },
      enumerable: true,
    });
    expect(evaluatePredicate("data.type == 'text'", scope(row))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([null, undefined, ''])('an absent predicate (%j) is "always visible"', (expr) => {
    expect(evaluatePredicate(expr as never, scope({}))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('an empty object-form source is "always visible"', () => {
    expect(evaluatePredicate({ dialect: 'cel', source: '' }, scope({}))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('unparseable garbage fails open, and now names what it could not resolve', () => {
    // Before objectstack#6936 this fell through to a bare truthy check on the
    // whole string, resolved to `undefined`, and hid the field silently. It is
    // an unresolvable reference by any reading, so it warns.
    expect(evaluatePredicate('this is not CEL (((', scope({}))).toBe(true);
    expect(warnings()).toContain('this is not CEL (((');
  });
});

/* ── 5. CEL-style absorption: a short-circuited branch is never reached ──── */

describe('short-circuit absorption (CEL order)', () => {
  it('`false && unresolvable` is false — the bad half is absorbed, no warning', () => {
    // Matches CEL, where a false conjunct absorbs an erroring branch. The
    // verdict is decided by a path that DID resolve, so fail-open never applies
    // and there is nothing to report.
    expect(evaluatePredicate("data.type == 'currency' && type == 'formula'", scope({ type: 'text' }))).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('`true || unresolvable` is true, also silently', () => {
    expect(evaluatePredicate("data.type == 'text' || type == 'formula'", scope({ type: 'text' }))).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('but a reachable unresolvable half decides the predicate, and warns', () => {
    expect(evaluatePredicate("data.type == 'text' && type == 'formula'", scope({ type: 'text' }))).toBe(true);
    expect(warnings()).toContain('`type`');
  });
});

/* ── 6. the version-skew specimen, from the bundled spec itself ──────────── */

/**
 * The reproduction from the issue: `@objectstack/spec` ≤ 17.0.0-rc.5 ships the
 * `objectForm` sub-field predicates spelled BARE (`type in [...]`), which this
 * engine evaluates against `{ data: draftRow }`. A frontend carrying the
 * objectstack#6331 reader fix in front of such a backend resolved `type` to
 * nothing and hid all 16 type-conditional sub-fields, for every row type.
 *
 * Read from the installed spec rather than hand-transcribed — the same choice
 * `SchemaForm.visibleWhen.test.tsx` made, for the same reason: a hand-written
 * fixture proves the fixture, not the metadata this engine actually renders.
 *
 * When the workspace bumps to a spec with objectstack#6254 landed, the bare
 * subset legitimately becomes empty. That must not turn this suite into a green
 * run over nothing (the #5046 trap), so the total-predicate guard below is
 * asserted unconditionally, and the literal skew table in the next block —
 * which is version-independent — carries the semantics on its own.
 */
describe('bundled spec `objectForm`: bare predicates no longer hide their fields', () => {
  type Node = Record<string, unknown>;
  const collect = (node: unknown, out: Array<{ field: string; source: string }>): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) collect(n, out);
      return;
    }
    const n = node as Node;
    const pred = n.visibleWhen ?? n.visibleOn;
    if (pred) {
      const source = typeof pred === 'string' ? pred : (pred as { source?: string }).source;
      if (source) out.push({ field: String(n.field ?? '(section)'), source });
    }
    for (const v of Object.values(n)) if (v && typeof v === 'object') collect(v, out);
  };

  const predicates: Array<{ field: string; source: string }> = [];
  collect(objectForm, predicates);
  const bare = predicates.filter((p) => !/^\s*data\b/.test(p.source));

  it('the spec ships type-conditional predicates on objectForm at all', () => {
    // Non-vacuity guard: objectstack#6254 changes the SPELLING of these
    // predicates, never their presence, so this holds on both sides of the bump.
    expect(predicates.length).toBeGreaterThan(0);
  });

  it('every bare-root predicate the installed spec ships evaluates true for any row', () => {
    for (const { field, source } of bare) {
      for (const rowType of ['text', 'currency', 'lookup', 'formula', 'code', 'summary', 'autonumber']) {
        expect(
          evaluatePredicate(source, scope({ name: 'f', type: rowType })),
          `${field}: ${source} (row type ${rowType})`,
        ).toBe(true);
      }
    }
  });

  it('and every one of them is reported once per predicate', () => {
    for (const { source } of bare) evaluatePredicate(source, scope({ type: 'text' }));
    // Distinct predicate sources → distinct warnings; duplicate sources
    // (maxLength/minLength share one) collapse, which is the intended memo.
    const distinct = new Set(bare.map((p) => p.source));
    expect(warn).toHaveBeenCalledTimes(distinct.size);
  });

  it('`data.`-spelled predicates keep discriminating by row type (post-#6254 shape)', () => {
    // The other half of the skew window: once the backend is upgraded, the same
    // sub-fields must go back to being row-type-conditional rather than always
    // visible. Fail-open applies to unresolvable paths only.
    const currency = scope({ name: 'amount', type: 'currency' });
    const text = scope({ name: 'title', type: 'text' });
    expect(evaluatePredicate("data.type in ['number','currency','percent']", currency)).toBe(true);
    expect(evaluatePredicate("data.type in ['text','textarea','email']", currency)).toBe(false);
    expect(evaluatePredicate("data.type in ['text','textarea','email']", text)).toBe(true);
    expect(evaluatePredicate("data.type in ['number','currency','percent']", text)).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

/**
 * The literal skew table — the 16 `objectForm` sub-field predicates as spec
 * 17.0.0-rc.5 spells them, with the Studio sub-field each one gates. Kept as a
 * literal so the specimen survives a spec bump: it is the shape the issue
 * measured (16 sub-fields, zero shown, zero diagnostics), not whatever the
 * installed package happens to carry today.
 */
const SKEWED_OBJECT_FORM_PREDICATES: Array<[field: string, source: string]> = [
  ['maxLength', "type in ['text','textarea','email','url','phone','password','markdown','html','richtext']"],
  ['minLength', "type in ['text','textarea','email','url','phone','password','markdown','html','richtext']"],
  ['min', "type in ['number','currency','percent','rating','slider','progress']"],
  ['max', "type in ['number','currency','percent','rating','slider','progress']"],
  ['precision', "type in ['number','currency','percent']"],
  ['scale', "type in ['number','currency','percent']"],
  ['options', "type in ['select','multiselect','radio','checkboxes']"],
  ['reference', "type in ['lookup','master_detail','tree']"],
  ['lookupFilters', "type in ['lookup','master_detail']"],
  ['deleteBehavior', "type in ['lookup','master_detail']"],
  ['multiple', "type in ['lookup']"],
  ['expression', "type == 'formula'"],
  ['returnType', "type == 'formula'"],
  ['summaryOperations', "type == 'summary'"],
  ['autonumberFormat', "type == 'autonumber'"],
  ['language', "type == 'code'"],
];

describe('the 16 vanished Studio sub-fields (objectstack#6936 reading)', () => {
  it('is the specimen the issue measured — 16 predicates', () => {
    expect(SKEWED_OBJECT_FORM_PREDICATES).toHaveLength(16);
  });

  it.each(SKEWED_OBJECT_FORM_PREDICATES)('%s is shown again, not silently dropped (%s)', (_field, source) => {
    // Before this change every one of these returned false for every row type:
    // `['text',…].includes(undefined)` / `undefined === 'formula'`.
    expect(evaluatePredicate(source, scope({ name: 'amount', type: 'currency' }))).toBe(true);
    expect(evaluatePredicate(source, scope({ name: 'title', type: 'text' }))).toBe(true);
    expect(warn).toHaveBeenCalled();
  });
});
