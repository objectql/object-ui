import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import {
  COVERED_SPECIFIERS,
  FLOORS,
  classifyFactory,
  deJsxClosingTags,
  findCallSites,
  scan,
  summarise,
} from '../check-vi-mock-inherit.mjs';
import { scanSource } from '../js-comment-mask.mjs';

/**
 * objectui#6849 — the test for `scripts/check-vi-mock-inherit.mjs`.
 *
 * ## Why this file carries more weight than usual
 *
 * The gate is GREEN AT REST: every `@object-ui/react` mock in the tree inherits
 * the real export surface, and the expectation is that they keep doing so. A
 * green run over this repo therefore proves only that the tree is clean — it
 * cannot tell a working gate from one that matches nothing, which is the exact
 * defect the gate exists to catch, one level up. Triage made the non-vacuity
 * control a delivery precondition for precisely that reason.
 *
 * So this file carries BOTH legs of the ablation, and neither is decoration:
 *
 *   - the POSITIVE control (`ablation`): the real historical instance,
 *     reconstructed byte-for-byte from `ObjectView.contractEnvelope-6726.test.tsx`
 *     as PR #6847 left it, driven end to end through `main()` for the exit code;
 *   - the NEGATIVE control (`the eleven`): every already-correct spelling the
 *     grep in #6768 mis-counted, each as its own case AND pinned against the
 *     real files on disk, because a gate that reddens on correct code gets
 *     deleted rather than fixed.
 *
 * ## Fixture discipline: never write a matchable call site into this source
 *
 * This file is inside the gate's own scan scope. Every fixture is built through
 * `mockCall()`, which interpolates the quote character — the source text here
 * reads `vi.${fn}(` and the pattern needs a literal `mock`/`doMock` followed by
 * a quote, so it never matches. Anything that DID match would be inside a string
 * literal, which the gate classifies as `embedded` and declines to judge anyway.
 * The first is what keeps the census figure honest. Same discipline, and the
 * same reasons, as `check-vi-mock-specifiers.test.ts`.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** A quote, from its code point — see "Fixture discipline" above. */
const Q = String.fromCharCode(39);

const COVERED = '@object-ui/react';

/** A `vi.mock` call as SOURCE TEXT, unmatchable in this file, matchable on disk. */
const mockCall = (spec: string, factory: string, fn: 'mock' | 'doMock' = 'mock') =>
  `vi.${fn}(${Q}${spec}${Q}, ${factory});`;

/** `vi.importActual(<spec>)` as source text, likewise unmatchable here. */
const importActual = (spec: string, generic = '') => `vi.${'importActual'}${generic}(${Q}${spec}${Q})`;

/** Classify one factory in isolation, through the real code path. */
function verdictOf(factory: string, spec: string = COVERED) {
  const sites = findCallSites(mockCall(spec, factory), { covered: [COVERED] });
  expect(sites, 'the fixture must produce exactly one call site').toHaveLength(1);
  return sites[0];
}

/** Build a throwaway tree and hand back its root plus a relative file list. */
function fixtureTree(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-vi-mock-inherit-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return { root, files: Object.keys(files) };
}

/** Fixture scans pass their own file list and switch the floors off. */
const scanFixture = (root: string, files: string[]) => scan(root, { files, floors: {} });

// ---------------------------------------------------------------------------
// THE NEGATIVE CONTROL — every already-correct spelling, none of them flagged
// ---------------------------------------------------------------------------

describe('the eleven — spellings the `importOriginal` grep mis-counted as broken', () => {
  /**
   * #6768 counted 36 frozen sites from a grep for the literal `importOriginal`.
   * The true count was 25. These are the eleven the grep called broken and that
   * are, in fact, correct. A name-matching gate demands edits to all eleven; a
   * gate that does that is overturned in its first review, so each spelling gets
   * its own case here rather than being trusted to the repo scan below.
   */

  it('the canonical spelling: a parameter named `importOriginal`, spread', () => {
    const site = verdictOf(`async (importOriginal) => ({ ...(await importOriginal()), SchemaRenderer: Stub })`);
    expect(site.verdict).toBe('inherits');
  });

  it('the SAME shape with a generic argument — 25 files in this tree write it', () => {
    expect(
      verdictOf(`async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), X: Stub })`).verdict,
    ).toBe('inherits');
  });

  it('a parameter named `importActual` — EnvironmentListToolbar.test.tsx', () => {
    // Same code, different word. Nothing about the NAME is load-bearing.
    expect(verdictOf(`async (importActual) => ({ ...(await importActual<any>()), X: Stub })`).verdict).toBe('inherits');
  });

  it('a parameter named `orig`, called through a cast — PageView.test.tsx', () => {
    // The real spelling: the parameter is not called directly, it is cast first.
    const site = verdictOf(
      `async (orig) => { const actual = await (orig as any)(); return { ...actual, X: Stub }; }`,
    );
    expect(site.verdict).toBe('inherits');
  });

  it('a ZERO-PARAMETER factory using vi.importActual — the nine in plugin-dashboard', () => {
    // No callback parameter exists at all, so a gate looking for one finds
    // nothing and calls this frozen. It is the largest of the three groups.
    const site = verdictOf(`async () => { const actual: any = await ${importActual(COVERED)}; return { ...actual, X: Stub }; }`);
    expect(site.verdict).toBe('inherits');
  });

  it('a parameter under a name nobody has used yet — the criterion is not a word list', () => {
    expect(verdictOf(`async (whateverTheyCalledIt) => ({ ...(await whateverTheyCalledIt()), X: Stub })`).verdict).toBe(
      'inherits',
    );
  });

  it('an obtained module handed through a chain of bindings', () => {
    expect(
      verdictOf(`async (importOriginal) => { const mod = await importOriginal(); const actual = mod; return { ...actual, X: Stub }; }`)
        .verdict,
    ).toBe('inherits');
  });

  it('an initialiser wrapped across lines — its call parentheses are on another line', () => {
    // A line-bounded read of the initialiser cuts before the `()` and reports a
    // binding that never calls anything: a fabricated finding on correct code.
    expect(
      verdictOf(
        [
          'async (importOriginal) => {',
          '  const actual = await importOriginal<',
          '    Record<string, unknown>',
          '  >();',
          '  return { ...actual, X: Stub };',
          '}',
        ].join('\n'),
      ).verdict,
    ).toBe('inherits');
  });
});

// ---------------------------------------------------------------------------
// THE POSITIVE CONTROL — the failing shape, in each of its forms
// ---------------------------------------------------------------------------

describe('the failing shape — a factory that hand-lists the export surface', () => {
  it('a zero-parameter factory returning a hand-written object is FROZEN', () => {
    const site = verdictOf(`() => ({ SchemaRenderer: Stub, useDataScope: Stub })`);
    expect(site.verdict).toBe('frozen');
    expect(site.reason).toMatch(/never obtains the real module/);
  });

  it('OBTAINING WITHOUT SPREADING is still frozen — both halves are required', () => {
    // The card says so explicitly, and it is the half a "does it call
    // importOriginal?" check would miss.
    const site = verdictOf(`async (importOriginal) => { await importOriginal(); return { SchemaRenderer: Stub }; }`);
    expect(site.verdict).toBe('frozen');
    expect(site.reason).toMatch(/never spreads it/);
  });

  it('spreading the CALLBACK rather than what it returns is frozen', () => {
    // `...importOriginal` spreads a function. It reads like the correct
    // spelling and inherits nothing — the shape a green-at-rest gate is most
    // likely to wave through.
    expect(verdictOf(`async (importOriginal) => ({ ...importOriginal, X: Stub })`).verdict).toBe('frozen');
  });

  it('DESTRUCTURING names out of the real module is not inheriting its surface', () => {
    expect(
      verdictOf(`async (importOriginal) => { const { useDataScope } = await importOriginal(); return { useDataScope, X: Stub }; }`)
        .verdict,
    ).toBe('frozen');
  });

  it('spreading something that is not the real module is frozen', () => {
    const site = verdictOf(`async (importOriginal) => ({ ...baseStubs, X: Stub })`);
    expect(site.verdict).toBe('frozen');
    expect(site.reason).toMatch(/not the real module/);
  });

  it('vi.importActual of a DIFFERENT specifier does not inherit THIS one', () => {
    // The real file this guards against obtains `react`, not the mocked module.
    const site = verdictOf(`async () => { const R = await import(${Q}react${Q}); return { C: R.createContext(null) }; }`);
    expect(site.verdict).toBe('frozen');
    expect(verdictOf(`async () => ({ ...(await ${importActual('@object-ui/core')}) })`).verdict).toBe('frozen');
  });

  it('catches the same defect written as vi.doMock', () => {
    const sites = findCallSites(mockCall(COVERED, `() => ({ X: Stub })`, 'doMock'), { covered: [COVERED] });
    expect(sites[0].fn).toBe('doMock');
    expect(sites[0].verdict).toBe('frozen');
  });
});

// ---------------------------------------------------------------------------
// Scope — the narrow gate triage ruled for, and what it must NOT touch
// ---------------------------------------------------------------------------

describe('scope — narrow, and out of scope by construction rather than by exemption', () => {
  it('a RELATIVE specifier is never judged — whole-module replacement is legitimate', () => {
    // `plugin-calendar/src/registration.test.tsx` replaces `./ObjectCalendar`
    // wholesale and its own comment explains why. There is no growing export
    // surface to inherit; a gate that reddened here would be deleted.
    const site = verdictOf(`() => ({ ObjectCalendar: Stub })`, './ObjectCalendar');
    expect(site.scope).toBe('local');
    expect(site.verdict).toBe('unjudged');
  });

  it('a third-party package is never judged', () => {
    expect(verdictOf(`() => ({ toast: Stub })`, 'sonner').scope).toBe('external');
  });

  it('a workspace package outside the covered set is counted, not judged', () => {
    // 299 frozen factories live on these today (objectui#6851). Judging them
    // would land this gate RED on 298 sites it was not dispatched to sweep.
    const site = verdictOf(`() => ({ useAuth: Stub })`, '@object-ui/auth');
    expect(site.scope).toBe('workspace');
    expect(site.verdict).toBe('unjudged');
  });

  it('there is NO per-file exception list anywhere in the gate', () => {
    // Triage: ⛔ 不要顺手加例外白名单. An exemption means the recogniser called
    // correct code broken — the repair is the recogniser, not a carve-out.
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/check-vi-mock-inherit.mjs'), 'utf8');
    expect(src).not.toMatch(/^\s*(export )?const (ALLOW|EXEMPT|IGNORE|SKIP|KNOWN)[A-Z_]*\s*=/m);
    expect(src).not.toMatch(/\.test\.tsx?['"`]\s*[,\]]/);
  });

  it('the covered set is non-empty and names only real workspace packages', () => {
    // A typo here empties the population silently, and the gate then reports OK
    // over nothing. The `covered` floor below is the other half of that guard.
    expect(COVERED_SPECIFIERS.length).toBeGreaterThan(0);
    for (const spec of COVERED_SPECIFIERS) {
      const dir = spec.replace('@object-ui/', '');
      const pkg = path.join(repoRoot, 'packages', dir, 'package.json');
      expect(fs.existsSync(pkg), `${spec} names no package in this workspace`).toBe(true);
      expect(JSON.parse(fs.readFileSync(pkg, 'utf8')).name).toBe(spec);
    }
  });

  it('the header states what it does NOT cover, and the precondition for widening', () => {
    // Triage asked for both in writing, so that a later reader widening the set
    // knows what evidence is owed rather than guessing at it.
    const header = fs.readFileSync(path.join(repoRoot, 'scripts/check-vi-mock-inherit.mjs'), 'utf8').slice(0, 12000);
    expect(header).toMatch(/whole-module replacement/i);
    expect(header).toMatch(/precondition for widening is a sweep/i);
  });
});

// ---------------------------------------------------------------------------
// Only text the language would execute
// ---------------------------------------------------------------------------

describe('only text the language would execute', () => {
  it('ignores a commented-out mock: it is not executed, so it cannot freeze anything', () => {
    expect(findCallSites(`// ${mockCall(COVERED, '() => ({ X: Stub })')}`)).toEqual([]);
    expect(findCallSites(`/* ${mockCall(COVERED, '() => ({ X: Stub })')} */`)).toEqual([]);
  });

  it('counts a call quoted inside a literal as `embedded`, and does not judge it', () => {
    const sites = findCallSites(`const sample = \`${mockCall(COVERED, '() => ({ X: Stub })')}\`;`);
    expect(sites).toHaveLength(1);
    expect(sites[0].scope).toBe('embedded');
    expect(sites[0].verdict).toBe('unjudged');
  });

  it('still sees a real call in a file that also holds prose about one', () => {
    // The blinding direction: a mask that dropped too much reports clean over
    // live code. This gate's own header quotes the defect in prose.
    const sites = findCallSites(
      [`/** docs mentioning ${mockCall(COVERED, '() => ({ X: Stub })')} */`, mockCall(COVERED, '() => ({ Y: Stub })')].join('\n'),
    );
    expect(sites).toHaveLength(1);
    expect(sites[0].verdict).toBe('frozen');
  });

  it('an automock (no factory) inherits the surface by construction', () => {
    const sites = findCallSites(`vi.${'mock'}(${Q}${COVERED}${Q});`);
    expect(sites[0].verdict).toBe('automock');
  });

  it('a factory that is NOT written inline fails rather than passing unread', () => {
    // The obvious evasion, and the direction that matters: a gate that reports
    // OK for a factory it never read is a gate that can be walked around
    // without anybody deciding to walk around it.
    const site = verdictOf(`sharedReactFactory()`);
    expect(site.verdict).toBe('indirect');
    const { root, files } = fixtureTree({ 'a.test.tsx': `${mockCall(COVERED, 'sharedReactFactory()')}\n` });
    expect(scanFixture(root, files).unreadable).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The JSX mask — a real mis-mask in the shared scanner, measured
// ---------------------------------------------------------------------------

describe('deJsxClosingTags — the shared masker reads `</div>` as a regex literal', () => {
  /**
   * `js-comment-mask` opens a regex when a `/` follows something that is not a
   * value. In `</div>` that something is `<`, so a PHANTOM regex opens and runs
   * to the end of the line, swallowing whatever is there — including the `)`
   * that closes a `vi.mock` call. Measured on this tree: SEVEN call sites in
   * five files could not be delimited at all, one of them a covered site.
   * Filed against the shared module as objectui#6850; worked around here.
   */

  const jsxFactory = `({ open, children }: any) => (open ? <div>{children}</div> : null)`;

  it('the mis-mask is real: the closing tag opens a literal span in the raw source', () => {
    // Pinning the CAUSE, not just the workaround. If the shared masker is ever
    // fixed this case fails and the workaround can be retired deliberately.
    const src = `const C = ${jsxFactory};\n`;
    const { literal } = scanSource(src);
    // The `/` opens the phantom span, so the first byte INSIDE it is the `d`
    // of `div` — the slash itself is consumed as the opener, not flagged.
    const inside = src.indexOf('</div>') + 2;
    expect(literal[inside], 'the shared masker no longer mis-reads a JSX closing tag').toBe(1);
    // ...and the phantom runs to end of line, swallowing the `)` that closes
    // the call along with everything else after it. THAT is what breaks a
    // delimiter walk.
    expect(literal[src.indexOf(': null)')]).toBe(1);
    expect(literal[src.lastIndexOf(')')]).toBe(1);
  });

  it('neutralises the tag while PRESERVING LENGTH, so every offset still holds', () => {
    const src = 'a</div>b</>c</Foo.Bar>z';
    const out = deJsxClosingTags(src);
    expect(out).toHaveLength(src.length);
    expect(out).toBe('a<____>b<_>c<________>z');
    // Every offset past the rewrite still indexes the same byte, which is what
    // lets the mask's flags be read against the ORIGINAL source.
    expect(out.indexOf('z')).toBe(src.indexOf('z'));
  });

  it('leaves a `/` that is not a closing tag alone — a regex, a path, a division', () => {
    for (const src of ['const re = /<x>/;', 'const p = "a/b";', 'const q = a / b;', 'x.replace(/</g, "&lt;");']) {
      expect(deJsxClosingTags(src)).toBe(src);
    }
  });

  it('THE CONSEQUENCE: a covered factory returning JSX is READ, not skipped', () => {
    // Without the workaround this call site is `unreadable`. `unreadable` fails
    // the gate, so the mis-mask would not have been silent — but it would have
    // reddened five innocent files instead of judging them.
    const site = verdictOf(`async (importOriginal) => ({ ...(await importOriginal()), C: ${jsxFactory} })`);
    expect(site.verdict).toBe('inherits');
  });

  it('...and a FROZEN factory returning JSX is still caught', () => {
    expect(verdictOf(`() => ({ C: ${jsxFactory} })`).verdict).toBe('frozen');
  });
});

// ---------------------------------------------------------------------------
// THE ABLATION — the real historical instance, end to end
// ---------------------------------------------------------------------------

describe('ablation — the 26th, reconstructed from the site this PR converts', () => {
  /**
   * `packages/plugin-view/src/__tests__/ObjectView.contractEnvelope-6726.test.tsx`
   * as PR #6847 left it. It is the card's own thesis in the second direction:
   * the sweep's grep for `importOriginal` produced eleven false positives AND
   * missed this one, which contains that token nowhere. `git cat-file -e
   * 1e14d70ae:<path>` succeeds and `git diff 1e14d70ae HEAD -- <path>` was empty
   * before this PR, so the sweep really did look at these bytes.
   */

  const FROZEN_FACTORY = [
    'async () => {',
    `  const React = await import(${Q}react${Q});`,
    '  return {',
    '    SchemaRenderer: ({ data }: any) => {',
    '      if (Array.isArray(data)) delivered.push(data);',
    '      return <div data-testid="schema-renderer" />;',
    '    },',
    '    SchemaRendererContext: React.createContext(null),',
    '    subscribeDataChanges: () => () => {},',
    '    notifyDataChanged: () => {},',
    '  };',
    '}',
  ].join('\n');

  const CONVERTED_FACTORY = FROZEN_FACTORY.replace('async () => {', 'async (importOriginal) => {').replace(
    '  return {',
    '  return {\n    ...(await importOriginal<Record<string, unknown>>()),',
  );

  const suiteAt = 'packages/plugin-view/src/__tests__/ObjectView.contractEnvelope-6726.test.tsx';

  const runWith = (factory: string) => {
    const { root, files } = fixtureTree({ [suiteAt]: `${mockCall(COVERED, factory)}\n` });
    return scanFixture(root, files);
  };

  it('THE HISTORICAL INSTANCE: the gate goes RED on it', () => {
    const result = runWith(FROZEN_FACTORY);
    expect(result.frozen.map((f: { file: string }) => f.file)).toEqual([suiteAt]);
    expect(result.frozen[0].reason).toMatch(/never obtains the real module/);
  });

  it('the converted form is recognised as a fix — the gate goes GREEN', () => {
    const result = runWith(CONVERTED_FACTORY);
    expect(result.frozen).toEqual([]);
    expect(result.census.inherits).toBe(1);
  });

  it('names the file and the line, so the finding is actionable', () => {
    expect(runWith(FROZEN_FACTORY).frozen[0].line).toBe(1);
  });

  it('THE DISCRIMINATING HALF: correct neighbours in the same file are NOT flagged', () => {
    // A real file mocks several specifiers at once. Only the covered one is
    // judged, and the inheriting spellings beside it stay green.
    const { root, files } = fixtureTree({
      [suiteAt]: [
        mockCall('@object-ui/plugin-grid', `() => ({ ObjectGrid: Stub })`),
        mockCall('sonner', `() => ({ toast: Stub })`),
        mockCall('./ObjectCalendar', `() => ({ ObjectCalendar: Stub })`),
        mockCall(COVERED, `async (orig) => { const actual = await (orig as any)(); return { ...actual, X: Stub }; }`),
      ].join('\n'),
    });
    const result = scanFixture(root, files);
    expect(result.frozen).toEqual([]);
    expect(result.unreadable).toEqual([]);
    expect(result.census.covered).toBe(1);
  });

  it('catches the broken one while its out-of-scope neighbours sit around it', () => {
    const { root, files } = fixtureTree({
      [suiteAt]: [
        mockCall('sonner', `() => ({ toast: Stub })`),
        mockCall(COVERED, FROZEN_FACTORY),
        mockCall('./ObjectCalendar', `() => ({ ObjectCalendar: Stub })`),
      ].join('\n'),
    });
    expect(scanFixture(root, files).frozen).toHaveLength(1);
  });

  it('exits NON-ZERO on a frozen factory, with the guidance in the message', () => {
    // End to end through `main()`, because the exit code is the whole contract
    // with CI — a `main()` that swallowed `frozen` would pass every case above.
    //
    // The gate resolves its repo root from its OWN location, never from `cwd`,
    // so the probe copies the import graph into a throwaway git repo and adds
    // one frozen fixture there.
    const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'check-vi-mock-inherit-red-'));
    let status = 0;
    let output = '';
    try {
      fs.mkdirSync(path.join(probe, 'scripts'));
      for (const f of ['check-vi-mock-inherit.mjs', 'invoked-as.mjs', 'js-comment-mask.mjs']) {
        fs.copyFileSync(path.join(repoRoot, 'scripts', f), path.join(probe, 'scripts', f));
      }
      // Floors would fire on a tree this small and mask the signal, so the
      // probe raises the frozen finding on its own: floors are OFF here by
      // pointing the fixture's own file list at a lowered FLOORS is not
      // available across a process boundary, so instead the probe asserts the
      // FROZEN section specifically rather than the bare exit code.
      fs.mkdirSync(path.join(probe, 'pkg'), { recursive: true });
      fs.writeFileSync(path.join(probe, 'pkg', 'a.test.tsx'), `${mockCall(COVERED, '() => ({ X: Stub })')}\n`);
      execFileSync('git', ['init', '-q'], { cwd: probe });
      execFileSync('git', ['add', '-A'], { cwd: probe });
      try {
        execFileSync('node', ['scripts/check-vi-mock-inherit.mjs'], { cwd: probe, encoding: 'utf8' });
      } catch (err) {
        const e = err as { status: number; stdout: string; stderr: string };
        status = e.status;
        output = `${e.stdout}${e.stderr}`;
      }
    } finally {
      fs.rmSync(probe, { recursive: true, force: true });
    }
    expect(status, 'a frozen factory must be RED — a green here is the defect itself').toBe(1);
    expect(output).toMatch(/freezes the mock export surface/);
    expect(output).toContain('pkg/a.test.tsx:1');
    expect(output, 'the message must show the fix, not just the finding').toMatch(/importOriginal/);
  });
});

// ---------------------------------------------------------------------------
// NON-VACUITY — a scan that finds nothing must FAIL, not pass
// ---------------------------------------------------------------------------

describe('non-vacuity — the population refuses to collapse', () => {
  it('declares a floor for every counter a collapse would zero', () => {
    expect(Object.keys(FLOORS).sort()).toEqual(['covered', 'sources', 'testFiles']);
    for (const [name, floor] of Object.entries(FLOORS)) {
      expect(floor, `FLOORS.${name} must be a real floor, not zero`).toBeGreaterThan(0);
    }
  });

  it('reports every floor as breached when the walk returns nothing at all', () => {
    const result = scan(repoRoot, { files: [] });
    expect(result.frozen).toEqual([]); // clean by the only measure it has...
    expect(result.vacuous.map((v: { counter: string }) => v.counter).sort()).toEqual([
      'covered',
      'sources',
      'testFiles',
    ]); // ...and that is exactly why it must still fail
  });

  it('breaches the covered floor when the walk finds sources but no covered mocks', () => {
    // The specific collapse this gate is exposed to: `COVERED_SPECIFIERS` is
    // renamed or misspelled, every call site drops out of scope, and the gate
    // reports OK over a population of zero.
    const files = Array.from({ length: 2000 }, (_, i) => `packages/p/src/__tests__/m${i}.test.ts`);
    const result = scan(repoRoot, { files });
    const breached = result.vacuous.map((v: { counter: string }) => v.counter);
    expect(breached).toContain('covered');
    expect(breached).not.toContain('sources');
    expect(breached).not.toContain('testFiles');
  });

  it('exits non-zero on a collapsed population, with the census in the message', () => {
    const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'check-vi-mock-inherit-empty-'));
    fs.mkdirSync(path.join(probe, 'scripts'));
    for (const f of ['check-vi-mock-inherit.mjs', 'invoked-as.mjs', 'js-comment-mask.mjs']) {
      fs.copyFileSync(path.join(repoRoot, 'scripts', f), path.join(probe, 'scripts', f));
    }
    execFileSync('git', ['init', '-q'], { cwd: probe });

    let status = 0;
    let output = '';
    try {
      // Nothing is `git add`ed, so `git ls-files` succeeds and returns nothing.
      execFileSync('node', ['scripts/check-vi-mock-inherit.mjs'], { cwd: probe, encoding: 'utf8' });
    } catch (err) {
      const e = err as { status: number; stdout: string; stderr: string };
      status = e.status;
      output = `${e.stdout}${e.stderr}`;
    } finally {
      fs.rmSync(probe, { recursive: true, force: true });
    }
    expect(status, 'an empty scan must be RED — a green here is the defect itself').toBe(1);
    expect(output).toMatch(/population COLLAPSED/);
    expect(output, 'the message must name which counters collapsed').toMatch(/sources: found 0, floor is/);
  });
});

// ---------------------------------------------------------------------------
// The tree as it stands
// ---------------------------------------------------------------------------

describe('repo state — the gate is green on this tree', () => {
  const result = scan(repoRoot);

  it('has no frozen and no unreadable factory on a covered specifier', () => {
    expect(
      result.frozen.map((f: { file: string; line: number; reason: string }) => `${f.file}:${f.line} ${f.reason}`),
      'Run `pnpm check:vi-mock-inherit` for the full report and the fix guidance.',
    ).toEqual([]);
    expect(result.unreadable.map((u: { file: string; line: number }) => `${u.file}:${u.line}`)).toEqual([]);
  });

  it('actually walked the tree rather than silently matching nothing', () => {
    // The empty-verdict trap: without these, the assertion above passes for the
    // wrong reason on the day the walk breaks. Floors, not exact counts — the
    // measured figures move every day (4002 / 2285 / 107 when this landed).
    expect(result.census.sources).toBeGreaterThan(1000);
    expect(result.census.testFiles).toBeGreaterThan(1000);
    expect(result.census.covered).toBeGreaterThan(50);
    expect(result.census.inherits).toBe(result.census.covered - result.census.automock);
    expect(result.vacuous).toEqual([]);
  });

  it('THE ELEVEN, pinned against the real files — a future edit reddens here', () => {
    // The negative control on disk rather than on a fixture. Each of these was
    // counted as broken by #6768's grep and is correct.
    const eleven = [
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.bindNotForwarded-6575.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.cells.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.columnHeader.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.columnIdentity.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.emitBoundary-6373.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.overrideSource-6425.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.percentLocale.test.tsx',
      'packages/plugin-dashboard/src/__tests__/ObjectDataTable.stableEmptyRows.test.tsx',
      'packages/plugin-dashboard/src/__tests__/lookupRelationalMeta-6694.test.tsx',
      'packages/app-shell/src/environment/__tests__/EnvironmentListToolbar.test.tsx',
      'packages/app-shell/src/views/__tests__/PageView.test.tsx',
    ];
    expect(eleven).toHaveLength(11);
    for (const file of eleven) {
      expect(fs.existsSync(path.join(repoRoot, file)), `${file} moved — this control tests nothing`).toBe(true);
      const covered = findCallSites(fs.readFileSync(path.join(repoRoot, file), 'utf8')).filter(
        (s: { scope: string }) => s.scope === 'covered',
      );
      expect(covered.length, `${file} no longer mocks ${COVERED}`).toBeGreaterThan(0);
      for (const site of covered) expect(site.verdict, `${file}:${site.line}`).toBe('inherits');
    }
  });

  it('the deliberate whole-module replacement is out of scope, not exempted', () => {
    // `vi.mock('./ObjectCalendar', ...)` — triage named this one as the thing a
    // wide gate would have annoyed someone with.
    const file = 'packages/plugin-calendar/src/registration.test.tsx';
    expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
    const sites = findCallSites(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    const calendar = sites.filter((s: { specifier: string }) => s.specifier === './ObjectCalendar');
    expect(calendar.length, 'the named instance is gone — this control tests nothing').toBeGreaterThan(0);
    for (const site of calendar) expect(site.scope).toBe('local');
  });

  it('puts the census in the verdict, so a reader sees the population', () => {
    // "OK" alone is what a gate that does nothing also prints.
    const line = summarise(result);
    expect(line).toMatch(/\d+ tracked source file\(s\)/);
    expect(line).toMatch(new RegExp(`\\d+ call site\\(s\\) on ${COVERED} judged`));
    const out = execFileSync('node', ['scripts/check-vi-mock-inherit.mjs'], { cwd: repoRoot, encoding: 'utf8' });
    expect(out).toMatch(/check-vi-mock-inherit: OK/);
    expect(out).toContain(`${result.census.covered} call site(s) on ${COVERED} judged`);
  });

  it('needs no install and no build — it is a cheap-tier gate', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/check-vi-mock-inherit.mjs'), 'utf8');
    const imports = [...src.matchAll(/^import .*? from '([^']+)';$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(3);
    for (const spec of imports) {
      expect(spec.startsWith('node:') || spec.startsWith('./'), `${spec} would need an install`).toBe(true);
    }
  });

  it('judges the SAME population the sibling specifier gate walks', () => {
    // The two gates ask different questions about one set of call sites. A
    // population that drifts between them is a hole neither one reports.
    const sibling = fs.readFileSync(path.join(repoRoot, 'scripts/check-vi-mock-specifiers.mjs'), 'utf8');
    const mine = fs.readFileSync(path.join(repoRoot, 'scripts/check-vi-mock-inherit.mjs'), 'utf8');
    const patternOf = (src: string) => src.match(/export const CALL_RE = (.+);/)?.[1];
    expect(patternOf(mine)).toBe(patternOf(sibling));
  });
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

describe('wiring — the gate is reachable and every PR shape starts it', () => {
  const SCRIPT = 'scripts/check-vi-mock-inherit.mjs';
  const WORKFLOW = 'vi-mock-specifiers.yml';
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /** A workflow's YAML with whole-line comments removed — see the sibling suite. */
  const yamlOf = (file: string) =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('is exposed as a root package script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:vi-mock-inherit']).toBe(`node ${SCRIPT}`);
  });

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(path.join(workflowDir, WORKFLOW)), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf(WORKFLOW);
    expect(yaml).toMatch(new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}`));
    expect(yaml).toMatch(/^\s*pull_request:/m);
    expect(yaml).toMatch(/^\s*push:/m);
  });

  it('subscribes merge_group — a required check that skips a queue build stalls it', () => {
    expect(yamlOf(WORKFLOW)).toMatch(/^\s*merge_group:/m);
  });

  it('runs it in NO path-filtered workflow', () => {
    // A mock can be written into any package, so no path filter is correct.
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} runs ${SCRIPT} behind a paths-ignore`).not.toMatch(/paths-ignore:/);
      expect(yaml, `${file} runs ${SCRIPT} behind a paths filter — see objectui#3448`).not.toMatch(/^\s+paths:/m);
    }
  });

  it('has exactly one home', () => {
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual([WORKFLOW]);
  });

  it('installs nothing before running the gate — the cheap tier, mechanically', () => {
    const yaml = yamlOf(WORKFLOW);
    expect(yaml).not.toMatch(/pnpm install/);
    expect(yaml.indexOf(SCRIPT)).toBeGreaterThan(-1);
  });
});
