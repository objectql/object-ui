#!/usr/bin/env node
/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Cross-file line-address citation census (objectui#8875).
 *
 * ## What this answers, and what it deliberately does not
 *
 * objectui#7853 ruled the class -- CITE THE ASSERTION BY CONTENT, NOT BY LINE
 * ADDRESS. objectui#8047 mechanized it as the `no-line-address-in-test-name`
 * ESLint rule, but for TEST NAMES only; it carves out comments and failure
 * messages on the stated reasoning that "a human reads them beside the code
 * they annotate". objectui#8875 observes that the justification holds for a
 * SAME-FILE citation and does not hold for a CROSS-FILE one: the reader of
 * `packages/types/src/crud.ts` is not looking at
 * `packages/core/src/actions/ActionRunner.ts`, nothing puts the cited line in
 * front of them, and nothing tells them it moved.
 *
 * That card rules on nothing. It names three possible directions -- extend the
 * ESLint rule to comments and message strings, add a report-only census, or
 * rule the form out and repair on sight -- and says the choice "needs the
 * tree-wide population that has NOT been measured".
 *
 * THIS SCRIPT IS THAT MEASUREMENT AND NOTHING ELSE. It prints a number. It
 * repairs nothing, it is not wired into CI, and it takes no position on which
 * of the three directions the number favours. Deciding that is objectui#8875's
 * next step and is reserved to it.
 *
 * ## Why a `census:*` script and not a `check:*` gate
 *
 * The form follows this tree's own convention, and the convention is load
 * bearing rather than cosmetic. Two `census:*` scripts already exist
 * (`census:body-dialect`, `census:tsconfig-test-parity`); measured on this
 * tree, `census:body-dialect` appears in NO file under `.github/workflows/`
 * while the control `check:entry-guard` resolves to `lint.yml`. So `census:*`
 * is the spelling that already means "runnable, reported, not blocking", and
 * choosing it is how this change stays report-only WITHOUT a reader having to
 * take that on trust. A `check:*` name would invite the next sweep to wire it
 * into a workflow, which objectui#8875 explicitly reserved.
 *
 * It also keeps a second obligation out of the way: objectui#3653 pins
 * `content/docs/guide/ci-cd-pipeline.md`'s table BY COMMAND, so a CI step here
 * would owe a matching documentation row for a gate nobody has decided to have.
 *
 * ## What counts as a citation -- five syntaxes, and why each is here
 *
 * objectui#8875 measured four spellings in PR #8867's blast radius and named a
 * fifth that no basename-anchored probe can see. All five are read here,
 * because the card's own evidence is that a single-syntax probe under-reads
 * this class by construction -- the filing seat's first probe was `path:line`
 * only and missed a `#L` permalink among its own 73 hits.
 *
 *   1. `name.ext:NNN`      -- the dominant spelling. The name may carry
 *                            directories (`packages/core/src/x.ts:12`) or be a
 *                            bare basename (`ActionRunner.ts:112`).
 *   2. `name.ext#LNNN`     -- the GitHub permalink form, including inside a
 *                            full `https://github.com/...` URL, where suffix
 *                            resolution below strips the `blob/<ref>/` prefix.
 *   3. `line NNN of/in/at NAME` -- the address written before the name.
 *   4. `NAME line NNN`     -- the address written after the name.
 *   5. THE CONTINUATION ADDRESS -- a bare `:NNN` or `#LNNN` carrying NO
 *      filename, inheriting the file from an address earlier in the same
 *      window. `packages/types/src/crud.ts` writes
 *      `` `ActionRunner.ts:1788` and `:1794` ``; a `basename:[0-9]+` probe
 *      cannot match the second one. The card caught it only because a human
 *      read the site the probe did hit. It is the syntax most likely to be
 *      missed and the reason a count from a one-syntax probe is not a census.
 *
 * The extension list (`SOURCE_EXT`) is what makes `NAME.ext:NNN` a SOURCE
 * ADDRESS rather than a coincidence, and it is copied in spirit from
 * `eslint-rules/no-line-address-in-test-name.js` so the two instruments agree
 * on what an address is: a version number (`1.2.3`) has no `:`, a clock time
 * (`12:30`) has no extension, and a host:port (`example.com:3000`) is excluded
 * because `com` is not in the list.
 *
 * ## What is carved out, and why the carve-outs are printed rather than hidden
 *
 * RELEASED CHANGELOG SECTIONS. `packages/plugin-form/CHANGELOG.md`'s hits sit
 * under the released heading `## 17.6.0`. A changelog entry is a DATED RECORD
 * OF WHAT WAS TRUE AT THAT RELEASE, regenerated from changesets -- re-addressing
 * it to today's tree would make it false AS HISTORY. So every line at or after
 * a `CHANGELOG.md`'s first released-version heading is excluded. Anything ABOVE
 * that heading is not yet a dated record and stays in the population.
 *
 * THIS SCRIPT AND ITS TEST. Both carry addresses as FIXTURE DATA -- including
 * the two controls below -- so counting them would be the instrument reading
 * itself.
 *
 * Both carve-outs are COUNTED AND PRINTED, never silently dropped. A carve-out
 * whose size is not reported is indistinguishable from a scanner that cannot
 * see the file at all, and this card's whole subject is a zero nobody audited.
 *
 * ⚠️ PENDING CHANGESETS ARE NOT CARVED OUT, and that is a judgement this census
 * declines to make FOR the reader rather than one it has taken. `.changeset/*.md`
 * is the largest single directory in the population. A pending changeset is the
 * SOURCE of a future dated changelog entry, so the released-changelog argument
 * arguably reaches it -- but it is not dated yet, it is still editable, and
 * objectui#8875 carved out released sections only. So the rows stay in, and the
 * `.changeset` line of the by-directory table is what lets anyone who disagrees
 * subtract them without re-running anything.
 *
 * SAME-FILE citations are excluded from the population, counted separately.
 * objectui#8047's carve-out reasoning -- "a human reads them beside the code
 * they annotate" -- is exactly what still holds there, and objectui#8875
 * questions only the cross-file case.
 *
 * ## TEST NAMES are out of scope, and the split is measured rather than assumed
 *
 * objectui#8047's rule owns citations that reach a test name and runs at
 * `error` in `eslint.config.js`, so that sub-population is kept at zero by lint
 * rather than by this script. This census does not re-implement the rule's AST
 * reading. Instead every hit is CLASSIFIED with a cheap line-anchored heuristic
 * (`in_test_name`) and the count is printed: if the ESLint rule is doing its
 * job that number is zero, and if it ever is not, the census says so instead of
 * quietly overlapping. Hits inside test FILES that are not test NAMES stay in
 * the population on purpose -- objectui#8875's own site list contains two
 * (`action-forward-parity.test.tsx:156`, `action-forward-precedence.test.tsx:139`).
 *
 * ## How a citation is judged FALSE -- and why "moved" is not the question
 *
 * objectui#8875's central reading is that 10 of the 14 references a PR's line
 * shifts moved were ALREADY FALSE before that branch existed. So movement is
 * necessary but not sufficient, and this census never asks whether a diff
 * shifted an address. It asks only what is AT THE CITED LINE TODAY.
 *
 * Four verdicts, in the order they are decided:
 *
 *   `out-of-range`    the cited line is past the end of the cited file.
 *                     Mechanically certain. FALSE.
 *   `non-substantive` the cited line is blank or carries nothing but
 *                     delimiters -- a docblock's closing star-slash, a bare
 *                     `});`, a `---` rule. A citation whose target
 *                     is a closing brace is rot; this is the shape the card's
 *                     own off-by-one control has. FALSE.
 *   `drifted`         the cited line carries none of the citation's own
 *                     content anchors, but at least one of them IS somewhere
 *                     else in the cited file. The census reports where. FALSE.
 *   `resolves`        at least one content anchor is on the cited line.
 *
 * plus three UNJUDGED outcomes that are reported separately and never folded
 * into the false count: `no-anchor` (the citing prose offered nothing to match
 * on), `anchor-absent` (the anchors appear nowhere in the cited file, so the
 * prose is probably not naming a symbol) and the two resolution failures
 * `no-such-file` / `ambiguous-basename`.
 *
 * The two resolution failures are findings in their own right and are the reason
 * they are named rather than merged. `no-such-file` is dominated by citations
 * into BUILD ARTIFACTS -- `packages/types/dist/overlay.d.ts:334`, `form.d.ts:1376`
 * -- which are untracked, regenerated, and cannot be checked by anything ever.
 * `ambiguous-basename` is a BARE BASENAME (`index.ts:255`, `ObjectView.tsx:37`)
 * that names several tracked files at once, so no instrument can decide which
 * one it meant. Neither is counted false, because neither has been shown wrong;
 * both are counted as citations no reader and no tool can resolve.
 *
 * CONTENT ANCHORS come only from places where this tree writes code rather than
 * English: backticked spans, quoted strings, and bare camelCase/PascalCase
 * identifiers, inside a +/-2 line window around the citation. Atoms belonging to
 * the cited path itself are dropped -- a file's own name appears on its own
 * lines, and matching that would score every citation `resolves`. There is no
 * English stopword list anywhere in here, deliberately: a stopword list is a
 * second thing to keep honest, and the three anchor sources are already
 * code-shaped by construction.
 *
 * ⚠️ The judged verdicts are a HEURISTIC over prose, and the direction of each
 * error is worth stating. A spuriously matched anchor scores `resolves` and
 * UNDER-reports; a citation to a whole block rather than a single line scores
 * `drifted` and OVER-reports. Both buckets are printed with their sites so a
 * reader can audit either direction, and the controls below are what keep the
 * instrument from collapsing into "flags everything" or "flags nothing".
 *
 * ## The two controls, both printed, both fatal
 *
 * objectui#8875's acceptance: a census that flags everything is as useless as
 * one that flags nothing, so the instrument has to be shown firing AND not
 * firing, on this tree, in its own output.
 *
 *   FIRING     `scripts/check-doc-component-types.mjs` cites the action
 *              vocabulary at `ActionRunner.ts:112`. Verified by content, not by
 *              number: line 112 is the closing delimiter of a docblock and
 *              `ActionDef` opens at 113. This citation MUST be reported false.
 *
 *   NON-FIRING `packages/types/src/crud.ts` cites `register('detail'` as
 *              resolving to `plugin-detail/src/index.tsx:387`. Verified by
 *              content: that line is the `ComponentRegistry.register('detail',`
 *              call. This citation MUST NOT be reported false.
 *
 * Either control failing exits non-zero, and so does an EMPTY POPULATION: a
 * census that reads nothing because it is blind is indistinguishable from a
 * clean tree, which is the failure this whole card is about. The controls are
 * addressed BY CONTENT (the citing file plus the cited symbol), never by their
 * own line numbers -- a control pinned by line address would be an instance of
 * the defect being measured.
 *
 * Usage:
 *   node scripts/cross-file-line-citation-census.mjs
 *   node scripts/cross-file-line-citation-census.mjs --json
 *   node scripts/cross-file-line-citation-census.mjs --list-false
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { isEntrypoint } from './invoked-as.mjs';

/**
 * Extensions that make `NAME.ext:NNN` a source address. Kept in step with
 * `eslint-rules/no-line-address-in-test-name.js`'s list of the same name so the
 * gate and the census cannot disagree about what an address is.
 */
const SOURCE_EXT = [
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs',
  'json', 'jsonc', 'md', 'mdx', 'yml', 'yaml',
  'css', 'scss', 'html', 'vue', 'svelte', 'snap', 'sh', 'py', 'toml',
];

/** Files this census reads. Anything else is not scanned, and says so. */
const SCANNED_EXT = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs',
  'json', 'jsonc', 'md', 'mdx', 'yml', 'yaml', 'txt',
  'css', 'scss', 'html', 'vue', 'svelte', 'sh', 'py', 'toml',
]);

/** Generated or vendored text nothing authors by hand. */
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'skills-lock.json']);

/** The instrument may not count itself: both files carry addresses as fixtures. */
const SELF_FILES = new Set([
  'scripts/cross-file-line-citation-census.mjs',
  'scripts/__tests__/cross-file-line-citation-census.test.ts',
]);

/**
 * LONGEST EXTENSION FIRST, and a trailing non-word guard. Both are needed, and
 * the first was found by this census misreading its own tree: a naive
 * `ts|tsx` alternation matched `.ts` inside `ListView.tsx`, and the ONE
 * `line NNN of NAME` instance in the repository was reported against a file
 * called `ListView.ts` that does not exist. The `path:line` syntaxes hid the
 * bug -- their required `:` forces the engine to backtrack into `tsx` -- so the
 * defect was visible only in the syntax with nothing after the name. That is
 * this card's own subject one level up: a probe that answers confidently about
 * a file it never looked at.
 */
const EXT_ALT = [...SOURCE_EXT].sort((a, b) => b.length - a.length).join('|');
const NAME = String.raw`[A-Za-z0-9_@$./-]*[A-Za-z0-9_$-]\.(?:${EXT_ALT})(?![A-Za-z0-9])`;

/** Syntax 1 -- `name.ext:NNN`. */
const RE_COLON = new RegExp(String.raw`(${NAME}):(\d+)`, 'g');
/** Syntax 2 -- `name.ext#LNNN`, permalink form, URL or bare. */
const RE_PERMALINK = new RegExp(String.raw`(${NAME})#L(\d+)`, 'g');
/** Syntax 3 -- `line NNN of|in|at NAME`, address written first. */
const RE_LINE_BEFORE = new RegExp(
  String.raw`\blines?\s+(\d+)(?:\s*[-–]\s*\d+)?\s+(?:of|in|at|from)\s+\`?(${NAME})`,
  'gi',
);
/** Syntax 4 -- `NAME line NNN`, address written second. */
const RE_LINE_AFTER = new RegExp(String.raw`(${NAME})\`?[\s,(]+(?:at\s+)?\blines?\s+(\d+)`, 'gi');
/**
 * Syntax 5 -- the continuation address. A bare `:NNN` / `#LNNN` with no
 * filename. The lookbehind rejects anything that would make it part of a larger
 * token: a clock time (`12:30`), a decimal, a path, and an address already
 * matched by syntax 1 or 2.
 */
const RE_CONT_COLON = /(?<![A-Za-z0-9_$./#-]):(\d+)\b/g;
const RE_CONT_PERMALINK = /(?<![A-Za-z0-9_$./-])#L(\d+)\b/g;

/** A released changelog heading -- `## 1.2.3`, with or without a link wrapper. */
const RELEASED_HEADING = /^##\s+\[?v?\d+\.\d+\.\d+/;

/** A line carrying no content of its own: blank, or delimiters only. */
const NON_SUBSTANTIVE = /^[\s*/{}()[\];,.'"`+\-|=<>#~&!?:]*$/;

/** Backticked code spans and quoted strings -- where this tree writes code in prose. */
const CODE_SPAN = /`([^`\n]{1,120})`|'([^'\n]{2,80})'|"([^"\n]{2,80})"/g;
/** Bare camelCase / PascalCase identifiers, which prose does not produce by accident. */
const CASED_IDENT = /\b[a-z][a-z0-9$]*[A-Z][A-Za-z0-9_$]*\b|\b[A-Z][a-z0-9$]+[A-Z][A-Za-z0-9_$]*\b/g;
/** Atoms inside a code span. */
const ATOM = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;

/**
 * A vitest/jest declaration reaching its TITLE STRING -- the root, an optional
 * modifier chain, an optional `each(...)` argument list, then the opening quote
 * of the title. The capture is the quote character, so the title's extent can be
 * walked from there.
 */
const TEST_DECL_TITLE = /^\s*(?:await\s+)?(?:it|test|describe|bench|suite)(?:\.[A-Za-z_$]+)*\s*(?:\([^()]*\)\s*)?\(\s*(['"`])/;

/**
 * Is the span `[start, end)` inside a test TITLE on this line?
 *
 * objectui#8047's ESLint rule owns that sub-population and runs at `error`, so
 * this census only needs to say whether it is overlapping with it. The FIRST
 * version of this predicate merely asked whether the line contained something
 * shaped like `it(`, and it reported 27 hits on this tree -- every one of them a
 * false positive: the prose `declare it (\`form.d.ts:1368\`)`, a markdown table
 * cell, and this rule's OWN header quoting the false positive it was written to
 * avoid. A number like that is worse than no number, because it reads as an
 * overlap with a gate that is in fact clean. Hence the extent walk here, and
 * hence CLASSIFIER_CASES below: a zero from this predicate is only a reading if
 * the predicate is shown firing in the same run.
 *
 * The declaration is anchored at the START OF THE STATEMENT, which is what
 * separates a real `it(` from the word "it" in a sentence. The cost is an
 * under-read on a declaration nested mid-line, and that direction is chosen
 * deliberately: an under-read leaves the citation in the main population, where
 * it is still counted and still visible, while an over-read invents an overlap
 * with a gate that is clean.
 */
export function inTestTitle(line, start, end) {
  const m = TEST_DECL_TITLE.exec(line);
  if (!m) return false;
  const quote = m[1];
  const open = m[0].length;
  let close = open;
  while (close < line.length) {
    if (line[close] === '\\') { close += 2; continue; }
    if (line[close] === quote) break;
    close += 1;
  }
  return start >= open && end <= close;
}

/**
 * The classifier's own control pair, run on every census. The positive case is
 * the shape objectui#8047's rule bans; the negative case is the exact prose that
 * fooled the first version of the predicate.
 */
export const CLASSIFIER_CASES = [
  { name: 'an address inside a test title IS classified as a test name', line: "  it('renders per SchemaRenderer.tsx:599', () => {});", find: 'SchemaRenderer.tsx:599', want: true },
  { name: 'prose containing `it (` is NOT classified as a test name', line: ' * declare it (`form.d.ts:1368`), so `command.mdx` keeps it.', find: 'form.d.ts:1368', want: false },
  { name: "a docblock quoting a test-like sentence is NOT classified as a test name", line: ' *     ("...reads and draws it (PageHeader.tsx:123...")  that merely looks like', find: 'PageHeader.tsx:123', want: false },
  { name: 'an `each` title still counts as a test name', line: "  it.each(ROWS)('adopts SchemaRenderer.tsx:599', () => {});", find: 'SchemaRenderer.tsx:599', want: true },
];

export function evaluateClassifier() {
  return CLASSIFIER_CASES.map((c) => {
    const start = c.line.indexOf(c.find);
    const got = start >= 0 && inTestTitle(c.line, start, start + c.find.length);
    return { ...c, ok: got === c.want, got };
  });
}

/** Anchors shorter or plainer than this cannot carry a citation on their own. */
function isStrongAtom(atom) {
  if (atom.length < 4) return false;
  if (/[a-z][A-Z]/.test(atom)) return true;
  if (/^[A-Z][a-z0-9$]+[A-Z]/.test(atom)) return true;
  if (atom.includes('_')) return true;
  return atom.length >= 6;
}

/** Every tracked path, as git sees them. */
function trackedFiles(root) {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean);
}

/**
 * Resolves a WRITTEN path -- which may be a bare basename, a partial path, or
 * the tail of a GitHub permalink URL -- to a tracked file, by taking the
 * LONGEST suffix of its segments that any tracked path ends with. A written
 * path suffix beats a bare basename, which is what keeps `src/index.ts:12` from
 * being scored against the wrong package.
 */
export function resolveCited(written, index) {
  const segs = written.split('/').filter((s) => s && s !== '.' && s !== '..');
  if (segs.length === 0) return { kind: 'no-such-file', candidates: [] };
  for (let k = segs.length; k >= 1; k -= 1) {
    const suffix = segs.slice(-k).join('/');
    const hits = index.get(segs[segs.length - 1]) ?? [];
    const matches = hits.filter((p) => p === suffix || p.endsWith(`/${suffix}`));
    if (matches.length === 1) return { kind: 'resolved', path: matches[0] };
    // Ambiguity at the LONGEST matching suffix is real ambiguity: a shorter
    // suffix can only match more files, never fewer, so there is nothing more
    // specific left to try.
    if (matches.length > 1) return { kind: 'ambiguous-basename', candidates: matches };
  }
  const byName = index.get(segs[segs.length - 1]) ?? [];
  if (byName.length > 1) return { kind: 'ambiguous-basename', candidates: byName };
  if (byName.length === 1) return { kind: 'resolved', path: byName[0] };
  return { kind: 'no-such-file', candidates: [] };
}

/** Content anchors for a citation: code-shaped tokens in a +/-2 line window. */
export function anchorsFor(lines, lineIndex, citedPath) {
  const window = lines.slice(Math.max(0, lineIndex - 2), lineIndex + 3).join('\n');
  const atoms = new Set();
  let m;
  CODE_SPAN.lastIndex = 0;
  while ((m = CODE_SPAN.exec(window)) !== null) {
    const span = m[1] ?? m[2] ?? m[3] ?? '';
    ATOM.lastIndex = 0;
    let a;
    while ((a = ATOM.exec(span)) !== null) atoms.add(a[0]);
  }
  CASED_IDENT.lastIndex = 0;
  while ((m = CASED_IDENT.exec(window)) !== null) atoms.add(m[0]);

  // A file's own name appears on its own lines, so scoring a citation against
  // the atoms of the path it cites would mark almost everything as resolving.
  const forbidden = new Set();
  for (const seg of citedPath.split(/[/.]/)) {
    ATOM.lastIndex = 0;
    let a;
    while ((a = ATOM.exec(seg)) !== null) forbidden.add(a[0]);
  }
  return [...atoms].filter((t) => isStrongAtom(t) && !forbidden.has(t));
}

/**
 * An anchor on more lines than this cannot locate anything. `string` occurs on
 * 40 lines of a types file: finding it "somewhere else" says only that the file
 * is written in TypeScript, and scoring a citation `drifted` on that evidence is
 * how a census turns into one that flags everything. Measured on this tree, the
 * threshold is what separates 618 false readings from the reported number --
 * see the header's note on error direction.
 */
export const MAX_ANCHOR_LINES = 5;

/**
 * Which anchors can actually discriminate inside the cited file, and where each
 * one is. An anchor absent from the file cannot judge a line in it; one spread
 * across the file cannot either.
 */
export function locateAnchors(citedLines, anchors) {
  const located = [];
  for (const a of anchors) {
    const lines = [];
    for (let i = 0; i < citedLines.length; i += 1) {
      if (citedLines[i].includes(a)) lines.push(i + 1);
      if (lines.length > MAX_ANCHOR_LINES) break;
    }
    if (lines.length >= 1 && lines.length <= MAX_ANCHOR_LINES) located.push({ anchor: a, lines });
  }
  return located;
}

/** Decides one citation against the tree AS IT IS TODAY. Never asks what moved. */
export function judge(hit, root, index, fileCache) {
  const resolution = resolveCited(hit.citedWritten, index);
  if (resolution.kind !== 'resolved') return { verdict: resolution.kind, candidates: resolution.candidates };
  const citedPath = resolution.path;
  if (citedPath === hit.file) return { verdict: 'same-file', citedPath };

  let citedLines = fileCache.get(citedPath);
  if (citedLines === undefined) {
    try {
      citedLines = readFileSync(join(root, citedPath), 'utf8').split('\n');
    } catch {
      citedLines = null;
    }
    fileCache.set(citedPath, citedLines);
  }
  if (citedLines === null) return { verdict: 'no-such-file', citedPath };

  if (hit.citedLine < 1 || hit.citedLine > citedLines.length) {
    return { verdict: 'out-of-range', citedPath, citedLength: citedLines.length };
  }
  const target = citedLines[hit.citedLine - 1];
  if (NON_SUBSTANTIVE.test(target)) {
    return { verdict: 'non-substantive', citedPath, target: target.trim() };
  }
  if (hit.anchors.length === 0) return { verdict: 'no-anchor', citedPath, target: target.trim() };
  // The two directions take DIFFERENT evidence, and the asymmetry is the point.
  // An anchor sitting ON the cited line is direct positive evidence that the
  // address still describes what the prose says, however common that anchor is
  // elsewhere. Claiming DRIFT is the opposite: it asserts the content moved, so
  // it needs a witness that can actually locate something -- a promiscuous
  // anchor found "somewhere else" says only that the file is written in the
  // language it is written in.
  const onTarget = hit.anchors.find((a) => target.includes(a));
  if (onTarget) return { verdict: 'resolves', citedPath, anchor: onTarget, target: target.trim() };
  const located = locateAnchors(citedLines, hit.anchors);
  if (located.length === 0) {
    // Either the citing prose names nothing that is in the cited file at all,
    // or everything it names is spread across it. Neither judges a line.
    return { verdict: 'anchor-absent', citedPath, target: target.trim() };
  }
  const elsewhere = located[0];
  return {
    verdict: 'drifted',
    citedPath,
    target: target.trim(),
    actualLine: elsewhere.lines[0],
    anchor: elsewhere.anchor,
  };
}

/** Scans one file, returning raw citation hits before judging. */
export function scanFile(relPath, text) {
  const lines = text.split('\n');
  const isChangelog = basename(relPath) === 'CHANGELOG.md';
  let releasedFrom = Infinity;
  if (isChangelog) {
    for (let i = 0; i < lines.length; i += 1) {
      if (RELEASED_HEADING.test(lines[i])) { releasedFrom = i; break; }
    }
  }

  const hits = [];
  const carvedOut = [];
  /** The most recent full address, so a bare `:NNN` can inherit its file. */
  let lastAddress = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/[:#]/.test(line) && !/\bline\s+\d/i.test(line)) {
      if (lastAddress && i - lastAddress.line > 2) lastAddress = null;
      continue;
    }
    /** Character spans already claimed on this line, so syntaxes cannot double-count. */
    const claimed = [];
    const overlaps = (s, e) => claimed.some(([cs, ce]) => s < ce && cs < e);

    const record = (syntax, written, num, start, end) => {
      if (overlaps(start, end)) return;
      claimed.push([start, end]);
      const citedLine = Number(num);
      if (!Number.isInteger(citedLine) || citedLine < 1) return;
      const entry = {
        file: relPath,
        line: i + 1,
        column: start + 1,
        syntax,
        citedWritten: written,
        citedLine,
        text: line.trim().slice(0, 200),
        inTestName: inTestTitle(line, start, end),
      };
      if (i >= releasedFrom) carvedOut.push({ ...entry, carveOut: 'released-changelog-section' });
      else hits.push(entry);
      lastAddress = { written, line: i };
    };

    for (const [syntax, re, nameFirst] of [
      ['colon', RE_COLON, true],
      ['permalink', RE_PERMALINK, true],
      ['line-before-name', RE_LINE_BEFORE, false],
      ['name-before-line', RE_LINE_AFTER, true],
    ]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const written = nameFirst ? m[1] : m[2];
        const num = nameFirst ? m[2] : m[1];
        record(syntax, written, num, m.index, m.index + m[0].length);
      }
    }

    // Syntax 5 last, and only where an address is already in scope: a bare
    // `:NNN` on its own is a colon and a number, not a citation.
    if (lastAddress && i - lastAddress.line <= 2) {
      for (const re of [RE_CONT_COLON, RE_CONT_PERMALINK]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line)) !== null) {
          record('continuation', lastAddress.written, m[1], m.index, m.index + m[0].length);
        }
      }
    }
    if (lastAddress && i - lastAddress.line > 2) lastAddress = null;
  }
  return { hits, carvedOut, lines };
}

/** Verdicts that mean "this citation does not describe the tree as it is now". */
export const FALSE_VERDICTS = new Set(['out-of-range', 'non-substantive', 'drifted']);
/** Verdicts the census refuses to score in either direction. */
export const UNJUDGED_VERDICTS = new Set(['no-anchor', 'anchor-absent', 'no-such-file', 'ambiguous-basename']);

/** The bucket a citing file is reported under. */
export function bucketOf(relPath) {
  const segs = relPath.split('/');
  if (segs.length === 1) return '(repo root)';
  if (['packages', 'apps', 'examples'].includes(segs[0])) return `${segs[0]}/${segs[1]}`;
  if (segs[0] === 'scripts' && segs.length > 2) return `scripts/${segs[1]}`;
  return segs[0];
}

/**
 * The two controls, addressed BY CONTENT -- the citing file and the file it
 * cites -- and never by their own line numbers. A control pinned by line
 * address would be an instance of the defect this census measures.
 */
export const CONTROLS = [
  {
    id: 'firing',
    from: 'scripts/check-doc-component-types.mjs',
    to: 'packages/core/src/actions/ActionRunner.ts',
    want: 'false',
    why: 'the docblock closes at the cited line and `ActionDef` opens on the next one (objectui#8875)',
  },
  {
    id: 'non-firing',
    from: 'packages/types/src/crud.ts',
    to: 'packages/plugin-detail/src/index.tsx',
    want: 'not-false',
    why: "the cited line is the `ComponentRegistry.register('detail',` call the prose names",
  },
];

export function evaluateControls(rows) {
  return CONTROLS.map((c) => {
    const matches = rows.filter((r) => r.file === c.from && r.citedPath === c.to);
    if (matches.length === 0) {
      return { ...c, ok: false, detail: 'NOT FOUND -- the census did not see this citation at all' };
    }
    const anyFalse = matches.some((r) => FALSE_VERDICTS.has(r.verdict));
    const ok = c.want === 'false' ? anyFalse : !anyFalse;
    const detail = matches
      .map((r) => `${r.file}:${r.line} -> ${r.citedPath}:${r.citedLine} [${r.verdict}]`)
      .join('; ');
    return { ...c, ok, detail };
  });
}

function tally(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(r[key], (m.get(r[key]) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function main(argv) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const asJson = argv.includes('--json');
  const listAll = argv.includes('--list-all');

  const tracked = trackedFiles(root);
  const index = new Map();
  for (const p of tracked) {
    const b = basename(p);
    if (!index.has(b)) index.set(b, []);
    index.get(b).push(p);
  }

  const hits = [];
  const carvedOut = [];
  let scanned = 0;
  let selfCarved = 0;

  for (const rel of tracked) {
    const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '';
    if (!SCANNED_EXT.has(ext)) continue;
    if (SKIP_FILES.has(basename(rel))) continue;
    let text;
    try {
      if (statSync(join(root, rel)).size > 4 * 1024 * 1024) continue;
      text = readFileSync(join(root, rel), 'utf8');
    } catch {
      continue;
    }
    scanned += 1;
    const r = scanFile(rel, text);
    if (SELF_FILES.has(rel)) {
      selfCarved += r.hits.length + r.carvedOut.length;
      continue;
    }
    for (const h of r.hits) h.anchors = anchorsFor(r.lines, h.line - 1, h.citedWritten);
    hits.push(...r.hits);
    carvedOut.push(...r.carvedOut);
  }

  const fileCache = new Map();
  const judged = hits.map((h) => {
    const j = judge(h, root, index, fileCache);
    return { ...h, ...j, bucket: bucketOf(h.file), anchors: h.anchors.slice(0, 6) };
  });

  // A same-file citation is out of scope by definition: objectui#8047's
  // carve-out reasoning ("a human reads it beside the code it annotates") is
  // exactly what still holds there, and objectui#8875 questions only the
  // cross-file case. The count is printed so the boundary is visible.
  const sameFile = judged.filter((r) => r.verdict === 'same-file');
  const population = judged.filter((r) => r.verdict !== 'same-file');
  const falseRows = population.filter((r) => FALSE_VERDICTS.has(r.verdict));
  const unjudged = population.filter((r) => UNJUDGED_VERDICTS.has(r.verdict));
  const resolving = population.filter((r) => r.verdict === 'resolves');
  const controls = evaluateControls(population);
  const classifier = evaluateClassifier();
  const inTestName = population.filter((r) => r.inTestName);

  if (asJson) {
    console.log(JSON.stringify({
      head,
      scannedFiles: scanned,
      trackedFiles: tracked.length,
      population: population.length,
      falseToday: falseRows.length,
      resolving: resolving.length,
      unjudged: unjudged.length,
      sameFileExcluded: sameFile.length,
      carvedOutReleasedChangelog: carvedOut.length,
      carvedOutSelf: selfCarved,
      inTestName: inTestName.length,
      bySyntax: Object.fromEntries(tally(population, 'syntax')),
      byDirectory: Object.fromEntries(tally(population, 'bucket')),
      byVerdict: Object.fromEntries(tally(population, 'verdict')),
      controls,
      classifierControls: classifier,
      rows: listAll ? population : falseRows,
    }, null, 2));
  } else {
    console.log(`# Cross-file line-address citation census -- objectui#8875 (HEAD ${head})\n`);
    console.log(`Scanned ${scanned} of ${tracked.length} tracked files (extension whitelist; anything else is NOT SCANNED, which is not the same as zero).\n`);

    console.log('## Controls -- both must hold, or this census is not a reading\n');
    for (const c of controls) {
      console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id} (want ${c.want}): ${c.from} -> ${c.to}`);
      console.log(`      ${c.detail}`);
      console.log(`      why: ${c.why}`);
    }
    for (const c of classifier) {
      console.log(`${c.ok ? 'PASS' : 'FAIL'}  test-name classifier (want ${c.want}): ${c.name}`);
    }
    console.log('');

    console.log('## The number\n');
    console.log(`Cross-file citations in the population : ${population.length}`);
    console.log(`  of which FALSE against today's tree  : ${falseRows.length}`);
    console.log(`  of which resolve to their content    : ${resolving.length}`);
    console.log(`  of which this census does NOT judge  : ${unjudged.length}`);
    console.log('');
    console.log(`Excluded, same-file citations (#8047's carve-out still holds) : ${sameFile.length}`);
    console.log(`Excluded, released CHANGELOG sections (dated records)         : ${carvedOut.length}`);
    console.log(`Excluded, this census and its own test (fixture addresses)    : ${selfCarved}`);
    console.log(`Reaching a test name (objectui#8047's rule owns these)        : ${inTestName.length}`);
    console.log("  ^ this zero is a reading only because the classifier controls above fired.");
    console.log('');

    console.log('## By directory\n');
    console.log(`${'directory'.padEnd(34)}${'total'.padStart(7)}${'false'.padStart(7)}${'resolves'.padStart(10)}${'unjudged'.padStart(10)}`);
    for (const [b] of tally(population, 'bucket')) {
      const rows = population.filter((r) => r.bucket === b);
      console.log(
        `${b.padEnd(34)}${String(rows.length).padStart(7)}` +
        `${String(rows.filter((r) => FALSE_VERDICTS.has(r.verdict)).length).padStart(7)}` +
        `${String(rows.filter((r) => r.verdict === 'resolves').length).padStart(10)}` +
        `${String(rows.filter((r) => UNJUDGED_VERDICTS.has(r.verdict)).length).padStart(10)}`,
      );
    }
    console.log('');

    console.log('## By syntax\n');
    for (const [s, n] of tally(population, 'syntax')) console.log(`  ${String(s).padEnd(20)} ${n}`);
    console.log('');
    console.log('## By verdict\n');
    for (const [v, n] of tally(population, 'verdict')) console.log(`  ${String(v).padEnd(20)} ${n}`);
    console.log('');

    console.log(`## The ${falseRows.length} citation(s) that are false today\n`);
    console.log('⛔ This is a REPORT. objectui#8875 reserves the repair decision; shifting an');
    console.log('   already-false address by a hunk delta moves a wrong pointer to a differently');
    console.log('   wrong place while making the diff look diligent.\n');
    for (const r of falseRows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
      const where = r.verdict === 'drifted' ? ` (anchor \`${r.anchor}\` is at :${r.actualLine})`
        : r.verdict === 'out-of-range' ? ` (file has ${r.citedLength} lines)`
          : ` (cited line reads \`${r.target}\`)`;
      console.log(`  ${r.file}:${r.line}  cites  ${r.citedPath}:${r.citedLine}  [${r.verdict}]${where}`);
    }
    console.log('');

    if (listAll) {
      console.log('## Every citation in the population\n');
      for (const r of population.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)) {
        console.log(`  ${r.file}:${r.line}  ${r.syntax.padEnd(17)} -> ${r.citedWritten}:${r.citedLine}  [${r.verdict}]`);
      }
      console.log('');
    }
  }

  const failedControls = [...controls, ...classifier].filter((c) => !c.ok);
  if (failedControls.length > 0) {
    console.error(`\n✗ ${failedControls.length} control(s) failed -- this run is NOT a reading.`);
    return 1;
  }
  if (population.length === 0) {
    console.error('\n✗ Empty population. A census that reads nothing because it is blind is');
    console.error('  indistinguishable from a clean tree, so this exits non-zero rather than');
    console.error('  printing a silent zero.');
    return 1;
  }
  return 0;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
