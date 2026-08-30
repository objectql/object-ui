#!/usr/bin/env node

/**
 * check-upstream-port-parity -- the ported objectstack tooling in this tree is
 * a PINNED copy, and drift from the pin is RED.
 *
 *   node scripts/check-upstream-port-parity.mjs              # verify the pin
 *   node scripts/check-upstream-port-parity.mjs --list        # what is pinned, and how far it diverges
 *   node scripts/check-upstream-port-parity.mjs --self-test   # verify the checker itself
 *   node scripts/check-upstream-port-parity.mjs --resync <upstream-file> --ref <sha>
 *                                                            # the deliberate re-sync act
 *
 * ## What this gate is for
 *
 * `scripts/pm/check-half-states.mjs` was copied here from objectstack
 * (objectui#5791) under a workflow header that calls it a verbatim copy and
 * enumerates the handful of things a re-sync "must not clobber". Both halves of
 * that promise decayed with nothing watching. Measured on 2026-08-28, before
 * this gate landed:
 *
 *   objectui's ported copy                        9,340 lines
 *   objectstack upstream                         12,948 lines
 *   `diff` between them                           4,637 lines
 *   the sweeper's own --self-test, here           1,116 cases
 *   the same suite, on upstream's copy            1,574 cases
 *
 * So 458 predicate cases and ~3,600 lines of fixes had landed upstream and
 * never arrived here, and the copy went on rendering a confident patrol report
 * with the corresponding rows simply missing. Nothing could see it: the port's
 * own test file pins the ADAPTATIONS (correctly -- that is its job) and by
 * construction cannot look at upstream at all.
 *
 * The direction of harm is the one this tree treats as worst. A drifted copy
 * does not fail; it reports. It became load-bearing once: objectui#6641 had to
 * hand-port H22's closure floor into this copy, because wiring the new
 * environment variable in the workflow alone would have set a variable this
 * copy did not read -- an unfloored closed reader at ~87% residue density,
 * arriving as a full-looking anchor body.
 *
 * ## The shape: reverse the declared divergences, then compare BYTES
 *
 * The pin (`scripts/upstream-port-pin.json`) carries, per ported file, the
 * upstream ref it was taken from, the SHA-256 of that upstream blob, and the
 * DECLARED DIVERGENCES as exact text pairs. Verification runs backwards:
 *
 *   ported file  --(reverse each declared divergence)-->  reconstruction
 *   SHA-256(reconstruction) === the pinned upstream digest    ? green : red
 *
 * Byte equality is the assertion, so there is no "close enough" reading and no
 * heuristic to tune. Three failure directions, all named:
 *
 *   1. an edit OUTSIDE every declared region -- the reversal succeeds and the
 *      digest differs;
 *   2. an edit INSIDE a declared region -- the reversal finds its `ported`
 *      snippet zero times and says which divergence;
 *   3. upstream moved -- same as (1) from this side, and the fix is a re-sync
 *      rather than a revert, which is why the message names the procedure.
 *
 * ⛔ What it deliberately does NOT do is fetch anything. A gate that reached
 * api.github.com would be red on a network hiccup and green on a cached 200,
 * and this repository's whole reason for owning a patrol is that a check which
 * cannot read its input must never read as clean (#4690). The pinned digest IS
 * the input; the `ref` beside it is provenance for a human, and the gate says
 * so rather than implying it verified it.
 *
 * ## Why a digest and not a checked-in copy of upstream
 *
 * The obvious spelling -- commit upstream's blob, apply a patch, diff -- costs
 * 784 KB of duplicated source that every future reader has to be told to
 * ignore, and it puts a second copy of the predicates in the tree, which is the
 * same disease one level up. The digest is 64 characters and answers exactly
 * the same question. The cost is that a red gate cannot show you upstream's
 * side of the diff; the message names the two commands that do.
 *
 * ## Bumping the pin IS the re-sync
 *
 *   git -C <objectstack checkout> fetch origin main
 *   git -C <objectstack checkout> show origin/main:scripts/pm/check-half-states.mjs > /tmp/up.mjs
 *   node scripts/check-upstream-port-parity.mjs --resync /tmp/up.mjs --ref <the commit sha>
 *
 * `--resync` applies the declared divergences FORWARD onto the new upstream
 * text, writes the ported file, and rewrites the pin's ref and digest. It is
 * the only supported way to move the pin, because the alternative -- editing a
 * digest by hand until the gate goes green -- is indistinguishable from
 * baselining the drift it exists to catch. Afterwards, run the ported file's
 * own suites: a divergence whose anchor upstream deleted fails LOUDLY here
 * (zero occurrences), but a divergence that still applies and no longer makes
 * sense is only visible to those tests.
 *
 * ## The divergences are a checklist, not a licence
 *
 * Every entry carries a `why`. An adaptation nobody can justify in one sentence
 * is drift that was written down rather than drift that was decided, and the
 * self-test refuses a pin whose entries lack one. The set is meant to SHRINK:
 * three of the entries here exist only because upstream's own self-test rows
 * are coupled to the resolved sweep repo, and would disappear the day upstream
 * derives those specimens instead of hard-coding them.
 *
 * Exit: 0 = parity holds, 1 = drift, 2 = the pin itself is unusable.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PIN_PATH = 'scripts/upstream-port-pin.json';

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

/** SHA-256 of a UTF-8 text, hex. The one comparison this gate makes. */
export function digest(text) {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

/**
 * Decode bytes as STRICT UTF-8.
 *
 * `Buffer#toString('utf8')` replaces malformed sequences with U+FFFD, which
 * would turn "this file is not valid UTF-8" into "the digest does not match" --
 * a true statement pointing at the wrong cause, and one whose obvious repair is
 * to bump the pin. Strict decoding makes it its own error.
 */
export function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label}: not valid UTF-8 — refusing to guess at its bytes`);
  }
}

/**
 * Every structural rule the pin has to satisfy before any comparison is worth
 * making. Returns the problems; empty means usable.
 *
 * This is separate from verification on purpose. A malformed pin is BAD USAGE
 * (exit 2), not a finding about the tree: reporting it as drift would send the
 * next reader to diff a file that is fine.
 */
export function validatePin(pin) {
  const problems = [];
  const bad = (m) => problems.push(m);
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) {
    return ['the pin is not a JSON object'];
  }
  const up = pin.upstream;
  if (!up || typeof up !== 'object') bad('`upstream` is missing');
  else {
    if (typeof up.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(up.repo)) {
      bad('`upstream.repo` is not an `owner/name` repository');
    }
    // A ref that is not a full commit sha cannot identify one tree. A branch
    // name would make the pin read as precise while naming a moving target.
    if (typeof up.ref !== 'string' || !HEX40.test(up.ref)) {
      bad('`upstream.ref` is not a 40-character commit sha');
    }
  }
  if (!Array.isArray(pin.files) || pin.files.length === 0) {
    bad('`files` is missing or empty — a pin that pins nothing is green by construction');
    return problems;
  }
  const seen = new Set();
  for (const [i, f] of pin.files.entries()) {
    const at = `files[${i}]`;
    if (!f || typeof f !== 'object') { bad(`${at} is not an object`); continue; }
    for (const key of ['ported', 'upstreamPath']) {
      if (typeof f[key] !== 'string' || !f[key]) bad(`${at}.${key} is missing`);
    }
    if (typeof f.ported === 'string') {
      if (path.isAbsolute(f.ported) || f.ported.split(/[\\/]/).includes('..')) {
        bad(`${at}.ported must be a repo-relative path without \`..\``);
      }
      if (seen.has(f.ported)) bad(`${at}.ported is pinned twice (${f.ported})`);
      seen.add(f.ported);
    }
    if (typeof f.upstreamSha256 !== 'string' || !HEX64.test(f.upstreamSha256)) {
      bad(`${at}.upstreamSha256 is not a 64-character SHA-256 digest`);
    }
    if (!Array.isArray(f.divergences)) { bad(`${at}.divergences is not an array`); continue; }
    const ids = new Set();
    for (const [j, d] of f.divergences.entries()) {
      const dat = `${at}.divergences[${j}]`;
      if (!d || typeof d !== 'object') { bad(`${dat} is not an object`); continue; }
      if (typeof d.id !== 'string' || !d.id.trim()) bad(`${dat}.id is missing`);
      else if (ids.has(d.id)) bad(`${dat}.id is a duplicate (${d.id})`);
      else ids.add(d.id);
      // An undocumented adaptation is drift someone wrote down. The reason is
      // the whole difference between a divergence list and a diff.
      if (typeof d.why !== 'string' || d.why.trim().length < 10) {
        bad(`${dat}.why is missing — every declared divergence states why it exists`);
      }
      if (typeof d.upstream !== 'string' || !d.upstream) bad(`${dat}.upstream is empty`);
      if (typeof d.ported !== 'string' || !d.ported) bad(`${dat}.ported is empty`);
      if (typeof d.upstream === 'string' && d.upstream === d.ported) {
        bad(`${dat} declares a divergence between two identical texts`);
      }
    }
  }
  return problems;
}

/**
 * Rewrite `text` by replacing each divergence's `from` side with its `to` side,
 * in order, requiring EXACTLY ONE occurrence at each step.
 *
 * The occurrence count is the load-bearing part. A snippet matching twice would
 * let the replacement land on whichever came first, which is a coin-flip
 * dressed as a check; a snippet matching zero times means the region it names
 * has been edited, which is the second of the three drift directions and needs
 * to be said in those words rather than surfacing as a digest mismatch.
 *
 * @returns {{ text: string, problems: string[] }}
 */
export function rewrite(text, divergences, direction) {
  const forward = direction !== 'reverse';
  const ordered = forward ? divergences : [...divergences].reverse();
  const problems = [];
  let out = text;
  for (const d of ordered) {
    const from = forward ? d.upstream : d.ported;
    const to = forward ? d.ported : d.upstream;
    const n = countOccurrences(out, from);
    if (n !== 1) {
      problems.push(
        `divergence \`${d.id}\`: expected its ${forward ? 'upstream' : 'ported'} text exactly once, found ${n}` +
          (n === 0
            ? ' — the region it declares has been edited, or upstream moved it'
            : ' — the anchor is ambiguous and must be widened until it is unique'),
      );
      continue;
    }
    out = out.replace(from, to);
  }
  return { text: out, problems };
}

/** Non-overlapping occurrences of a literal substring. */
export function countOccurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

/**
 * The verdict for one pinned file, computed from text alone so the self-test
 * drives the real logic over fixtures rather than over the tree.
 *
 * @returns {{ ok: boolean, reasons: string[], actual: string }}
 */
export function verifyFile(entry, portedText) {
  const { text, problems } = rewrite(portedText, entry.divergences ?? [], 'reverse');
  const actual = digest(text);
  if (problems.length) return { ok: false, reasons: problems, actual };
  if (actual !== entry.upstreamSha256) {
    return {
      ok: false,
      actual,
      reasons: [
        `reconstruction does not match the pinned upstream blob\n` +
          `      pinned : ${entry.upstreamSha256}\n` +
          `      actual : ${actual}\n` +
          `    Every declared divergence still applied cleanly, so the difference is OUTSIDE all of ` +
          `them — either this copy was edited without declaring it, or upstream moved.`,
      ],
    };
  }
  return { ok: true, reasons: [], actual };
}

function countOccurrencesSafe(text, needle) {
  return needle ? countOccurrences(text, needle) : 0;
}

function readPin(root = ROOT) {
  const raw = readFileSync(path.join(root, PIN_PATH));
  return JSON.parse(decodeUtf8(raw, PIN_PATH));
}

function readPorted(root, rel) {
  return decodeUtf8(readFileSync(path.join(root, rel)), rel);
}

function resyncCommand(pin, entry) {
  return (
    `      git -C <objectstack checkout> fetch origin main\n` +
    `      git -C <objectstack checkout> show origin/main:${entry.upstreamPath} > /tmp/upstream.mjs\n` +
    `      node scripts/check-upstream-port-parity.mjs --resync /tmp/upstream.mjs --ref <commit sha>\n` +
    `    Upstream is ${pin.upstream.repo}; the pin currently names ${pin.upstream.ref}.`
  );
}

function main(root = ROOT) {
  let pin;
  try {
    pin = readPin(root);
  } catch (err) {
    console.error(`check-upstream-port-parity: cannot read ${PIN_PATH} — ${err.message}`);
    return 2;
  }
  const structural = validatePin(pin);
  if (structural.length) {
    console.error(`check-upstream-port-parity: ${PIN_PATH} is not usable:`);
    for (const p of structural) console.error(`  - ${p}`);
    console.error(
      '  A pin that cannot be read is not a clean tree. Refusing to report parity from it.',
    );
    return 2;
  }

  let failed = 0;
  for (const entry of pin.files) {
    let portedText;
    try {
      portedText = readPorted(root, entry.ported);
    } catch (err) {
      console.error(`✗ ${entry.ported}: cannot be read — ${err.message}`);
      failed++;
      continue;
    }
    const verdict = verifyFile(entry, portedText);
    if (verdict.ok) {
      console.log(
        `✓ ${entry.ported}: byte-identical to ${pin.upstream.repo}@${pin.upstream.ref.slice(0, 9)}:` +
          `${entry.upstreamPath} modulo ${entry.divergences.length} declared divergence(s).`,
      );
      continue;
    }
    failed++;
    console.error(`✗ ${entry.ported}: DRIFTED from the pinned upstream copy.`);
    for (const r of verdict.reasons) console.error(`    ${r}`);
    console.error('    To re-sync (bumping the pin is the deliberate act):');
    console.error(resyncCommand(pin, entry));
  }

  if (failed) {
    console.error(
      `✗ check-upstream-port-parity: ${failed} of ${pin.files.length} ported file(s) drifted. ` +
        '⛔ Do not edit the pinned digest by hand to clear this — that baselines the drift the gate exists to catch.',
    );
    return 1;
  }
  console.log(
    `✓ check-upstream-port-parity: ${pin.files.length} ported file(s) match ` +
      `${pin.upstream.repo}@${pin.upstream.ref.slice(0, 9)} modulo their declared divergences. ` +
      '(The digest is verified; the ref beside it is provenance and is NOT fetched.)',
  );
  return 0;
}

function list(root = ROOT) {
  const pin = readPin(root);
  console.log(`upstream: ${pin.upstream.repo}@${pin.upstream.ref}`);
  for (const entry of pin.files) {
    const portedText = readPorted(root, entry.ported);
    console.log(`\n${entry.ported}  <-  ${entry.upstreamPath}`);
    console.log(`  pinned upstream digest: ${entry.upstreamSha256}`);
    console.log(`  declared divergences  : ${entry.divergences.length}`);
    for (const d of entry.divergences) {
      const lines = d.ported.split('\n').length;
      console.log(
        `    - ${d.id} (${lines} line(s), ${countOccurrencesSafe(portedText, d.ported)} match(es) in the ported copy)`,
      );
      console.log(`      ${d.why}`);
    }
  }
  return 0;
}

function resync(argv, root = ROOT) {
  const fileAt = argv.indexOf('--resync');
  const refAt = argv.indexOf('--ref');
  const upstreamFile = argv[fileAt + 1];
  const ref = argv[refAt + 1];
  if (!upstreamFile || upstreamFile.startsWith('--')) {
    console.error('check-upstream-port-parity: --resync needs a path to the new upstream file');
    return 2;
  }
  if (!ref || !HEX40.test(ref)) {
    console.error(
      'check-upstream-port-parity: --ref must be the full 40-character commit sha the file was taken from. ' +
        'A branch name names a moving target and would make the pin read as precise when it is not.',
    );
    return 2;
  }
  const pin = readPin(root);
  const structural = validatePin(pin);
  if (structural.length) {
    console.error('check-upstream-port-parity: refusing to re-sync from an unusable pin:');
    for (const p of structural) console.error(`  - ${p}`);
    return 2;
  }
  const upstreamText = decodeUtf8(readFileSync(upstreamFile), upstreamFile);
  // WHICH pinned file this is. Named explicitly, or inferred only when there is
  // exactly one candidate. ⛔ Never guessed from the argument's basename: a
  // wrong guess would forward-apply one file's divergences onto another file's
  // text, and the result would be written to disk before anything could notice.
  const named = argv.includes('--path') ? argv[argv.indexOf('--path') + 1] : null;
  const candidates = named ? pin.files.filter((f) => f.upstreamPath === named) : pin.files;
  if (candidates.length !== 1) {
    console.error(
      `check-upstream-port-parity: ${candidates.length === 0 ? 'no pinned file matches' : 'more than one file is pinned'}. ` +
        `Pass --path <upstream path>, one of: ${pin.files.map((f) => f.upstreamPath).join(', ')}`,
    );
    return 2;
  }
  const entry = candidates[0];
  const { text, problems } = rewrite(upstreamText, entry.divergences, 'forward');
  if (problems.length) {
    console.error(`check-upstream-port-parity: the declared divergences do not apply to the new upstream text:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      '  ⛔ This is the re-sync doing its job, not a bug in it: upstream changed a region this port adapts. ' +
        'Re-decide the divergence by hand, update the pin entry, and run this again.',
    );
    return 1;
  }
  writeFileSync(path.join(root, entry.ported), text, 'utf8');
  entry.upstreamSha256 = digest(upstreamText);
  pin.upstream.ref = ref;
  writeFileSync(path.join(root, PIN_PATH), `${JSON.stringify(pin, null, 2)}\n`, 'utf8');
  console.log(
    `✓ re-synced ${entry.ported} from ${pin.upstream.repo}@${ref.slice(0, 9)}:${entry.upstreamPath} ` +
      `(${entry.divergences.length} divergence(s) re-applied) and bumped the pin.`,
  );
  console.log('  ⚠️ Now run the ported file\'s own suites: a divergence that still APPLIES but no longer');
  console.log('     makes sense is invisible here and visible only there.');
  return 0;
}

// ── the self-test ────────────────────────────────────────────────────────────
//
// Fixture-driven: everything below runs the real `rewrite`, `verifyFile` and
// `validatePin` over hand-built texts, so a green scan of the tree means the
// recogniser works rather than that it recognised nothing. The last block is
// the exception and is deliberate -- it drives the SHIPPED pin, because a pin
// this gate cannot parse is the one failure a fixture can never show.
function selfTest() {
  const cases = [];
  const t = (name, ok, detail) => cases.push({ name, ok, detail });

  const UP = [
    'const A = 1;',
    'export const REPO = "objectstack-ai/objectstack";',
    'function f() {',
    '  return 1;',
    '}',
    'const Z = 9;',
    '',
  ].join('\n');
  const DIVS = [
    {
      id: 'repo-constant',
      why: 'this install names its own board',
      upstream: 'export const REPO = "objectstack-ai/objectstack";\n',
      ported: 'export const REPO = "objectstack-ai/objectui";\n',
    },
    {
      id: 'extra-guard',
      why: 'an escape hatch that exists only here',
      upstream: 'function f() {\n',
      ported: 'function f() {\n  if (OFF) return 0;\n',
    },
  ];
  const PORTED = rewrite(UP, DIVS, 'forward').text;
  const ENTRY = {
    ported: 'scripts/x.mjs',
    upstreamPath: 'scripts/x.mjs',
    upstreamSha256: digest(UP),
    divergences: DIVS,
  };

  // ── row 1: parity holds ────────────────────────────────────────────────────
  t('forward application produces a text that differs from upstream', PORTED !== UP);
  t('parity holds: the declared divergences reverse to the pinned digest', verifyFile(ENTRY, PORTED).ok);
  t('…and the round trip is byte-exact, not merely same-digest', rewrite(PORTED, DIVS, 'reverse').text === UP);

  // ── row 2: drift BEYOND the patch reds ─────────────────────────────────────
  const driftedOutside = PORTED.replace('const Z = 9;', 'const Z = 10;');
  const outside = verifyFile(ENTRY, driftedOutside);
  t('drift outside every declared region is RED', !outside.ok);
  t('…and is reported as a digest mismatch, not as a broken divergence', outside.reasons.join(' ').includes('OUTSIDE all of'));
  t('…and the message names the pinned digest so the reader can diff', outside.reasons.join(' ').includes(ENTRY.upstreamSha256));
  // The direction that matters most: an edit that LOOKS like an adaptation but
  // was never declared. Upstream's own text, deleted here, is exactly the
  // ~3,600-line shape this gate was written for, one line at a time.
  const deleted = PORTED.replace('  return 1;\n', '');
  t('a DELETED upstream line is RED (the drift shape this gate exists for)', !verifyFile(ENTRY, deleted).ok);
  // A comment-only edit is still drift: the ported copy is a copy.
  t('a prose-only edit outside a declared region is RED too', !verifyFile(ENTRY, `// note\n${PORTED}`).ok);

  // ── row 3: drift INSIDE a declared region names the divergence ─────────────
  const driftedInside = PORTED.replace('  if (OFF) return 0;', '  if (OFF) return [];');
  const inside = verifyFile(ENTRY, driftedInside);
  t('an edit inside a declared region is RED', !inside.ok);
  t('…and names the divergence rather than the digest', inside.reasons.join(' ').includes('`extra-guard`'));
  t('…and says the region was edited or upstream moved it', inside.reasons.join(' ').includes('has been edited'));

  // An AMBIGUOUS anchor must be refused, never applied to the first match: a
  // replacement that picks one of two identical sites is a coin flip wearing a
  // check's clothing.
  const ambiguous = [{ id: 'dup', why: 'x'.repeat(20), upstream: 'const A = 1;\n', ported: 'const A = 2;\n' }];
  const twice = `${UP}const A = 1;\n`;
  const amb = rewrite(twice, ambiguous, 'forward');
  t('an anchor matching twice is refused, not applied to the first', amb.problems.length === 1 && amb.text === twice);
  t('…and the message says to widen the anchor', amb.problems.join(' ').includes('widened'));

  // ── row 4: the pin-bump procedure ──────────────────────────────────────────
  // Upstream grows a line. The OLD pin must red; forward-applying the same
  // divergences onto the new upstream and re-digesting must go green — that is
  // the whole of `--resync`, driven here without touching the filesystem.
  const UP2 = UP.replace('const Z = 9;', 'const Z = 9;\nconst NEW = 1;');
  const bumped = rewrite(UP2, DIVS, 'forward');
  t('a moved upstream still applies the divergences cleanly', bumped.problems.length === 0);
  t('…and the OLD pin reds against the re-synced file (the bump is required)', !verifyFile(ENTRY, bumped.text).ok);
  const ENTRY2 = { ...ENTRY, upstreamSha256: digest(UP2) };
  t('…and the BUMPED pin goes green on it', verifyFile(ENTRY2, bumped.text).ok);
  t('…while the bumped pin still reds on the pre-bump copy', !verifyFile(ENTRY2, PORTED).ok);
  // The other half of the bump: a divergence whose anchor upstream DELETED must
  // fail loudly at re-sync time rather than being silently dropped.
  const UP3 = UP.replace('function f() {\n', '');
  const lost = rewrite(UP3, DIVS, 'forward');
  t('a divergence whose upstream anchor vanished fails the re-sync loudly', lost.problems.length === 1);
  t('…naming the divergence that no longer applies', lost.problems.join(' ').includes('`extra-guard`'));

  // ── row 5: a malformed pin is REFUSED, never read as clean ─────────────────
  const good = { upstream: { repo: 'o/r', ref: 'a'.repeat(40) }, files: [ENTRY] };
  t('the fixture pin is well-formed', validatePin(good).length === 0);
  const broken = [
    ['a non-object pin', 'nope'],
    ['no files at all', { ...good, files: [] }],
    ['a branch name where a commit sha belongs', { ...good, upstream: { repo: 'o/r', ref: 'main' }, }],
    ['a short ref', { ...good, upstream: { repo: 'o/r', ref: 'abc1234' } }],
    ['a repo that is not owner/name', { ...good, upstream: { repo: 'objectstack', ref: 'a'.repeat(40) } }],
    ['a digest that is not SHA-256', { ...good, files: [{ ...ENTRY, upstreamSha256: 'deadbeef' }] }],
    ['an absolute ported path', { ...good, files: [{ ...ENTRY, ported: '/etc/passwd' }] }],
    ['a ported path escaping the repo', { ...good, files: [{ ...ENTRY, ported: '../x.mjs' }] }],
    ['the same file pinned twice', { ...good, files: [ENTRY, ENTRY] }],
    ['a divergence with no id', { ...good, files: [{ ...ENTRY, divergences: [{ ...DIVS[0], id: '' }] }] }],
    ['duplicate divergence ids', { ...good, files: [{ ...ENTRY, divergences: [DIVS[0], DIVS[0]] }] }],
    ['a divergence with no stated reason', { ...good, files: [{ ...ENTRY, divergences: [{ ...DIVS[0], why: '' }] }] }],
    ['an empty divergence side', { ...good, files: [{ ...ENTRY, divergences: [{ ...DIVS[0], ported: '' }] }] }],
    ['a divergence between two identical texts', { ...good, files: [{ ...ENTRY, divergences: [{ ...DIVS[0], ported: DIVS[0].upstream }] }] }],
  ];
  for (const [name, pin] of broken) {
    t(`malformed pin refused: ${name}`, validatePin(pin).length > 0);
  }

  // ── the shipped pin, and the tree it pins ─────────────────────────────────
  // Fixtures cannot show that the REAL pin parses, and a pin that does not
  // parse is the one state in which this gate has nothing to say.
  let shipped = null;
  try {
    shipped = readPin();
  } catch (err) {
    t('the shipped pin parses', false, err.message);
  }
  if (shipped) {
    const problems = validatePin(shipped);
    t('the shipped pin is well-formed', problems.length === 0, problems.join('; '));
    t('…and pins at least one file', Array.isArray(shipped.files) && shipped.files.length >= 1);
    t(
      '…and every declared divergence states a reason',
      shipped.files.every((f) => (f.divergences ?? []).every((d) => typeof d.why === 'string' && d.why.trim().length >= 10)),
    );
  }

  const failed = cases.filter((c) => !c.ok);
  for (const c of failed) console.error(`  ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (failed.length) {
    console.error(`✗ check-upstream-port-parity self-test: ${failed.length} of ${cases.length} case(s) failed.`);
    return 1;
  }
  console.log(
    `✓ check-upstream-port-parity self-test: ${cases.length} cases pass — parity holds on an undrifted copy, ` +
      'drift outside the declared regions reds as a digest mismatch, drift inside one names its divergence, ' +
      'an ambiguous anchor is refused rather than applied, the pin-bump procedure round-trips (and a vanished ' +
      'anchor fails it loudly), and every malformed-pin shape is refused instead of read as clean.',
  );
  return 0;
}

if (isEntrypoint(import.meta.url)) {
  const argv = process.argv;
  process.exit(
    argv.includes('--self-test')
      ? selfTest()
      : argv.includes('--resync')
        ? resync(argv)
        : argv.includes('--list')
          ? list()
          : main(),
  );
}
