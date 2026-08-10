#!/usr/bin/env node
/**
 * Every in-repo path an agent skill guide states in a backtick code span must
 * exist on disk.
 *
 * Run:  node scripts/check-skills-paths.mjs   (also `pnpm check:skills-paths`)
 *       node scripts/check-skills-paths.mjs --list   # every candidate + verdict
 * Exit: 0 = every stated path resolves (or is baselined), 1 = one does not, or
 *       the baseline below has gone stale
 *
 * ## The gap this closes (objectui#3735)
 *
 * The guides under `skills/objectui/` are a direct INPUT to every agent that
 * writes code in this repo, and their prose gives in-repo paths as coordinates:
 * "the five contexts live in ...", "declare the route in ...". Nothing checked
 * that any of those paths existed.
 *
 * `scripts/check-doc-links.mjs` does not reach them twice over. Its `SCAN_ROOTS`
 * table (see that file) lists `content/docs`, `examples`, three root markdown
 * files, `docs` and the package READMEs — no `skills` row. And it judges
 * MARKDOWN LINKS; a bare path inside a code span is not a link, so widening its
 * scan roots alone would still have seen none of this.
 *
 * The cost was paid twice before this gate existed, both times found by eye
 * while reading:
 *
 *   - #3713 / PR #3729 — the directory-tree and metadata-registry sections of
 *     `skills/objectui/guides/console-development.md`.
 *   - #3730 / PR #3734 — the same file's Key contexts (5 rows), Key hooks
 *     (7 rows) and UnifiedSidebar sections: 13 real symbols given at
 *     coordinates that do not exist.
 *
 * This failure mode is expensive out of proportion to its size, and the reason
 * is worth stating: the SYMBOL is usually real and only the path is wrong, so an
 * agent does not get a compile error — it gets "file not found" from a `Read`,
 * assumes its own search was clumsy, and spends a full lap re-locating something
 * the guide claimed to have located for it. It also recurs by construction: the
 * app-shell extraction commits (`c1e105793`, `28ffe4033`, `b279d80d6`,
 * `cccdf84d7`) moved code with nothing anywhere to say the guides had gone
 * stale.
 *
 * ## What counts as a stated path, and what deliberately does not
 *
 * Measured on `main@6422aa891`, over the 18 markdown files under `skills`:
 * 91 backtick tokens open with one of `PATH_PREFIXES` and contain no
 * whitespace. Of those, 5 are patterns rather than paths and 86 are literal
 * assertions — 85 resolve, 1 does not, and that one is a deliberate negative
 * sentence (the sole baseline entry). So the signal-to-noise ratio is what makes
 * this checkable at all: one exemption for 86 assertions.
 *
 * Three exclusions, each a rule rather than a baseline entry, because none of
 * them is a claim that a file exists:
 *
 *   1. **Whitespace.** A span containing a space is prose, or a command line, or
 *      a type — not a path. (PR #3856 added a self-check command line to
 *      `console-development.md` in exactly this shape; it is out of scope by
 *      this rule alone, with no entry needed anywhere.)
 *   2. **Patterns.** A token carrying a glob metacharacter or a placeholder
 *      segment is a shape, not a location: the guides legitimately write the
 *      protected-primitive glob under `packages/components/src/ui`, the guide
 *      glob under `content/docs/guide`, and a Zod-schema path with a
 *      placeholder domain segment. `existsSync` on any of them is meaningless.
 *      See `PATTERN_RE`.
 *   3. **Fenced blocks.** Only inline code spans in PROSE are read. A fence is a
 *      worked example, and a tutorial fence may legitimately name a file the
 *      reader is about to create. Measured: this removes 0 tokens from today's
 *      tree, so it buys nothing yet and is a scope statement for later — the
 *      inverse boundary `check-doc-links.mjs` draws for itself, and for the same
 *      reason (that file's `stripCode` section spells it out).
 *
 * ## The prefix allow-list is a decision, not an accident
 *
 * `PATH_PREFIXES` holds the five top-level directories the finding measured.
 * This repo has eleven: `docs`, `e2e`, `eslint-rules`, `public` and `patches`
 * are deliberately NOT in the list today. That was measured too, so a later
 * widening starts from a number instead of a guess: adding all five moves the
 * reading from 86 to 88 checked assertions, both new ones resolve, and nothing
 * turns red. Cheap — but it is a separate decision from this gate's existence,
 * and `check-doc-links.mjs` learned the discipline the hard way (#3479 / #3490 /
 * #3545: every scan-surface widening arrives with its own batch of red to
 * clear). Widen it on purpose, with the measurement re-run, not as a rider.
 *
 * Two near-misses that the pattern rule catches today by luck rather than by
 * design, recorded so the next reader is not surprised: the guides cite the
 * SIBLING framework repo's `packages/spec/src` and `packages/platform-objects`
 * trees, neither of which exists in objectui. Both are spelled with a wildcard
 * or a placeholder, so rule 2 removes them. A cross-repo path spelled literally
 * would be a false red here, and the baseline — with its `reason` field — is
 * where that gets recorded if it ever happens.
 *
 * ## Existence only, not kind
 *
 * `existsSync`, deliberately: a trailing slash is not required to resolve to a
 * directory, nor a `.tsx` suffix to a file. The defect class is "this
 * coordinate does not exist", and stretching the gate to judge kind would add a
 * second, weaker claim to every green.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The scan surface, relative to the repo root: markdown under this directory. */
export const SCAN_ROOT = 'skills';

/** Where the exemptions live. A ratchet — see `readBaseline`. */
export const BASELINE_FILE = 'scripts/skills-path-baseline.json';

/**
 * Top-level directories whose name at the start of a code span means "a path in
 * this repository". See the docblock section above before adding one.
 */
export const PATH_PREFIXES = ['apps', 'packages', 'examples', 'scripts', 'content'];

const PREFIX_RE = new RegExp(`^(${PATH_PREFIXES.join('|')})/`);

/**
 * A shape rather than a location: glob metacharacters, an angle-bracket or
 * brace placeholder segment, a shell variable, or an elided middle. None of
 * these can be handed to `existsSync` and mean anything.
 */
const PATTERN_RE = /[*?[\]{}<>$]|\.\.\./;

/** Opening or closing fence, matched the way `check-doc-links.mjs` matches it. */
const FENCE_RE = /^\s*(`{3,}|~{3,})(.*)$/;

/** An inline code span. Multi-backtick delimiters included, contents captured. */
const INLINE_CODE_RE = /(`+)([^`\n]*)\1/g;

/**
 * `file token` — the baseline's identity for one exemption.
 *
 * A SPACE joins them, and that is checkable rather than lucky: a candidate token
 * is rejected outright if it contains whitespace, and no path under `skills`
 * has a space in it either. (Not a NUL, and not any other control byte: one raw
 * U+0000 makes grep classify this whole file as binary — see
 * `scripts/check-control-bytes.mjs`, which would also fail on it.)
 */
const keyOf = (file, token) => `${file} ${token}`;

/** Every markdown file under `dir`, recursively. Absolute paths, sorted. */
export function markdownFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files; // caller decides whether a missing surface is an error
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) markdownFiles(full, files);
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

/**
 * Path-shaped tokens stated in one markdown file's prose.
 *
 * @returns `{ line, token, pattern }[]` — `pattern: true` marks the tokens rule
 *          2 above excludes. They are returned rather than dropped so `--list`
 *          and the tests can see what the extractor classified, instead of
 *          having to infer it from an absence.
 */
export function extractPathTokens(source) {
  /** @type {{ line: number, token: string, pattern: boolean }[]} */
  const found = [];
  let openFence = null;

  source.split('\n').forEach((line, index) => {
    const fence = FENCE_RE.exec(line);

    if (openFence) {
      const closes =
        fence && fence[1][0] === openFence[0] && fence[1].length >= openFence.length && fence[2].trim() === '';
      if (closes) openFence = null;
      return;
    }
    if (fence) {
      openFence = fence[1];
      return;
    }

    for (const match of line.matchAll(INLINE_CODE_RE)) {
      const token = match[2];
      if (!token || /\s/.test(token) || !PREFIX_RE.test(token)) continue;
      found.push({ line: index + 1, token, pattern: PATTERN_RE.test(token) });
    }
  });

  return found;
}

/**
 * The exemption list.
 *
 * A RATCHET, not an escape hatch, and `scan()` enforces that in BOTH directions:
 * an entry whose path has appeared on disk is as red as a new dead path (the
 * prose now says something false), and so is an entry the scan never met (the
 * sentence was rewritten or the file renamed, so the entry is dead weight).
 * Without the second direction a baseline degrades into a skip-list nobody dares
 * delete from; without the first it silently licenses a claim that has become
 * wrong. `KNOWN_OFFENDERS` in `check-control-bytes.mjs` and
 * `scripts/i18n-call-site-key-baseline.json` are the two in-repo precedents.
 */
export function readBaseline(root) {
  const file = path.join(root, BASELINE_FILE);
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  return { allowedMissing: parsed.allowedMissing ?? {} };
}

/** Every `file token` key the baseline declares. */
export function baselineKeys(baseline) {
  return Object.entries(baseline.allowedMissing).flatMap(([file, tokens]) =>
    Object.keys(tokens).map((token) => keyOf(file, token)),
  );
}

/**
 * The one scan. `main()`, `--list` and the test suite all go through here, so
 * the tests exercise the real code path rather than a parallel imitation.
 *
 * Reads the directory, not `git ls-files`: the surface is "markdown on disk
 * under `skills`", which lets the tests run the real `scan()` over a fixture
 * tree with no git repository in it.
 *
 * @param root      directory to treat as the repository root
 * @param baseline  `{ allowedMissing: { [file]: { [token]: { reason, issue } } } }`
 */
export function scan(root, baseline = readBaseline(root)) {
  const files = markdownFiles(path.join(root, SCAN_ROOT));

  /** Dead paths nobody declared. Red. */
  const missing = [];
  /** Declared dead paths, still dead. Green, but reported. */
  const exempt = [];
  /** Declared dead paths that now exist — the prose is now wrong. Red. */
  const staleNowExists = [];
  /** Tokens rule 2 excluded. Reported by `--list` only. */
  const patterns = [];
  const seen = new Set();
  let checked = 0;
  let resolved = 0;

  for (const full of files) {
    const file = path.relative(root, full);
    for (const hit of extractPathTokens(readFileSync(full, 'utf8'))) {
      if (hit.pattern) {
        patterns.push({ file, ...hit });
        continue;
      }
      checked++;

      const entry = baseline.allowedMissing[file]?.[hit.token];
      if (entry) seen.add(keyOf(file, hit.token));
      const record = { file, line: hit.line, token: hit.token };

      if (existsSync(path.join(root, hit.token))) {
        resolved++;
        if (entry) staleNowExists.push({ ...record, ...entry });
        continue;
      }
      if (entry) {
        exempt.push({ ...record, ...entry });
        continue;
      }
      missing.push(record);
    }
  }

  /** Declared exemptions the scan never met. Red. */
  const staleUnseen = baselineKeys(baseline).filter((key) => !seen.has(key));

  return { missing, exempt, staleNowExists, staleUnseen, patterns, files: files.length, checked, resolved };
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

const describe = (r) => `${r.file}:${r.line} — ${r.token}`;

function main() {
  const root = repoRoot();
  const result = scan(root);
  const { missing, exempt, staleNowExists, staleUnseen } = result;

  // The empty-verdict trap: a broken extractor, a renamed scan root or a moved
  // guide tree would satisfy every assertion above by finding nothing at all.
  // A gate that passes because it looked at zero files is not a gate.
  if (result.files === 0 || result.checked === 0) {
    console.error(
      `❌  check-skills-paths: scanned ${result.files} markdown file(s) under ${SCAN_ROOT}/ and found ${result.checked} path assertion(s).\n\n` +
        `Nothing to judge means this gate reports OK for the wrong reason. Either the\n` +
        `scan surface moved (see SCAN_ROOT) or the extractor stopped matching (see\n` +
        `extractPathTokens and PATH_PREFIXES). objectui#3735 measured 18 files and\n` +
        `86 assertions on main@6422aa891, so a reading of zero is a broken gate, not\n` +
        `a clean tree.`,
    );
    process.exit(1);
  }

  if (missing.length === 0 && staleNowExists.length === 0 && staleUnseen.length === 0) {
    const waived = exempt.length ? `; ${exempt.length} baselined` : '';
    console.log(
      `✅  check-skills-paths: OK (${result.resolved}/${result.checked} stated path(s) resolve across ` +
        `${result.files} guide file(s)${waived}).`,
    );
    process.exit(0);
  }

  if (missing.length > 0) {
    const phrase = missing.length === 1 ? 'stated path does' : 'stated paths do';
    console.error(`❌  check-skills-paths: ${missing.length} ${phrase} not exist\n`);
    for (const r of missing) console.error(`    • ${describe(r)}`);
    console.error(`
These are coordinates an agent will follow. The symbol named next to one of them
is usually real and only the location is wrong, so nobody gets a compile error —
they get "file not found" from a Read and spend a lap re-locating it (#3713,
#3730 were 13+ of these in one guide).

Fix the prose. If the path is deliberately named as NOT existing — a sentence
whose whole point is "there is no such directory" — add it to
${BASELINE_FILE} with a reason, and expect the gate to
go red again the day that path appears on disk.`);
  }

  if (staleNowExists.length > 0) {
    const phrase = staleNowExists.length === 1 ? 'baselined path now EXISTS' : 'baselined paths now EXIST';
    console.error(`\n❌  check-skills-paths: ${staleNowExists.length} ${phrase} on disk:\n`);
    for (const r of staleNowExists) console.error(`    • ${describe(r)}  [${r.issue}] ${r.reason}`);
    console.error(`
The exemption said this path does not exist and the prose was written around
that. It exists now, so the sentence is wrong — fix the prose first, then delete
the entry from ${BASELINE_FILE}.`);
  }

  if (staleUnseen.length > 0) {
    const phrase = staleUnseen.length === 1 ? 'baseline entry' : 'baseline entries';
    console.error(`\n❌  check-skills-paths: ${staleUnseen.length} ${phrase} the scan never met:\n`);
    for (const key of staleUnseen) console.error(`    • ${key}`);
    console.error(`
Written as "file token". The guide no longer states that path — the sentence was
rewritten, or the file moved. Delete the entry from ${BASELINE_FILE}: an
exemption nobody removes is how a baseline turns into a permanent skip-list.`);
  }

  process.exit(1);
}

// Run only when invoked directly — the test suite imports `scan()` and the
// extractor from here and must not trigger a repo scan (or a `process.exit`) on
// import. Same guard shape as `scripts/check-control-bytes.mjs`.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  if (process.argv.includes('--list')) {
    const result = scan(repoRoot());
    for (const r of result.patterns) console.log(`pattern    ${describe(r)}`);
    for (const r of result.exempt) console.log(`baselined  ${describe(r)}  [${r.issue}]`);
    for (const r of result.missing) console.log(`MISSING    ${describe(r)}`);
    console.log(
      `\n${result.files} file(s), ${result.checked} assertion(s) checked ` +
        `(${result.resolved} resolve, ${result.exempt.length} baselined), ` +
        `${result.patterns.length} pattern(s) excluded.`,
    );
  } else {
    main();
  }
}
