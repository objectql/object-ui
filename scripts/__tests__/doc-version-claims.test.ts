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
 * It is a RATCHET first, and a correctness check for exactly ONE class (the section after
 * next). It cannot know whether "Tailwind CSS v3.3+" is true — that would need a per-claim
 * anchor, and most claims here have none. What it can decide is the EVENT: a version
 * literal appeared in a doc surface and nobody wrote down why. Every literal on the two
 * scanned surfaces is either
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
 * ## The one class this file ASSERTS instead of recording (objectui#3717)
 *
 * The paragraph above holds for four of the five classes below. `restatement` is the
 * exception, and it can be one for a structural reason the others lack: a README restating
 * its OWN peer range has a machine-readable anchor lying next to it. Every peer-line
 * restatement entry is therefore resolved to the line it was matched on, the dep name and
 * the FULL range are parsed off that line, the manifest beside that README is read, and
 * the two ranges must be equal. That is `describe('the peer-line assertion')` below, and
 * it is the whole of objectui#3710's ruling B — which landed only its first half, the
 * prose narrowing; the `why` strings kept saying "re-verify with a one-line read of the
 * manifest", i.e. a human, until this test replaced that sentence with a run.
 *
 * The hole it closes is one the ratchet is STRUCTURALLY blind to, not merely lazy about.
 * The inventory key is the matched literal, and a match stops at the FIRST version token:
 * the key for a line reading `^18.0.0 || ^19.0.0` records only `^18.0.0`. So widen a
 * manifest to a third arm, or narrow it to one, and the literal is untouched, the entry is
 * untouched, and both directions of the ratchet report green over a README that now
 * misstates the range. objectui#3690 was exactly that shape, found by a human census
 * (there the README was right and the MANIFEST lagged it — the assertion is symmetric, it
 * names the disagreement, not the guilty side). objectui#3741, still open, proposes
 * narrowing react-runtime's manifest range; the day someone does, this test goes red until
 * that README follows.
 *
 * Two boundaries, both deliberate, both pinned below:
 *
 *   - PEER lines only. plugin-chatbot's entry restates the MAJOR of its own
 *     dependencies["@ai-sdk/react"], which is not a peer range and not verbatim, so it
 *     carries `notAPeerRestatement` and is skipped BY NAME. One rule judges one kind of
 *     fact: a rule mixing verbatim equality with major-compatibility would leave the next
 *     reader unable to say what its red means.
 *   - Whitespace inside a range is insignificant; nothing else is. See `sameRange`.
 *
 * Still not promised, stated so it is not mistaken for covered: a literal with no
 * same-package anchor (`unanchored`, `sample`) is recorded and not checked.
 *
 * ## What objectui#3750 added: the block, not just the ledgered lines
 *
 * Until then the peer assertion's input set was the LEDGER — the `restatement` entries —
 * and that is narrower than the thing a reader acts on. Measured on 8ad6070fb: the peer
 * blocks hold 28 backticked statements, the ledger names 12 of them (all `react`), and of
 * the 16 nobody compared, NINE disagreed with their own manifest. The worst was
 * `packages/components/README.md` telling readers to install `tailwindcss` `^3.0.0`
 * against a manifest demanding `^4.2.1` — follow the README and npm rejects the peer.
 *
 * The ledger could not have caught any of the nine, for two independent reasons, and both
 * are worth naming because they are different failures:
 *
 *   - `tailwindcss` never MATCHED the scan. `TOOLCHAIN` spelled the name as
 *     `Tailwind CSS|Tailwind`, and `Tailwind` with a trailing word boundary does not
 *     match inside `tailwindcss` — the `css` continues the word. So the line never became
 *     a claim, never earned an inventory entry, and both directions of the ratchet were
 *     green over it. Fixed here by adding the lowercase package spelling to `TOOLCHAIN`;
 *     measured to newly match exactly one line in the 221-file corpus, that one.
 *   - The other eight were STRUCTURAL, and no regex fix reaches them. Five READMEs listed
 *     a `react-dom` peer their manifest does not declare (and whose `src` contains not one
 *     react-dom reference); three listed `@object-ui/core` with no version literal at all,
 *     which is not a version claim in any spelling, so a scan for version literals is the
 *     wrong instrument by construction.
 *
 * Hence the input set below is the UNION: every statement the ledger resolves, plus every
 * bullet of every `Peer Dependencies` block, deduplicated by line so one drift has one
 * reporter. A bullet naming a dep the manifest does not declare is a failure even though
 * it carries no version, which is precisely the class the ratchet cannot express.
 *
 * The REVERSE direction — every declared peer must appear in the block — is here too, but
 * scoped to READMEs that ALREADY HAVE a block, and that scoping is the whole decision.
 * Measured: 11 of 39 packages have one, and 20 of the 28 without declare peers. Repo-wide
 * the rule would demand 20 new blocks written to satisfy a test, which is churn buying
 * nothing — a package that documents its peers nowhere is not lying to anyone. Scoped to
 * packages that opted in by writing a block, it is a promise the README already made:
 * this list is the peers. It found one real gap on a tree where the forward direction was
 * clean — `plugin-designer` declared a `react-router-dom` peer its block never mentioned,
 * so a reader following that README installs the package and gets an unmet-peer warning
 * for a dependency the README never named.
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
 * ALL NINE have since been paid off — objectui#3708 (the two spec claims and the
 * TypeScript one), #3709 (the three scaffolder-output lines), #3710 (layout's peer line
 * and plugin-chatbot's `@ai-sdk/react` major) and #3690 (the last one, below). Their
 * entries left this file in the same changes that repaired them, which is the downward
 * half of the ratchet doing its job rather than a courtesy. NO `stale` entry remains.
 *
 * The last one out, `packages/plugin-report/README.md`, was also the only one whose
 * repair belonged on the MANIFEST side rather than in prose: it was the one entry where
 * the README was RIGHT and the manifest lagged it, so objectui#3690 widened that
 * package's `peerDependencies.react`/`react-dom` to `^18.0.0 || ^19.0.0` and the claim
 * became true without a character of prose being touched. Its entry is now a plain
 * `restatement`. That direction — fix the anchor, not the sentence — is the cheapest way
 * an entry ever leaves this list. The class is empty, not abolished: `stale` stays in
 * `ClaimKind` so the next known-false literal can still be recorded rather than blessed.
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

/**
 * Toolchain and runtime names whose version a reader would act on.
 *
 * `tailwindcss` is listed SEPARATELY from `Tailwind`, and that is a fix rather than a
 * duplicate (objectui#3750). These alternatives are applied between word boundaries, and
 * `Tailwind` followed by a boundary cannot match inside `tailwindcss`: the `css` continues
 * the word. The package spelling — the one a peer line and a package.json both use — was
 * therefore invisible to this scan from the day it was written, which is how
 * `packages/components/README.md` held `tailwindcss` `^3.0.0` against a `^4.2.1` manifest
 * with every gate green.
 *
 * Ordering is load-bearing: JavaScript alternation is first-match, not longest-match, so
 * `Tailwind CSS` must stay ahead of `tailwindcss` (otherwise, case-insensitively,
 * "Tailwind CSS v3.3" would... not actually break, since `tailwindcss` needs the letters
 * adjacent — but the general rule is cheap to honour and the next name added may not be
 * so forgiving). Measured cost of the addition across the 221-file corpus: exactly one new
 * match, `packages/components/README.md` line 41 — repaired in the same change and
 * inventoried below.
 */
const TOOLCHAIN =
  '(?:Node\\.js|Node|TypeScript|Tailwind CSS|tailwindcss|Tailwind|React DOM|React|pnpm|Vite|Vitest|npm|Zod)';

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
 *                  `anchored`, kept separate because it is the largest class (13 of 21)
 *                  and the one that had already drifted: the two drifted members were
 *                  repaired by objectui#3710 and re-filed here as restatements, and a
 *                  third joined from `stale` when objectui#3690 widened the manifest its
 *                  README already described. Since objectui#3717 this is the one class
 *                  whose named equality is MACHINE-checked: the peer-line assertion below
 *                  reads the manifest and demands the ranges match. An entry that does
 *                  not restate a peer range cannot join quietly — it must say so in
 *                  `notAPeerRestatement`.
 * `sample`       - illustrative or template content. NOT an assertion about this
 *                  repository's versions: a changelog a plugin renders as demo data, or
 *                  a package.json skeleton the reader owns after copying it.
 * `unanchored`   - a claim about this repository with no checkable anchor anywhere,
 *                  believed true today. The class this gate exists to shrink: nothing
 *                  can tell us when it stops being true.
 * `stale`        - measured WRONG at the time of writing. Recorded, not blessed.
 *
 * Nine of the 27 were `stale` at the census. ALL NINE have been paid off — objectui#3708,
 * #3709 and #3710 on the docs side, and #3690 on the manifest side (the one entry whose
 * repair was a manifest edit, not a docs edit) — and their entries were deleted in the
 * same changes, so NONE remains today. Inventorying a known-false line records the debt
 * where the next reader will trip over it, and the ratchet still stops a tenth from
 * joining them unnoticed, which is why the class outlives its last member.
 */
type ClaimKind = 'anchored' | 'restatement' | 'sample' | 'unanchored' | 'stale';

interface KnownClaim {
  file: string;
  claim: string;
  kind: ClaimKind;
  why: string;
  /**
   * Only legal on a `restatement`, and it is how such an entry opts OUT of the verbatim
   * peer assertion — carrying the reason, not a boolean, so the opt-out is as documented
   * as the entry itself.
   *
   * The assertion refuses to let this field and real coverage coexist: an entry either
   * resolves to a peer statement that is checked, or names why it cannot, never both and
   * never neither. So a future `restatement` with no peer anchor cannot drift out of
   * coverage by simply not parsing — it goes red until someone writes the sentence.
   */
  notAPeerRestatement?: string;
}

/**
 * The peer-dependency line 11 package READMEs carry verbatim from their manifests —
 * `layout` joined them in objectui#3710, which narrowed its over-promising `>=` spelling
 * to the range its manifest actually declares, and `plugin-report` joined in
 * objectui#3690 from the opposite direction: it had carried this line WITHOUT the
 * manifest to back it, so the manifest was widened to `^18.0.0 || ^19.0.0` rather than
 * the sentence rewritten.
 */
const PEER_18_19 = 'react' + TICK + ' ^18.0.0';
const PEER_RESTATEMENT_OK =
  'Restates this package peerDependencies.react verbatim; asserted against the manifest by the peer-line assertion below (objectui#3717), no longer by a human reading it.';

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
  {
    file: 'packages/components/README.md',
    claim: 'tailwindcss' + TICK + ' ^4.2.1',
    kind: 'restatement',
    why: 'Restates this package peerDependencies.tailwindcss verbatim. Newly VISIBLE to the scan in objectui#3750 — the TOOLCHAIN word-boundary fix above — and repaired in the same change: it read ^3.0.0 against a ^4.2.1 manifest, and the package is Tailwind 4 only (its postcss.config.js loads @tailwindcss/postcss, which has no v3 counterpart, and src/index.css opens with an @import of tailwindcss and uses the v4-only @theme and @custom-variant at-rules, with no tailwind.config.js anywhere).',
  },
  { file: 'packages/i18n/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/layout/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/mobile/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/permissions/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/plugin-ai/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/plugin-designer/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/plugin-report/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  { file: 'packages/react/README.md', claim: PEER_18_19, kind: 'restatement', why: PEER_RESTATEMENT_OK },
  {
    file: 'packages/react-runtime/README.md',
    claim: 'react >= 18',
    kind: 'restatement',
    why: 'Restates this package peerDependencies.react, which is literally ">=18" — the one README whose looser spelling is the manifest spelling.',
  },
  {
    file: 'packages/plugin-chatbot/README.md',
    claim: '@ai-sdk/react' + TICK + ' v4',
    kind: 'restatement',
    why: 'Names the major of this package own dependencies["@ai-sdk/react"], which is ^4.0.47. Kept rather than deleted because the reader follows it to the streaming protocol docs; re-verify with a one-line read of the manifest.',
    notAPeerRestatement:
      'Restates a dependencies entry, not a peerDependencies range, and restates its MAJOR ("v4" for ^4.0.47) rather than the range verbatim. Both facts put it outside the peer-line assertion, which judges verbatim equality of a peer range and nothing else. Covering it would need a second, weaker rule ("same major"), and one rule that returns two kinds of red is a rule whose failures nobody can read.',
  },
];

/**
 * The one file shape with a manifest lying next to it. A `restatement` entry naming any
 * other file has nothing to be checked against, and the assertion reports that rather
 * than skipping it — a restatement of a manifest that cannot be located is not a
 * restatement.
 */
const PACKAGE_README = /^packages\/([^/]+)\/README\.md$/;

/** Wraps text in the backticks markdown quotes it with, without writing one raw. */
const ticked = (text: string): string => TICK + text + TICK;

interface PeerStatement {
  dep: string;
  range: string;
}

/** A range must OPEN with an operator or a digit. See `parsePeerStatement`. */
const RANGE_OPENS = /^[\^~><=\d]/;

/**
 * The dep and the FULL range one README line states as a peer requirement, or null when
 * the line states none. Two spellings, both measured on the corpus rather than assumed:
 *
 *   - a bullet in a peer-dependency list — 11 of the 12 entries, one spelling between them:
 *       - `react` ^18.0.0 || ^19.0.0
 *   - one code span read as prose, `packages/react-runtime/README.md` alone:
 *       `react >= 18` is a peer dependency.
 *
 * Note what the range is here and is not in the inventory key: the key stops at the first
 * version token (`^18.0.0`), this reads the range to end of line (`^18.0.0 || ^19.0.0`).
 * That difference is the entire added reach of the assertion.
 *
 * `RANGE_OPENS` is load-bearing, not tidiness. Without it the bullet shape swallows every
 * list item that opens with a backticked identifier — an API bullet parses as dep
 * "useChat()" with range "returns a stream", and the manifest lookup then fails for a
 * reason that has nothing to do with drift. A gate that goes red for the wrong reason
 * teaches people to stop reading it.
 */
function parsePeerStatement(line: string): PeerStatement | null {
  const bullet = new RegExp(
    '^\\s*[-*]\\s+' + TICK + '([^' + TICK + ']+)' + TICK + '\\s+(\\S.*?)\\s*$',
  ).exec(line);
  if (bullet !== null && RANGE_OPENS.test(bullet[2])) {
    return { dep: bullet[1].trim(), range: bullet[2] };
  }

  const prose = new RegExp(
    TICK + '([^' + TICK + '\\s]+)\\s+([^' + TICK + ']+)' + TICK + '\\s+is a peer dependency',
  ).exec(line);
  if (prose !== null && RANGE_OPENS.test(prose[2].trim())) {
    return { dep: prose[1], range: prose[2].trim() };
  }

  return null;
}

/**
 * The block header, in the one spelling all 11 blocks use, on a line of its own
 * (objectui#3750). Anchored rather than searched-for on purpose: `troubleshooting.md` has
 * a `Missing Peer Dependencies` heading and `data-objectstack.mdx` two prose sentences
 * about peer dependencies, none of them a machine-comparable list, and a loose match would
 * drag all three in and then fail to parse their prose as bullets.
 */
const PEER_BLOCK_HEADING = /^\*\*Peer Dependencies:?\*\*$/i;

/** A bullet naming a backticked dep, with whatever follows it. Range optional HERE. */
const PEER_BULLET = new RegExp(
  '^\\s*[-*]\\s+' + TICK + '([^' + TICK + ']+)' + TICK + '\\s*(.*?)\\s*$',
);

/** Any list item, conforming or not — what the block walker uses to find the block's end. */
const ANY_BULLET = /^\s*[-*]\s+\S/;

interface PeerBullet {
  line: number;
  /** null when the line is a bullet but does not name a backticked dep at all. */
  dep: string | null;
  /** Text after the dep name; empty string when the bullet states no range. */
  rest: string;
  raw: string;
}

/**
 * Every bullet of one README's peer block, or null when it has no block.
 *
 * Deliberately NOT built on `parsePeerStatement`: that function answers "is this line a
 * peer statement with a range", and returns null for `- ` + a backticked `@object-ui/core`
 * with nothing after it. Three READMEs carried exactly that line while their manifests
 * declared no such peer, and a block reader that inherited the same null would have walked
 * straight past all three. Inside a block the question is different — every bullet is a
 * claim about a peer whether or not it carries a version — so the range is optional at
 * PARSE time and its absence is judged by the assertion instead.
 *
 * The walker skips blank lines and stops at the first non-blank line that is not a list
 * item, which is what ends every block in the corpus (a level-2 heading) and also ends one
 * followed by a prose paragraph.
 */
function peerBlockBullets(rel: string): PeerBullet[] | null {
  const lines = linesOf(rel);
  const start = lines.findIndex((line) => PEER_BLOCK_HEADING.test(line.trim()));
  if (start < 0) return null;

  const bullets: PeerBullet[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === '') continue;
    if (!ANY_BULLET.test(raw)) break;
    const match = PEER_BULLET.exec(raw);
    bullets.push({
      line: i + 1,
      dep: match === null ? null : match[1].trim(),
      rest: match === null ? '' : match[2],
      raw: raw.trim(),
    });
  }
  return bullets;
}

/**
 * Range equality: VERBATIM, up to whitespace INSIDE the range.
 *
 * That one-space normalisation is not a softening, and it exists for a measured reason.
 * `packages/react-runtime/README.md` writes `react >= 18` while its manifest writes
 * `>=18`. Nothing is drifted there — the two spell the same single comparator and npm
 * parses them identically — so byte-strict equality would paint that entry red on a tree
 * where nothing is wrong. The only two answers to such a red are to rewrite one side for
 * the gate's benefit, or to declare the entry uncovered: a cosmetic edit, or lost
 * coverage, in exchange for nothing.
 *
 * Everything this assertion exists to catch survives, because whitespace is the only
 * thing dropped: a bumped major, a `||` arm added or removed, `^` turning into `~`, a
 * vanished upper bound all still compare unequal. Pinned by its own test below — a
 * normaliser that quietly grew to strip operators would make the whole assertion vacuous
 * while every other test in this file stayed green.
 */
const sameRange = (a: string, b: string): boolean =>
  a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

function manifestPeers(pkgDir: string): Record<string, string> | null {
  const abs = path.join(repoRoot, 'packages', pkgDir, 'package.json');
  let raw: string;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
  const json: unknown = JSON.parse(raw);
  const peers = (json as { peerDependencies?: Record<string, string> }).peerDependencies;
  return peers ?? {};
}

const readmeLines = new Map<string, string[]>();
function linesOf(rel: string): string[] {
  let cached = readmeLines.get(rel);
  if (cached === undefined) {
    cached = fs.readFileSync(path.join(repoRoot, rel), 'utf8').split('\n');
    readmeLines.set(rel, cached);
  }
  return cached;
}

interface ComparedPeer {
  line: number;
  dep: string;
  readme: string;
  /** `undefined` when the manifest does not declare this dep as a peer at all. */
  manifest: string | undefined;
}

interface PeerCheck {
  entry: KnownClaim;
  /** Every line carrying this entry's literal that reads as a peer statement. */
  compared: ComparedPeer[];
  /** The entry's file has no manifest beside it. */
  noManifest: boolean;
  /** The literal is not in the tree — the downward ratchet above is its single reporter. */
  absent: boolean;
}

/**
 * Resolution goes through `flaggedClaims`, the same scan the ratchet judges, rather than
 * re-grepping the READMEs. Two reasons, both about composing with what is already here:
 * the scan already turned the whitespace-normalised inventory key back into concrete line
 * numbers, and keying off it means "the literal is not in the tree" is the SAME fact in
 * both tests, so the two can agree on who reports it.
 */
const claimsByKey = new Map<string, Claim[]>();
for (const claim of flaggedClaims) {
  const bucket = claimsByKey.get(keyOf(claim));
  if (bucket === undefined) claimsByKey.set(keyOf(claim), [claim]);
  else bucket.push(claim);
}

const peerChecks: PeerCheck[] = KNOWN_CLAIMS.filter((e) => e.kind === 'restatement').map((entry) => {
  const occurrences = claimsByKey.get(keyOf(entry)) ?? [];
  const pkgDir = PACKAGE_README.exec(entry.file)?.[1];
  const peers = pkgDir === undefined ? null : manifestPeers(pkgDir);
  const compared: ComparedPeer[] = [];

  if (peers !== null) {
    for (const occurrence of occurrences) {
      const stated = parsePeerStatement(linesOf(entry.file)[occurrence.line - 1] ?? '');
      if (stated === null) continue;
      compared.push({
        line: occurrence.line,
        dep: stated.dep,
        readme: stated.range,
        manifest: peers[stated.dep],
      });
    }
  }

  return { entry, compared, noManifest: peers === null, absent: occurrences.length === 0 };
});

/** One statement to be judged against one manifest entry, whatever route found it. */
interface PeerComparison {
  file: string;
  line: number;
  dep: string;
  /** null when the statement names a dep but states no range — see `peerBlockBullets`. */
  readme: string | null;
  /** `undefined` when the manifest does not declare this dep as a peer at all. */
  manifest: string | undefined;
}

/** A bullet inside a peer block that does not even name a backticked dep. */
interface MalformedBullet {
  file: string;
  line: number;
  raw: string;
}

interface PeerBlock {
  file: string;
  pkgDir: string;
  peers: Record<string, string>;
  bullets: PeerBullet[];
}

/**
 * Every package README carrying a peer block, read straight off the file rather than
 * through the ledger. This is objectui#3750's widening: the ledger indexed 12 of the 28
 * statements these blocks make, and nine of the other 16 were wrong.
 */
const peerBlocks: PeerBlock[] = scannedFiles
  .map((abs) => path.relative(repoRoot, abs).split(path.sep).join('/'))
  .flatMap((rel) => {
    const pkgDir = PACKAGE_README.exec(rel)?.[1];
    if (pkgDir === undefined) return [];
    const bullets = peerBlockBullets(rel);
    const peers = manifestPeers(pkgDir);
    if (bullets === null || peers === null) return [];
    return [{ file: rel, pkgDir, peers, bullets }];
  });

const malformedBullets: MalformedBullet[] = peerBlocks.flatMap((block) =>
  block.bullets
    .filter((bullet) => bullet.dep === null)
    .map((bullet) => ({ file: block.file, line: bullet.line, raw: bullet.raw })),
);

/**
 * Ledger-resolved statements first, then every block bullet, deduplicated by line.
 *
 * The dedupe is what keeps "one defect, one reporter" true across the widening: the 12
 * ledgered `react` lines all sit INSIDE blocks, so both routes reach them and without this
 * a single drifted range would print twice and read as two problems. Ledger entries win
 * the tie only because they arrive first; the two routes agree on every field for a line
 * both can see.
 */
const peerComparisons: PeerComparison[] = [];
const seenStatement = new Set<string>();
for (const check of peerChecks) {
  if (check.entry.notAPeerRestatement !== undefined) continue;
  for (const stated of check.compared) {
    const at = `${check.entry.file}:${stated.line}`;
    if (seenStatement.has(at)) continue;
    seenStatement.add(at);
    peerComparisons.push({
      file: check.entry.file,
      line: stated.line,
      dep: stated.dep,
      readme: stated.readme,
      manifest: stated.manifest,
    });
  }
}
for (const block of peerBlocks) {
  for (const bullet of block.bullets) {
    if (bullet.dep === null) continue;
    const at = `${block.file}:${bullet.line}`;
    if (seenStatement.has(at)) continue;
    seenStatement.add(at);
    peerComparisons.push({
      file: block.file,
      line: bullet.line,
      dep: bullet.dep,
      readme: RANGE_OPENS.test(bullet.rest) ? bullet.rest : null,
      manifest: block.peers[bullet.dep],
    });
  }
}

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

describe('doc version claims - the peer-line assertion', () => {
  it('pins every peer statement to the range its own manifest declares', () => {
    const failures: string[] = [];

    // Inventory integrity, which only the LEDGER route can report: an entry claiming to
    // restate a peer range that resolves to no comparable statement at all. The widened
    // block route cannot see this — it never looks at entries — so it stays here.
    for (const check of peerChecks) {
      // Skipped by name, with its reason on the entry. The closure test below is what
      // stops this branch from becoming a way out.
      if (check.entry.notAPeerRestatement !== undefined) continue;

      // A literal that is no longer in the tree is an inventory defect, and the downward
      // ratchet above already names it in its own red. Reporting it here too would read
      // as two problems where there is one; the coverage floor at the end of this test is
      // what keeps the skip from becoming a hole.
      if (check.absent) continue;

      if (check.noManifest) {
        failures.push(
          `${check.entry.file} :: is not a package README, so there is no manifest beside ` +
            `it to restate - reclassify the entry or point it at the package`,
        );
        continue;
      }

      if (check.compared.length === 0) {
        failures.push(
          `${check.entry.file} :: the literal ${JSON.stringify(check.entry.claim)} is present, ` +
            `but the line carrying it does not read as a peer statement, so NOTHING was ` +
            `compared - teach parsePeerStatement the spelling, or set notAPeerRestatement`,
        );
      }
    }

    // The widened set: ledger-resolved statements UNION every peer-block bullet, one
    // entry per line. objectui#3750 — the ledger indexed 12 of 28 and nine of the rest
    // were wrong.
    for (const stated of peerComparisons) {
      if (stated.manifest === undefined) {
        failures.push(
          `${stated.file}:${stated.line}  ${stated.dep}: the README lists it as a peer, but ` +
            `this package's peerDependencies does not declare ${stated.dep} at all - delete ` +
            `the line, or declare the peer if the package really needs the host to supply it`,
        );
      } else if (stated.readme === null) {
        failures.push(
          `${stated.file}:${stated.line}  ${stated.dep}: listed in the peer block with no ` +
            `version range, so a reader cannot tell what to install and nothing can be ` +
            `compared - write the range the manifest declares (${JSON.stringify(stated.manifest)})`,
        );
      } else if (!sameRange(stated.readme, stated.manifest)) {
        failures.push(
          `${stated.file}:${stated.line}  ${stated.dep}: README says ` +
            `${JSON.stringify(stated.readme)}, manifest says ${JSON.stringify(stated.manifest)}`,
        );
      }
    }

    for (const bad of malformedBullets) {
      failures.push(
        `${bad.file}:${bad.line}  ${JSON.stringify(bad.raw)}: a bullet inside a Peer ` +
          `Dependencies block that names no backticked package, so it states a requirement ` +
          `nothing can check - write it as a package plus its range, or move the prose out ` +
          `of the block`,
      );
    }

    expect(
      failures,
      `A README's Peer Dependencies block and its own package.json no longer agree:\n` +
        failures.map((f) => `  - ${f}`).join('\n') +
        `\n\nThis assertion does not decide which side is wrong. objectui#3710 narrowed the ` +
        `PROSE to the manifest; objectui#3690 widened the MANIFEST to the prose, because ` +
        `there the README was right. objectui#3750 did both in one change: it narrowed ` +
        `components' tailwindcss line to the manifest (the package is Tailwind 4 only), and ` +
        `deleted eight lines naming peers no manifest declares. Read the package and fix the ` +
        `side that is actually stale, then run this again.\n\n` +
        `Note that the ratchet above cannot see this class of drift: the inventory key stops ` +
        `at the first version token, so changing the second arm of a range leaves the key, ` +
        `the literal and the entry all untouched and both directions of the ratchet green. ` +
        `Nor can it see a peer line carrying no version literal at all.`,
    ).toEqual([]);

    // Vacuity floor. Everything above is a loop: empty the inventory, break the line
    // parser, or break the block walker, and the loops report success over nothing.
    // Measured at 21 comparisons after objectui#3750 (20 block bullets across 11 READMEs
    // plus react-runtime's prose sentence, which sits in no block); it was 12 before the
    // widening. A floor rather than a pin, because this list legitimately shrinks when a
    // package stops declaring a peer.
    expect(
      peerComparisons.length,
      'the peer assertion compared implausibly few statements - the parser, the block ' +
        'walker or the inventory collapsed, and the assertion is now green over nothing',
    ).toBeGreaterThanOrEqual(18);

    // And the block walker specifically must still be finding blocks: the union above
    // would still clear its floor on ledger entries alone if `peerBlockBullets` started
    // returning null for every file.
    expect(
      peerBlocks.length,
      'no Peer Dependencies block was found in any package README - the block heading ' +
        'spelling changed and the widening is silently back to ledger-only coverage',
    ).toBeGreaterThanOrEqual(8);
  });

  it('requires a peer block to list every peer its own manifest declares', () => {
    // The REVERSE direction, and the scoping is the decision — see the header. Only
    // READMEs that already carry a block are judged: writing one is optional, but a block
    // that exists is a claim to be the list, and a reader who installs everything in it
    // and still gets an unmet-peer warning was misled by an omission rather than a typo.
    //
    // Measured when this landed: 11 of 39 packages carry a block and 20 of the 28 without
    // declare peers, so the repo-wide spelling of this rule would have demanded 20 new
    // blocks written to satisfy a test. It found exactly one real omission —
    // plugin-designer declared a react-router-dom peer its block never mentioned.
    const missing: string[] = [];

    for (const block of peerBlocks) {
      const listed = new Set(block.bullets.map((bullet) => bullet.dep).filter((dep) => dep !== null));
      for (const [dep, range] of Object.entries(block.peers)) {
        if (!listed.has(dep)) {
          missing.push(
            `${block.file} :: peerDependencies declares ${dep} ${JSON.stringify(range)}, but ` +
              `the Peer Dependencies block never names it - a reader following this README ` +
              `installs the package and gets an unmet-peer warning for something it never told ` +
              `them about`,
          );
        }
      }
    }

    expect(
      missing,
      `A package README carries a Peer Dependencies block that is not the whole list:\n` +
        missing.map((m) => `  - ${m}`).join('\n') +
        `\n\nAdd the missing line to the block, or drop the peer from the manifest if the ` +
        `package does not actually need the host to supply it. This rule applies ONLY to ` +
        `READMEs that already have a block: 20 packages declare peers and document none, ` +
        `and forcing blocks onto them would be churn bought for a test rather than a reader.`,
    ).toEqual([]);
  });

  it('lets no restatement entry sit outside the assertion without saying so', () => {
    // The facts this test owns, none of which the assertion above reports: that an opt-out
    // carries a real reason, that it has not gone stale, and that it cannot appear on a
    // kind it does not apply to. "Covered by neither" is deliberately left to the
    // assertion above, so each defect has exactly one reporter.
    for (const check of peerChecks) {
      const excluded = check.entry.notAPeerRestatement;
      if (excluded === undefined) continue;

      expect(
        excluded.length,
        `${keyOf(check.entry)} opts out of the peer assertion and must say why, at length`,
      ).toBeGreaterThan(25);

      expect(
        check.compared,
        `${keyOf(check.entry)} carries notAPeerRestatement, but its line DOES read as a peer ` +
          `statement now - the opt-out is stale and is suppressing a real check`,
      ).toEqual([]);
    }

    for (const entry of KNOWN_CLAIMS) {
      if (entry.kind === 'restatement') continue;
      expect(
        entry.notAPeerRestatement,
        `${keyOf(entry)} is ${entry.kind}, not a restatement - notAPeerRestatement opts out ` +
          `of a check that never applied to it, so it reads as coverage that was never there`,
      ).toBeUndefined();
    }
  });

  it('reads a peer statement in the two spellings the corpus uses, and refuses the rest', () => {
    expect(parsePeerStatement('- ' + ticked('react') + ' ^18.0.0 || ^19.0.0')).toEqual({
      dep: 'react',
      range: '^18.0.0 || ^19.0.0',
    });
    expect(parsePeerStatement('- ' + ticked('react-router-dom') + ' ^6.0.0 || ^7.0.0')).toEqual({
      dep: 'react-router-dom',
      range: '^6.0.0 || ^7.0.0',
    });
    expect(parsePeerStatement(ticked('react >= 18') + ' is a peer dependency.')).toEqual({
      dep: 'react',
      range: '>= 18',
    });

    for (const notAPeerLine of [
      // A listed peer with no range: there is nothing to compare, and pretending
      // otherwise would compare "" against the manifest and always be red.
      '- ' + ticked('@object-ui/core'),
      // An API bullet. The shape RANGE_OPENS exists to reject.
      '- ' + ticked('useChat()') + ' returns a stream of message parts',
      '**Peer Dependencies:**',
      // plugin-chatbot's own claim line, which is why that entry is opted out by name.
      'using ' + ticked('@ai-sdk/react') + ' v4 (Vercel UI Message Stream protocol) for streaming,',
    ]) {
      expect(
        parsePeerStatement(notAPeerLine),
        `${JSON.stringify(notAPeerLine)} must not read as a peer statement`,
      ).toBeNull();
    }
  });

  it('treats whitespace inside a range as insignificant, and nothing else', () => {
    // The one pair the normalisation exists for, and the only place in the corpus where
    // README and manifest differ by anything at all.
    expect(sameRange('>= 18', '>=18')).toBe(true);
    expect(sameRange('^18.0.0 || ^19.0.0', '^18.0.0||^19.0.0')).toBe(true);

    for (const [readme, manifest] of [
      // The manifest gained an arm and the README did not follow. This is the objectui#3690
      // shape, and the one the ratchet above is structurally blind to.
      ['^18.0.0 || ^19.0.0', '^18.0.0 || ^19.0.0 || ^20.0.0'],
      ['^18.0.0 || ^19.0.0', '^19.0.0'],
      ['^18.0.0', '~18.0.0'],
      ['^18.0.0', '^18.0.1'],
      ['>= 18', '>= 19'],
      ['>=18', '>18'],
    ]) {
      expect(
        sameRange(readme, manifest),
        `${readme} and ${manifest} are different ranges and must not compare equal`,
      ).toBe(false);
    }
  });

  it('recognises the block heading only in the spelling that opens a machine-readable list', () => {
    // The corpus spelling, on its own line. Anchored: the three near-misses below are real
    // lines in this repository, and a loose match would pull their prose into the walker.
    expect(PEER_BLOCK_HEADING.test('**Peer Dependencies:**')).toBe(true);
    for (const notABlock of [
      '## 3. Missing Peer Dependencies',
      '- Peer dependency versions',
      '**Note:** The `@objectstack/client` package is a peer dependency and must be installed separately.',
      '2. Ensure peer dependencies match the new baselines',
    ]) {
      expect(
        PEER_BLOCK_HEADING.test(notABlock.trim()),
        `${JSON.stringify(notABlock)} does not open a peer block and must not be walked as one`,
      ).toBe(false);
    }
  });

  it('reads a range-less peer bullet instead of skipping it, which is how eight lines hid', () => {
    // The distinction objectui#3750 turns on. `parsePeerStatement` answers "is this a peer
    // statement WITH a range" and correctly returns null here; the block walker must not
    // inherit that null, because three READMEs listed this exact line against manifests
    // declaring no such peer, and a walker that skipped it would have walked past all three.
    const rangeless = '- ' + ticked('@object-ui/core');
    expect(parsePeerStatement(rangeless)).toBeNull();

    const parsed = PEER_BULLET.exec(rangeless);
    expect(parsed?.[1], 'the block walker must still recover the dep name').toBe('@object-ui/core');
    expect(RANGE_OPENS.test(parsed?.[2] ?? ''), 'and must record that it states no range').toBe(false);

    // A bullet with a range still parses the range identically to the ledger route, so the
    // two agree on every line both can see - the premise the dedupe rests on.
    const ranged = PEER_BULLET.exec('- ' + ticked('react') + ' ^18.0.0 || ^19.0.0');
    expect({ dep: ranged?.[1], range: ranged?.[2] }).toEqual({
      dep: 'react',
      range: '^18.0.0 || ^19.0.0',
    });
  });

  it('walks a real peer block to its end and no further', () => {
    // components carries the longest block in the corpus and is followed by a heading,
    // which is what must stop the walk. Reading past it would drag the `## Setup`
    // section's bullets in and fail them against a manifest that never mentioned them.
    const bullets = peerBlockBullets('packages/components/README.md');
    expect(bullets?.map((b) => b.dep)).toEqual(['react', 'react-dom', 'tailwindcss']);

    // A README with no block at all returns null rather than an empty list, so "has no
    // block" and "has an empty block" stay distinguishable - the reverse-direction rule
    // above judges the second and deliberately ignores the first.
    expect(peerBlockBullets('packages/plugin-grid/README.md')).toBeNull();
  });
});
