#!/usr/bin/env node
/**
 * Every fenced `ts` / `tsx` snippet in the documentation this gate covers must
 * COMPILE, `--strict`, against the packages' BUILT `dist/*.d.ts` — the surface a
 * reader who copies it actually imports.
 *
 * Run:  node scripts/check-doc-snippet-types.mjs   (also `pnpm check:doc-snippets`)
 *       node scripts/check-doc-snippet-types.mjs --build-filter   (turbo filter args)
 * Exit: 0 = every covered snippet parses and type-checks, the harness proved
 *       itself on its own controls, and the coverage ledger is exact.
 *       1 = a snippet failed, a control failed, or the ledger is stale.
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
 * ## Coverage is declared, never assumed
 *
 * A document is covered unless it is named in `UNGATED_DOCS` with a reason. The
 * default is therefore COVERED: a new page is compiled from the day it lands,
 * and opting one out is an edit a reviewer can see. Entries are re-derived every
 * run — an entry naming a file that does not exist, or that holds no `ts` / `tsx`
 * block at all, fails as a stale entry, so the list can only shrink.
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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Configuration ────────────────────────────────────────────────────────────

/** Documentation surfaces read by this gate. Kept identical in spirit to
 *  `check-doc-links.mjs`: the pages a reader lands on, plus every published
 *  package README (which ships to npm inside the package's `files`). */
const MDX_ROOT = 'content/docs';
const PACKAGES_DIR = 'packages';

/** Fence languages treated as compilable TypeScript. `js` / `jsx` are NOT in the
 *  set: they are not type-annotated, so a strict program judges them on rules
 *  their authors never opted into. */
const TS_FENCE_LANGUAGES = new Set(['ts', 'tsx', 'typescript']);

/**
 * Documents whose snippets are NOT compiled, each with the reason. The default
 * is covered; this list is the debt, by name, and it can only shrink.
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
  'content/docs/guide/objectos-integration.mdx':
    '36 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 10 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 7 unresolved-module diagnostic(s); plus TS2305x1 TS2339x1 — candidate real defects, un-triaged',
  'content/docs/plugins/plugin-calendar-view.mdx':
    '2 unresolved-module diagnostic(s) — and NOT a defect: the page is a migration guide whose ' +
    '"Before" blocks quote the retired `@object-ui/plugin-calendar-view` import on purpose. Covering ' +
    'it means declaring those blocks, which is a judgement about the page rather than a mechanical ' +
    'edit — the one entry here that would be closed by declaring blocks rather than by fixing them.',
  'content/docs/plugins/plugin-calendar.mdx':
    '25 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 6 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 2 unresolved-module diagnostic(s); plus TS2322x1 — candidate real defects, un-triaged',
  'content/docs/plugins/plugin-chatbot.mdx':
    '21 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'content/docs/plugins/plugin-detail.mdx':
    '16 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'content/docs/plugins/plugin-gantt.mdx':
    '31 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 2 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'content/docs/plugins/plugin-kanban.mdx':
    '6 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 8 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'content/docs/plugins/plugin-map.mdx':
    '43 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 5 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'content/docs/plugins/plugin-timeline.mdx':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies',
  'content/docs/utilities/create-plugin.mdx':
    '1 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 1 unresolved-module diagnostic(s)',
  'content/docs/utilities/data-objectstack.mdx':
    '16 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2391x1 — candidate real defects, un-triaged',
  'content/docs/utilities/runner.mdx':
    '5 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 3 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; 3 unresolved-module diagnostic(s)',
  'packages/app-shell/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 14 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/auth/README.md':
    '1 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 15 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2741x1 — candidate real defects, un-triaged',
  'packages/collaboration/README.md':
    '13 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2339x2 TS2353x1 TS2554x1 TS2739x1 — candidate real defects, un-triaged',
  'packages/components/README.md':
    '1 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
  'packages/core/README.md':
    '5 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines; plus TS2339x2 — candidate real defects, un-triaged',
  'packages/data-objectstack/README.md':
    '10 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 41 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
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
  'packages/plugin-form/README.md':
    '12 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 1 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
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
  'packages/plugin-view/README.md':
    '14 parse diagnostic(s) — blocks fenced `ts` that are bare object literals or elided bodies; 14 undefined-name diagnostic(s) — blocks continue an earlier block, or use ambient names the page never defines',
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
 */
export function scanFences(source) {
  const lines = source.split('\n');
  const blocks = [];
  const markers = [];
  for (let i = 0; i < lines.length; i++) {
    const marker = FRAGMENT_MARKER.exec(lines[i]);
    if (marker) markers.push({ line: i + 1, reason: marker[1].trim(), consumed: false });
    const open = /^([ \t]*)(`{3,})(.*)$/.exec(lines[i]);
    if (!open) continue;
    const ticks = open[2];
    let close = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const c = /^[ \t]*(`{3,})[ \t]*$/.exec(lines[j]);
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
        body: lines.slice(i + 1, close).join('\n'),
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
      else if (entry.endsWith('.mdx')) out.push(relative(root, p).split(sep).join('/'));
    }
  };
  const mdxRoot = join(root, MDX_ROOT);
  if (existsSync(mdxRoot)) walk(mdxRoot);
  const pkgDir = join(root, PACKAGES_DIR);
  if (existsSync(pkgDir)) {
    for (const entry of readdirSync(pkgDir).sort()) {
      const readme = join(pkgDir, entry, 'README.md');
      if (existsSync(readme)) out.push(relative(root, readme).split(sep).join('/'));
    }
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

  return { documents, covered, compiled, declaredFragments, findings, paths, neededPackages, scans };
}

/** Phase 1 (syntax) and phase 2 (semantics), kept apart on purpose. */
export function compileSnippets({ root = repoRoot, compiled, paths }) {
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

  return {
    parseFailures,
    semanticFailures,
    semanticallyJudged: owners.size,
    resolvedFileName,
    srcLeaks,
    sentinelDiagnostics,
    positiveDiagnostics,
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

function main() {
  const argv = process.argv.slice(2);
  const state = analyze({});

  if (argv.includes('--build-filter')) {
    // Turbo filter arguments for exactly the packages the covered snippets
    // import. Coverage grows -> the build grows, and nothing else does.
    process.stdout.write([...state.neededPackages].sort().map((n) => `--filter=${n}`).join(' '));
    process.stdout.write('\n');
    return 0;
  }

  const blocking = state.findings.filter(
    (f) => f.reason === 'unbuilt-package' || f.reason === 'source-typed-package',
  );
  if (blocking.length > 0) {
    for (const f of state.findings) console.error(`  ${f.site}  [${f.reason}]  ${f.detail}`);
    console.error(
      '\nThe snippet program was NOT run: the packages it resolves against are not built, or are typed from source.',
    );
    return 1;
  }

  const run = compileSnippets({ root: repoRoot, compiled: state.compiled, paths: state.paths });

  // ── controls, before any verdict about the documents ──────────────────────
  const controlFailures = [];
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
  }
  if (failed) {
    console.error('\nDocumentation snippets must compile against the built types. See the header of this script.');
    return 1;
  }
  console.log('\nEvery covered documentation snippet compiles against the built types.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}

export { UNGATED_DOCS, TS_FENCE_LANGUAGES, FRAGMENT_MARKER, main };
