/**
 * objectui#6598 — the html tier's silent-vanish hole for braced non-JSON values.
 *
 * `interpretBrace` materializes strict-JSON values only; anything else becomes
 * the deferred `{ $expr }` marker, and NOTHING downstream evaluates that marker
 * (this tier parses, never executes — ADR-0080; a repo-wide grep finds zero
 * `$expr` consumers outside this package). So `columns={['name','amount']}` —
 * the universal JSX spelling, single quotes — used to compile with ZERO
 * diagnostics into a value every renderer's defensive non-array read degrades
 * to "no columns declared": rows render, the author's whole data binding is
 * eaten, and no surface ever says why. That is ADR-0078's prohibited
 * parsed-but-silently-inert state, reported from production as objectui#6598
 * (moved from objectstack#12649).
 *
 * These cases pin the correction: a `$expr` value on a DECLARED input now draws
 * the warning-severity `inert-expression` diagnostic, message carrying the fix.
 * Severity is pinned as WARNING deliberately (the objectui#5709 precedent for
 * inert authored keys): escalating to error, widening the accepted literal
 * grammar (single quotes / unquoted keys), and base-prop (`style`) coverage are
 * open contract decisions on the issue — a change to any of those should move
 * these pins consciously, not by accident.
 *
 * The fixture manifest mirrors the LIVE `list-view` registration's relevant
 * inputs (packages/plugin-list/src/index.tsx) but is deliberately synthetic —
 * tier.test.ts's `object-table` fixture standing in for the live registration
 * is how the issue got mis-anchored in the first place. The live-path
 * (registry → SchemaRenderer → grid handoff) evidence lives in the issue
 * report, not here: this file pins the compile half.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../index.js';
import type { Manifest } from '../types.js';

const manifest: Manifest = {
  components: {
    'list-view': {
      type: 'list-view',
      namespace: 'plugin-list',
      inputs: [
        { name: 'objectName', type: 'string', required: true },
        { name: 'columns', type: 'array' },
        { name: 'options', type: 'object' },
      ],
    },
  },
};

describe('inert-expression: braced non-JSON on a declared input warns instead of vanishing', () => {
  it("single-quoted array — the JSX habit — draws the warning and stays in the tree as $expr", () => {
    const r = compile(`<list-view objectName="account" columns={['name','amount']} />`, manifest);
    expect(r.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'inert-expression',
        tag: 'list-view',
        message: expect.stringContaining('"columns"'),
      }),
    ]);
    // The marker itself is unchanged — the tree still carries the deferred
    // value; only the silence is gone. The message names the fix.
    expect(r.tree?.columns).toEqual({ $expr: "['name','amount']" });
    expect(r.diagnostics[0].message).toMatch(/JSON/);
    // Warning, not error: the page still compiles (the objectui#5709 posture).
    expect(r.ok).toBe(true);
  });

  it('unquoted object keys draw the same warning', () => {
    const r = compile(`<list-view objectName="account" columns={[{field:"name"}]} />`, manifest);
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'inert-expression' }),
    ]);
  });

  it('an $expr on an object-typed input is covered too', () => {
    const r = compile(`<list-view objectName="account" options={{pageSize: 25}} />`, manifest);
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'inert-expression', tag: 'list-view' }),
    ]);
  });

  it('strict-JSON spellings stay diagnostic-free — the warning cannot fire on a working page', () => {
    for (const source of [
      `<list-view objectName="account" columns={["name","amount"]} />`,
      `<list-view objectName="account" columns={[{"field":"name","label":"Full Name"}]} />`,
      `<list-view objectName="account" options={{"pageSize":25}} />`,
      `<list-view objectName="account" />`,
    ]) {
      const r = compile(source, manifest);
      expect(r.diagnostics).toEqual([]);
      expect(r.ok).toBe(true);
    }
  });

  it('an $expr on an UNKNOWN prop keeps drawing unknown-prop, not a double report', () => {
    const r = compile(`<list-view objectName="account" aggregate={{field:'amount'}} />`, manifest);
    expect(r.diagnostics).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'unknown-prop' }),
    ]);
  });
});
