#!/usr/bin/env node
/**
 * Every fenced example in `skills/` that carries the opt-in marker must still be
 * REAL: a `ts` / `tsx` / `typescript` block must compile against the packages'
 * BUILT `dist/*.d.ts`, and a `json` / `jsonc` block must parse.
 *
 * Run:  node scripts/check-skill-examples.mjs        (also `pnpm check:skill-examples`)
 *       node scripts/check-skill-examples.mjs --list          # every candidate fence + verdict
 *       node scripts/check-skill-examples.mjs --measure       # judge EVERY candidate, marked or not
 *       node scripts/check-skill-examples.mjs --build-filter  # filter args for turbo/pnpm
 *       node scripts/check-skill-examples.mjs --self-test     # fixtures, both directions
 * Exit: 0 = every MARKED fence holds up, and the marked population is non-empty.
 *       1 = THE GATE RAN AND FOUND ERRORS. A marked fence failed to parse, failed
 *           to type-check, or a marker is not adjacent to a fence it can opt in.
 *           Everything printed above the summary is a verdict about a guide.
 *       2 = THE GATE COULD NOT RUN, so nothing printed above is a verdict about
 *           any guide: the packages the marked fences import are not built (or
 *           are typed from source), a harness control failed, or the marked
 *           population is empty. Fix the tree and re-run. Never read this as a
 *           guide defect, and never as a pass.
 *
 * ## The gap this closes (objectui#7359)
 *
 * The guides under `skills/objectui/` are the first thing an AI reads when it
 * writes ObjectUI code, and at the branch point they carried 112 `ts` / `tsx` /
 * `typescript` fences and 56 `json` fences. NOT ONE of them was read by any gate
 * in this repository, and every gate that could have reached them excludes the
 * surface by construction rather than by accident:
 *
 *   | gate                          | why it does not reach a fence in `skills/`   |
 *   |-------------------------------|----------------------------------------------|
 *   | `check-skills-paths.mjs`      | deliberately reads inline code spans in PROSE only — "a fence is a worked example", and a tutorial fence may name a file the reader is about to create |
 *   | `check-doc-links.mjs`         | its `SCAN_ROOTS` has no `skills` row          |
 *   | `check-doc-component-types.mjs` | `DOCS_ROOT = 'content/docs'`, and its header says "not `skills/**`" verbatim |
 *   | `check-doc-snippet-types.mjs` | `content/docs` + the package READMEs + `README.md` |
 *   | `check-doc-fence-languages.mjs` | same surface, and it judges the fence LANGUAGE TAG, never the contents |
 *
 * So this repository enforced path existence in skill prose and nothing else. A
 * fence could import a symbol that does not exist, spell a key the renderer never
 * reads, or restate a shape the spec had changed, and stay green forever. Two
 * rounds of exactly that were already cleaned BY HAND (objectui#3658 / #7094's
 * truth sweep, and #7251's correctness items — which included an eval asserting a
 * mobile hook API with zero occurrences repo-wide), which is precisely the
 * economics `check-skills-paths.mjs` was created to end for paths.
 *
 * ## Opt-in, and why that is the only shape that can start
 *
 * `check-doc-snippet-types.mjs` is opt-OUT: every `ts` fence in a covered
 * document is compiled unless a marker declares it a fragment. That rule is right
 * there and wrong here, and the difference is measurable rather than a matter of
 * taste. The docs corpus was curated into that shape over several cards; the
 * skills corpus never has been. Most of its fences are FRAGMENTS by construction
 * — a `columns: [...]` subtree, a `plugins: [...]` literal, a hook body that
 * continues the block above it, a `vitest` test that imports a dev-only package
 * no consumer of `@object-ui/*` can resolve. Turning all 112 on at once would
 * produce a wall of red on prose that is not wrong, and the reliable outcome of a
 * gate that reds on correct code is that someone deletes it.
 *
 * Hence the convention this file PORTS from objectstack's
 * `packages/spec/scripts/check-skill-examples.ts`: a self-contained,
 * should-hold-up block is opted in by an HTML comment on the line DIRECTLY ABOVE
 * its fence. The marker's exact spelling is in `MARKER` below (a JavaScript block
 * comment cannot quote an HTML comment's closer without confusing a reader
 * grepping for it, so it lives in code, the way
 * `check-doc-snippet-types.mjs` puts its own marker in
 * `FRAGMENT_MARKER_EXAMPLES`).
 *
 * Two properties make the marker safe on this surface, and both are the reason
 * objectstack chose this spelling over a fence-meta tag like ` ```ts check `:
 *
 *   1. It is an HTML comment, so it renders to nothing. A skill guide is read by
 *      an agent as raw markdown and by a human as rendered markdown; neither sees
 *      it.
 *   2. It leaves the fence info string a BARE ` ```typescript `. Three gates in
 *      this repository key on the info string — `check-doc-fence-languages.mjs`
 *      most directly — and a fence-meta tag would have punched a hole in every
 *      one of them.
 *
 * Opt-in also makes the starting population an honest, stated number rather than
 * a wall of exemptions: see "The starting population" below.
 *
 * ## Marker ADJACENCY is strict, and an orphan is a failure
 *
 * The marker must be the line IMMEDIATELY above the fence-open line — not the
 * nearest non-blank line above it. A marker anywhere else is an ORPHAN and fails
 * the run.
 *
 * This is the one rule where being strict costs nothing and being lenient costs
 * everything. A marker separated from its fence by a blank line, or left behind
 * when its fence was deleted or rewritten, is a claim that nothing checks: under
 * a lenient rule it silently opts in NOTHING, and the author who wrote it
 * believes their example is gated. That is the "looks like enforcement, isn't"
 * class this repository has now measured five separate times (objectui#3009,
 * #3181, #3494, #4846, #7115). A stale marker is reported, loudly, with its line
 * number.
 *
 * ## Fence-awareness: a marker shown as EXAMPLE TEXT claims nothing
 *
 * This gate's own convention has to be documentable in the very guides it
 * governs, and in this file's own tests. So a marker line that sits INSIDE some
 * other fenced block — a ```markdown illustration showing what the marker looks
 * like — is at once not an opt-in and not an orphan: it is not at top level, so
 * it claims nothing. `fenceSpans()` answers "which top-level fence owns this
 * line?" for BOTH questions, so the two readings cannot drift apart. The same
 * walk also supplies each fence's CLOSING line, so the body's end is decided by
 * exactly the predicate that decided the fence opened — never by a second,
 * looser closer re-derived at the extraction site (objectstack measured that
 * pair disagreeing on an indented closer and on a CRLF file, in opposite
 * directions).
 *
 * ## How imports resolve: the BUILT dist, exactly like the docs gate
 *
 * A marked `ts` fence is compiled `--strict` against each package's built
 * `dist/*.d.ts`, resolved through the same `paths` map
 * `check-doc-snippet-types.mjs` derives from every package's own `exports` /
 * `types` field, plus that gate's declared-dependency rule for third-party
 * specifiers (a snippet importing `@object-ui/layout` may import `lucide-react`
 * because that package declares it — and may not import a package nothing
 * declares).
 *
 * ⛔ The alternative was mapping `@object-ui/*` to `src/` through
 * `tsconfig.base.json`, and it is rejected for the reason that gate's header
 * states in as many words: the root config maps the workspace to SOURCE, so a
 * harness that inherited it would judge the guides against code no reader
 * resolves — green while the published surface is broken. The reader of a skill
 * guide is a consumer who installs `@object-ui/react` from npm. That is the
 * surface, so that is what is compiled against.
 *
 * ⚠️ The honest edge of that resolution, measured rather than assumed, and
 * printed on every run as `Unmapped specifiers`: a bare specifier that neither
 * the workspace map nor the declared-dependency map covers still resolves if the
 * REPOSITORY ROOT declares it, because pnpm symlinks the root's own dependency
 * set into `/node_modules`. `vitest`, `react` and `@testing-library/react` are
 * root devDependencies here, so a marked fence importing them is verified
 * against THIS workspace's copy — not against anything a reader of the guide is
 * told to install. The guides do tell that reader to install vitest, so the
 * examples are not wrong; the GATE simply is not the thing that proves it. The
 * inherited UNDECLARED control does not close this: it bounds resolution against
 * TRANSITIVE packages (which pnpm leaves only under `.pnpm/`), a different leak.
 * Naming the specifiers in the run output is what stops that from being a silent
 * property of a green — tightening it is recorded as a follow-up, not done here.
 *
 * The cost of that decision is the PRECONDITION, and it is a declared exit code
 * rather than a silent green: if a package a marked fence imports has no `dist`,
 * this gate prints `PRECONDITION NOT MET` and exits 2 (`couldNotRun`), never 0
 * and never 1. Zero with nothing run reads as coverage, which is the exact
 * failure shape this whole gate family exists to prevent (objectui#4846). The 1
 * vs 2 split is this repository's convention, not a new one — see
 * `check-eager-closure-budget.mjs` (1 = over budget, 2 = the gauge produced
 * nothing) and `check-doc-snippet-types.mjs`, whose header records three separate
 * agents in one evening each having to notice a printed message before their exit
 * code meant anything.
 *
 * ## What is REUSED, and what is deliberately local
 *
 * The type-check HARNESS is imported from `check-doc-snippet-types.mjs`:
 * `derivePackageTypePaths`, `deriveDeclaredDependencyPaths` and
 * `compileSnippets`. That is not convenience — that harness carries the
 * syntax/semantics split (a `tsc` program with ONE parse error reports no
 * semantic diagnostics at all, program-wide, so an unparseable block must never
 * blind the rest) and the three self-controls (RESOLUTION lands on a built
 * artifact, a planted SENTINEL import must produce TS2305, a POSITIVE control
 * must be clean, and an UNDECLARED specifier must still fail to resolve). A
 * second hand-rolled harness would be a second answer to the same question, and
 * that gate's own header records what hand-rolling it three times cost.
 *
 * What is local is the READING of those controls (`evaluateControls` below) and
 * everything about the marker convention. `scripts/__tests__/check-skill-examples.test.ts`
 * pins that this file imports the shared harness rather than growing its own.
 *
 * ## The starting population (objectui#7359 step 2)
 *
 * `--measure` judges EVERY candidate fence, marked or not, and prints the
 * pass/fail split per language. That is how the marker was landed on exactly the
 * fences that already held up at the branch point, and it stays in the file so
 * the number is re-derivable rather than a claim in a merged PR body.
 *
 * ⛔ There is deliberately NO ratchet and NO count pin. Whether the marked
 * population becomes shrink-only — the way `check-doc-fence-languages.mjs`
 * treats its declared-file population — is a separate decision, recorded as a
 * follow-up rather than taken here. What IS enforced is a floor: a run in which
 * NOTHING is marked exits 2, because a gate that checks nothing must not report
 * success.
 *
 * ## The third assertion: no bare `any` in a marked block (objectui#7463)
 *
 * A marker is the author's claim "this block compiles", and the orphan-marker
 * and empty-population guards above exist because a gate that checks nothing
 * must not report success. A bare `any` inside a marked block is that same
 * failure wearing a green badge: every property access on an `any` is
 * unchecked, so `tsc` proves exactly nothing about the lines a reader copies.
 * objectstack's `packages/spec/scripts/check-skill-examples.ts` carries this as
 * its third assertion and records the measured specimen — two marked hook
 * examples annotated `ctx: any` that read a key the hook context does not have,
 * green through the whole of that gate's life.
 *
 * SCOPE, ported from that file rather than re-derived: the annotation must BE
 * `any`, in a position where it erases checking wholesale — a parameter, a
 * variable/property/return annotation, a type alias, or an `as any` /
 * `satisfies any` / angle-bracket assertion. `any` NESTED inside a larger type
 * (`Record<string, any>`, `any[]`, `Promise<any>`) is deliberately NOT flagged.
 * That boundary is the zero-false-positive line, and holding it is what keeps a
 * red meaning broken. Casts and locals are in scope and not for symmetry: a
 * parameter-only rule is defeated by exactly the edit an author reaches for
 * when it goes red — move the `any` one line down (`const c: any = ctx`) or
 * into the access (`(ctx as any).x`) — leaving the gate green over an unchanged
 * defect.
 *
 * ⚠️ ONE DELIBERATE DIVERGENCE from objectstack, and it is about which tree is
 * walked. objectstack picks `ScriptKind` off the fence label; the harness THIS
 * gate compiles through parses EVERY block as TSX regardless of label (see
 * `compileSnippets`, and its own header for why). So this walk uses TSX too. A
 * guard that walked a different tree from the one `tsc` judged would be exactly
 * the dormant checker this file's own docblocks warn about. The visible
 * consequence: an angle-bracket `<any>value` assertion is JSX under TSX and is
 * therefore a PARSE failure — already red through the syntax leg, one exit code
 * earlier, never reaching this walk. Its arm is kept in the position table
 * anyway, so the rule stays whole if the harness's ScriptKind ever changes.
 *
 * Parsing, never a regex: the corpus is prose, and `any` occurs in string
 * literal unions, in JSDoc and in ordinary English. `createSourceFile` never
 * throws on malformed input, so a block too broken to parse yields no findings
 * here and is caught by the `tsc` pass — the right division of labour.
 *
 * ⛔ The baseline (`KNOWN_BARE_ANY_EXAMPLES`) is SHRINK-ONLY and is NOT an
 * allowlist: a row whose red is gone fails as STALE. It exists because the
 * assertion landed over a corpus that already had four sites, and unmarking or
 * re-pointing those fences mechanically would have been the gate weakening the
 * guides to suit itself. Each row is a declared debt with a named site, so the
 * per-row skills judgement it needs is a visible piece of work rather than a
 * silent exemption. See the list's own docblock for what each row is.
 *
 * ## Deliberately NOT answered here
 *
 *   1. **Whether a marked JSON fence is VALID METADATA.** It is parsed, not
 *      validated against `@object-ui/types`' schemas. Parsing catches the
 *      trailing comma, the smart quote and the truncated object; deciding which
 *      fences are complete documents rather than prose fragments is the same
 *      boundary `check-doc-snippet-types.mjs` left unruled for the same reason,
 *      and guessing it is what produces a gate people learn to ignore.
 *   2. **Bounding ROOT-devDependency resolution.** The `Unmapped specifiers`
 *      line below names the leak; closing it is objectui#7463 item 2 and is
 *      still open, because the harness that would carry the bound is SHARED and
 *      the fix is not local to this gate. Measured at objectui#7463's head, so
 *      the next reader argues from a number rather than re-deriving it: the
 *      marked population's unmapped set is exactly `@playwright/test` and
 *      `vitest`, both declared by the repository ROOT and both resolving out of
 *      `/node_modules`; and a bound placed in `compileSnippets` would newly red
 *      exactly ONE of `check-doc-snippet-types.mjs`'s own 432 compiled snippets
 *      (`content/docs/guide/objectos-integration.mdx:638`, importing
 *      `@playwright/test`). One new red on a surface this gate does not own is
 *      a decision about the docs corpus, not a refactor, so it is escalated
 *      rather than taken.
 *   3. **Whether an eval's `must_contain` token is taught by the guides.** A
 *      different oracle over a different corpus, discussed at length on
 *      objectui#7359 and explicitly not this check.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import {
  compileSnippets,
  deriveDeclaredDependencyPaths,
  derivePackageTypePaths,
} from './check-doc-snippet-types.mjs';
import { isEntrypoint } from './invoked-as.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Configuration ────────────────────────────────────────────────────────────

/**
 * The prose roots this gate walks: the PUBLISHED skill bundle, and the
 * CONTRIBUTOR-ONLY bundle under `.claude/skills`.
 *
 * Stated here as a decision rather than left to be read off the walker, which is
 * objectui#5174's finding restated — a reader had to open the collector to learn
 * that "covered by default" meant "covered if the filename ends in `.mdx`".
 *
 * `.claude/skills` was added by objectui#7463 item 3, the same widening
 * `check-skills-paths.mjs` took in objectui#7358 and for the same reason: when
 * objectui#7251 moved the two contributor-only guides out of `skills/`, that
 * gate simply stopped looking at them and nothing turned red. A gate whose scan
 * root is narrower than the surface it claims silently un-covers whatever moves
 * out of it.
 *
 * ⚠️ WIDENING A ROOT IS NOT ARMING IT. Opt-in is the whole design here, so this
 * edit adds candidates, not coverage: nothing under `.claude/skills/**` carries
 * the marker, and adding one is the surface owner's step, not this widening's.
 * Measured at objectui#7463's head, which is the number that makes "zero new
 * red on day one" checkable rather than asserted:
 *
 *   |                          | before | after |
 *   |--------------------------|--------|-------|
 *   | guides scanned           | 18     | 20    |
 *   | ts/tsx/typescript fences | 112    | 121   |
 *   | json/jsonc fences        | 56     | 56    |
 *   | MARKED fences            | 56     | 56    |
 *
 * All 9 new candidates are `typescript` fences in
 * `.claude/skills/objectui-contributor/` (5 in `guides/console-development.md`,
 * 4 in `rules/no-touch-zones.md`); the two `SKILL.md` files carry none. The
 * MARKED row is the one that decides whether this widening is safe, and it does
 * not move.
 *
 * Re-derive it with `--measure`; `--list` names every new candidate.
 */
export const SCAN_ROOTS = ['skills', '.claude/skills'];

/** Fence languages compiled as TypeScript. */
export const TS_FENCE_LANGUAGES = new Set(['ts', 'tsx', 'typescript']);

/** Fence languages parsed as JSON. `jsonc` additionally tolerates comments. */
export const JSON_FENCE_LANGUAGES = new Set(['json', 'jsonc']);

/**
 * The opt-in marker, spelled out. It lives in code rather than in the header for
 * the reason `check-doc-snippet-types.mjs` gives for its own: a JavaScript block
 * comment cannot carry these delimiters without a reader having to reconstruct
 * them. Byte-for-byte identical to objectstack's, so the convention is one
 * convention across the two repositories rather than two that look alike.
 */
export const MARKER = '<!-- os:check -->';

/**
 * This gate's exit codes, named so callers and tests can talk about them.
 * `couldNotRun` is deliberately distinct from `examplesFailed`; see the header.
 * The numbers are `check-doc-snippet-types.mjs`'s and
 * `check-eager-closure-budget.mjs`'s — this repository's convention — and each
 * gate names them for itself so that no gate's exit contract is a side effect of
 * importing another one.
 */
export const EXIT_CODES = {
  /** Every marked fence held up, the controls held, something was marked. */
  verified: 0,
  /** The gate RAN. A marked fence or a marker is at fault — a verdict was read. */
  examplesFailed: 1,
  /** The gate COULD NOT RUN. Nothing it printed is a verdict about a guide. */
  couldNotRun: 2,
};

// ── The bare-`any` debt list ─────────────────────────────────────────────────

/**
 * ⛔ SHRINK-ONLY. Rows spelled exactly as `bareAnyRowKey()` builds them:
 *
 *     GUIDE:FENCELINE POSITION
 *
 * where POSITION is `describeAnyPosition()`'s own wording, so a row names one
 * `any` at one site and a per-row fix removes exactly one line. Two `any`s of
 * different kinds in one fence are two rows; the fence line disambiguates two
 * of the SAME kind in different fences.
 *
 * ⚠️ Not an allowlist. A row whose red is GONE fails as STALE, so the list can
 * only shrink — the same direction, and the same reasoning, as
 * `KNOWN_UNTAUGHT_EVAL_TOKENS` in `check-skill-eval-tokens.mjs`. It is keyed on
 * the fence LINE, which means moving a guide's prose above the fence forces a
 * re-declaration. That cost is deliberate: a row that floated free of its line
 * would keep covering a site nobody has looked at since.
 *
 * The corpus at objectui#7463's branch point was FOUR rows, measured under
 * `--measure` before the assertion was armed. One is left, and it is not a
 * mechanical unmark:
 *
 *   - `plugin-development.md:92` `defaultValue` — the guide is FAITHFUL prose,
 *     not rot. `ComponentInput.defaultValue` really is `any` in
 *     `packages/types/src/base.ts`, so the honest fix is to the platform type,
 *     not to the guide restating it. Fixing the guide alone would make it lie.
 *
 * The three `testing.md` rows were retired by objectui#7494, which answered the
 * skills judgement each of them was waiting on and taught the honest idiom in
 * their place — the schema fence hands the validator its invalid value with no
 * assertion at all (the parameter takes it as-is), and the adapter fence doubles
 * through the public `getClient()` seam instead of reaching the private `client`
 * field through a cast. Both fences stay MARKED; the rows went in the same
 * commit as the guide edit, because a row whose red is gone fails as STALE.
 *
 * @type {ReadonlySet<string>}
 */
export const KNOWN_BARE_ANY_EXAMPLES = new Set([
  'skills/objectui/guides/plugin-development.md:92 property `defaultValue`',
]);

/** The baseline key for one bare-`any` finding at one site. */
export function bareAnyRowKey(block, finding) {
  return `${block.doc}:${block.fenceLine} ${finding.where}`;
}

// ── Bare-`any` guard (objectui#7463, ported from objectstack #5943) ──────────

/**
 * Every position in which a bare `any` erases checking wholesale, keyed by the
 * PARENT node kind. The test is `parent.type === node` (or the assertion's own
 * type slot), so an `any` nested in a larger type — `Record<string, any>`,
 * `any[]`, `Promise<any>` — has a TypeReference/ArrayType parent and is not a
 * finding. That boundary is this guard's zero-false-positive line; widening it
 * is a different question with a different, much larger baseline.
 *
 * Returns the human-readable position (which is also half the baseline key), or
 * `null` when this `any` is not in a checking-erasing position.
 */
export function describeAnyPosition(node) {
  const parent = node.parent;
  if (!parent) return null;

  const named = (name) => (name && ts.isIdentifier(name) ? ` \`${name.text}\`` : '');

  if (ts.isParameter(parent) && parent.type === node) return `parameter${named(parent.name)}`;
  if (ts.isVariableDeclaration(parent) && parent.type === node) return `variable${named(parent.name)}`;
  if ((ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) && parent.type === node)
    return `property${named(parent.name)}`;
  if (ts.isTypeAliasDeclaration(parent) && parent.type === node)
    return `type alias \`${parent.name.text}\``;
  if (ts.isAsExpression(parent) && parent.type === node) return '`as any` assertion';
  if (ts.isSatisfiesExpression(parent) && parent.type === node) return '`satisfies any` assertion';
  // Unreachable under TSX (the harness's ScriptKind) — an angle-bracket
  // assertion is JSX there and fails the syntax leg first. Kept so the rule
  // stays whole if that ever changes; see the header's divergence note.
  if (ts.isTypeAssertionExpression(parent) && parent.type === node)
    return 'angle-bracket `any` assertion';
  // Return annotations: functions, methods, arrows, getters, signatures.
  if (ts.isFunctionLike(parent) && parent.type === node) return 'return type';
  return null;
}

/**
 * Every bare `any` annotation in one block body, in source order.
 *
 * ⚠️ Parsed as TSX, matching `compileSnippets`, which parses EVERY block as TSX
 * regardless of the fence label. A guard that walked a different tree from the
 * one `tsc` judged would be reporting about a program that was never checked.
 * `createSourceFile` never throws: a block too broken to parse yields no
 * findings here and is caught by the syntax leg instead.
 */
export function findBareAny(code) {
  const sf = ts.createSourceFile(
    'block.tsx',
    code,
    ts.ScriptTarget.ES2020,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const findings = [];
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const where = describeAnyPosition(node);
      if (where) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        findings.push({ line: line + 1, col: character + 1, where });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return findings;
}

// ── Fence scanning ───────────────────────────────────────────────────────────

/**
 * ANY CommonMark-shaped opening code fence — every language, not just the ones
 * this gate compiles or parses: up to three spaces of indent, a run of three or
 * more backticks, and an info string that cannot itself contain a backtick.
 */
const ANY_FENCE_OPEN_RE = /^ {0,3}(`{3,})([^`]*)$/;

/** A closing fence: indent, at least as long a backtick run, nothing else. */
const FENCE_CLOSE_RE = /^ {0,3}(`{3,})[ \t]*$/;

/**
 * Which TOP-LEVEL fenced block owns each line — of ANY language, spanning both
 * the opening and closing fence lines. `owners[i]` is the index of the line that
 * OPENED the block, or `-1` for a line at true top level; a line that opens a
 * top-level fence owns itself, which is what makes this one array answer both of
 * this file's questions:
 *
 *   - "is this marker at top level?"    `owners[m] === -1`
 *   - "does this line open a fence?"    `owners[i] === i`
 *
 * `closeOf` carries each opener's closing line, so the body's end is read from
 * the same walk that decided the fence opened — never from a second, looser
 * closer re-derived at the extraction site. An unclosed fence runs to END OF
 * FILE per CommonMark, and `closeOf` records `lines.length` for it: one past the
 * last line, so the body slice reaches the end instead of dropping it. The two
 * cases have to be distinguishable, because "closed on the last line" and "never
 * closed" differ by exactly that line.
 */
export function fenceSpans(lines) {
  const owners = new Array(lines.length).fill(-1);
  const closeOf = new Map();
  let i = 0;
  while (i < lines.length) {
    const open = ANY_FENCE_OPEN_RE.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }
    const ticks = open[1];
    let close = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const c = FENCE_CLOSE_RE.exec(lines[j]);
      if (c && c[1].length >= ticks.length) {
        close = j;
        break;
      }
    }
    const end = close === -1 ? lines.length : close;
    for (let k = i; k <= end && k < lines.length; k++) owners[k] = i;
    closeOf.set(i, end);
    i = end + 1;
  }
  return { owners, closeOf };
}

/**
 * Every candidate fence in one document, plus every orphan marker.
 *
 * A candidate is a TOP-LEVEL fence whose language this gate can judge. `marked`
 * is true when the line immediately above the fence-open line is exactly the
 * marker (ignoring surrounding whitespace) and is itself at top level.
 *
 * An orphan is a top-level marker line that did not opt a candidate in — a
 * marker above a blank line, above prose, above a ```bash fence, or left behind
 * by a deleted example. A marker inside another fence is example text and is
 * neither: see the header.
 *
 * CRLF is normalised on the way in, so no regex here has to decide whether `\s`
 * should match a carriage return.
 */
export function scanSkillFences(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const { owners, closeOf } = fenceSpans(lines);

  const fences = [];
  const claimed = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (owners[i] !== i) continue; // not a top-level fence opener
    const open = ANY_FENCE_OPEN_RE.exec(lines[i]);
    if (!open) continue;
    const language = (open[2].trim().split(/\s+/)[0] || '').toLowerCase();
    const kind = TS_FENCE_LANGUAGES.has(language)
      ? 'ts'
      : JSON_FENCE_LANGUAGES.has(language)
        ? 'json'
        : null;
    if (kind === null) continue;

    const markerLine = i - 1;
    const marked =
      markerLine >= 0 && owners[markerLine] === -1 && lines[markerLine].trim() === MARKER;
    if (marked) claimed.add(markerLine);

    const close = closeOf.get(i) ?? lines.length;
    fences.push({
      kind,
      language,
      /** 1-based line of the fence-open line itself. */
      fenceLine: i + 1,
      body: lines.slice(i + 1, close).join('\n'),
      marked,
    });
  }

  const orphans = [];
  for (let i = 0; i < lines.length; i++) {
    if (owners[i] !== -1) continue; // example text inside another fence
    if (lines[i].trim() !== MARKER) continue;
    if (!claimed.has(i)) orphans.push(i + 1); // 1-based
  }

  return { fences, orphans };
}

/** Every guide in the scan set, repo-relative, in a stable order. */
export function listGuides(root = repoRoot) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith('.md')) out.push(relative(root, p).split(sep).join('/'));
    }
  };
  for (const rootName of SCAN_ROOTS) {
    const dir = join(root, rootName);
    if (existsSync(dir)) walk(dir);
  }
  return out;
}

// ── JSON fences ──────────────────────────────────────────────────────────────

/**
 * `source` with `//` and block comments blanked, outside string literals.
 *
 * Only used for `jsonc`. Written as a scanner rather than a regex because a
 * regex cannot tell a `//` inside `"https://..."` from a comment — and a URL in
 * a `json` example is not hypothetical.
 */
export function stripJsonComments(source) {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < source.length) {
    const c = source[i];
    if (inString) {
      out += c;
      if (c === '\\' && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n'; // keep line numbers honest
        i += 1;
      }
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** `source` with trailing commas before `}` / `]` removed. `jsonc` only. */
function stripTrailingCommas(source) {
  return source.replace(/,(?=\s*[}\]])/g, '');
}

/**
 * Parse one marked JSON fence. Returns `null` when it parses, or the parser's
 * own message when it does not.
 *
 * `json` is parsed STRICTLY — `JSON.parse` and nothing else — because a `json`
 * fence in a guide is a claim about what a real `.json` file may contain, and a
 * tolerant parser here would bless a file no `JSON.parse` in the product would
 * accept. `jsonc` gets comments and trailing commas removed first, and nothing
 * else: that is the whole of what the `jsonc` dialect adds over `json` for the
 * shapes a guide writes. There are zero `jsonc` fences in the corpus today; the
 * language is recognised so that adding one is not a silent no-op.
 */
export function parseJsonFence(body, language) {
  const text = language === 'jsonc' ? stripTrailingCommas(stripJsonComments(body)) : body;
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// ── Collection ───────────────────────────────────────────────────────────────

/** Workspace package specifiers a block imports (bare specifier root only). */
function importedSpecifiers(body) {
  const out = new Set();
  const patterns = [
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(body)) !== null) out.add(m[1]);
  }
  return out;
}

/**
 * Everything this run knows before any compiler is started.
 *
 * `measure: true` treats EVERY candidate fence as opted in. That is the
 * measurement mode behind step 2 of objectui#7359, and it is the only difference
 * between the two modes — one predicate, so a fence cannot be measured under one
 * set of rules and gated under another.
 *
 * `baseline` is the bare-`any` debt list, taken as a parameter only so the
 * self-test can drive it in both directions over fixtures. The STALE half is
 * always computed against the MARKED population, never against the
 * measure-selected one: the list describes what is gated, so its rows must not
 * appear to be covered by a fence that is merely being measured.
 */
export function analyze({ root = repoRoot, measure = false, baseline = KNOWN_BARE_ANY_EXAMPLES } = {}) {
  const guides = listGuides(root);
  const scans = new Map();
  for (const guide of guides) {
    scans.set(guide, scanSkillFences(readFileSync(join(root, guide), 'utf8')));
  }

  const findings = [];
  const candidates = [];
  for (const guide of guides) {
    const { fences, orphans } = scans.get(guide);
    for (const line of orphans) {
      findings.push({
        reason: 'orphan-marker',
        site: `${guide}:${line}`,
        detail:
          `\`${MARKER}\` must be the line IMMEDIATELY above a ts/tsx/typescript/json/jsonc fence. ` +
          'Here it opts nothing in, so the example below it is unchecked while reading as gated.',
      });
    }
    for (const fence of fences) {
      candidates.push({ doc: guide, ...fence, selected: measure || fence.marked });
    }
  }

  const selected = candidates.filter((c) => c.selected);
  const tsBlocks = selected.filter((c) => c.kind === 'ts');
  const jsonBlocks = selected.filter((c) => c.kind === 'json');

  // ── the packages those blocks import must be BUILT ────────────────────────
  const { paths, packageDirOf, sourceTyped } = derivePackageTypePaths(root);
  const neededPackages = new Set();
  for (const block of tsBlocks) {
    for (const specifier of importedSpecifiers(block.body)) {
      const owner = Object.keys(packageDirOf).find(
        (name) => specifier === name || specifier.startsWith(`${name}/`),
      );
      if (owner) neededPackages.add(owner);
    }
  }
  for (const name of [...neededPackages].sort()) {
    if (sourceTyped[name]) {
      findings.push({
        reason: 'source-typed-package',
        site: packageDirOf[name],
        detail: `${name} declares its types at ${sourceTyped[name]} — source, not a built artifact. A marked example may not be judged against it.`,
      });
      continue;
    }
    const entry = paths[name];
    if (!entry || !existsSync(entry[0])) {
      findings.push({
        reason: 'unbuilt-package',
        site: packageDirOf[name],
        detail: `${name} declares types at ${entry ? relative(root, entry[0]) : '(none)'} and it is not on disk — run the build first`,
      });
    }
  }

  const {
    paths: dependencyPaths,
    untyped: untypedDependencies,
    declared: declaredSpecifiers,
  } = deriveDeclaredDependencyPaths(root, neededPackages, packageDirOf);
  // Workspace entries win every collision, exactly as in the docs gate.
  const mergedPaths = { ...dependencyPaths, ...paths };

  // Bare specifiers the selected fences import that NOTHING in the map covers.
  // See `unmappedSpecifiers` in the header: these are the ones that resolve, if
  // at all, out of the repository root's own `node_modules`, so naming them in
  // every run is what keeps a green honest about what backed it.
  const mapped = new Set(Object.keys(mergedPaths));
  const unmappedSpecifiers = new Set();
  for (const block of tsBlocks) {
    for (const specifier of importedSpecifiers(block.body)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
      const root2 = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
      if (mapped.has(root2) || mapped.has(specifier)) continue;
      unmappedSpecifiers.add(root2);
    }
  }

  // ── the bare-`any` assertion, over the SELECTED ts blocks ─────────────────
  // Purely syntactic, so it runs whether or not the tree is built and whether or
  // not a block later fails to parse — an `any` that a reader would copy is a
  // finding about that guide either way.
  const bareAny = [];
  for (const block of tsBlocks) {
    for (const finding of findBareAny(block.body)) {
      const key = bareAnyRowKey(block, finding);
      bareAny.push({ block, finding, key, baselined: baseline.has(key) });
    }
  }

  // STALE rows are read off the MARKED population regardless of mode (see the
  // docblock): a baseline row is a claim about a gated fence.
  const markedRedKeys = new Set();
  for (const block of candidates) {
    if (block.kind !== 'ts' || !block.marked) continue;
    for (const finding of findBareAny(block.body)) markedRedKeys.add(bareAnyRowKey(block, finding));
  }
  const bareAnyStale = [...baseline].filter((key) => !markedRedKeys.has(key)).sort();

  return {
    unmappedSpecifiers,
    bareAny,
    bareAnyStale,
    guides,
    scans,
    candidates,
    tsBlocks,
    jsonBlocks,
    findings,
    paths: mergedPaths,
    dependencyPaths,
    untypedDependencies,
    declaredSpecifiers,
    neededPackages,
  };
}

/**
 * The findings that stop the program from being built at all, so no verdict
 * about any guide can be read from the run. Kept apart from the findings that
 * ARE verdicts (an orphan marker) because the two leave through different exit
 * codes.
 */
export function blockingPreconditions(findings) {
  return findings.filter((f) => f.reason === 'unbuilt-package' || f.reason === 'source-typed-package');
}

/**
 * The filter arguments naming the packages the selected fences import, each
 * carrying pnpm/turbo's DEPENDENCY-CLOSURE suffix `...`. Identical in shape and
 * in reasoning to `check-doc-snippet-types.mjs`'s `buildFilterArgs`: the set this
 * gate computes is the packages the GUIDES import, which is not a buildable unit
 * on its own, and emitting bare names left that gap to be closed by accident by
 * whichever tool the reader reached for.
 */
export function buildFilterArgs(packages) {
  return [...packages]
    .sort()
    .map((n) => `--filter=${n}...`)
    .join(' ');
}

// ── Reporting ────────────────────────────────────────────────────────────────

function formatDiagnostic(diagnostic, block) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    // The block body starts on the line after its fence.
    return `${block.doc}:${block.fenceLine + 1 + line}:${character + 1}  TS${diagnostic.code}: ${message}`;
  }
  return `${block.doc}:${block.fenceLine}  TS${diagnostic.code}: ${message}`;
}

/**
 * Read the shared harness's controls. The harness is
 * `check-doc-snippet-types.mjs`'s; the READING is local, so this gate's exit
 * contract is its own rather than a side effect of importing another gate.
 *
 * Returns the lines to print (a control that is not printed cannot be audited)
 * and the failures. Any failure means the harness is broken, which is a verdict
 * about the harness and never about a guide — so it leaves through
 * `couldNotRun`.
 */
export function evaluateControls(run) {
  const lines = [];
  const failures = [];

  lines.push(`  resolution   resolved to '${run.resolvedFileName ?? '(unresolved)'}'`);
  if (!run.resolvedFileName || !/[\\/]dist[\\/].*\.d\.ts$/.test(run.resolvedFileName)) {
    failures.push(
      `resolution did not land on a built artifact (${run.resolvedFileName ?? 'unresolved'}) — the examples would be judged against source, or against nothing`,
    );
  }
  if (run.srcLeaks.length > 0) {
    failures.push(
      `${run.srcLeaks.length} source file(s) under a package's src/ entered the program, e.g. ${run.srcLeaks[0]}`,
    );
  }

  const sentinelCodes = run.sentinelDiagnostics.map((d) => d.code);
  lines.push(
    `  sentinel     a planted missing export produced ${run.sentinelDiagnostics.length} diagnostic(s)${sentinelCodes.length ? ` (TS${sentinelCodes.join(', TS')})` : ''}`,
  );
  if (!sentinelCodes.includes(2305)) {
    failures.push(
      "the planted sentinel produced no TS2305 — the program is resolving everything to 'any' and would report green forever",
    );
  }

  lines.push(`  positive     a real export produced ${run.positiveDiagnostics.length} diagnostic(s)`);
  if (run.positiveDiagnostics.length > 0) {
    failures.push(
      `the positive control failed (${ts.flattenDiagnosticMessageText(run.positiveDiagnostics[0].messageText, ' ')}) — the harness is broken, not the guides`,
    );
  }

  const undeclaredCodes = run.undeclaredDiagnostics.map((d) => d.code);
  lines.push(
    `  undeclared   a specifier no imported package declares (installed at ${run.undeclaredInstalledAt ?? '(NOT INSTALLED)'}) produced ${run.undeclaredDiagnostics.length} diagnostic(s)${undeclaredCodes.length ? ` (TS${undeclaredCodes.join(', TS')})` : ''}`,
  );
  if (run.undeclaredDeclared) {
    failures.push(
      'the undeclared control specifier is now a DECLARED dependency of an imported package, so it can no longer show that resolution stayed narrow — pick another',
    );
  } else if (!run.undeclaredInstalledAt) {
    failures.push(
      'the undeclared control specifier is not installed, so its failure to resolve proves nothing about how far resolution reaches — pick another',
    );
  } else if (!undeclaredCodes.includes(2307)) {
    failures.push(
      'a specifier NO imported package declares now resolves — third-party resolution has widened past the imported packages\' own dependencies, and every guide would stay green while it does',
    );
  }

  return { lines, failures };
}

/**
 * Judge the selected fences. Returns everything the caller needs to print a
 * verdict, with the type-check and JSON halves kept apart.
 */
export function judge(state) {
  const run = compileSnippets({
    root: repoRoot,
    compiled: state.tsBlocks,
    paths: state.paths,
    declaredSpecifiers: state.declaredSpecifiers,
  });

  const failedTs = new Set();
  for (const { block } of run.parseFailures) failedTs.add(block);
  for (const { block } of run.semanticFailures) failedTs.add(block);

  const jsonFailures = [];
  for (const block of state.jsonBlocks) {
    const message = parseJsonFence(block.body, block.language);
    if (message !== null) jsonFailures.push({ block, message });
  }

  return { run, failedTs, jsonFailures };
}

// ── The run ──────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const measure = argv.includes('--measure');
  const state = analyze({ root: repoRoot, measure });

  if (argv.includes('--build-filter')) {
    // ⛔ This query answers from an UNBUILT tree by design and must keep exiting
    // 0 there: it is what the workflow runs to learn what to build, one step
    // BEFORE the build. Sharing the precondition exit would deadlock the gate
    // against its own build step (the reasoning, and the wording, are
    // `check-doc-snippet-types.mjs`'s).
    process.stdout.write(`${buildFilterArgs(state.neededPackages)}\n`);
    return EXIT_CODES.verified;
  }

  const marked = state.candidates.filter((c) => c.marked);

  // ── the anti-idle floor, checked before anything expensive ────────────────
  // A gate that checks nothing must not report success. Under `--measure` the
  // selected population is every candidate, so the floor is about that instead.
  if (!measure && marked.length === 0) {
    console.error(
      `No fence under ${SCAN_ROOTS.join(', ')} carries \`${MARKER}\`, so this run judged nothing.`,
    );
    console.error(
      `\nPRECONDITION NOT MET (exit ${EXIT_CODES.couldNotRun}) — the marked population is EMPTY. ` +
        'This is "I could not run", NOT "I ran and everything held up": a gate that checks nothing ' +
        'must not report success (objectui#4846). Either the markers were removed, or this gate is ' +
        'reading the wrong root — see SCAN_ROOTS in this script.',
    );
    return EXIT_CODES.couldNotRun;
  }

  const blocking = blockingPreconditions(state.findings);
  if (blocking.length > 0) {
    for (const f of state.findings) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
    console.error(
      `\nPRECONDITION NOT MET (exit ${EXIT_CODES.couldNotRun}) — the example program was NOT run: ` +
        'the packages it resolves against are not built, or are typed from source.',
    );
    console.error(
      `This is "I could not run", NOT "I ran and found errors" (exit ${EXIT_CODES.examplesFailed}). ` +
        'No line above is a verdict about any guide. Build what the gate needs, then re-run:',
    );
    console.error(
      '  pnpm exec turbo run build $(node scripts/check-skill-examples.mjs --build-filter) --concurrency=2\n' +
        '  pnpm check:skill-examples',
    );
    return EXIT_CODES.couldNotRun;
  }

  const { run, failedTs, jsonFailures } = judge(state);

  const { lines: controlLines, failures: controlFailures } = evaluateControls(run);
  console.log(
    `Third-party resolution: ${Object.keys(state.dependencyPaths).length} specifier(s) mapped from the declared dependencies of ${state.neededPackages.size} imported package(s); ${state.untypedDependencies.length} declared specifier(s) ship no types here and stay unresolvable.`,
  );
  console.log(
    state.unmappedSpecifiers.size === 0
      ? 'Unmapped specifiers: none — every bare import of a selected fence is covered by the map above.'
      : `Unmapped specifiers (resolve, if at all, from the repository ROOT's own node_modules — this workspace's devDependency set, NOT what a reader of the guide installs): ${[...state.unmappedSpecifiers].sort().join(', ')}`,
  );
  console.log('Controls:');
  for (const line of controlLines) console.log(line);
  console.log('');

  if (argv.includes('--list') || measure) {
    for (const block of state.candidates) {
      let verdict;
      const anyHits = state.bareAny.filter((h) => h.block === block);
      const anyNote = anyHits.length
        ? ` + ${anyHits.length} bare \`any\`${anyHits.every((h) => h.baselined) ? ' (all baselined)' : ''}`
        : '';
      if (!block.selected) verdict = 'unmarked — ignored';
      else if (block.kind === 'json')
        verdict = jsonFailures.some((f) => f.block === block) ? 'FAIL' : 'pass';
      else if (failedTs.has(block)) verdict = `FAIL${anyNote}`;
      else verdict = anyHits.some((h) => !h.baselined) ? `FAIL${anyNote}` : `pass${anyNote}`;
      console.log(
        `  ${block.doc}:${block.fenceLine}  [${block.language}]  ${block.marked ? 'marked' : '      '}  ${verdict}`,
      );
    }
    console.log('');
  }

  for (const f of state.findings) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
  for (const { block, diagnostics } of run.parseFailures) {
    for (const d of diagnostics) console.error(`  [syntax]    ${formatDiagnostic(d, block)}`);
  }
  for (const { block, diagnostics } of run.semanticFailures) {
    for (const d of diagnostics) console.error(`  [semantic]  ${formatDiagnostic(d, block)}`);
  }
  for (const { block, message } of jsonFailures) {
    console.error(`  [json]      ${block.doc}:${block.fenceLine}  ${message}`);
  }
  for (const hit of state.bareAny) {
    if (hit.baselined) continue;
    console.error(
      `  [bare-any]  ${hit.block.doc}:${hit.block.fenceLine + hit.finding.line}:${hit.finding.col}  ` +
        `${hit.finding.where} is annotated \`any\`, which erases checking wholesale — this fence's ` +
        'marker claims it compiles, and every property access on that `any` is unchecked. Give it the ' +
        'honest type, or declare the row VERBATIM in KNOWN_BARE_ANY_EXAMPLES (⛔ SHRINK-ONLY):\n' +
        `                ${hit.key}`,
    );
  }
  for (const key of state.bareAnyStale) {
    console.error(
      `  ${key}  [stale-baseline]  this row is no longer red — delete its line, KNOWN_BARE_ANY_EXAMPLES only shrinks`,
    );
  }

  // ── the summary always states COVERAGE, never just a verdict ──────────────
  const tsCandidates = state.candidates.filter((c) => c.kind === 'ts');
  const jsonCandidates = state.candidates.filter((c) => c.kind === 'json');
  const parseFailedBlocks = run.parseFailures.length;
  console.log(
    `Scanned ${state.guides.length} guide(s) under ${SCAN_ROOTS.join(', ')}: ` +
      `${tsCandidates.length} ts/tsx/typescript fence(s), ${jsonCandidates.length} json/jsonc fence(s).`,
  );
  console.log(
    measure
      ? `MEASURE MODE: every candidate judged, marked or not — ${marked.length} of them carry the marker today.`
      : `Marked: ${state.tsBlocks.length} ts fence(s) and ${state.jsonBlocks.length} json fence(s). Unmarked fences are ignored by design (opt-in).`,
  );
  console.log(
    parseFailedBlocks === 0
      ? 'Syntax phase:   every selected ts fence parsed, so every one of them reached the semantic phase.'
      : `Syntax phase:   ${parseFailedBlocks} ts fence(s) failed to parse and were NOT semantically checked.`,
  );
  console.log(
    `Semantic phase: ${run.semanticallyJudged} of ${state.tsBlocks.length} ts fence(s) judged, ${run.semanticFailures.length} failed.`,
  );
  console.log(
    `JSON phase:     ${state.jsonBlocks.length} fence(s) parsed, ${jsonFailures.length} failed.`,
  );
  const bareAnyNew = state.bareAny.filter((h) => !h.baselined);
  console.log(
    `Bare \`any\`:     ${state.bareAny.length} finding(s) across ${new Set(state.bareAny.map((h) => h.block)).size} selected fence(s); ` +
      `${state.bareAny.length - bareAnyNew.length} declared in KNOWN_BARE_ANY_EXAMPLES (⛔ SHRINK-ONLY, ${KNOWN_BARE_ANY_EXAMPLES.size} row(s)), ` +
      `${bareAnyNew.length} NOT declared, ${state.bareAnyStale.length} declared row(s) no longer red.`,
  );
  if (parseFailedBlocks > 0) {
    console.log(
      `NOTE: this run's semantic result covers ${run.semanticallyJudged} fence(s) only. A syntax failure is not a semantic pass.`,
    );
  }

  if (measure) {
    const tsPass = tsCandidates.length - [...failedTs].filter((b) => b.kind === 'ts').length;
    const jsonPass = jsonCandidates.length - jsonFailures.length;
    console.log(
      `\nStarting population — ts: ${tsPass}/${tsCandidates.length} pass; json: ${jsonPass}/${jsonCandidates.length} pass.`,
    );
    const markedAny = state.bareAny.filter((h) => h.block.marked);
    console.log(
      `Bare \`any\` would-be population — ${state.bareAny.length} finding(s) over every candidate, ` +
        `of which ${markedAny.length} sit in a MARKED fence (the population this assertion actually gates).`,
    );
    for (const hit of state.bareAny) {
      console.log(
        `  ${hit.block.marked ? 'marked  ' : 'unmarked'}  ${hit.block.doc}:${hit.block.fenceLine + hit.finding.line}  ${hit.finding.where}${hit.baselined ? '  [declared]' : ''}`,
      );
    }
  }

  if (controlFailures.length > 0) {
    console.error('\nHARNESS CONTROL FAILED — no verdict about the guides can be read from this run:');
    for (const c of controlFailures) console.error(`  - ${c}`);
    console.error(
      `\nThe gate COULD NOT RUN (exit ${EXIT_CODES.couldNotRun}). A broken harness is a verdict about ` +
        'the harness, never about the guides.',
    );
    return EXIT_CODES.couldNotRun;
  }

  // `--measure` reports; it does not gate. It exists to produce the number the
  // marker was landed on, and every candidate fence is selected in it, so its
  // failures are the UNMARKED population by construction — a verdict about what
  // is not yet opted in, which is not a defect.
  if (measure) return EXIT_CODES.verified;

  const failed =
    state.findings.length > 0 ||
    parseFailedBlocks > 0 ||
    run.semanticFailures.length > 0 ||
    jsonFailures.length > 0 ||
    bareAnyNew.length > 0 ||
    state.bareAnyStale.length > 0;

  if (failed) {
    console.error(
      `\nA marked example in ${SCAN_ROOTS.join(', ')} no longer holds up. Fix the example, or — if it ` +
        'was never meant to compile on its own — remove its marker rather than weakening this gate.',
    );
    return EXIT_CODES.examplesFailed;
  }
  console.log('\nEvery marked skill example holds up against the built types.');
  return EXIT_CODES.verified;
}

// ── Self-test ────────────────────────────────────────────────────────────────

/**
 * The marker convention, pinned in BOTH directions on fixtures rather than on
 * the real guides. A committed fixture guide would have to contain a
 * deliberately broken example, and something else in this repository would
 * eventually scan it — the reasoning `check-skills-paths.test.ts` states for its
 * own throwaway trees.
 *
 * The four cases objectui#7359 asks for are all here, and each one is a
 * direction this gate could fail in silently:
 *
 *   - a marked fence that HOLDS UP must pass (a harness broken the other way
 *     reds every guide at once and reads as "the guides are full of defects");
 *   - a marked fence that is BROKEN must fail (without it the gate is a rubber
 *     stamp);
 *   - a marker NOT adjacent to a fence must be reported (the stale-marker case:
 *     lenient adjacency opts in nothing while the author believes otherwise);
 *   - an UNMARKED broken fence must be ignored (opt-in is the whole design; if
 *     this leaks the gate reds on day one on prose that is not wrong).
 *
 * Plus the two the design turns on and nobody would think to write down: a
 * marker shown as EXAMPLE TEXT inside another fence claims nothing and is not an
 * orphan either, and a marker above a ```bash fence IS an orphan.
 *
 * The bare-`any` guard (objectui#7463) is pinned on BOTH edges here, and the
 * negative edge is the load-bearing one: ten in-scope positions must be found
 * and six nested `any`s must NOT be, because that boundary is the whole reason
 * a red from this assertion means something. Its shrink-only baseline is pinned
 * in both directions too — a declared row suppresses, and a row whose red is
 * gone is STALE.
 */
export function selfTest() {
  const cases = [];
  const t = (name, ok, detail) => cases.push({ name, ok: Boolean(ok), detail });

  // ── scanner: what a marker opts in ────────────────────────────────────────
  const guide = [
    '# Guide',
    '',
    MARKER,
    '```typescript',
    "export const one: number = 1;",
    '```',
    '',
    '```typescript',
    'const broken: number = "not a number";',
    '```',
    '',
    MARKER,
    '',
    '```typescript',
    'export const two = 2;',
    '```',
    '',
    MARKER,
    '```bash',
    'pnpm install',
    '```',
    '',
    MARKER,
    '```json',
    '{ "ok": true }',
    '```',
    '',
    '````markdown',
    MARKER,
    '```typescript',
    'this is an illustration, not an example',
    '```',
    '````',
    '',
  ].join('\n');

  const scan = scanSkillFences(guide);
  const marked = scan.fences.filter((f) => f.marked);
  t('a marker directly above a fence opts exactly that fence in', marked.length === 2, JSON.stringify(marked.map((f) => f.fenceLine)));
  t('the opted-in ts fence is the FIRST one, not the unmarked broken one', marked.some((f) => f.kind === 'ts' && f.body.includes('export const one')));
  t('the opted-in json fence is recognised as json', marked.some((f) => f.kind === 'json' && f.language === 'json'));
  t('an unmarked broken fence is a candidate but NOT selected', scan.fences.some((f) => !f.marked && f.body.includes('not a number')));
  t(
    'a marker separated from its fence by a blank line is an ORPHAN',
    scan.orphans.includes(12),
    `orphans=${JSON.stringify(scan.orphans)}`,
  );
  t('a marker above a ```bash fence is an ORPHAN', scan.orphans.includes(18), `orphans=${JSON.stringify(scan.orphans)}`);
  t(
    'a marker shown as example text inside another fence is neither opt-in nor orphan',
    scan.orphans.length === 2 && !scan.fences.some((f) => f.body.includes('illustration')),
    `orphans=${JSON.stringify(scan.orphans)} fences=${scan.fences.length}`,
  );

  // ── an unclosed fence must not swallow the rest of the file ───────────────
  const unclosed = scanSkillFences(['```typescript', 'const a = 1;', '', '# still inside, per CommonMark'].join('\n'));
  t('an unclosed fence runs to end of file rather than throwing', unclosed.fences.length === 1, JSON.stringify(unclosed.fences.map((f) => f.fenceLine)));

  // ── JSON fences ──────────────────────────────────────────────────────────
  t('valid json parses', parseJsonFence('{"a": 1}', 'json') === null);
  t('a trailing comma fails under `json`', parseJsonFence('{"a": 1,}', 'json') !== null);
  t('a comment fails under `json`', parseJsonFence('{\n  // nope\n  "a": 1\n}', 'json') !== null);
  t('a trailing comma passes under `jsonc`', parseJsonFence('{"a": 1,}', 'jsonc') === null);
  t('a comment passes under `jsonc`', parseJsonFence('{\n  // fine\n  "a": 1\n}', 'jsonc') === null);
  t(
    'a `//` inside a string is not a comment',
    parseJsonFence('{"url": "https://example.com/x"}', 'jsonc') === null,
  );
  t('a truncated object fails', parseJsonFence('{"a": 1', 'json') !== null);

  // ── the bare-`any` assertion, BOTH directions ────────────────────────────
  // Every in-scope position must be found, and every nested `any` must not be.
  // The negative half is the half that matters: it is the zero-false-positive
  // line, and a widening of it would red on prose that is not wrong.
  const anyPositive = [
    ['parameter', 'export function f(ctx: any) { return ctx; }', 'parameter `ctx`'],
    ['variable', 'export const x: any = 1;', 'variable `x`'],
    ['property (interface)', 'export interface I { p: any }', 'property `p`'],
    ['property (class)', 'export class C { p: any = 1; }', 'property `p`'],
    ['type alias', 'export type A = any;', 'type alias `A`'],
    ['return type', 'export function g(): any { return 1; }', 'return type'],
    ['arrow return type', 'export const h = (): any => 1;', 'return type'],
    ['method signature return', 'export interface J { m(): any }', 'return type'],
    ['`as any`', 'export const y = ({} as any);', '`as any` assertion'],
    ['`satisfies any`', 'export const z = ({} satisfies any);', '`satisfies any` assertion'],
  ];
  for (const [label, code, want] of anyPositive) {
    const hits = findBareAny(code);
    t(
      `bare \`any\` in a ${label} position is FOUND`,
      hits.length === 1 && hits[0].where === want,
      `got ${JSON.stringify(hits.map((f) => f.where))}, want ["${want}"]`,
    );
  }

  const anyNegative = [
    ['Record<string, any>', 'export const a: Record<string, any> = {};'],
    ['any[]', 'export const b: any[] = [];'],
    ['Array<any>', 'export const c: Array<any> = [];'],
    ['Promise<any>', 'export async function d(): Promise<any> { return 1; }'],
    ['a union arm', 'export const e: string | any[] = [];'],
    ['the WORD any in prose', 'export const f2 = "any"; // any old comment about any of it'],
  ];
  for (const [label, code] of anyNegative) {
    const hits = findBareAny(code);
    t(`a nested \`any\` (${label}) is NOT a finding`, hits.length === 0, JSON.stringify(hits));
  }

  t(
    'JSX parses rather than mis-reading as a type assertion (the harness ScriptKind)',
    findBareAny('export const El = () => <div className="x">hi</div>;').length === 0,
  );

  // ── the baseline, both directions, over fixture blocks ───────────────────
  const anyBlock = { doc: 'fixture/any.md', fenceLine: 10, kind: 'ts', marked: true, body: 'export function f(ctx: any) { return ctx; }\n' };
  const anyKey = bareAnyRowKey(anyBlock, findBareAny(anyBlock.body)[0]);
  t(
    'the baseline row key names the guide, the fence line and the position',
    anyKey === 'fixture/any.md:10 parameter `ctx`',
    anyKey,
  );
  t('an UNDECLARED bare `any` is red', !new Set([]).has(anyKey));
  t('a DECLARED bare `any` is suppressed', new Set([anyKey]).has(anyKey));

  const realState = analyze({ root: repoRoot, measure: false });
  t(
    'the real run has NO undeclared bare `any` — every row is in KNOWN_BARE_ANY_EXAMPLES',
    realState.bareAny.every((h) => h.baselined),
    JSON.stringify(realState.bareAny.filter((h) => !h.baselined).map((h) => h.key)),
  );
  t(
    'and NO declared row has gone stale — the list only shrinks',
    realState.bareAnyStale.length === 0,
    JSON.stringify(realState.bareAnyStale),
  );
  t(
    'a baseline row whose red is GONE is reported as STALE',
    analyze({ root: repoRoot, measure: false, baseline: new Set([...KNOWN_BARE_ANY_EXAMPLES, 'skills/objectui/guides/testing.md:1 parameter `ghost`']) }).bareAnyStale
      .length === 1,
  );

  // ── the type-check half, through the REAL harness ─────────────────────────
  // Two fixture blocks that need no package types at all, so this leg measures
  // the harness rather than the workspace. The CONTROLS still need the built
  // tree; when it is not built they fail, and that is reported as PRECONDITION
  // NOT MET rather than as a passing or failing self-test — the same rule the
  // real run follows.
  const holds = { doc: 'fixture/holds.md', fenceLine: 1, kind: 'ts', body: 'export const one: number = 1;\n' };
  const broken = { doc: 'fixture/broken.md', fenceLine: 1, kind: 'ts', body: 'export const two: number = "no";\n' };
  const unparseable = { doc: 'fixture/unparseable.md', fenceLine: 1, kind: 'ts', body: 'export const three: = ;\n' };
  const state = analyze({ root: repoRoot, measure: false });
  const blocking = blockingPreconditions(state.findings);
  const run = compileSnippets({
    root: repoRoot,
    compiled: [holds, broken, unparseable],
    paths: state.paths,
    declaredSpecifiers: state.declaredSpecifiers,
  });
  const { failures: controlFailures } = evaluateControls(run);

  if (blocking.length > 0 || controlFailures.length > 0) {
    for (const f of blocking) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
    for (const c of controlFailures) console.error(`  - ${c}`);
    console.error(
      `\nPRECONDITION NOT MET (exit ${EXIT_CODES.couldNotRun}) — the self-test's type-check leg needs ` +
        'the workspace built, and this tree is not. The scanner cases above did run; the compiler ' +
        'cases did NOT, and a self-test that quietly skipped them would be the exact silent-green ' +
        'this gate exists to prevent. Build, then re-run:',
    );
    console.error(
      '  pnpm exec turbo run build $(node scripts/check-skill-examples.mjs --build-filter) --concurrency=2\n' +
        '  node scripts/check-skill-examples.mjs --self-test',
    );
    for (const c of cases.filter((c2) => !c2.ok)) console.error(`  ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    return EXIT_CODES.couldNotRun;
  }

  const semanticallyFailed = new Set(run.semanticFailures.map((f) => f.block));
  const parseFailed = new Set(run.parseFailures.map((f) => f.block));
  t('a marked fence that holds up is CLEAN', !semanticallyFailed.has(holds) && !parseFailed.has(holds));
  t('a marked fence with a type error is RED', semanticallyFailed.has(broken));
  t('a marked fence that does not parse is a SYNTAX failure, never a skip', parseFailed.has(unparseable));
  t(
    'one unparseable fence does not blind the semantic phase for the rest',
    run.semanticallyJudged === 2,
    `semanticallyJudged=${run.semanticallyJudged}`,
  );

  const failed = cases.filter((c) => !c.ok);
  for (const c of failed) console.error(`  ✗ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  if (failed.length) {
    console.error(`✗ check-skill-examples self-test: ${failed.length} of ${cases.length} case(s) failed.`);
    return EXIT_CODES.examplesFailed;
  }
  console.log(
    `✓ check-skill-examples self-test: ${cases.length} cases pass (marker adjacency both directions, orphans, nested illustration, json/jsonc, the bare-\`any\` guard in both directions with its shrink-only baseline, and the compiler legs through the real harness).`,
  );
  return EXIT_CODES.verified;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(process.argv.includes('--self-test') ? selfTest() : main());
}

export { main };
