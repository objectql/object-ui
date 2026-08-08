import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3697: nothing in this repository looks at a version literal written
 * into documentation prose.
 *
 * The family this closes over cost two cleanup PRs in one morning. `@objectstack/spec`
 * `^3.3.0` and `Node >= 18` sat frozen in 36 package READMEs (#3645, PR #3688) and on
 * one site page (#3689, PR #3698) while the repository walked from spec 3.x to
 * `^17.0.0-rc.5` and root `engines.node` to `>=22`. Both were found by a human census,
 * not by a gate, because every gate in `scripts/` judges something else: links
 * (`check-doc-links.mjs`), control bytes, i18n keys and values, spec symbol derivation,
 * script coverage, changeset shape. Not one reads a version number.
 *
 * ## What this gate actually promises, and what it does not
 *
 * It is a RATCHET, not a correctness check. It cannot know whether "Tailwind CSS v3.3+"
 * is true — that would need a per-claim anchor, and most claims here have none. What it
 * can decide is the EVENT: a version literal appeared in a doc surface and nobody wrote
 * down why. Every literal on the two scanned surfaces is either
 *
 *   - structurally exempt, because it sits under a version heading (release notes are
 *     history: `## v3.3.0` sections describe what was true at that release and must stay
 *     frozen), or
 *   - listed in `KNOWN_CLAIMS` below with a classification and a reason.
 *
 * Anything else fails. Adding a new version literal therefore costs an inventory entry
 * and a sentence justifying it, which is precisely the review step the #3645 family
 * never got.
 *
 * The inventory ratchets in both directions: an entry naming a claim that is no longer
 * in the tree also fails, so cleaning a doc forces the list to shrink and the list can
 * never rot into a permanent hole (same stance as `DOCUMENTATION_EXEMPT` in
 * `ci-cd-pipeline-doc.test.ts`).
 *
 * ## The census that set the design (measured on d46b40324, the merge of PR #3698)
 *
 * The dispatch expected the bare-claim count to be zero, since #3688 and #3698 had just
 * cleared this family. It is not zero — those two PRs cleared the `^3.3.0` / `>= 18`
 * SPELLINGS from the surfaces they touched, and the general shape was never measured:
 *
 *   221 files scanned, 38 literals matched, 11 structurally exempt, 27 inventoried.
 *
 * Of the 27, NINE were measurably wrong at that cut and were recorded as `stale` —
 * including `@objectstack/spec ^4.0.4` in the architecture overview's layer diagram,
 * thirteen majors behind the `^17.0.0-rc.5` every manifest declares. None was fixed by
 * objectui#3697 itself: that was a test-only task and every repair is a docs edit, so
 * they were filed separately. Inventorying a known-false line with `kind: 'stale'`
 * recorded the debt instead of blessing it, and still stopped a tenth from joining
 * them silently.
 *
 * EIGHT of those nine have since been paid off — objectui#3708 (the two spec claims and
 * the TypeScript one), #3709 (the three scaffolder-output lines) and #3710 (layout's
 * peer line and plugin-chatbot's `@ai-sdk/react` major). Their entries left this file in
 * the same change, which is the downward half of the ratchet doing its job rather than
 * a courtesy. One `stale` entry remains, `packages/plugin-report/README.md`, and it is
 * the one repair that belongs on the MANIFEST side: objectui#3690 widens the package's
 * `peerDependencies.react`, after which the README is correct without being touched.
 *
 * ## Fences are SCANNED — the opposite of `check-doc-links.mjs`, on purpose
 *
 * `check-doc-links.mjs` blanks fenced blocks via `stripCode()` and its header argues
 * against widening: fenced code legitimately contains `[...](...)` that is not a link,
 * and a gate that told an illustrative route from an executable one would be a different
 * gate. That reasoning is sound THERE and inverts HERE, because the two gates pay
 * different prices for a false positive.
 *
 * `check-doc-links.mjs` has no inventory, so a false positive is permanent red and must
 * be designed out. This gate has one, so a false positive costs a single line saying
 * "illustrative sample, not a claim" — while a miss costs the whole #3645 family again.
 * The measurement makes the trade concrete: stripping fences drops 12 of the 38 hits,
 * and among the dropped were the two worst defects the census found — both of them
 * since repaired, which is the argument's strongest evidence rather than a reason to
 * delete it. A fence-stripping gate would have reported green over both of these:
 *
 *   - `architecture-overview.md`, the layer diagram, stated `@objectstack/spec ^4.0.4`
 *     inside an ASCII box (a fence), 13 majors stale — fixed by objectui#3708;
 *   - `create-plugin.mdx` documented the scaffolder's output as pinning
 *     `@object-ui/core` `^0.3.0`, when the manifest literal in
 *     `packages/create-plugin/src/index.ts` actually writes workspace-link dependencies
 *     and no such peer at all — fixed by objectui#3709.
 *
 * So: scan fences, absorb the samples in the inventory. The residual hole is stated
 * rather than implied — a version literal in a file OUTSIDE the two scan roots is
 * invisible here, exactly as it was before.
 *
 * ## The version-heading exemption is deliberately narrow, and here is why
 *
 * The obvious spelling — "a heading containing something that looks like a version" —
 * silently exempts an entire document. Measured: `content/docs/rfcs/0001-clipboard-paste.md`
 * numbers its sections `### 1.1`, `### 5.1`, `### 7.3`, and 18 of those match a loose
 * pattern. The whole RFC would have dropped out of the scan while the gate reported
 * green.
 *
 * `VERSION_HEADING` therefore anchors at the START of the heading text and demands
 * either a `v` prefix or a full three-part version: `## v3.3.0 - 2026-04-17` and
 * `## [3.3.0] - 2026-04-17` are release sections; `### 6.4 Quick-paste optimisation` is
 * a numbered paragraph and stays scanned. That distinction is pinned by its own test
 * below, because it is the one place where a lazier regex turns this gate vacuous.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The two surfaces objectui#3697 names. Both are read by humans looking for the
 * version they must install, and both are already walked by `check-doc-links.mjs`
 * (scan roots 1 and 7) — this gate adds a second question about the same files.
 */
const SCAN_ROOTS = ['content/docs', 'packages/*/README.md'] as const;

const UNSCANNED_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', '.git']);

/**
 * Range operators a version literal may carry, ASCII and typographic alike.
 *
 * Every regex fragment below is a plain quoted string rather than a `String.raw`
 * template, for one mechanical reason: these character classes must contain a literal
 * BACKTICK, because markdown quotes package names that way, and a backtick cannot
 * appear inside a backtick-delimited template at all.
 */
const OP = '(?:\\^|~|>=|<=|>|<|=|≥|≤)';

/**
 * What counts as a version.
 *
 * Deliberately NOT "a name followed by any number". The corpus contains
 * `| parseClipboard | Vitest | 100% branch |` and `| coerceCell | Vitest | 100% |`
 * (`rfcs/0001-clipboard-paste.md:461`), which a bare-integer rule reads as
 * "Vitest 100". A literal must therefore be dotted (`5.0`, `18.2.0`, `22.x`),
 * operator-prefixed (`^18`, `>= 18`, the typographic `≥ 18`), `v`-prefixed
 * (`v3`), or an explicit floor (`18+`).
 *
 * The cost of that strictness, stated: a bare major with no operator and no dot —
 * "our Tailwind 4" in `packages/plugin-chatbot/README.md:9` — is NOT matched. Loosening
 * to catch it takes the corpus from 38 hits to 37 flagged (measured), most of them
 * prose numbers that are not versions at all. A major-only mention is also the least
 * drift-prone spelling there is, so the recall lost is the recall worth losing.
 */
const VERSION =
  '(?:' + OP + '\\s*v?\\d+(?:\\.\\d+)*(?:\\.x)?|v\\d+(?:\\.\\d+)*|\\d+\\.[\\dx]+(?:\\.[\\dx]+)*|\\d+\\+)';

/** A package in a scope this repository publishes or consumes as its contract. */
const FIRST_PARTY = '@(?:objectstack|object-ui)/(?:\\*|[a-z][a-z0-9-]*)';

/** Toolchain and runtime names whose version a reader would act on. */
const TOOLCHAIN =
  '(?:Node\\.js|Node|TypeScript|Tailwind CSS|Tailwind|React DOM|React|pnpm|Vite|Vitest|npm|Zod)';

/**
 * What may sit between the name and its version: quoting, a table pipe, a colon,
 * a dash. Bounded at six characters so `@object-ui/*` on one side of a sentence and
 * an unrelated number on the other are not welded into a claim.
 */
/**
 * A literal backtick, written as the escape rather than pasted, so the character that
 * delimits template literals never appears raw in this file.
 *
 * Related trap, paid for while writing this file and recorded so the next reader does
 * not pay it again: a package glob written in PROSE inside one of these block comments
 * ends the comment early, because a segment wildcard followed by a slash IS the comment
 * terminator. The parser then reports a nonsense error a dozen lines further down, on a
 * line that is itself a comment. Same shape as this repo's no-raw-control-byte rule —
 * writing ABOUT a delimiter is exactly when you materialise it — so package globs are
 * spelled without the wildcard in the comments here.
 */
const TICK = '\u0060';
const SEP = '[' + TICK + '\'"\\s:,|)\\]]{0,6}(?:[-—]\\s*)?[' + TICK + '\'"]?\\s*';

/**
 * Case-insensitive, and the reason is the biggest single class in the corpus: the
 * "Peer Dependencies" lists in the package READMEs quote the package name
 * lowercase and in backticks. A case-sensitive scan finds 8 flagged claims; the same
 * scan case-insensitively finds 27, and the 19 it adds are exactly those manifest
 * restatements — the class where two entries are already drifted from the manifest
 * they restate.
 */
const CLAIM_RES = [
  new RegExp(FIRST_PARTY + SEP + '(' + VERSION + ')', 'gi'),
  // The optional `@scope/` prefix lets a third-party package whose name ends in a
  // toolchain word be read as one claim: `@ai-sdk/react` v3 in plugin-chatbot's README.
  new RegExp('(?:@[a-z0-9-]+/)?\\b' + TOOLCHAIN + '\\b' + SEP + '(' + VERSION + ')(?!\\s*%)', 'gi'),
];

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;

/**
 * A heading that opens a section of HISTORY. See the header: anchored at the start,
 * and a two-part version must carry a `v` so that `### 4.1 Layering` is not a release.
 */
const VERSION_HEADING = /^\[?(?:v\d+\.\d+(?:\.\d+)?|\d+\.\d+\.\d+)(?![\d.])/;

interface Claim {
  file: string;
  line: number;
  /** Whitespace-normalised matched text — the inventory key, stable across reflows. */
  claim: string;
  inFence: boolean;
  /** The version heading this claim sits under, if any. */
  underVersionHeading: string | null;
}

function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!UNSCANNED_DIRS.has(entry.name)) walk(full, out);
      continue;
    }
    if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Expands one scan root. The only glob syntax is a whole segment that is `*`. */
function collectFiles(root: string): string[] {
  const abs = path.join(repoRoot, root);
  if (!root.includes('*')) {
    try {
      if (fs.statSync(abs).isFile()) return [abs];
    } catch {
      return [];
    }
    return walk(abs).sort();
  }
  const [before, after] = root.split('*');
  const parent = path.join(repoRoot, before);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(parent, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && !UNSCANNED_DIRS.has(e.name))
    .map((e) => path.join(parent, e.name, after))
    .filter((p) => fs.existsSync(p))
    .sort();
}

/**
 * Every version claim in one file, tagged with the fence state and the nearest
 * enclosing version heading. Fenced lines are scanned (see header); fence DELIMITER
 * lines are not, because ```ts is not a claim.
 */
function claimsIn(file: string): Claim[] {
  const rel = path.relative(repoRoot, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const found: Claim[] = [];
  const headings: { level: number; text: string }[] = [];
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = FENCE_RE.exec(line);

    if (fence) {
      const closes =
        fenceMatch != null &&
        fenceMatch[2][0] === fence[0] &&
        fenceMatch[2].length >= fence.length &&
        fenceMatch[3].trim() === '';
      if (closes) fence = null;
      else collect(line, i, true);
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[2];
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (headings.length > 0 && headings[headings.length - 1].level >= level) headings.pop();
      headings.push({ level, text: heading[2].trim() });
    }
    collect(line, i, false);
  }

  function collect(line: string, index: number, inFence: boolean): void {
    // Any ANCESTOR heading being a version section is enough: the compatibility
    // matrix sits under `### Compatibility Matrix` under `## v3.3.0`.
    const versionHeading = headings.find((h) => VERSION_HEADING.test(h.text));
    for (const re of CLAIM_RES) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(line)) !== null) {
        found.push({
          file: rel,
          line: index + 1,
          claim: match[0].replace(/\s+/g, ' ').trim(),
          inFence,
          underVersionHeading: versionHeading?.text ?? null,
        });
      }
    }
  }

  return found;
}

const scannedFiles = SCAN_ROOTS.flatMap(collectFiles);
const allClaims = scannedFiles.flatMap(claimsIn);
const exemptClaims = allClaims.filter((c) => c.underVersionHeading !== null);
const flaggedClaims = allClaims.filter((c) => c.underVersionHeading === null);

/** The inventory key. File plus claim text, so an edit above does not invalidate it. */
const keyOf = (c: Pick<Claim, 'file' | 'claim'>): string => `${c.file} :: ${c.claim}`;

/**
 * How a recorded claim earns its place.
 *
 * The dispatch for objectui#3697 proposed three classes — history, toolchain fact,
 * bare claim. The census needed five; the two extra are reported with this PR rather
 * than folded in silently, because each carries a different repair.
 *
 * `anchored`     - true today AND checkable against a machine-readable truth in this
 *                  tree, so a reviewer can re-verify it in one command.
 * `restatement`  - a README restating its OWN package.json. Formally a subclass of
 *                  `anchored`, kept separate because it is the largest class (12 of 21)
 *                  and the one that had already drifted: the two drifted members were
 *                  repaired by objectui#3710 and re-filed here as restatements. Note
 *                  what this class does and does not buy — the equality it names is
 *                  re-verified by a HUMAN reading the manifest, not by this gate, which
 *                  only asks whether a literal was recorded at all. Pinning README to
 *                  manifest mechanically is still the payoff this class is pointing at.
 * `sample`       - illustrative or template content. NOT an assertion about this
 *                  repository's versions: a changelog a plugin renders as demo data, or
 *                  a package.json skeleton the reader owns after copying it.
 * `unanchored`   - a claim about this repository with no checkable anchor anywhere,
 *                  believed true today. The class this gate exists to shrink: nothing
 *                  can tell us when it stops being true.
 * `stale`        - measured WRONG at the time of writing. Recorded, not blessed.
 *
 * Nine of the 27 were `stale` at the census. Eight have been paid off (objectui#3708,
 * #3709, #3710) and their entries deleted in the same change; ONE remains, and it is
 * the one whose repair is a manifest edit rather than a docs edit (objectui#3690).
 * Inventorying a known-false line records the debt where the next reader will trip over
 * it, and the ratchet still stops a tenth from joining them unnoticed.
 */
type ClaimKind = 'anchored' | 'restatement' | 'sample' | 'unanchored' | 'stale';

interface KnownClaim {
  file: string;
  claim: string;
  kind: ClaimKind;
  why: string;
}

/**
 * The peer-dependency line 10 package READMEs carry verbatim from their manifests —
 * `layout` joined them in objectui#3710, which narrowed its over-promising `>=` spelling
 * to the range its manifest actually declares. An eleventh README, `plugin-report`,
 * carries the same line WITHOUT the manifest to back it; that one stays `stale` below.
 */
const PEER_18_19 = 'react' + TICK + ' ^18.0.0';
const PEER_RESTATEMENT_OK =
  'Restates this package peerDependencies.react verbatim; re-verify with a one-line read of the manifest.';

const KNOWN_CLAIMS: KnownClaim[] = [
  // --- content/docs ------------------------------------------------------------
  {
    file: 'content/docs/guide/ci-cd-pipeline.md',
    claim: 'Node 22.x',
    kind: 'anchored',
    why: 'Matches the 14 node-version: 22.x declarations across .github/workflows. Verified true; this page already has its own pin test (ci-cd-pipeline-doc.test.ts).',
  },
  {
    file: 'content/docs/guide/plugins.md',
    claim: 'react": "^18.0.0',
    kind: 'sample',
    why: 'A package.json skeleton for a plugin author to copy into THEIR repo. Not a statement about versions this repository uses or requires.',
  },
  {
    file: 'content/docs/guide/plugins.md',
    claim: 'typescript": "^5.0.0',
    kind: 'sample',
    why: 'Same skeleton block. Advice a plugin author owns once copied, not a claim this repo can be measured against.',
  },
  {
    file: 'content/docs/guide/plugins.md',
    claim: 'vite": "^5.0.0',
    kind: 'sample',
    why: 'Same skeleton block; the plugin author picks their own bundler version after copying it.',
  },
  {
    file: 'content/docs/guide/theming.md',
    claim: 'Tailwind CSS v3.3',
    kind: 'unanchored',
    why: 'A capability floor for RTL logical properties ("requires v3.3+ or v4"), not a claim about the version shipped here. Satisfied by the ^4.x this repo uses, but nothing can check it.',
  },
  {
    file: 'content/docs/guide/troubleshooting.md',
    claim: 'React 18+',
    kind: 'unanchored',
    why: 'Consistent with the ^18.0.0 || ^19.0.0 peer ranges, but stated repo-wide with no per-package anchor, so no gate can tell when it stops being true.',
  },
  {
    file: 'content/docs/plugins/plugin-markdown.mdx',
    claim: 'react | 18.2.0',
    kind: 'sample',
    why: 'Demo content inside a template literal: a fake changelog fed to the markdown renderer to show a table. Names no real dependency of this repo.',
  },
  {
    file: 'content/docs/plugins/plugin-markdown.mdx',
    claim: 'vite | 4.5.0',
    kind: 'sample',
    why: 'Second row of the same fake changelog demo string.',
  },

  // --- packages/<name>/README.md ----------------------------------------------
  { file: 'packages/auth/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/collaboration/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/components/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/i18n/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/layout/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/mobile/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/permissions/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/plugin-ai/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/plugin-designer/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/react/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  {
    file: 'packages/react-runtime/README.md',
    claim: 'react >= 18',
    kind: 'restatement',
    why: 'Restates this package peerDependencies.react, which is literally ">=18" — the one README whose looser spelling is the manifest spelling.',
  },
  {
    file: 'packages/plugin-report/README.md',
    claim: PEER_18_19,
    kind: 'stale',
    why: 'Claims ^18.0.0 || ^19.0.0 while this package peerDependencies.react is ^18.0.0 alone — the sole UI package without React 19, first noticed as an out-of-scope finding in PR #3688.',
  },
  {
    file: 'packages/plugin-chatbot/README.md',
    claim: '@ai-sdk/react' + TICK + ' v4',
    kind: 'restatement',
    why: 'Names the major of this package own dependencies["@ai-sdk/react"], which is ^4.0.47. Kept rather than deleted because the reader follows it to the streaming protocol docs; re-verify with a one-line read of the manifest.',
  },
];

describe('doc version claims - the scan itself', () => {
  it('reads a plausible corpus, so a broken scan cannot report green', () => {
    // Every count below is a floor, not the measured value: docs are added and
    // removed constantly and this test must not become a file-count pin. What it
    // must catch is a scan that silently collapsed to nothing — the failure mode
    // that would make every other assertion in this file vacuously true.
    expect(scannedFiles.length, 'the scan roots resolved to implausibly few files').toBeGreaterThan(150);
    expect(
      allClaims.length,
      'the claim regexes matched implausibly little - they were measured at 38 hits on d46b40324',
    ).toBeGreaterThan(25);
  });

  it('exercises the version-heading exemption, so the exemption is not decorative', () => {
    // objectui#3697 names two lines as the control group that must stay green:
    // release-notes.md's `Bump every @object-ui/* dependency to ^3.3.0` upgrade step
    // and the `| Node.js | >= 18 |` row of the v3.3.0 compatibility matrix. Green by
    // NOT MATCHING would prove nothing, so the floor asserts the exemption path is
    // actually taken, and the file assertion names where.
    expect(
      exemptClaims.length,
      'no claim was structurally exempted - either release-notes.md lost its version ' +
        'sections or VERSION_HEADING stopped matching them, and the exemption this gate ' +
        'depends on is now untested',
    ).toBeGreaterThanOrEqual(8);

    const exemptFiles = new Set(exemptClaims.map((c) => c.file));
    expect(exemptFiles, 'the v3.3.0 release section must still be reached by the exemption').toContain(
      'content/docs/guide/release-notes.md',
    );
  });

  it('does not treat a numbered section heading as a release section', () => {
    // The trap that would make this whole file vacuous. `0001-clipboard-paste.md`
    // numbers 18 of its headings `### N.M`; a loose "heading contains a version"
    // rule exempts the entire RFC and the gate still prints green.
    for (const notARelease of ['1.1 Real-world scenarios', '6.4 Quick-paste optimisation (deferred to v1.1)', '7.3 ImportWizard (refactor for reuse)', 'Migrating to v4', '2.2 Non-Goals (explicitly deferred)']) {
      expect(VERSION_HEADING.test(notARelease), `"${notARelease}" must stay SCANNED, not exempt`).toBe(false);
    }
    for (const isARelease of ['v3.3.0 - 2026-04-17 First Official Release', '[3.3.0] - 2026-04-17', 'v4.0 Migration', '17.0.0-rc.5 notes']) {
      expect(VERSION_HEADING.test(isARelease), `"${isARelease}" is a release section and must be exempt`).toBe(true);
    }

    // And the exemption must not have swallowed the RFC in practice, either.
    expect(
      exemptClaims.map((c) => c.file),
      'content/docs/rfcs/0001-clipboard-paste.md was structurally exempted - its numbered ' +
        'headings are being read as release sections again',
    ).not.toContain('content/docs/rfcs/0001-clipboard-paste.md');
  });
});

describe('doc version claims - the ratchet', () => {
  it('records every version literal on the scanned surfaces', () => {
    const known = new Set(KNOWN_CLAIMS.map(keyOf));
    const unrecorded = flaggedClaims.filter((c) => !known.has(keyOf(c)));

    expect(
      unrecorded.map((c) => `${c.file}:${c.line}  ${c.claim}`),
      `These doc surfaces state a version and nothing in this repository can tell whether ` +
        `it is still true:\n` +
        unrecorded.map((c) => `  - ${c.file}:${c.line}  ${JSON.stringify(c.claim)}`).join('\n') +
        `\n\nPrefer DELETING the literal and pointing at the truth instead — the root ` +
        `package.json \`engines\`, the package's own \`peerDependencies\`, the workflow. ` +
        `That is what PR #3688 did to 36 READMEs and PR #3698 to the CLI page, and it is ` +
        `the only spelling that cannot go stale.\n\n` +
        `If the literal must stay, add it to KNOWN_CLAIMS in this file with a \`kind\` and a ` +
        `reason. objectui#3645 froze \`@objectstack/spec ^3.3.0\` across 36 READMEs for ` +
        `thirteen major versions precisely because no review step ever asked this question.`,
    ).toEqual([]);
  });

  it('keeps the inventory honest - no entry may outlive the claim it excuses', () => {
    const present = new Set(flaggedClaims.map(keyOf));
    const stale = KNOWN_CLAIMS.filter((entry) => !present.has(keyOf(entry)));

    expect(
      stale.map((e) => keyOf(e)),
      `KNOWN_CLAIMS names version claims that are no longer in the tree:\n` +
        stale.map((e) => `  - ${keyOf(e)}`).join('\n') +
        `\n\nDelete the entries. The inventory only ratchets downward if a cleaned-up doc ` +
        `forces its entry out; a list allowed to keep dead rows becomes a permanent hole ` +
        `(the same reason DOCUMENTATION_EXEMPT in ci-cd-pipeline-doc.test.ts is checked ` +
        `against the workflow directory).`,
    ).toEqual([]);
  });

  it('makes every inventory entry carry a real justification', () => {
    for (const entry of KNOWN_CLAIMS) {
      expect(entry.why.length, `KNOWN_CLAIMS[${keyOf(entry)}] needs a reason, not a placeholder`).toBeGreaterThan(25);
    }
    // Duplicate keys would let one entry silently excuse a second claim.
    const keys = KNOWN_CLAIMS.map(keyOf);
    expect(new Set(keys).size, 'KNOWN_CLAIMS has duplicate entries').toBe(keys.length);
  });
});
