#!/usr/bin/env node
/**
 * Every fenced `ts` / `tsx` snippet in the documentation this gate covers must
 * COMPILE, `--strict`, against the packages' BUILT `dist/*.d.ts` — the surface a
 * reader who copies it actually imports.
 *
 * Run:  node scripts/check-doc-snippet-types.mjs   (also `pnpm check:doc-snippets`)
 *       node scripts/check-doc-snippet-types.mjs --build-filter   (filter args for
 *       turbo or pnpm; each carries the `...` dependency-closure suffix)
 * Exit: 0 = every covered snippet parses and type-checks, the harness proved
 *       itself on its own controls, and the coverage ledger is exact.
 *       1 = THE GATE RAN AND FOUND ERRORS. A snippet failed to parse or to
 *       type-check, or the coverage ledger is stale. Everything printed above
 *       the summary is a verdict about a document.
 *       2 = THE GATE COULD NOT RUN, so nothing printed above is a verdict about
 *       any document: the packages the covered snippets import are not built (or
 *       are typed from source), or one of the harness's own controls failed.
 *       Fix the tree and re-run. Never read this as a documentation defect, and
 *       never as a pass.
 *
 * ## Why "could not run" is its own exit code (objectui#5465)
 *
 * Both 1 and 2 are non-zero, so no caller's pass/fail changes: this gate is
 * invoked from exactly one workflow step (`doc-snippet-types.yml`), which fails
 * on any non-zero, and which builds this gate's own `--build-filter` closure
 * BEFORE invoking it — an unbuilt tree is not a state CI can reach. The
 * distinction exists for the reader. "I could not run" and "I ran and found
 * errors" are different facts, and while they shared one exit code they were
 * indistinguishable at the exit-code level: three separate agents in one evening
 * (objectui#6171, #6186, #5259) each had to notice the printed message and
 * rebuild before their exit code meant anything, and #6171 wrote it down as
 * "an unbuilt-tree exit is indistinguishable from a real failure at the
 * exit-code level". `scripts/check-eager-closure-budget.mjs` had already drawn
 * this same line for this same reason — 1 for "over budget" (a verdict about the
 * bundle), 2 for "the gauge produced nothing" (a verdict about the gauge) — so
 * this is the repository's convention, not a new one.
 *
 * ⛔ What is NOT an option here: printing the reason and exiting 0. Zero with
 * nothing run reads as coverage, which is the exact failure shape this whole
 * gate family exists to prevent (objectui#4846: an unexaminable package must not
 * read as a clean one).
 *
 * ## What this gate answers, and the three things it does NOT (read this first)
 *
 * It answers exactly one question: **does this snippet still compile against the
 * published types.** That catches an import of a symbol the package does not
 * export, a prop or key the type does not have, a signature the call no longer
 * matches, and a key whose TYPE was repurposed underneath the prose.
 *
 * It does NOT answer:
 *
 *   1. **Schema-key validity.** Whether a metadata literal would survive
 *      `ReportSchema.safeParse` is a different question with a different
 *      answer: `@objectstack/spec`'s schemas are strict, so they reject keys a
 *      TypeScript annotation never sees (an object literal assigned through a
 *      widened type, or written with no annotation at all). That is objectui#5138
 *      shape 1, left unruled on purpose — it needs a way to mark which blocks are
 *      complete documents rather than prose fragments, and guessing that boundary
 *      is what produces a gate people learn to ignore.
 *   2. **Whether a `type` literal names a registered component.** That is
 *      `scripts/check-doc-component-types.mjs`, the first dimension, and it stays
 *      its own gate: it needs no install and no build, and it must keep running
 *      unfiltered on every docs-only PR.
 *   3. **Whether a shell example runs** (objectui#5151). A ```bash block is not
 *      read here at all.
 *
 * That list is not modesty, it is the point. objectui#5138 measured what a gate
 * with an unstated blind spot does: `check-doc-component-types` verified the
 * `type` literals `summary` / `matrix` / `joined` — which were correct — while
 * four separate falsehoods sat beside them in the same snippets (`objectName` and
 * `groupingsDown`, keys the strict `ReportSchema` rejects; `columns:
 * [{ field, aggregate }]`, a key repurposed to `string[]`; `import type
 * { ReportInput }`, a type the spec does not export; and `registerDrillHandler`,
 * a fabricated export). Three gates were green on that prose for the whole
 * interval. The card's sentence for it:
 *
 *     The gate looked at the one key that was correct.
 *
 * A gate that checks the one thing that is right converts "unverified" into a
 * green, which is worse than no gate. So this file states its edges out loud, and
 * the ledger below states, by name, every document it does not read.
 *
 * ## Why this exists at all: it is consolidation, not new capability
 *
 * The harness had already been hand-rolled three times, each time privately, each
 * time finding defects its reviewer had not listed:
 *
 *   objectui#5053  README export-surface probe — proved the name set had to come
 *                  from the package's EXPORTS, not from a grep of `src/`
 *                  (`ReportScheduleConfig` appears twice in `src/` and is not
 *                  exported; a grep-based check calls it real).
 *   objectui#5060  README signature probe — extracted the blocks BY SCRIPT rather
 *                  than by hand, and carried a wiring self-check (deliberately
 *                  swap two arguments; the probe must go red) so a silently-`any`
 *                  program could not pass as green.
 *   objectui#5047  the two plugin-report documents — compiled against the built
 *                  `dist/index.d.ts` with a resolution self-check proving it, and
 *                  a planted `ThisNameIsDefinitelyNotExported` sentinel.
 *
 * All three practices are kept here (see "Controls"). One practice is
 * deliberately NOT kept: #5047's first run was a FALSE GREEN, and the mechanism
 * is the most important thing this file inherits — see "Syntax is not semantics".
 *
 * ## The rule for fragments: explicit marker, never a silent skip
 *
 * Documentation legitimately contains partial snippets. The rule this gate uses,
 * stated rather than inferred:
 *
 *     EVERY `ts` / `tsx` fenced block in a covered document is compiled, in
 *     ISOLATION, as its own module. A block that is not meant to compile must be
 *     DECLARED by a marker line immediately above its fence, carrying a written
 *     reason. There is no third case: a block that fails to parse is a FAILURE,
 *     never a skip.
 *
 * Two kinds of block need the declaration, and the reason says which: a genuine
 * FRAGMENT (a shape excerpt, a block continuing the one above it, a call into
 * the host's own router), and a block that is deliberately about code that no
 * longer exists — a migration guide's "before" example naming a retired package
 * is correct documentation and must not compile. The marker keyword stays
 * `fragment` for both rather than growing a second vocabulary; what
 * distinguishes them is the written reason, which is the part a reviewer reads.
 *
 * The two marker spellings are quoted verbatim in `FRAGMENT_MARKER_EXAMPLES`
 * below — an MDX expression comment for `.mdx`, an HTML comment for `.md`. They
 * live in code rather than in this header because a block comment cannot quote a
 * block comment's delimiters.
 *
 * Two halves of that rule are load-bearing:
 *
 * **Never skip on failure to parse.** The tempting rule — "if it does not parse
 * it must be a fragment, skip it" — turns every real defect into a skip, silently,
 * and it degrades exactly when the docs get worse. A block nobody has declared and
 * that does not parse is reported.
 *
 * **In isolation, as its own module.** Blocks on one page are NOT compiled into a
 * shared scope, and every block with no top-level `import`/`export` has an
 * `export {}` appended so it cannot see another block's globals. This models the
 * reader, who copies ONE block: objectui#5047 found three README examples calling
 * `defineReport` with no import of their own, and fixed the documents rather than
 * the harness. A shared scope hides that whole defect class — and it hides it
 * INVISIBLY, because the page still reads fine to a human going top to bottom.
 *
 * ## Syntax is not semantics — the false-green mechanism this gate is built around
 *
 * objectui#5047 measured it, and it nearly cost that review its result: `tsc`
 * reports syntactic diagnostics and, IF THERE ARE ANY, never reports semantic
 * ones — program-wide, not per-file. Two prose fragments with a bare
 * `filter: { ... }` line produced five parse errors and ZERO semantic
 * diagnostics, over a program whose whole purpose was the semantic half. The run
 * was red, so it read as "the check works" while proving nothing at all about
 * every other block in it.
 *
 * Three consequences, all of them structural here rather than advisory:
 *
 *   - The two phases are SEPARATE. Blocks are parsed one at a time first;
 *     anything with a parse error is reported as a `syntax` failure and is kept
 *     OUT of the semantic program, so one unparseable block cannot blind the
 *     rest.
 *   - Every failure line is tagged `[syntax]` or `[semantic]`, and the summary
 *     always prints the semantic COVERAGE — how many blocks the semantic phase
 *     actually judged, out of how many exist. A syntax-only red therefore cannot
 *     be read as a semantic pass, and a semantic green cannot be read as covering
 *     blocks that never reached the checker.
 *   - When any block fails to parse, the summary says so in the same breath as
 *     the semantic result, in words.
 *
 * ## Controls — a probe that cannot fail is not a probe
 *
 * Three run on every invocation, before any verdict about the documents:
 *
 *   RESOLUTION  `@object-ui/types` is resolved through the same host the program
 *               uses, and the resolved path is PRINTED. It must land in a
 *               `dist/` `.d.ts`. The repository's own root `tsconfig.json` maps
 *               `@object-ui/<name>` to each package's `src`, so a harness that inherited
 *               it would silently check the docs against SOURCE — green while the
 *               published surface is broken. Nothing here extends that config,
 *               and every source file the program loads is checked not to live
 *               under a package's `src/`.
 *   SENTINEL    a synthetic module importing `ThisNameIsDefinitelyNotExported`
 *               from a real package MUST produce TS2305. A probe that silently
 *               resolves everything to `any` reports green forever; this is the
 *               only thing that can tell the two apart.
 *   POSITIVE    a synthetic module importing a real symbol MUST be clean. Without
 *               it, a harness broken in the other direction (wrong `lib`, missing
 *               types, unbuilt tree) turns every document red at once and reads
 *               as "the docs are full of defects".
 *
 *   UNDECLARED  a synthetic module importing `@floating-ui/react-dom` MUST produce
 *               TS2307. That package IS installed in this workspace — Radix's
 *               popper pulls it in, under `@object-ui/components`'s declared
 *               `@radix-ui/react-popover` — and NO package a covered document
 *               imports declares it, so no reader of the documented packages can
 *               import it either. It is the control on the third-party rule
 *               below: the moment resolution widens past what the imported
 *               packages declare, this control goes green and the gate has become
 *               a rubber stamp no snippet can fail — invisibly, because every
 *               document stays green while it happens. It also fails loudly if
 *               the specifier ever BECOMES a declared dependency (pick another),
 *               or is not installed at all (a specifier that resolves nowhere
 *               proves nothing about how far resolution reaches).
 *
 * ## Third-party specifiers resolve exactly as far as the imported packages declare
 *
 * A snippet that imports `@object-ui/layout` may also import `lucide-react`,
 * because `@object-ui/layout` DECLARES `lucide-react`: a reader who installs that
 * package gets it in their `node_modules`, and `SidebarNav`'s `NavItem.icon`
 * genuinely takes a lucide icon. This program compiles every block at the
 * repository ROOT, where under pnpm a workspace package's own dependency is not
 * hoisted and so does not resolve — five correct blocks across
 * `content/docs/layout` failed TS2307 on nothing but that (objectui#6120). The
 * snippets were right; the resolution environment was the gap.
 *
 * The rule, stated here because its EDGES are the whole of its value:
 *
 *     For every workspace package a COVERED document imports, each specifier that
 *     package declares in its own `dependencies` is mapped to the types a
 *     consumer of that package would resolve — resolved from inside that
 *     package's own directory, exactly the way that package's own code resolves
 *     it.
 *
 * Four edges, each deliberate:
 *
 *   - **Declared, never merely installed.** The set comes from `dependencies` in
 *     the imported packages' manifests, never from a walk of `node_modules`. A
 *     blanket mapping would let a snippet import a transitive package no consumer
 *     can reach and still pass green, which is strictly worse than the gap it
 *     would close: the gate's whole value is that it fails where a reader fails.
 *   - **`dependencies` only** — not `peerDependencies`, not `devDependencies`. A
 *     dependency is what the package installs FOR its consumer; a peer is a
 *     requirement ON the consumer that may be unmet; a devDependency reaches no
 *     consumer at all. A snippet importing a peer therefore still fails here.
 *     That is the conservative direction on purpose: this rule fails CLOSED, and
 *     widening it later is a visible edit with a reason, not a silent drift.
 *   - **Imported packages only.** A package no covered document imports
 *     contributes nothing, so this map grows only as coverage grows — the same
 *     property `--build-filter` has, for the same reason.
 *   - **The bare specifier only, no subpath wildcard.** `lucide-react` is mapped;
 *     `lucide-react/dynamic` is not, and fails closed. Mapping `<pkg>/*` would
 *     reach past the package's own `exports`, and `exports` is precisely the
 *     boundary a reader hits.
 *
 * ⛔ What this rule exists INSTEAD of: declaring `lucide-react` at the repository
 * root. That would put an entry in this repository's dependency graph that exists
 * only to make a checker pass — changing what the repo claims to need in order to
 * satisfy a tool. The 2026-08-24 ruling on objectui#6120 rejected that route by
 * name, alongside objectui#5329 (minting a `$schema` URL because prose named one)
 * and objectui#6107 (minting exports because docs imported them). A manifest is a
 * claim about what a package needs; a doc gate's convenience is not that claim.
 *
 * ## Coverage is declared, never assumed — and the scan surface is stated here
 *
 * A document is covered unless it is named in `UNGATED_DOCS` with a reason. The
 * default is therefore COVERED: a new page is compiled from the day it lands,
 * and opting one out is an edit a reviewer can see. Entries are re-derived every
 * run — an entry naming a file that does not exist, or that holds no `ts` / `tsx`
 * block at all, fails as a stale entry, so the list can only shrink.
 *
 * That rule is only true of documents the walk actually reaches, so the SCAN
 * SURFACE is stated in the same breath as the coverage rule rather than left to
 * be read off the collector:
 *
 *     every `.mdx` and `.md` page under `content/docs`, every
 *     `packages/<name>/README.md`, and the root `README.md`.
 *
 * Stating it here is objectui#5174's finding, and the finding was not the missing
 * extension — it was that a reader had to open `listDocuments` to learn that
 * "covered by default" meant "covered if the filename ends in `.mdx`". The
 * collector admitted 143 `.mdx` under `content/docs` and silently excluded 40
 * `.md` guides — the getting-started pages a reader copies from most. None of
 * them was in the ledger, so they were neither covered NOR declared ungated:
 * they were invisible to this gate's own accounting, and the summary line below
 * could not mention them. That is precisely the silent skip the fragment rule
 * exists to prevent, arriving one level up, at the document instead of the block.
 * Anything added to the scan surface later belongs in that list, on the same day.
 *
 * ⚠️ The honest limit, stated because a reader of a green run needs it: an
 * ungated document is NOT compiled and NOT counted. Its snippets are unverified,
 * exactly as they were before this gate existed. The ledger is a debt list with
 * names, not a coverage claim. It carries no per-file failure count on purpose:
 * a count would have to be produced by compiling every ungated document, which
 * means building every package in the workspace on every run — the per-PR
 * full-repo build the 2026-08-16 ruling on objectui#4846 rejected (see
 * `.github/workflows/published-dist-gate.yml`). The build here is scoped to the
 * packages the COVERED documents import, which is why `--build-filter` exists and
 * why the cost grows only as coverage grows.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isEntrypoint } from './invoked-as.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Configuration ────────────────────────────────────────────────────────────

/** Documentation surfaces read by this gate. Kept identical in spirit to
 *  `check-doc-links.mjs`: the pages a reader lands on, plus every published
 *  package README (which ships to npm inside the package's `files`). */
const DOCS_ROOT = 'content/docs';
const PACKAGES_DIR = 'packages';

/**
 * Pages at the repository ROOT that join the scan set by name.
 *
 * objectui#7115. Between this gate's surface (`content/docs` + the package
 * READMEs) and `check-doc-component-types.mjs`'s (`content/docs` alone), the
 * root `README.md` fell through: the most-read authored file in the repository —
 * the GitHub landing page and the npm page for the workspace — was read by NO
 * doc gate at all. It taught the unregistered type `stat-card` four times in its
 * flagship example for as long as the example existed.
 *
 * Adding the name here is what makes the file VISIBLE to this gate's accounting.
 * Whether its snippets compile is a separate question answered, as for every
 * other document, by `UNGATED_DOCS` below: covered by default, and opted out
 * only with a written, re-derived reason. That distinction is objectui#5174's,
 * quoted in the header — a document outside the walk is "neither covered NOR
 * declared ungated", which is strictly worse than a named debt.
 *
 * A name here that does not resolve is a failed run, not a quiet skip: see the
 * check in `main`.
 */
const ROOT_PAGES = ['README.md'];

/** Page extensions collected under `DOCS_ROOT`. BOTH are collected, and that is
 *  the whole content of the scan surface: `content/docs` is authored in a mix of
 *  `.mdx` and `.md` — the same guide tree, the same renderer, the same reader —
 *  and an extension is not a coverage decision. Collecting only `.mdx` is how
 *  objectui#5174 happened: 40 `.md` guides sat outside the ledger, so they were
 *  neither covered nor declared ungated, which is precisely the silent skip the
 *  fragment rule below exists to prevent. Anything else under the tree (`.json`
 *  sidecars) holds no prose and is not a page. */
const DOC_EXTENSIONS = ['.mdx', '.md'];

/** Fence languages treated as compilable TypeScript. `js` / `jsx` are NOT in the
 *  set: they are not type-annotated, so a strict program judges them on rules
 *  their authors never opted into. */
const TS_FENCE_LANGUAGES = new Set(['ts', 'tsx', 'typescript']);

/**
 * Documents whose snippets are NOT compiled, each with the reason. The default
 * is covered; this list is the debt, by name, and it can only shrink.
 *
 * ⚠️ ZERO of these entries are now `.md` pages under `content/docs`. There were 19
 * when objectui#5174 made them visible — the collector reads `.md`, and an entry
 * with a measured reason is what a page that cannot pass yet is owed — and that
 * card then walked every one of them back OFF this list rather than re-wording its
 * reason. The direction on that card was entries LEAVING, and it finished: what
 * remains here is `.mdx` pages under `content/docs` plus package READMEs, and the
 * ENTRIES BELOW are that list — re-derived every run and shrink-only, so the names
 * in it are the count. This sentence carried the literal `12 .mdx pages and 32
 * package READMEs` until objectui#5174's batch 7, by which point BOTH halves had
 * drifted: the README count has been 31 since objectui#5259, and the `.mdx` count
 * moves with every batch. Nothing fails on a stale number written here, which is
 * why it is a pointer to the list now rather than a copy of its length.
 *
 * Batch 1 took ten: `api/schema-reference`, `plugins/index`, and the `guide/` pages
 * `architecture-overview`, `deployment`, `expressions`, `notifications`,
 * `public-forms`, `schema-overview`, `troubleshooting` and `user-state-persistence`
 * — clearing 90 diagnostics. Batch 2 took four more — `guide/plugins`,
 * `guide/building-crud-app`, `rfcs/0001-clipboard-paste` and `guide/architecture`
 * — clearing 89. Batch 3 took three — `guide/plugin-development`,
 * `guide/schema-rendering` and `guide/theming` — clearing 81. Batch 4 took the
 * final pair, `guide/component-registry` (59) and `guide/layout` (45), clearing
 * 104. Each page reached zero the honest two ways — a block
 * that should compile was made self-contained against the built `dist/`, and a
 * block that genuinely cannot compile got a `FRAGMENT_MARKER` declaration with a
 * written reason. Nothing about this gate's strictness moved to get them there.
 *
 * Batch 4 in the same terms as the batches below: 32 blocks brought under the gate
 * — 23 declared fragments and 9 that compile, of which 5 already compiled untouched
 * and 4 were edited to. Its defect was in the page's ONE complete copy-paste
 * example: `guide/component-registry`'s `RatingComponent` calls `useState` while
 * importing only `forwardRef` from `react`, so the block a reader is invited to
 * take whole was broken at the first hook. The same block took `cn` from the
 * reader's own `@/lib/utils` alias when `@object-ui/components` exports `cn`
 * itself. Two things this gate CANNOT see on that page, stated because a green run
 * must not be read as more than it is: `ComponentRegistry` is a `Registry<any>`, so
 * `register()`'s component argument is `any` and no registered component's props
 * are checked against what `SchemaRenderer` passes; and `BaseSchema` carries
 * `[key: string]: any`, so a wrong key on a `BaseSchema`-shaped literal is
 * structurally invisible here. What IS sealed — and therefore really checked —
 * is `ComponentMeta`, `ComponentInput`, `NavItem`, `NavGroup`, `AppShellProps` and
 * `SidebarNavProps`; every literal of those six on the two pages was measured
 * clean, the `lucide-react` blocks by probing them with the icon import shimmed
 * rather than by inferring it from the TS2307 that hid them.
 *
 * Batch 2's two routes in proportion, because the ratio is the reviewable part: it
 * brought 42 blocks under the gate — 34 declared fragments and 8 that compile, of
 * which 4 already compiled untouched and 4 were edited to. Three of those four
 * edits were genuine documented-API defects the ledger had been hiding, and they
 * are why a page like `guide/architecture` was worth covering rather than
 * declaring wholesale: `building-crud-app`'s REST adapter
 * passed `QueryParams['$orderby']` — a four-shape union — straight into
 * `URLSearchParams.set`, which takes a string; its `TaskDetail` component used
 * `SchemaRenderer` with no import of its own; and `guide/architecture`'s section
 * titled "Type Safety", marked `// ✅ Type-checked`, set `ButtonSchema.onClick` to
 * the STRING `'handleClick'` where the declared type is `() => void | Promise<void>`.
 * The pages that are mostly fragments are mostly fragments for a stated reason:
 * Batch 3 in the same terms: 38 blocks brought under the gate — 26 declared
 * fragments and 12 that compile, of which 7 already compiled untouched and 5 were
 * edited to. Its defect was the largest single one this card has surfaced, and it
 * was hidden the way objectui#5138 describes: `guide/theming`'s three `Theme`
 * objects were annotated `Theme` but the annotation itself errored (`Theme` was
 * never imported in two of them), so TypeScript never excess-checked the literals
 * underneath. With the annotation resolving, the `brand` palette alone had TEN of
 * its fourteen `colors` keys off `ColorPalette` — `"primary-foreground"`,
 * `foreground`, `muted`, `ring`, `destructive` and the other `*-foreground` pairs
 * are Shadcn CSS VARIABLE names, not palette keys — plus `radius` and `fonts`,
 * neither of which is a `Theme` key, and no `label`, which is required. Every one
 * of those is dropped in silence at runtime: `generateColorVars` iterates
 * `COLOR_TO_CSS_MAP`, so it can only ever emit the keys `ColorPalette` declares.
 * The pages were teaching theme JSON most of which the engine ignores. The fix
 * routes them through the two doors that do work — the real palette keys, each
 * annotated with the variable it emits, and `customVars` for the rest, which the
 * engine emits verbatim as `--<key>: <value>`.
 *
 * `guide/plugin-development` also had the documented Vitest example asserting
 * `toBeInTheDocument()` with no `@testing-library/jest-dom` import, the matcher's
 * own package — a reader copying that test got neither the types nor the matcher.
 *
 * The pages that are mostly fragments are mostly fragments for a stated reason:
 * `guide/plugin-development` walks the reader through building a plugin package,
 * so its blocks import `./types` and `./BoardImpl` — files the reader has just
 * been told to write — and `guide/theming` quotes the published `Badge` source,
 * which imports `class-variance-authority`, a peer that resolves in the reader's
 * app but is not a root dependency here.
 * `guide/plugins` and the clipboard-paste RFC document packages the reader is being
 * taught to create, and an RFC's signature excerpts have no bodies by design.
 * `guide/layout` is the same shape as `guide/theming`, one layer out: four of its
 * nine blocks import `lucide-react` for the icon COMPONENTS `NavItem.icon` takes,
 * and that package — a dependency of ten workspace packages here, including
 * `@object-ui/layout` — is not a root dependency, so the specifier does not resolve
 * in this program. Hoisting a package to the repo root to buy a doc snippet
 * coverage is a real dependency edge, so those blocks are declared instead, with
 * what sits underneath them measured (via a shimmed icon import) rather than left
 * unknown. `guide/component-registry`'s six category lists were markdown BULLET
 * LISTS inside `tsx` fences — the fence language was the defect there rather
 * than anything in the blocks, so they were declared here and left to their own
 * change. objectui#5997 (PR #6056) then made that change: the six fences are
 * plain markdown bullet lists on the page now, which takes those blocks out of
 * the ts/tsx population this gate collects at all, so the six `FRAGMENT_MARKER`
 * declarations came out with them — a marker on a block the gate no longer
 * collects is debt nothing would ever fail to prompt the removal of. The entry
 * stays here because this ledger keeps the record of why each declaration
 * existed, not because the page still carries them.
 *
 * objectui#5343 then read that list back and cleared it for the getting-started
 * pages: no entry for `content/docs/guide/**` or for
 * `content/docs/api/schema-reference.md` names a missing export any more. Every
 * symbol those pages documented now exists on the built `dist/index.d.ts`, so
 * their reasons record what each fabricated name BECAME instead. objectui#5360
 * then closed out the last one. `content/docs/utilities/index.md` named
 * `ObjectStackProvider` (@object-ui/data-objectstack) — a React context provider
 * on a package that is headless — and that page LEFT this ledger rather than
 * getting a re-measured reason: it holds exactly ONE ts/tsx block, so rewriting
 * that block against the real surface (`createObjectStackAdapter` injected
 * through `@object-ui/react`'s `SchemaRendererProvider`, the shape PR #4129 had
 * already established on the sibling `content/docs/utilities/data-objectstack.mdx`)
 * retired the two undefined-name diagnostics in the same stroke and took the page
 * to zero. No entry on this list names a missing export any more.
 *
 * The reasons are deliberately concrete about WHAT would have to change, because
 * "does not compile" is three different jobs: a page whose snippets reference
 * ambient names it never defines needs the blocks made self-contained (or
 * declared fragments); a page whose ```ts fences hold bare object literals needs
 * the fence language corrected to `json`; a page whose snippets are genuinely
 * wrong needs the documented API fixed. Only the third is a defect this gate
 * would report, and telling them apart is per-page work.
 *
 * @type {Record<string, string>}
 */
const UNGATED_DOCS = {
  // objectui#7115 put the root README into the scan surface; this entry is what
  // that bought on THIS gate's question. The file is now VISIBLE to the ledger
  // instead of invisible to the walk — the objectui#5174 distinction quoted in
  // the header — and the debt below is measured, not estimated. ⚠️ Read as debt,
  // never as a pass: these 9 diagnostics are real and objectui#7417 carries them.
  // The three TS2305s are the ones that matter; the other six are fragment shape.
  'README.md':
    '4 undefined-name diagnostic(s) — blocks use ambient names the page never defines (`myAPI`, ' +
    '`MySidebar`) or continue an earlier block (`SchemaRenderer`, `schema`); 2 elided-body ' +
    'diagnostic(s) (TS2420, TS2355) — a `DataSource` implementation written as `// ... other ' +
    'methods`; plus TS2305x3 — REAL defects, measured against the built `dist/index.d.ts` of each ' +
    'package and filed as objectui#7417: `ObjectRenderer` is on no export of @object-ui/app-shell ' +
    '(the same phantom objectui#7095 recorded in examples/byo-backend-console/README.md), ' +
    '`registerDefaultRenderers` is on no export of @object-ui/components (only ' +
    '`registerPlaceholders` is) and is taught in no other authored file, and ' +
    '`createObjectStackAdapter` is imported from @object-ui/core, which does not ship it — ' +
    '@object-ui/data-objectstack does, as packages/plugin-dashboard/README.md already writes it.',
  'content/docs/plugins/plugin-calendar-view.mdx':
    '2 unresolved-module diagnostic(s) — and NOT a defect: the page is a migration guide whose ' +
    '"Before" blocks quote the retired `@object-ui/plugin-calendar-view` import on purpose. Covering ' +
    'it means declaring those blocks, which is a judgement about the page rather than a mechanical ' +
    'edit — the one entry here that would be closed by declaring blocks rather than by fixing them.',
  'content/docs/plugins/plugin-detail.mdx':
    '16 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'content/docs/utilities/create-plugin.mdx':
    '1 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 1 unresolved-module diagnostic(s)',
  'packages/app-shell/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 14 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/auth/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 15 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2741x1 — candidate real defects, un-triaged',
  'packages/collaboration/README.md':
    '13 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2339x2 TS2353x1 TS2554x1 TS2739x1 — candidate real defects, un-triaged',
  'packages/core/README.md':
    '5 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the ' +
    'page never defines; plus TS2339x1 — TRIAGED, and NOT a defect: the remaining one is ' +
    '`userListView.columns.push(...) // ❌ TypeError (strict mode)`, the System-View immutability ' +
    'demonstration, so a readonly rejection there is the documentation working as written. ' +
    'This entry read TS2339x2 until objectui#5257: the second one, on the `cloneAsOverride` draft ' +
    'one block below, was a real signature defect — `cloneAsOverride` returned its input type, so ' +
    'the documented override flow did not compile. It now returns `DeepMutable<T>` and that ' +
    'diagnostic is gone. Covering this page still needs the 5 undefined-name blocks made ' +
    'self-contained or declared, plus a way to declare a block whose rejection IS the point.',
  'packages/fields/README.md':
    '2 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 1 unresolved-module diagnostic(s)',
  'packages/i18n/README.md':
    '7 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2554x2 TS2559x2 — candidate real defects, un-triaged',
  'packages/layout/README.md':
    '3 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 3 unresolved-module diagnostic(s)',
  'packages/mobile/README.md':
    '19 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS1108x2 TS2345x1 TS2353x1 — candidate real defects, un-triaged',
  'packages/permissions/README.md':
    '12 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2322x4 TS2345x1 TS2353x1 — candidate real defects, un-triaged',
  'packages/plugin-ai/README.md':
    '5 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2322x3 — candidate real defects, un-triaged',
  'packages/plugin-calendar/README.md':
    '9 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 2 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/plugin-charts/README.md':
    '6 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'packages/plugin-chatbot/README.md':
    '5 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 1 unresolved-module diagnostic(s); plus TS17000x1 TS2322x1 — candidate real defects, un-triaged',
  'packages/plugin-dashboard/README.md':
    '19 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 4 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/plugin-designer/README.md':
    '2 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 12 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2339x6 TS2554x1 TS2741x1 — candidate real defects, un-triaged',
  'packages/plugin-detail/README.md':
    '5 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 15 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/plugin-editor/README.md':
    '6 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'packages/plugin-gantt/README.md':
    '9 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 12 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/plugin-kanban/README.md':
    '6 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'packages/plugin-list/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 7 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/plugin-map/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 1 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2322x1 — candidate real defects, un-triaged',
  'packages/plugin-markdown/README.md':
    '2 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'packages/plugin-report/README.md':
    '16 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS1108x1 — candidate real defects, un-triaged',
  'packages/plugin-tree/README.md':
    '3 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'packages/providers/README.md':
    '7 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2741x1 — candidate real defects, un-triaged',
  'packages/react-runtime/README.md':
    '25 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2813x1 TS2814x1 — candidate real defects, un-triaged',
  'packages/react/README.md':
    '9 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2339x2 — candidate real defects, un-triaged',
  'packages/types/README.md':
    '3 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 3 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
};

// ── Fence scanning ───────────────────────────────────────────────────────────

/**
 * One level of blockquote marker: the `>` a Markdown blockquote puts in front of
 * every line it contains — the fences and the code between them alike. At most one
 * space after the marker is consumed, per CommonMark, so indentation that belongs
 * to the snippet survives the strip.
 */
const QUOTE_MARKER = /^[ \t]*>[ \t]?/;

/**
 * `line` with `depth` levels of blockquote marker removed. `depth === 0` returns
 * the line unchanged, byte for byte; that identity path is what keeps every
 * unquoted fence in the corpus collecting exactly as it did before. A line that
 * runs out of markers early is returned as far as it stripped, which bounds a
 * lazily-continued blockquote instead of letting its fence run to end of file.
 */
function stripQuotePrefix(line, depth) {
  let out = line;
  for (let d = 0; d < depth; d++) {
    const m = QUOTE_MARKER.exec(out);
    if (!m) break;
    out = out.slice(m[0].length);
  }
  return out;
}

/** The declaration a fragment carries; see FRAGMENT_MARKER_EXAMPLES. */
const FRAGMENT_MARKER =
  /^[ \t]*(?:\{\/\*|<!--)[ \t]*doc-snippet:[ \t]*fragment[ \t]*(?:—|--|-|:)[ \t]*(.+?)[ \t]*(?:\*\/\}|-->)[ \t]*$/;

const MIN_REASON_LENGTH = 12;

/**
 * The marker, spelled out. Quoted as strings because a JavaScript block comment
 * cannot contain the `*` + `/` these examples end with — which is exactly why the
 * header points here instead of showing them itself. Both forms are inert in
 * their own renderer: the MDX form is an expression comment, the HTML form is an
 * HTML comment, and neither reaches the reader.
 */
export const FRAGMENT_MARKER_EXAMPLES = [
  '{/* doc-snippet: fragment \u2014 why this block cannot compile */}',
  '<!-- doc-snippet: fragment \u2014 why this block cannot compile -->',
];

/**
 * Every fenced block in one document, with the ts/tsx ones marked. Fences are
 * matched by their own run length so a ```` ```` ```` wrapper containing ``` does
 * not confuse the walk, and a block's opening info string is kept verbatim.
 *
 * A fence opened inside a blockquote is collected too. Its opener's quote depth
 * is carried to the search for its closing fence and stripped from every body
 * line, so the compiler sees the snippet the reader sees and not the `>` around
 * it. Depth 0 — every unquoted fence — takes the identity path and scans exactly
 * as it did before blockquotes were recognised.
 */
export function scanFences(source) {
  const lines = source.split('\n');
  const blocks = [];
  const markers = [];
  for (let i = 0; i < lines.length; i++) {
    const marker = FRAGMENT_MARKER.exec(lines[i]);
    if (marker) markers.push({ line: i + 1, reason: marker[1].trim(), consumed: false });
    const open = /^([ \t]*(?:>[ \t]*)*)(`{3,})(.*)$/.exec(lines[i]);
    if (!open) continue;
    const ticks = open[2];
    const depth = (open[1].match(/>/g) ?? []).length;
    let close = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const c = /^[ \t]*(`{3,})[ \t]*$/.exec(stripQuotePrefix(lines[j], depth));
      if (c && c[1].length >= ticks.length) {
        close = j;
        break;
      }
    }
    const info = open[3].trim();
    const language = (info.split(/\s+/)[0] || '').toLowerCase();
    if (TS_FENCE_LANGUAGES.has(language)) {
      // The marker must be the nearest non-blank line above the fence.
      let k = i - 1;
      while (k >= 0 && lines[k].trim() === '') k--;
      const above = k >= 0 ? markers.find((m) => m.line === k + 1) : undefined;
      if (above) above.consumed = true;
      blocks.push({
        fenceLine: i + 1,
        language,
        body: lines
          .slice(i + 1, close)
          .map((line) => stripQuotePrefix(line, depth))
          .join('\n'),
        fragmentReason: above ? above.reason : null,
      });
    }
    i = close;
  }
  return { blocks, markers };
}

/** Every document in the scan set, in a stable order. */
export function listDocuments(root = repoRoot) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (DOC_EXTENSIONS.some((ext) => entry.endsWith(ext)))
        out.push(relative(root, p).split(sep).join('/'));
    }
  };
  const docsRoot = join(root, DOCS_ROOT);
  if (existsSync(docsRoot)) walk(docsRoot);
  const pkgDir = join(root, PACKAGES_DIR);
  if (existsSync(pkgDir)) {
    for (const entry of readdirSync(pkgDir).sort()) {
      const readme = join(pkgDir, entry, 'README.md');
      if (existsSync(readme)) out.push(relative(root, readme).split(sep).join('/'));
    }
  }
  // Root pages last, by name. An absent one is dropped here so a throwaway
  // fixture tree stays listable; `main` refuses to publish a verdict when one is
  // missing from a real run, which is the only place that can bite.
  for (const name of ROOT_PAGES) {
    if (existsSync(join(root, name))) out.push(name);
  }
  return out;
}

// ── Where the types come from: the BUILT artifacts, derived per run ──────────

/**
 * `paths` for the snippet program, derived from each workspace package's own
 * `exports` / `types` — the entry a consumer resolves. Every target must EXIST:
 * a missing one means the package is unbuilt, which is reported as its own
 * failure rather than as sixty broken snippets.
 */
export function derivePackageTypePaths(root = repoRoot) {
  const paths = {};
  const packageDirOf = {};
  /**
   * Packages whose declared types are SOURCE, not a built artifact —
   * `@object-ui/test-support` points `types` at `src/index.ts`. Such an entry is
   * deliberately kept OUT of `paths`: silently mapping it would judge a snippet
   * against code no consumer resolves, which is the exact substitution this gate
   * exists to make impossible. A covered snippet that imports one is reported.
   */
  const sourceTyped = {};
  const pkgDir = join(root, PACKAGES_DIR);
  for (const entry of readdirSync(pkgDir).sort()) {
    const manifestPath = join(pkgDir, entry, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!manifest.name) continue;
    packageDirOf[manifest.name] = `${PACKAGES_DIR}/${entry}`;
    const record = (specifier, relPath) => {
      if (typeof relPath !== 'string') return;
      const abs = join(pkgDir, entry, relPath.replace(/^\.\//, ''));
      if (!/[\\/]dist[\\/].*\.d\.ts$/.test(abs)) {
        sourceTyped[specifier] = relative(root, abs).split(sep).join('/');
        return;
      }
      paths[specifier] = [abs];
    };
    const exportsField = manifest.exports;
    if (exportsField && typeof exportsField === 'object') {
      for (const [subpath, target] of Object.entries(exportsField)) {
        if (!target || typeof target !== 'object') continue;
        const specifier =
          subpath === '.' ? manifest.name : `${manifest.name}${subpath.replace(/^\./, '')}`;
        record(specifier, target.types);
      }
    } else {
      record(manifest.name, manifest.types || manifest.typings);
    }
  }
  return { paths, packageDirOf, sourceTyped };
}

/** A declaration file, in any of the three spellings a package may ship. */
const DECLARATION_FILE = /\.d\.(ts|mts|cts)$/;
/** Any path inside a workspace package's `src/` — never a surface a reader gets. */
const WORKSPACE_SRC = /[\\/]packages[\\/][^\\/]+[\\/]src[\\/]/;
/** Never written to disk: only a location to resolve FROM, inside a package. */
const DEPENDENCY_PROBE_FILE = '__doc-snippet-dependency-probe__.ts';

/**
 * `paths` for the THIRD-PARTY specifiers a covered snippet may legitimately
 * import: for each workspace package a covered document imports, every specifier
 * that package DECLARES in its own `dependencies`, resolved from inside that
 * package's directory — which is exactly what the package's own code resolves,
 * and exactly what a consumer who installs it gets.
 *
 * The rule and its four edges are stated in this file's header; the two things
 * enforced right here are that the set is read from MANIFESTS (never from a walk
 * of `node_modules`) and that a mapping may only ever land on a declaration file
 * outside any package's `src/`. A specifier that ships no types is left
 * unresolvable and reported as such, never mapped to something approximate: the
 * snippet importing it then fails, which is the honest answer.
 */
export function deriveDeclaredDependencyPaths(root = repoRoot, importedPackages = [], packageDirOf = {}) {
  const paths = {};
  const declaredBy = {};
  const untyped = [];
  const seen = new Set();
  const options = {
    module: COMPILER_OPTIONS.module,
    moduleResolution: COMPILER_OPTIONS.moduleResolution,
  };
  const host = ts.createCompilerHost(options, false);
  // Sorted, so which package wins a specifier two of them declare is decided by
  // name rather than by walk order — a run must not depend on readdir.
  for (const owner of [...importedPackages].sort()) {
    const dir = packageDirOf[owner];
    if (!dir) continue;
    const manifestPath = join(root, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const specifier of Object.keys(manifest.dependencies || {}).sort()) {
      // A workspace package is mapped from its OWN `exports` by
      // `derivePackageTypePaths`, and one deliberately left unmapped there
      // (source-typed) must STAY unmapped — routing it through a node_modules
      // symlink would judge a snippet against a package's `src/`, the exact
      // substitution this gate exists to make impossible.
      if (specifier in packageDirOf) continue;
      if (seen.has(specifier)) continue;
      seen.add(specifier);
      const resolved = ts.resolveModuleName(
        specifier,
        join(root, dir, DEPENDENCY_PROBE_FILE),
        options,
        host,
      );
      const file = resolved.resolvedModule ? resolved.resolvedModule.resolvedFileName : null;
      if (!file || !DECLARATION_FILE.test(file) || WORKSPACE_SRC.test(file)) {
        untyped.push({ specifier, owner, resolved: file });
        continue;
      }
      paths[specifier] = [file];
      declaredBy[specifier] = owner;
    }
  }
  // `seen` is exactly the set of non-workspace specifiers the imported packages
  // DECLARE, whether or not each one could be mapped. The UNDECLARED control
  // reads it to tell its two failure modes apart: a control specifier that has
  // become a declared dependency (pick another) is a different fact from one
  // that resolves without any manifest declaring it (resolution has widened).
  return { paths, declaredBy, untyped, declared: [...seen].sort() };
}

/**
 * Where a package is physically installed in this workspace, found WITHOUT
 * assuming it resolves from anywhere in particular: pnpm's virtual store holds
 * one directory per (package, version, peer-set), named with `/` replaced by `+`.
 * Used only by the UNDECLARED control, which must never confuse "this specifier
 * does not resolve" with "this package is not installed" — the second proves
 * nothing about how far resolution reaches.
 */
export function findInstalledCopy(root = repoRoot, specifier = '') {
  const storeDir = join(root, 'node_modules', '.pnpm');
  if (!existsSync(storeDir)) return null;
  const prefix = `${specifier.replace(/\//g, '+')}@`;
  for (const entry of readdirSync(storeDir).sort()) {
    if (!entry.startsWith(prefix)) continue;
    const candidate = join(storeDir, entry, 'node_modules', ...specifier.split('/'));
    if (existsSync(join(candidate, 'package.json'))) {
      return relative(root, candidate).split(sep).join('/');
    }
  }
  return null;
}

/** Workspace package specifiers a document imports (bare specifier root only). */
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

// ── The run ──────────────────────────────────────────────────────────────────

const SENTINEL_EXPORT = 'ThisNameIsDefinitelyNotExported';
const CONTROL_PACKAGE = '@object-ui/types';
const CONTROL_REAL_EXPORT = 'ComponentSchema';

/**
 * The UNDECLARED control's specifier (see the header). Three properties make it
 * the right one, and all three are ASSERTED at run time rather than trusted:
 * it is installed in this workspace (a transitive of `@radix-ui/react-popover`,
 * which `@object-ui/components` declares), it is declared by no package in this
 * repository at all, and it ships real `.d.ts` files — so if resolution ever did
 * widen to reach it, the control module would compile CLEANLY rather than fail
 * for some unrelated reason. It is the difference between "the rule is narrow"
 * and "we hope the rule is narrow".
 */
const UNDECLARED_CONTROL_PACKAGE = '@floating-ui/react-dom';

const COMPILER_OPTIONS = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  resolveJsonModule: true,
  forceConsistentCasingInFileNames: true,
  noUnusedLocals: false,
  noUnusedParameters: false,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
};

const VIRTUAL_DIR = '.doc-snippet-probe';

export function analyze({ root = repoRoot, ungated = UNGATED_DOCS } = {}) {
  const findings = [];
  const documents = listDocuments(root);
  const documentSet = new Set(documents);

  // ── ledger: re-derived, never trusted ─────────────────────────────────────
  const scans = new Map();
  for (const doc of documents) {
    scans.set(doc, scanFences(readFileSync(join(root, doc), 'utf8')));
  }
  for (const [doc, reason] of Object.entries(ungated)) {
    if (!documentSet.has(doc)) {
      findings.push({ reason: 'stale-ungated-entry', site: doc, detail: 'no such document in the scan set' });
      continue;
    }
    if (!reason || reason.trim().length < MIN_REASON_LENGTH) {
      findings.push({ reason: 'unexplained-ungated-entry', site: doc, detail: 'an entry with no written reason is not a declaration' });
    }
    if (scans.get(doc).blocks.length === 0) {
      findings.push({ reason: 'stale-ungated-entry', site: doc, detail: 'document holds no ts/tsx fenced block' });
    }
  }

  // ── fragment markers: local, and never dangling ───────────────────────────
  for (const doc of documents) {
    const { markers, blocks } = scans.get(doc);
    for (const marker of markers) {
      if (!marker.consumed) {
        findings.push({
          reason: 'stale-fragment-marker',
          site: `${doc}:${marker.line}`,
          detail: 'a fragment marker must sit immediately above a ts/tsx fence',
        });
      }
    }
    if (doc in ungated) continue;
    for (const block of blocks) {
      if (block.fragmentReason !== null && block.fragmentReason.length < MIN_REASON_LENGTH) {
        findings.push({
          reason: 'unexplained-fragment',
          site: `${doc}:${block.fenceLine}`,
          detail: 'a fragment declaration must say why the block cannot compile',
        });
      }
    }
  }

  const covered = documents.filter((d) => !(d in ungated));
  const compiled = [];
  const declaredFragments = [];
  for (const doc of covered) {
    for (const block of scans.get(doc).blocks) {
      (block.fragmentReason === null ? compiled : declaredFragments).push({ doc, ...block });
    }
  }

  // ── the packages those snippets import must be BUILT ──────────────────────
  const { paths, packageDirOf, sourceTyped } = derivePackageTypePaths(root);
  const neededPackages = new Set();
  for (const block of compiled) {
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
        detail: `${name} declares its types at ${sourceTyped[name]} — source, not a built artifact. A covered snippet may not be judged against it.`,
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

  // ── and what THOSE packages declare resolves too, exactly that far ────────
  const {
    paths: dependencyPaths,
    declaredBy: dependencyDeclaredBy,
    untyped: untypedDependencies,
    declared: declaredSpecifiers,
  } = deriveDeclaredDependencyPaths(root, neededPackages, packageDirOf);
  // Workspace entries win every collision: a workspace package is mapped from
  // its own `exports`, and one deliberately left unmapped stays unmapped.
  const mergedPaths = { ...dependencyPaths, ...paths };

  return {
    documents,
    covered,
    compiled,
    declaredFragments,
    findings,
    paths: mergedPaths,
    workspacePaths: paths,
    dependencyPaths,
    dependencyDeclaredBy,
    untypedDependencies,
    declaredSpecifiers,
    neededPackages,
    scans,
  };
}

/** Phase 1 (syntax) and phase 2 (semantics), kept apart on purpose. */
export function compileSnippets({ root = repoRoot, compiled, paths, declaredSpecifiers = [] }) {
  const parseFailures = [];
  const virtual = new Map();
  const owners = new Map();
  compiled.forEach((block, index) => {
    // Every block is parsed as TSX regardless of the fence label. The corpus
    // labels JSX-bearing snippets `ts`, `tsx` and `typescript` interchangeably,
    // and a JSX element in a `ts` fence is a PARSE error under ScriptKind.TS —
    // which under the never-skip rule above would be reported as a syntax defect
    // in a snippet that is fine. The one construct TSX gives up is the
    // angle-bracket type assertion `<T>value`; `value as T` is the form this
    // repository's own sources and docs use.
    const probe = ts.createSourceFile('probe.tsx', block.body, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
    if (probe.parseDiagnostics && probe.parseDiagnostics.length > 0) {
      parseFailures.push({ block, diagnostics: probe.parseDiagnostics });
      return;
    }
    const name = join(root, VIRTUAL_DIR, `s${String(index).padStart(4, '0')}.tsx`);
    // A block with no top-level import/export is a SCRIPT: its declarations would
    // be globals shared with every other block. Force a module so each block is
    // judged exactly as a reader who copies that one block would experience it.
    const body = ts.isExternalModule(probe) ? block.body : `${block.body}\nexport {};\n`;
    virtual.set(name, body);
    owners.set(name, block);
  });

  const sentinelFile = join(root, VIRTUAL_DIR, '__control_sentinel.ts');
  const positiveFile = join(root, VIRTUAL_DIR, '__control_positive.ts');
  virtual.set(
    sentinelFile,
    `import { ${SENTINEL_EXPORT} } from '${CONTROL_PACKAGE}';\nexport const sentinel = ${SENTINEL_EXPORT};\n`,
  );
  virtual.set(
    positiveFile,
    `import type { ${CONTROL_REAL_EXPORT} } from '${CONTROL_PACKAGE}';\nexport type Control = ${CONTROL_REAL_EXPORT};\n`,
  );
  // A namespace import, so that ANY successful resolution reports zero
  // diagnostics: the control must distinguish "did not resolve" from "resolved",
  // never "resolved but the name I picked happened to be missing".
  const undeclaredFile = join(root, VIRTUAL_DIR, '__control_undeclared.ts');
  virtual.set(
    undeclaredFile,
    `import * as undeclared from '${UNDECLARED_CONTROL_PACKAGE}';\nexport type Undeclared = typeof undeclared;\n`,
  );

  const options = { ...COMPILER_OPTIONS, baseUrl: root, paths, types: [] };
  const host = ts.createCompilerHost(options, true);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (f) => (virtual.has(f) ? virtual.get(f) : readFile(f));
  host.fileExists = (f) => virtual.has(f) || fileExists(f);
  host.getSourceFile = (f, languageVersion, onError, shouldCreate) =>
    virtual.has(f)
      ? ts.createSourceFile(f, virtual.get(f), languageVersion, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      : getSourceFile(f, languageVersion, onError, shouldCreate);

  const program = ts.createProgram([...virtual.keys()], options, host);

  // CONTROL: resolution must land on a built artifact, never on a package's src.
  const resolved = ts.resolveModuleName(CONTROL_PACKAGE, join(root, VIRTUAL_DIR, 'x.ts'), options, host);
  const resolvedFileName = resolved.resolvedModule ? resolved.resolvedModule.resolvedFileName : null;
  const srcLeaks = program
    .getSourceFiles()
    .map((f) => f.fileName)
    .filter((f) => /\/packages\/[^/]+\/src\//.test(f));

  const semanticFailures = [];
  for (const [name, block] of owners) {
    const sf = program.getSourceFile(name);
    const diagnostics = [...program.getSemanticDiagnostics(sf)];
    if (diagnostics.length > 0) semanticFailures.push({ block, diagnostics });
  }

  const sentinelDiagnostics = [...program.getSemanticDiagnostics(program.getSourceFile(sentinelFile))];
  const positiveDiagnostics = [...program.getSemanticDiagnostics(program.getSourceFile(positiveFile))];
  const undeclaredDiagnostics = [...program.getSemanticDiagnostics(program.getSourceFile(undeclaredFile))];

  return {
    parseFailures,
    semanticFailures,
    semanticallyJudged: owners.size,
    resolvedFileName,
    srcLeaks,
    sentinelDiagnostics,
    positiveDiagnostics,
    undeclaredDiagnostics,
    undeclaredDeclared: declaredSpecifiers.includes(UNDECLARED_CONTROL_PACKAGE),
    undeclaredInstalledAt: findInstalledCopy(root, UNDECLARED_CONTROL_PACKAGE),
  };
}

// ── Reporting ────────────────────────────────────────────────────────────────

function formatDiagnostic(diagnostic, block) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  let where = '';
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    // The block body starts on the line after its fence.
    where = `${block.doc}:${block.fenceLine + 1 + line}:${character + 1}`;
  } else {
    where = `${block.doc}:${block.fenceLine}`;
  }
  return `${where}  TS${diagnostic.code}: ${message}`;
}

/**
 * The gate's exit codes, named so that callers and tests can talk about them.
 * `couldNotRun` is deliberately distinct from `documentsFailed`: see the "Why
 * 'could not run' is its own exit code" section in this file's header.
 */
export const EXIT_CODES = {
  /** Every covered snippet compiled, the controls held, the ledger is exact. */
  verified: 0,
  /** The gate RAN. A snippet or the ledger is at fault — a verdict was read. */
  documentsFailed: 1,
  /** The gate COULD NOT RUN. Nothing it printed is a verdict about a document. */
  couldNotRun: 2,
};

/**
 * The findings that stop the snippet program from being built at all, so no
 * verdict about any document can be read from the run. Kept separate from the
 * findings that ARE verdicts (a stale ledger entry, an unexplained fragment)
 * because the two leave through different exit codes.
 *
 * @param {{ reason: string }[]} findings
 */
export function blockingPreconditions(findings) {
  return findings.filter(
    (f) => f.reason === 'unbuilt-package' || f.reason === 'source-typed-package',
  );
}

/**
 * The filter arguments that name the packages the covered snippets import, each
 * carrying pnpm/turbo's DEPENDENCY-CLOSURE suffix `...` ("this package AND the
 * packages it depends on").
 *
 * The closure suffix is why this is a function and not an inline `map`. The set
 * this gate computes is the packages the DOCUMENTS import, which is not a
 * buildable unit: a package the docs import pulls in workspace packages no
 * snippet ever names, and those still have to be built before the imported one
 * can compile. Emitting the bare names left that gap to the caller's tool to
 * close by accident (objectui#5911):
 *
 *   - `turbo run build <args>` closed it silently, because this repository's
 *     `build` task declares `dependsOn: ["^build"]`. Measured on this tree, the
 *     bare list and the `...` list select the IDENTICAL 33 tasks, so the suffix
 *     changes nothing for the workflow that consumes this — it is a no-op where
 *     the closure was already right.
 *   - `pnpm <args> run build` did NOT, because pnpm's `--filter` selects exactly
 *     what it matches and runs each package's own script. Measured on this tree:
 *     21 packages selected instead of 33, and the build died at
 *     `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL @object-ui/components` on
 *     `TS2307: Cannot find module '@object-ui/sdui-parser'` — a workspace
 *     package no snippet imports, so nothing put it in the list.
 *
 * Both spellings wear the same `--filter=` flag, so which one closes the gap was
 * invisible at the point of use. Carrying the closure in the emitted list makes
 * the answer independent of the tool the reader reaches for, which matters most
 * for the reader who is here because the gate just told them to build something.
 *
 * @param {Iterable<string>} packages package names the covered snippets import
 * @returns {string} space-separated `--filter=<pkg>...` words, sorted
 */
export function buildFilterArgs(packages) {
  return [...packages].sort().map((n) => `--filter=${n}...`).join(' ');
}

function main() {
  const argv = process.argv.slice(2);

  // Checked before anything else: a ROOT_PAGES name that does not resolve makes
  // the scan set quietly SMALLER, and every count this gate prints would still
  // look healthy. That silent shrink is the defect objectui#7115 was filed for.
  for (const name of ROOT_PAGES) {
    if (!existsSync(join(repoRoot, name))) {
      console.error(
        `ROOT_PAGES names \`${name}\`, which does not exist under ${repoRoot}. That name is part of ` +
          "this gate's stated scan surface (objectui#7115), so a dangling entry silently narrows the " +
          "surface back to what objectui#7115 found. Re-point it at the page's new path, or remove " +
          'it deliberately.',
      );
      return EXIT_CODES.couldNotRun;
    }
  }

  const state = analyze({});

  if (argv.includes('--build-filter')) {
    // Filter arguments for exactly the packages the covered snippets import,
    // plus their dependency closure. Coverage grows -> the build grows, and
    // nothing else does. Why the closure travels in the list: see
    // `buildFilterArgs` above.
    // ⛔ This query answers from an UNBUILT tree by design and must keep exiting
    // 0 there: it is what the workflow runs to learn what to build, one step
    // BEFORE the build. Making it share the precondition exit would deadlock the
    // gate against its own build step.
    process.stdout.write(buildFilterArgs(state.neededPackages));
    process.stdout.write('\n');
    return 0;
  }

  const blocking = blockingPreconditions(state.findings);
  if (blocking.length > 0) {
    for (const f of state.findings) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
    console.error(
      '\nPRECONDITION NOT MET (exit ' +
        EXIT_CODES.couldNotRun +
        ') — The snippet program was NOT run: the packages it resolves against are not built, or are typed from source.',
    );
    console.error(
      `This is "I could not run", NOT "I ran and found errors" (exit ${EXIT_CODES.documentsFailed}). ` +
        'No line above is a verdict about any document, and this run says nothing about whether the ' +
        'documentation compiles. Build what the gate needs, then re-run:',
    );
    console.error(
      '  pnpm exec turbo run build $(node scripts/check-doc-snippet-types.mjs --build-filter) --concurrency=2\n' +
        '  pnpm check:doc-snippets',
    );
    return EXIT_CODES.couldNotRun;
  }

  const run = compileSnippets({
    root: repoRoot,
    compiled: state.compiled,
    paths: state.paths,
    declaredSpecifiers: state.declaredSpecifiers,
  });

  // ── controls, before any verdict about the documents ──────────────────────
  const controlFailures = [];
  // Printed BEFORE the controls: it says how far this run's resolution reaches,
  // which is the thing the UNDECLARED control then bounds.
  console.log(
    `Third-party resolution: ${Object.keys(state.dependencyPaths).length} specifier(s) mapped from the declared dependencies of ${state.neededPackages.size} imported package(s); ${state.untypedDependencies.length} declared specifier(s) ship no types here and stay unresolvable.`,
  );
  console.log('Controls:');
  console.log(
    `  resolution   Module name '${CONTROL_PACKAGE}' was successfully resolved to '${run.resolvedFileName ?? '(unresolved)'}'`,
  );
  if (!run.resolvedFileName || !/[\\/]dist[\\/].*\.d\.ts$/.test(run.resolvedFileName)) {
    controlFailures.push(
      `resolution did not land on a built artifact (${run.resolvedFileName ?? 'unresolved'}) — the snippets would be judged against source, or against nothing`,
    );
  }
  if (run.srcLeaks.length > 0) {
    controlFailures.push(`${run.srcLeaks.length} source file(s) under a package's src/ entered the program, e.g. ${run.srcLeaks[0]}`);
  }
  const sentinelCodes = run.sentinelDiagnostics.map((d) => d.code);
  console.log(
    `  sentinel     importing '${SENTINEL_EXPORT}' produced ${run.sentinelDiagnostics.length} diagnostic(s)${sentinelCodes.length ? ` (TS${sentinelCodes.join(', TS')})` : ''}`,
  );
  if (!sentinelCodes.includes(2305)) {
    controlFailures.push(
      `the planted sentinel produced no TS2305 — the program is resolving everything to 'any' and would report green forever`,
    );
  }
  console.log(`  positive     importing '${CONTROL_REAL_EXPORT}' produced ${run.positiveDiagnostics.length} diagnostic(s)`);
  if (run.positiveDiagnostics.length > 0) {
    controlFailures.push(
      `the positive control failed (${ts.flattenDiagnosticMessageText(run.positiveDiagnostics[0].messageText, ' ')}) — the harness is broken, not the documents`,
    );
  }
  const undeclaredCodes = run.undeclaredDiagnostics.map((d) => d.code);
  console.log(
    `  undeclared   importing '${UNDECLARED_CONTROL_PACKAGE}' (installed at ${run.undeclaredInstalledAt ?? '(NOT INSTALLED)'}, declared by no imported package) produced ${run.undeclaredDiagnostics.length} diagnostic(s)${undeclaredCodes.length ? ` (TS${undeclaredCodes.join(', TS')})` : ''}`,
  );
  if (run.undeclaredDeclared) {
    controlFailures.push(
      `'${UNDECLARED_CONTROL_PACKAGE}' is now a DECLARED dependency of a package a covered document imports, so it can no longer show that resolution stayed narrow — pick a control specifier no imported package declares`,
    );
  } else if (!run.undeclaredInstalledAt) {
    controlFailures.push(
      `'${UNDECLARED_CONTROL_PACKAGE}' is not installed in this workspace, so its failure to resolve proves nothing about how far resolution reaches — pick an installed specifier no imported package declares`,
    );
  } else if (!undeclaredCodes.includes(2307)) {
    controlFailures.push(
      `a specifier NO imported package declares now resolves — third-party resolution has widened past the imported packages' own dependencies, so a snippet may import what no reader of these packages can get, and every document would stay green while it does`,
    );
  }
  console.log('');

  const total = state.compiled.length + state.declaredFragments.length;
  for (const f of state.findings) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
  for (const { block, diagnostics } of run.parseFailures) {
    for (const d of diagnostics) console.error(`  [syntax]    ${formatDiagnostic(d, block)}`);
  }
  for (const { block, diagnostics } of run.semanticFailures) {
    for (const d of diagnostics) console.error(`  [semantic]  ${formatDiagnostic(d, block)}`);
  }

  // ── the summary always states semantic COVERAGE, never just a verdict ─────
  const parseFailedBlocks = run.parseFailures.length;
  const coveredWithBlocks = new Set([
    ...state.compiled.map((b) => b.doc),
    ...state.declaredFragments.map((b) => b.doc),
  ]).size;
  console.log(
    `Scanned ${state.documents.length} document(s): ${state.covered.length} covered (${coveredWithBlocks} of them hold a ts/tsx block), ${Object.keys(UNGATED_DOCS).length} ungated — declared in this script, NOT verified by it.`,
  );
  console.log(
    `Covered blocks: ${total} — ${state.compiled.length} to compile, ${state.declaredFragments.length} declared fragment(s).`,
  );
  console.log(
    parseFailedBlocks === 0
      ? 'Syntax phase:   every block parsed, so every one of them reached the semantic phase.'
      : `Syntax phase:   ${parseFailedBlocks} block(s) failed to parse and were NOT semantically checked.`,
  );
  console.log(
    `Semantic phase: ${run.semanticallyJudged} of ${state.compiled.length} block(s) judged, ${run.semanticFailures.length} failed.`,
  );
  if (parseFailedBlocks > 0) {
    console.log(
      `NOTE: this run's semantic result covers ${run.semanticallyJudged} block(s) only. A syntax failure is not a semantic pass.`,
    );
  }

  const failed =
    controlFailures.length > 0 ||
    state.findings.length > 0 ||
    parseFailedBlocks > 0 ||
    run.semanticFailures.length > 0;

  if (controlFailures.length > 0) {
    console.error('\nHARNESS CONTROL FAILED — no verdict about the documents can be read from this run:');
    for (const c of controlFailures) console.error(`  - ${c}`);
    console.error(
      `\nThe gate COULD NOT RUN (exit ${EXIT_CODES.couldNotRun}). The sentence above is this run's own ` +
        'wording, and the exit code now agrees with it: a broken harness is a verdict about the ' +
        'harness, never about the documents.',
    );
    return EXIT_CODES.couldNotRun;
  }
  if (failed) {
    console.error('\nDocumentation snippets must compile against the built types. See the header of this script.');
    return EXIT_CODES.documentsFailed;
  }
  console.log('\nEvery covered documentation snippet compiles against the built types.');
  return EXIT_CODES.verified;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}

export { UNGATED_DOCS, TS_FENCE_LANGUAGES, FRAGMENT_MARKER, UNDECLARED_CONTROL_PACKAGE, main };
