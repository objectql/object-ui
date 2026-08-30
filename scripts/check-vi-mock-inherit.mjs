#!/usr/bin/env node
// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Rejects a `vi.mock` factory that HAND-LISTS the exports of a covered
 * workspace package instead of inheriting the real module's export surface.
 *
 * Run:  node scripts/check-vi-mock-inherit.mjs
 *       node scripts/check-vi-mock-inherit.mjs --list   # every call site found
 *       node scripts/check-vi-mock-inherit.mjs --json
 * Exit: 0 = OK, 1 = a frozen factory, an unreadable one, or a collapsed
 *       population (see "Green at rest" below)
 *
 * ## The defect (objectui#6849, surfaced by #6768 / PR #6847)
 *
 * A factory that returns a hand-written object freezes the mock's export
 * surface at whatever the author typed that day:
 *
 *     vi.mock('@object-ui/react', () => ({ SchemaRenderer: Stub }));
 *
 * The real module keeps growing. The next export that any module in the file's
 * import graph reads AT MODULE SCOPE resolves to `undefined` against the frozen
 * stand-in, and the file dies during COLLECTION -- before a single test runs.
 *
 * That failure does not look like a test failure. Measured on #6768:
 *
 *     Test Files  3 failed | 546 passed
 *     Tests       6694 passed          <- ZERO failed assertions
 *
 * The tests in those three files never ran, so nothing failed. PR #6847's
 * ablation reproduced it in isolation: reverting one converted file gives
 * `Test Files 1 failed (1)` / `Tests no tests`, against 32 passing on the
 * converted form. A reader seeing that months later reads flake, and the bill
 * is paid by whoever added the export -- in a red suite that does not point at
 * them. That is why the sweep needed a gate behind it rather than a habit.
 *
 * ## The recogniser is SEMANTIC. A name match is wrong in BOTH directions
 *
 * #6768 was written from a grep for the literal `importOriginal` and counted 36
 * frozen sites. The true count was 25, and this gate's first run found the miss
 * in the other direction too. Both errors are measured, not argued:
 *
 *   - **False positives -- 11.** Eleven files already inherited the real
 *     surface under a different spelling: nine in `plugin-dashboard` spread
 *     `await vi.importActual('@object-ui/react')` from a ZERO-PARAMETER
 *     factory; `EnvironmentListToolbar.test.tsx` names its callback parameter
 *     `importActual`; `PageView.test.tsx` names it `orig`. A gate matching the
 *     name would have demanded edits to eleven correct files and been deleted
 *     by the first person it annoyed.
 *   - **A false negative -- 1.** `plugin-view`'s
 *     `ObjectView.contractEnvelope-6726.test.tsx` hand-listed four exports from
 *     a zero-parameter factory and contains the token `importOriginal` nowhere,
 *     so the grep could not see it. It was byte-identical at PR #6847's own
 *     commit (`1e14d70ae`) and the sweep passed over it. This gate's first run
 *     over the tree flagged it; the same PR converts it.
 *
 * So the criterion is a property of the CODE, never of a name:
 *
 *   1. does the factory OBTAIN the real module -- through a callback parameter
 *      under ANY name, or through `vi.importActual` of the SAME specifier; and
 *   2. does the obtained value get SPREAD into the returned object?
 *
 * Obtaining without spreading is still frozen: `const actual = await
 * importOriginal(); return { SchemaRenderer: Stub };` inherits nothing. Both
 * halves are required, and both are read off the factory's own text.
 *
 * ## Scope: a declared, GROW-ONLY set of covered specifiers
 *
 * Triage ruled this gate NARROW (objectui#6849, R+34): limited to widely-
 * imported workspace specifiers rather than every `vi.mock` factory, because
 * the measured failure mechanism is itself narrow -- it needs a real export
 * surface that GROWS. Three things are therefore out of scope by construction,
 * not by exemption:
 *
 *   - **Whole-module replacement of a local module.** `vi.mock('./ObjectCalendar',
 *     ...)` in `plugin-calendar/src/registration.test.tsx` replaces a component
 *     wholesale and says so in its own comment. There is no growing surface to
 *     inherit, and a gate that reddened on it would be deleted rather than
 *     fixed. Relative specifiers are counted here and never judged.
 *   - **Third-party packages.** `sonner`, `react-router-dom`, `lucide-react`
 *     and friends grow only on a deliberate version bump. Counted, never judged.
 *   - **Workspace specifiers not in `COVERED_SPECIFIERS`.** See below.
 *
 * `COVERED_SPECIFIERS` holds the workspace packages whose frozen sites have
 * actually been SWEPT to zero. Today that is exactly one, and the reason is
 * measured rather than chosen. Running this file's classifier over all 1,499
 * `vi.mock` call sites in the tree at `9ce20233f`:
 *
 *     covered set = @object-ui/react (swept by PR #6847)  ->    1 frozen
 *     covered set = every @object-ui/* workspace package  ->  299 frozen
 *
 * with `@object-ui/auth` at 92, `@object-ui/i18n` at 34, `@object-ui/collaboration`
 * at 25 and `@object-ui/components` at 22. Import breadth does not separate them
 * either -- `@object-ui/react` is THIRD by measured import count (576 imports
 * across 552 files), behind `@object-ui/core` and `@object-ui/types` -- so there
 * is no threshold to derive and no honest way to widen the set today.
 *
 * **The precondition for widening is a sweep, not a judgement.** Convert a
 * specifier's frozen factories to the inheriting form, confirm this gate reads
 * zero for it, then add it to `COVERED_SPECIFIERS` in the same PR. The list only
 * ever grows. objectui#6851 carries the per-specifier worklist.
 *
 * ⛔ There is deliberately NO per-file exception list, and adding one is the
 * wrong repair. An exemption means the recogniser called correct code broken;
 * fix the recogniser, or the specifier does not belong in the covered set yet.
 *
 * ## Green at rest, and what follows from that
 *
 * Once the one site above is converted this gate reads zero, and on any
 * ordinary day its output is indistinguishable from a gate that matches
 * nothing -- which is the defect it exists to catch, one level up. Three
 * consequences, all load-bearing:
 *
 *   1. **The population must refuse to collapse.** A walk that finds no source
 *      files, no test files, or no covered call sites is a broken walk, not a
 *      clean tree. `FLOORS` turns each into a failure. Same discipline as
 *      `check-vi-mock-specifiers.mjs` and objectui#6195.
 *   2. **The verdict line carries the census**, so a reader sees the population
 *      the green was computed over.
 *   3. **A factory the gate cannot READ is a failure, never a pass.** An
 *      unbalanced argument list (`unreadable`) or a factory passed as some
 *      other expression (`indirect` -- a helper call, a shared constant) is
 *      reported and fails. Both are zero on this tree; letting either through
 *      silently would leave the obvious way to evade the gate wide open.
 *
 * `scripts/__tests__/check-vi-mock-inherit.test.ts` carries the ablation --
 * every already-correct spelling as a negative control, and a deliberately
 * hand-listed factory as the positive one -- because on a swept tree the run
 * itself proves nothing.
 *
 * ## Only text the language would EXECUTE is judged
 *
 * Comments are blanked and a call whose `vi` token sits inside a string is
 * classified `embedded` and counted, never judged -- both through one pass of
 * the shared `js-comment-mask.mjs`, exactly as the sibling gate does it, and
 * for the same reasons (this file's own header quotes the defect in prose).
 *
 * ## `js-comment-mask` reads a JSX closing tag as a regex literal
 *
 * The shared masker decides a `/` opens a regex when the preceding character is
 * not a value. In `</div>` the preceding character is `<`, so it opens a
 * PHANTOM regex that runs to the end of the line and swallows whatever is
 * there -- including the `)` that closes a `vi.mock` call.
 *
 * That is not hypothetical here: measured on this tree, SEVEN `vi.mock` call
 * sites in five files could not have their argument list delimited at all
 * because of it, one of them a covered `@object-ui/react` site
 * (`plugin-dashboard/src/__tests__/ObjectDataTable.cells.test.tsx`). The sibling
 * gate never noticed because it only reads the specifier; this gate reads the
 * factory BODY, so it cannot.
 *
 * `deJsxClosingTags` neutralises it, and the shape of the fix is what keeps it
 * safe: a JSX closing tag is rewritten to the SAME NUMBER OF BYTES
 * (`</div>` -> `<____>`) before masking, so every offset the mask returns still
 * indexes the original source, and the only bytes that change are slashes that
 * cannot be part of a spread, an identifier, or a specifier. A `</` inside a
 * string or a regex is rewritten too and does not matter: it is literal content
 * either way, and its quotes are untouched, so nothing structural moves.
 * Measured: the seven unreadable sites become zero, and no site changes verdict.
 *
 * This is a LOCAL workaround in this gate, not a change to the shared masker --
 * that module is used by many gates and its JSX behaviour is filed separately
 * as objectui#6850.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';
import { blank, scanSource } from './js-comment-mask.mjs';

/**
 * The workspace packages this gate judges. GROW-ONLY, and a specifier joins it
 * only after its frozen factories have been swept to zero -- see "Scope" above.
 */
export const COVERED_SPECIFIERS = Object.freeze(['@object-ui/react']);

/** Files the walk reads at all. */
const SOURCE_FILE_RE = /\.[cm]?[jt]sx?$/;

/** The test-file naming convention, for the census figure and its floor. */
const TEST_FILE_RE = /(\.(test|spec)\.[cm]?[jt]sx?$)|((^|\/)__tests__\/)/;

/** Belt-and-braces: git ignores these already, so nothing matches today. */
const EXCLUDED = /(^|\/)(node_modules|dist|build|\.next|\.turbo|\.wt-[^/]*)\//;

/**
 * A mock call followed by its opening quote, with an optional `import(` between
 * the two. Deliberately the same pattern as `check-vi-mock-specifiers.mjs`:
 * the two gates judge different properties of the SAME population, and a
 * population that drifts between them is a hole neither one reports.
 */
export const CALL_RE = /\bvi\s*\.\s*(mock|doMock)\s*\(\s*(import\s*\(\s*)?(['"`])([^'"`\n]*)\3/g;

/**
 * Floors below which a green verdict is a claim about coverage rather than a
 * statement about the tree. Set with room -- the point is to catch a walk that
 * COLLAPSED, not to pin today's exact numbers, which move every day.
 */
export const FLOORS = Object.freeze({
  sources: 1000,
  testFiles: 1000,
  covered: 50,
});

/** A JSX closing tag: `</div>`, `</Foo.Bar>`, `</>`. */
const JSX_CLOSING_TAG = /<\/([A-Za-z_$][\w$.:-]*)?\s*>/g;

/**
 * `source` with the slash of every JSX closing tag replaced, PRESERVING LENGTH,
 * so offsets from the mask still index the original. See the header section on
 * `js-comment-mask` for the measurement that made this necessary.
 */
export function deJsxClosingTags(source) {
  return source.replace(JSX_CLOSING_TAG, (m) => `<${'_'.repeat(m.length - 2)}>`);
}

/** 1-based line number of `offset` in `source`. */
function lineOf(source, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === '\n') line++;
  return line;
}

/**
 * Index of the `)` closing the `(` at `open`, ignoring anything inside a
 * literal, or -1 when the source does not balance.
 */
function matchingParen(masked, literal, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (literal[i]) continue;
    if (masked[i] === '(') depth++;
    else if (masked[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** `[start, end)` spans of the top-level arguments between `open` and `close`. */
function argumentSpans(masked, literal, open, close) {
  const spans = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < close; i++) {
    if (literal[i]) continue;
    const c = masked[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      spans.push([start, i]);
      start = i + 1;
    }
  }
  spans.push([start, close]);
  return spans;
}

/** Whole-word reference test, so `actual` does not match `actualThing`. */
function referencesName(text, name) {
  return new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);
}

/**
 * Does `text` hold the VALUE of the real module obtained through `token`?
 *
 * For a callback parameter the reference is not enough -- the parameter is a
 * FUNCTION, and `...importOriginal` spreads the function rather than the module
 * it would have returned. That is a frozen factory wearing an inheriting one's
 * clothes, and it is the shape a green-at-rest gate is most likely to wave
 * through, so the call is required: the token has to be followed by a `(`
 * somewhere in the expression (`importOriginal()`, `importOriginal<T>()`,
 * `(orig as any)()` all qualify).
 *
 * `OBTAIN_TOKEN` is exempt because it already STANDS FOR a completed call --
 * the whole `vi.importActual(<specifier>)` expression, parentheses included,
 * was replaced by it.
 */
function holdsObtainedModule(text, token, tokenIsValue = false) {
  if (!referencesName(text, token)) return false;
  if (tokenIsValue || token === OBTAIN_TOKEN) return true;
  const at = text.search(new RegExp(`(?<![\\w$])${token.replace(/\$/g, '\\$')}(?![\\w$])`));
  return text.indexOf('(', at + token.length) !== -1;
}

/**
 * The initialiser of a `const`/`let`/`var` starting at `from` (the index just
 * past its `=`), up to the `;` that ends the statement at bracket depth 0.
 *
 * Not a line-bounded slice: a generic argument list wrapped across lines
 * (`await importOriginal<\n  Record<string, unknown>\n>()`) would otherwise be
 * cut before its call parentheses and read as a binding that never calls
 * anything -- a fabricated finding on correct code.
 */
function readInitialiser(body, from) {
  let depth = 0;
  for (let i = from; i < body.length; i++) {
    const c = body[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return body.slice(from, i);
      depth--;
    } else if (c === ';' && depth === 0) return body.slice(from, i);
  }
  return body.slice(from);
}

/** The synthetic stand-in for `vi.importActual(<the covered specifier>)`. */
const OBTAIN_TOKEN = '__OBTAINED_ORIGINAL__';

/**
 * Read the head of a factory argument: its parameter names, and where its body
 * starts. Returns `null` when the argument is not a function literal at all.
 */
function readFactoryHead(masked, literal, start, end) {
  const text = masked.slice(start, end);
  const lead = text.length - text.replace(/^\s+/, '').length;
  const head = text.slice(lead);
  const at = start + lead;

  if (head === '') return null; // no factory argument

  const single = head.match(/^(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/);
  if (single) return { params: [single[1]], bodyStart: at + single[0].length };

  const parenthesised = /^(?:async\s+)?\(/.test(head);
  const keyword = /^(?:async\s+)?function\b/.test(head);
  if (!parenthesised && !keyword) return null; // a helper call, a constant, ...

  const open = masked.indexOf('(', at);
  if (open < 0 || open >= end) return null;
  const close = matchingParen(masked, literal, open);
  if (close < 0 || close > end) return null;

  const params = masked
    .slice(open + 1, close)
    .split(',')
    .map((p) => (p.match(/^\s*([A-Za-z_$][\w$]*)/) || [, null])[1])
    .filter(Boolean);
  return { params, bodyStart: close + 1 };
}

/**
 * Does the factory spanning `[start, end)` inherit the real export surface of
 * `specifier`?
 *
 * @returns {{ verdict: 'inherits'|'frozen'|'automock'|'indirect', obtained: string[], spreads: string[], reason?: string }}
 */
export function classifyFactory(masked, literal, start, end, specifier) {
  if (masked.slice(start, end).trim() === '') {
    // `vi.mock(spec)` with no factory: vitest AUTO-mocks the real module, so
    // the export surface is inherited by construction. Nothing to judge.
    return { verdict: 'automock', obtained: [], spreads: [] };
  }
  const head = readFactoryHead(masked, literal, start, end);
  if (!head) return { verdict: 'indirect', obtained: [], spreads: [] };

  // The body, with comments already blanked by the caller. Two more passes:
  // first swap in the obtain token for `vi.importActual(<this specifier>)`,
  // then blank literal content -- in that order, because the specifier the
  // first pass matches on IS literal content.
  const bodyStart = head.bodyStart;
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importActualRe = new RegExp(
    `\\bvi\\s*\\.\\s*importActual\\s*(?:<[^>]*>)?\\s*\\(\\s*(['"\`])${escaped}\\1\\s*\\)`,
    'g',
  );

  let body = '';
  for (let i = bodyStart; i < end; i++) body += literal[i] ? ' ' : masked[i];
  // ...but the importActual specifier has to survive the blanking to be
  // matched, so run that pass over the un-blanked body and pad to length.
  const rawBody = masked.slice(bodyStart, end);
  let obtainedViaImportActual = false;
  const marks = [];
  let m;
  importActualRe.lastIndex = 0;
  while ((m = importActualRe.exec(rawBody)) !== null) {
    if (literal[bodyStart + m.index]) continue; // the call itself is quoted
    obtainedViaImportActual = true;
    marks.push([m.index, m.index + m[0].length]);
  }
  for (const [from, to] of marks) {
    body = body.slice(0, from) + OBTAIN_TOKEN.padEnd(to - from, ' ') + body.slice(to);
  }

  const obtained = [...head.params];
  if (obtainedViaImportActual) obtained.push(OBTAIN_TOKEN);
  if (obtained.length === 0) {
    return { verdict: 'frozen', obtained, spreads: [], reason: 'the factory never obtains the real module' };
  }

  // Bindings, so `const actual = await importOriginal(); ... ...actual` counts.
  // A destructuring pattern is deliberately not a binding here: picking names
  // out of the real module is not inheriting its surface.
  const inherited = new Set(obtained);
  const bindings = [];
  const bindRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*/g;
  while ((m = bindRe.exec(body)) !== null) {
    bindings.push({ name: m[1], init: readInitialiser(body, m.index + m[0].length) });
  }
  for (let pass = 0; pass < bindings.length + 1; pass++) {
    let grew = false;
    for (const b of bindings) {
      if (inherited.has(b.name)) continue;
      if ([...inherited].some((t) => holdsObtainedModule(b.init, t, !obtained.includes(t)))) {
        inherited.add(b.name);
        grew = true;
      }
    }
    if (!grew) break;
  }

  // Every spread in the factory body, with the expression it spreads.
  const spreads = [];
  for (let i = 0; i + 2 < body.length; i++) {
    if (body[i] !== '.' || body[i + 1] !== '.' || body[i + 2] !== '.') continue;
    let depth = 0;
    let j = i + 3;
    for (; j < body.length; j++) {
      const c = body[j];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
    }
    spreads.push(body.slice(i + 3, j).trim());
    i = j - 1;
  }

  const inheriting = spreads.find((s) => [...inherited].some((t) => holdsObtainedModule(s, t, !obtained.includes(t))));
  if (inheriting) return { verdict: 'inherits', obtained, spreads, reason: `...${inheriting}` };
  return {
    verdict: 'frozen',
    obtained,
    spreads,
    reason:
      spreads.length === 0
        ? 'the factory obtains the real module but never spreads it'
        : 'the factory spreads something, but not the real module',
  };
}

/**
 * Every mock call site in one file, classified.
 *
 * `scope` is `covered` (judged), `workspace` (a workspace package outside
 * `COVERED_SPECIFIERS`), `external` (a third-party package), `local` (a
 * relative specifier -- whole-module replacement, out of scope by the ruling),
 * `dynamic` (an interpolated specifier) or `embedded` (the call token sits
 * inside a string, so it is a code SAMPLE -- see `check-vi-mock-specifiers.mjs`
 * for the instance that made this distinction necessary).
 */
export function findCallSites(source, { covered = COVERED_SPECIFIERS } = {}) {
  const dejsxed = deJsxClosingTags(source);
  const { comment, literal } = scanSource(dejsxed);
  const masked = blank(dejsxed, comment);
  const coveredSet = new Set(covered);

  const sites = [];
  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(masked)) !== null) {
    const specifier = m[4];
    const line = lineOf(masked, m.index);
    const viaImport = Boolean(m[2]);
    if (literal[m.index]) {
      sites.push({ fn: m[1], specifier, scope: 'embedded', verdict: 'unjudged', viaImport, line });
      continue;
    }
    const scope = specifier.includes('${')
      ? 'dynamic'
      : specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../')
        ? 'local'
        : coveredSet.has(specifier)
          ? 'covered'
          : specifier.startsWith('@object-ui/')
            ? 'workspace'
            : 'external';

    if (scope !== 'covered') {
      sites.push({ fn: m[1], specifier, scope, verdict: 'unjudged', viaImport, line });
      continue;
    }

    const open = masked.indexOf('(', m.index);
    const close = matchingParen(masked, literal, open);
    if (close < 0) {
      sites.push({ fn: m[1], specifier, scope, verdict: 'unreadable', viaImport, line, reason: 'the argument list does not balance' });
      continue;
    }
    const args = argumentSpans(masked, literal, open, close);
    const factory = args[1] ? [args[1][0], args[args.length - 1][1]] : [close, close];
    const judged = classifyFactory(masked, literal, factory[0], factory[1], specifier);
    sites.push({ fn: m[1], specifier, scope, viaImport, line, ...judged });
  }
  return sites;
}

/** The NUL that `git ls-files -z` delimits with, built from its code point. */
const NUL = String.fromCharCode(0);

function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split(NUL)
    .filter(Boolean);
}

/**
 * The one scan. `main()`, `--list`, `--json` and the test suite all go through
 * here, so the tests exercise the real code path rather than an imitation.
 *
 * @param {string} root  Repository root to scan.
 * @param {{ files?: string[] | null, floors?: Record<string, number>, covered?: readonly string[] }} [options]
 *   `files` overrides the `git ls-files` walk (fixtures pass their own list);
 *   `floors` overrides `FLOORS` -- pass `{}` to switch the collapse check off
 *   for a fixture tree, which is legitimately far below every repo floor;
 *   `covered` overrides `COVERED_SPECIFIERS`, so a fixture can exercise the
 *   scope boundary without waiting for the real list to grow.
 */
export function scan(root, { files = null, floors = FLOORS, covered = COVERED_SPECIFIERS } = {}) {
  const tracked = files ?? trackedFiles(root);
  const sources = tracked.filter((f) => SOURCE_FILE_RE.test(f) && !EXCLUDED.test(f));
  const testFiles = sources.filter((f) => TEST_FILE_RE.test(f));

  const sites = [];
  const frozen = [];
  const unreadable = [];
  const counters = {
    covered: 0,
    workspace: 0,
    external: 0,
    local: 0,
    dynamic: 0,
    embedded: 0,
    inherits: 0,
    automock: 0,
    filesWithMocks: 0,
  };

  for (const file of sources) {
    let source;
    try {
      source = readFileSync(join(root, file), 'utf8');
    } catch {
      continue; // symlink, gitlink, unreadable -- nothing to judge
    }
    // Cheap pre-filter only. The pattern below is what actually decides.
    if (!source.includes('vi')) continue;
    const found = findCallSites(source, { covered });
    if (found.length === 0) continue;
    counters.filesWithMocks++;
    for (const site of found) {
      counters[site.scope]++;
      const record = { file, ...site };
      if (site.scope === 'covered') {
        if (site.verdict === 'inherits' || site.verdict === 'automock') counters[site.verdict]++;
        else if (site.verdict === 'unreadable' || site.verdict === 'indirect') unreadable.push(record);
        else frozen.push(record);
      }
      sites.push(record);
    }
  }

  const census = { tracked: tracked.length, sources: sources.length, testFiles: testFiles.length, ...counters };

  // The population, checked for collapse. See "Green at rest" in the header.
  const vacuous = [];
  for (const [counter, floor] of Object.entries(floors)) {
    if (census[counter] < floor) vacuous.push({ counter, value: census[counter], floor });
  }

  return { census, sites, frozen, unreadable, vacuous, covered: [...covered] };
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** The census, as one line, for the verdict. */
export function summarise({ census, covered }) {
  return (
    `${census.sources} tracked source file(s), ${census.testFiles} test-named; ` +
    `${census.filesWithMocks} carry a mock; ` +
    `${census.covered} call site(s) on ${covered.join(', ')} judged ` +
    `(${census.inherits} inherit, ${census.automock} auto-mocked); ` +
    `${census.workspace} other workspace, ${census.external} external, ` +
    `${census.local} local, ${census.dynamic} non-static, ` +
    `${census.embedded} embedded in a string literal -- all out of scope`
  );
}

function main() {
  const result = scan(repoRoot());
  const { frozen, unreadable, vacuous } = result;

  if (frozen.length === 0 && unreadable.length === 0 && vacuous.length === 0) {
    console.log(`✅  check-vi-mock-inherit: OK (${summarise(result)}).`);
    process.exit(0);
  }

  if (frozen.length > 0) {
    const plural = frozen.length === 1 ? 'factory freezes' : 'factories freeze';
    console.error(`❌  check-vi-mock-inherit: ${frozen.length} ${plural} the mock export surface\n`);
    console.error('  A hand-listed factory pins the mock to the exports written that day. The');
    console.error('  next export any module in the file\'s import graph reads AT MODULE SCOPE');
    console.error('  then kills the file during COLLECTION -- the tests never run, so the suite');
    console.error('  reports ZERO failed assertions and reads like flake (objectui#6768):\n');
    for (const f of frozen) {
      console.error(`    - ${f.file}:${f.line} -- vi.${f.fn}(${JSON.stringify(f.specifier)})`);
      console.error(`      ${f.reason}`);
    }
    console.error(`
Inherit the real surface instead. Any of these spellings passes -- the gate reads
what the code DOES, not what the parameter is called:

    vi.mock('@object-ui/react', async (importOriginal) => ({
      ...(await importOriginal<Record<string, unknown>>()),
      SchemaRenderer: Stub,
    }));

    vi.mock('@object-ui/react', async () => {
      const actual = await vi.importActual('@object-ui/react');
      return { ...actual, SchemaRenderer: Stub };
    });

Obtaining without SPREADING is still frozen: a factory that awaits the real
module and then returns a hand-written object inherits nothing.

Only ${result.covered.join(', ')} is judged. Relative specifiers (whole-module
replacement), third-party packages and other workspace packages are counted and
never judged -- see the header for the ruling and the widening precondition.`);
  }

  if (unreadable.length > 0) {
    console.error(`\n❌  check-vi-mock-inherit: ${unreadable.length} covered factory/factories could not be READ\n`);
    console.error('  A factory this gate cannot parse is not a pass -- reporting OK for one is');
    console.error('  how the check gets evaded without anybody deciding to evade it:\n');
    for (const u of unreadable) {
      console.error(`    - ${u.file}:${u.line} -- vi.${u.fn}(${JSON.stringify(u.specifier)})`);
      console.error(
        `      ${u.verdict === 'indirect' ? 'the factory is not written inline (a helper call, a shared constant)' : u.reason}`,
      );
    }
    console.error(`
Write the factory inline in the \`vi.mock\` call so its shape is reviewable at the
call site. If it IS inline and the gate still cannot read it, the parse is the
bug -- fix it here rather than working around it in the test.`);
  }

  if (vacuous.length > 0) {
    console.error('\n❌  check-vi-mock-inherit: the population COLLAPSED -- this run proves nothing\n');
    for (const v of vacuous) {
      console.error(`    - ${v.counter}: found ${v.value}, floor is ${v.floor}`);
    }
    console.error(`
A scan that finds nothing reports OK, and reads as coverage. That is the exact
defect this gate exists to catch, one level up, so it is a FAILURE here instead.

Something upstream of the judgement broke: \`git ls-files\` returned little or
nothing, a filter inverted, the pattern stopped matching, or a specifier in
\`COVERED_SPECIFIERS\` was renamed and now matches no call site at all. Fix the
walk. If a floor is genuinely too high because the tree changed shape, move it in
\`FLOORS\` deliberately and say why -- never to make a red run green.

Census: ${summarise(result)}`);
  }

  process.exit(1);
}

// Run only when invoked directly -- the test suite imports `scan` and friends
// and must not trigger a repo scan (or a `process.exit`) on import.
if (isEntrypoint(import.meta.url)) {
  if (process.argv.includes('--json')) {
    const result = scan(repoRoot());
    console.log(
      JSON.stringify(
        { census: result.census, covered: result.covered, frozen: result.frozen, unreadable: result.unreadable, vacuous: result.vacuous },
        null,
        2,
      ),
    );
  } else if (process.argv.includes('--list')) {
    const result = scan(repoRoot());
    for (const s of result.sites) {
      const mark = s.scope === 'covered' ? String(s.verdict).toUpperCase().padEnd(10) : s.scope.padEnd(10);
      console.log(`${mark}  ${s.file}:${s.line}  vi.${s.fn}(${JSON.stringify(s.specifier)})`);
    }
    console.log(`\n${summarise(result)}`);
  } else {
    main();
  }
}
