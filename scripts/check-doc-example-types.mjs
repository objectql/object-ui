#!/usr/bin/env node
/**
 * Every ```ts / ```tsx fenced block inside a JSDoc `@example` on an EXPORTED
 * declaration under `packages/NAME/src/**` must COMPILE, `--strict`, against the
 * packages' BUILT `dist/*.d.ts` — or be DECLARED in the ledger below with a
 * written reason and the diagnostics it currently produces.
 *
 * Run:  node scripts/check-doc-example-types.mjs   (also `pnpm check:doc-examples`)
 * Exit: 0 = every covered example compiles, or fails exactly as its ledger row
 *       says it does; the harness proved itself on its own controls.
 *       1 = THE GATE RAN AND FOUND ERRORS. An example failed and nothing
 *       declared it, an example a row declares now compiles, or a row's
 *       diagnostics no longer match what the example produces.
 *       2 = THE GATE COULD NOT RUN, so nothing printed above is a verdict about
 *       any example: the packages are unbuilt (or typed from source), the walk
 *       collapsed, or one of the harness's own controls failed.
 *
 * This is a SIBLING of `scripts/check-doc-snippet-types.mjs`, not a fork. The
 * scan surface, the extraction and the ledger are this file's; the compiler
 * host, the built-`.d.ts` resolution, the root bound and every control are
 * IMPORTED from that harness and run unmodified, so an `@example` block is
 * judged by exactly the program a documentation fence is judged by. The two
 * gates' exit codes are deliberately the same three, for the reason that file's
 * header gives: "I could not run" and "I ran and found errors" are different
 * facts and must not share a code.
 *
 * ## What this gate answers, and the four things it does NOT
 *
 * It answers exactly one question: **does this shipped `@example` still compile
 * against the published types.** objectui#7974 is the defect that shape has:
 * `useSpecGesture`'s own `@example` passes a scalar `swipe.direction` where the
 * declared type is `SpecSwipeDirection[]`, so a reader who copies the example
 * out of their IDE's hover gets TS2322 — and nothing in this repository had ever
 * compiled it, because the Markdown gate's surface stops at `content/docs`, the
 * per-app docs trees, the package READMEs and the root pages.
 *
 * It does NOT answer:
 *
 *   1. **Whether a BARE `@example` body is correct.** Only FENCED ts/tsx blocks
 *      are compiled. The census below counts the bare ones rather than hiding
 *      them, and the reason they stay out is measured, not assumed — see
 *      "Why bare `@example` bodies are counted and not compiled".
 *   2. **Whether the example is idiomatic, runnable, or true.** A block that
 *      compiles can still teach a call nobody should make. That is review.
 *   3. **Schema-key validity** — the sibling's blind spot 1, unchanged here: a
 *      metadata literal that `safeParse` would reject can still satisfy a
 *      TypeScript annotation.
 *   4. **Code inside template literals.** That population already has an
 *      instrument: `check-doc-snippet-types.mjs --emit-census` (objectui#7864)
 *      walks the same `packages/NAME/src/**` tree, recognises a template that
 *      carries an `import`, substitutes its holes and compiles it through the
 *      same `compileSnippets()`. Adding a second reader of the same population
 *      here would be a second answer to a question that already has one. See
 *      "The template-literal half of objectui#8258" below.
 *
 * ## The population, and why the compiled tier is the fenced blocks
 *
 * Measured on the branch point (objectui#8258's first run), with the funnel this
 * gate re-prints on every run so the number it enforces stays DERIVED rather
 * than asserted:
 *
 *     1418  source files under packages/NAME/src (.ts/.tsx), tooling excluded
 *     2421    ... tooling files excluded by TOOLING_FILE (tests, mocks, stories)
 *      228  `@example` tags found by the AST
 *        0    ... in tooling files
 *       15    ... on a NON-exported declaration
 *      213  `@example` tags on EXPORTED declarations
 *      124    ... carrying a ts/tsx/typescript fence   <- THE COMPILED TIER
 *        1    ... carrying only an unlabelled fence
 *       88    ... BARE, no fence at all
 *
 * ### Why bare `@example` bodies are counted and not compiled
 *
 * Not an optimisation and not a silent skip — a measurement. 67 of the 88 bare
 * bodies parse as TSX, which sounds like a compilable population and is not: the
 * dominant shape is a VALUE illustration on an interface property, and it parses
 * only because a comma-separated list of string literals is a legal expression
 * statement. From `packages/types/src/base.ts`:
 *
 *     Component type identifier. Determines which renderer to use.
 *     `@example` 'input', 'button', 'form', 'grid'
 *
 * Compiling that judges nothing — it is four string literals — while the fenced
 * tier holds the blocks whose authors wrote a module. Feeding the bare tier to a
 * strict program would judge prose on rules its author never opted into, which is
 * the same reason `TS_FENCE_LANGUAGES` in the sibling excludes `js` and `jsx`.
 * The count is printed every run, so the day someone starts fencing them the
 * number moves and this paragraph is re-read.
 *
 * ## The ONE transformation, stated out loud
 *
 * A JSDoc `@example` is read in the IDE beside the declaration it documents, so
 * the documented symbol is in scope for its reader by construction; a fenced
 * block almost never imports it (measured: 8 of 124 import anything at all). The
 * gate therefore prepends ONE line:
 *
 *     import { SYMBOL } from 'SPECIFIER';
 *
 * and only when all three hold, each re-checked per run:
 *
 *   - the block's text references SYMBOL;
 *   - the block does not already import SYMBOL itself;
 *   - some probed SPECIFIER really exports SYMBOL — compiled in the same
 *     program, never assumed. TWO candidates are probed, in this order, and the
 *     first one that imports wins:
 *
 *       1. the package's ROOT specifier, e.g. `@object-ui/types`;
 *       2. the BUILT declaration of the symbol's OWN source file — the `dist`
 *          twin of `packages/NAME/src/a/b.ts`, offered only when that twin is
 *          on disk.
 *
 * The count reached by each candidate is printed every run, so both stay derived.
 *
 * ### Why candidate 2 exists, and why it widens nothing (objectui#8743)
 *
 * The justification above is SCOPE, not publication. Candidate 1 alone models
 * scope as "importable from the package's public entry", which is a publication
 * test, and it answers NO for every symbol a package exports to its own modules
 * and to nothing else. Such a block is then judged WITHOUT the import it needs,
 * so any example that spells its own symbol's name is TS2304 — not because the
 * example is wrong, but because this file could not name the symbol.
 *
 * `stripImportedDefaults` landed exactly there and reddened `main`. It is
 * deliberately package-internal — objectui#8317's design is that the strip
 * happens at the import boundary, not that consumers call it — so with candidate
 * 1 as the only route the remaining two are: EXPORT it, widening a published
 * surface (and moving `@object-ui/types`' public API) for a docs gate; or write
 * a ledger row, converting a checked example into an unchecked one. Both are
 * worse than the defect. Candidate 2 is the third route: the declaring module IS
 * an internal symbol's scope, and its built `.d.ts` is the same artifact tier
 * candidate 1 resolves to. Nothing is exported, nothing new is published, and
 * the example stays COMPILED.
 *
 * ⛔ Candidate 2 is not a licence to reference anything: it names the symbol the
 * block documents and nothing else, which is the same one-line bound candidate 1
 * has always had. It is not the `declare var NAME: any` pass refused below —
 * the types come from the real built declaration, so the call is judged against
 * the shipped signature.
 *
 * ⚠️ It is still PROBED, never assumed, and a bundling build has no twin to
 * probe: `tsup`/rolldown emit one `dist/index.d.ts` and no per-file declaration,
 * so the candidate is absent and the conservative answer stands. That is why the
 * printed list remains "symbols this gate did not inject", NOT a list of defects.
 *
 * ⚠️ Neither candidate guesses a SUBPATH. A symbol published only under one
 * (`@object-ui/types/zod`) is not reached by candidate 1 and does not need to
 * be — those blocks import themselves, which is what a reader copying them does,
 * and `alreadyImported` then withholds the prelude anyway.
 *
 * Prepended, not appended, because an `import` must precede the code that uses
 * it; the printed line numbers therefore carry an offset, which `formatDiagnostic`
 * is given as the block's fence line. Without this transformation the run is
 * unreadable rather than strict: 303 of 348 diagnostics were TS2304 naming the
 * documented symbol itself, and objectui#7974's real TS2322 was MASKED behind
 * `Cannot find name 'useSpecGesture'`. That is the whole argument for the line —
 * it does not make failures go away, it makes the surviving ones be about the
 * documented API.
 *
 * ⛔ What was priced and REFUSED: a second pass declaring every remaining free
 * name as `declare var NAME: any`. It shrinks the ledger from 90 rows to 32 and
 * is the wrong trade in every direction. It INVENTS diagnostics (measured: 6
 * TS2749 "refers to a value, but is being used as a type" and 2 TS2451
 * redeclarations that exist only because of the injected declarations), it makes
 * every downstream check on those names vacuous, and a green bought with `any`
 * teaches the next author that referencing an undeclared name is how you stop the
 * gate looking — the consumer-side tolerance AGENTS.md commandment #0.1 bans, one
 * level up. A 90-row ledger that says a true thing beats a 32-row ledger that
 * launders 58 rows through `any`.
 *
 * ## The ledger, and what makes it shrink-only
 *
 * `UNGATED_EXAMPLES` is keyed by `path:line symbol` and each row carries the
 * diagnostic CODES the example currently produces, a written reason, and the card
 * that owns it. Four verdicts, and only the first is silent:
 *
 *   block fails + row's codes match      -> declared debt, exempt
 *   block fails + no row                 -> RED. A new example must compile.
 *   block COMPILES + row                 -> RED, stale. The debt was paid; the
 *                                           row outlived it and must be deleted.
 *   block fails + row's codes DIFFER     -> RED. The failure changed underneath
 *                                           the declaration; re-derive the row.
 *   row naming a block that is gone      -> RED, stale.
 *
 * The third verdict is what makes the ledger shrink-only, and it is the same pin
 * `UNGATED_DOCS` carries in the sibling: a debt that can be declared once and
 * never re-examined is not a ledger, it is a mute button. The fourth is this
 * gate's addition — a row that says "fails with TS2304" must not go on covering
 * the block after the failure became TS2322.
 *
 * ⚠️ Recording codes makes a row sensitive to the TypeScript version, on purpose.
 * An upgrade that renumbers or splits a diagnostic reddens the rows it moved,
 * with "re-derive" printed beside them. That is a loud, correct signal about a
 * ledger whose rows are claims about a compiler; the alternative — a row that
 * covers whatever the block does today — is the mute button again.
 *
 * ### The first run: 90 of 124, and why it lands as a ledger rather than a clean
 *
 * 119 blocks reached the semantic phase (5 do not parse), 34 compile, 85 fail.
 * The failures are overwhelmingly ONE shape: a usage fragment that references
 * ambient names it never declares (`manager`, `evaluator`, `navigate`, `App`).
 * Those are not defects in the documented API and repairing them is editorial
 * work on 66 separate files — which is precisely what a declared, shrink-only
 * ledger is for, and precisely how objectui#5174 burned `UNGATED_DOCS` down to
 * the empty object it is today. Each row names what the example references, so
 * the row goes stale the moment the example is made self-contained.
 *
 * ⚠️ objectui#7974 is OPEN, and its row is the reason this gate ships with a
 * ledger rather than a green: `packages/mobile/src/useSpecGesture.ts` still
 * carries the scalar `direction` on `main`, its card is on another lane's queue
 * (`domain:ui`, `pm:queue`), and this gate may not fix it. The row records
 * TS2322 by number. When that lane repairs the example the row goes STALE and
 * reddens on THEIR pull request, which is the hand-off working as designed, not
 * a defect in it.
 *
 * ## The template-literal half of objectui#8258
 *
 * The card asks this gate to "decide per case whether to extract (a fenced marker
 * inside the literal) or to exempt with a reason". The decision, measured:
 * **no new rule here, and the exemption has a reason that is not "too hard".**
 *
 *   - The extraction the card imagines ALREADY EXISTS and already runs on this
 *     exact tree. `--emit-census` reports 20 recognised templates across
 *     `packages/cli`, `packages/create-plugin` and `packages/vscode-extension`,
 *     compiled through the same `compileSnippets()`. Building a second extractor
 *     here would put two readers on one population, which is how the two answers
 *     start disagreeing.
 *   - objectui#7977 is CLOSED (by objectui#8112, which corrected the prose).
 *   - objectui#7976's residue is NOT a template-parsing problem. It is
 *     `packages/vscode-extension/DESIGN.md` holding a hand-copied MIRROR of a
 *     template's text. Compiling the template — which `--emit-census` already
 *     does, at 0 diagnostics — says nothing about whether the mirror still
 *     matches it. That card needs an equality pin between two texts, which is a
 *     different instrument from a type-checker and belongs on that card.
 *
 * @type {never}
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isEntrypoint } from './invoked-as.mjs';
import { TOOLING_FILE } from './check-phantom-dependencies.mjs';
import { analyze, compileSnippets } from './check-doc-snippet-types.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Configuration ────────────────────────────────────────────────────────────

/** The tree this gate walks. Identical to the emitted census's, and to
 *  `check-phantom-dependencies`', so "a package's own source" means one thing. */
export const PACKAGES_DIR = 'packages';
export const SOURCE_SUBDIR = 'src';

/** Source extensions collected. */
const SOURCE_EXTENSION = /\.tsx?$/;

/** Fence languages treated as compilable TypeScript. Deliberately the same set
 *  the sibling uses; `js` / `jsx` are excluded there for a reason that holds
 *  here unchanged — they are not type-annotated. */
export const TS_FENCE_LANGUAGES = new Set(['ts', 'tsx', 'typescript']);

/** The shortest reason that counts as a declaration. The sibling's number. */
export const MIN_REASON_LENGTH = 12;

// ── Extraction ───────────────────────────────────────────────────────────────

/**
 * Every `.ts`/`.tsx` file under a workspace package's `src/`, split by the rule
 * `check-phantom-dependencies.mjs` already owns. The tooling half is RETURNED
 * rather than dropped: a population hiding in a test fixture is a different fact
 * from no population at all, and the funnel prints both.
 *
 * @param {string} root
 * @returns {{ files: string[], excludedAsTooling: string[] }}
 */
export function listExampleSources(root = repoRoot) {
  const files = [];
  const excludedAsTooling = [];
  const pkgDir = join(root, PACKAGES_DIR);
  if (!existsSync(pkgDir)) return { files, excludedAsTooling };
  for (const entry of readdirSync(pkgDir).sort()) {
    const src = join(pkgDir, entry, SOURCE_SUBDIR);
    if (!existsSync(src) || !statSync(src).isDirectory()) continue;
    const walk = (dir) => {
      for (const name of readdirSync(dir).sort()) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
          continue;
        }
        if (!SOURCE_EXTENSION.test(name)) continue;
        const rel = relative(root, p).split(sep).join('/');
        (TOOLING_FILE.test(rel) ? excludedAsTooling : files).push(rel);
      }
    };
    walk(src);
  }
  return { files, excludedAsTooling };
}

/**
 * The name of the EXPORTED declaration that owns this JSDoc, or `null` when the
 * nearest declaration carrying an `export` modifier has no identifier to name.
 *
 * Walks OUTWARD from the documented node, because the `export` keyword sits on
 * the statement while the JSDoc may hang off a member inside it — an `@example`
 * on an interface property belongs to the exported interface. A
 * `VariableStatement` carries the modifier but not the name; its first
 * declaration does.
 *
 * ⚠️ Read from the AST, never from a regex over the text, for the reason
 * `moduleSpecifiersOf` gives in the sibling (objectui#7555): the word `export`
 * inside a string or a comment is not an export.
 *
 * @param {ts.Node} node
 * @returns {{ exported: boolean, symbol: string | null }}
 */
export function exportedOwnerOf(node) {
  let n = node;
  while (n) {
    const modifiers = ts.canHaveModifiers(n) ? ts.getModifiers(n) : undefined;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(n)) {
        const d = n.declarationList.declarations[0];
        return { exported: true, symbol: d?.name && ts.isIdentifier(d.name) ? d.name.text : null };
      }
      const named = /** @type {{ name?: ts.Node }} */ (n).name;
      return { exported: true, symbol: named && ts.isIdentifier(named) ? named.text : null };
    }
    n = n.parent;
  }
  return { exported: false, symbol: null };
}

/**
 * Every fenced block inside one `@example` body, matched by its own fence run
 * length so a wider wrapper containing ``` does not confuse the walk.
 *
 * A JSDoc comment body has already had its leading ` * ` column stripped by the
 * TypeScript parser, so no quote-prefix machinery is needed here — that is the
 * one piece of `scanFences` this file does not reuse, and the reason it does
 * not.
 *
 * @param {string} text
 * @returns {{ language: string, body: string }[]}
 */
export function fencesOfExample(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^[ \t]*(`{3,})(.*)$/.exec(lines[i]);
    if (!open) continue;
    const ticks = open[1];
    let close = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const c = /^[ \t]*(`{3,})[ \t]*$/.exec(lines[j]);
      if (c && c[1].length >= ticks.length) {
        close = j;
        break;
      }
    }
    out.push({
      language: (open[2].trim().split(/\s+/)[0] || '').toLowerCase(),
      body: lines.slice(i + 1, close).join('\n'),
    });
    i = close;
  }
  return out;
}

/**
 * The census: every `@example` tag in the tree, classified. Counts nothing away
 * — the funnel it feeds prints each narrowing step, so the number the gate
 * enforces is derived from the population rather than asserted about it.
 *
 * @param {{ root?: string }} options
 */
export function exampleCensus({ root = repoRoot } = {}) {
  const { files, excludedAsTooling } = listExampleSources(root);
  const packageNameOf = {};
  const pkgDir = join(root, PACKAGES_DIR);
  if (existsSync(pkgDir)) {
    for (const entry of readdirSync(pkgDir).sort()) {
      const manifest = join(pkgDir, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      const name = JSON.parse(readFileSync(manifest, 'utf8')).name;
      if (name) packageNameOf[`${PACKAGES_DIR}/${entry}`] = name;
    }
  }

  const tags = [];
  const collect = (fileList, tooling) => {
    for (const file of fileList) {
      const source = readFileSync(join(root, file), 'utf8');
      if (!source.includes('@example')) continue;
      const sf = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.ES2022,
        true,
        file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const packageDir = file.split('/').slice(0, 2).join('/');
      const visit = (node) => {
        const jsDoc = /** @type {{ jsDoc?: ts.JSDoc[] }} */ (node).jsDoc;
        for (const doc of Array.isArray(jsDoc) ? jsDoc : []) {
          for (const tag of doc.tags ?? []) {
            if (tag.tagName.text !== 'example') continue;
            const { exported, symbol } = exportedOwnerOf(node);
            const text =
              typeof tag.comment === 'string'
                ? tag.comment
                : (ts.getTextOfJSDocComment(tag.comment) ?? '');
            tags.push({
              file,
              line: sf.getLineAndCharacterOfPosition(tag.getStart(sf)).line + 1,
              tooling,
              exported,
              symbol,
              package: packageNameOf[packageDir],
              fences: fencesOfExample(text),
              text,
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sf, visit);
    }
  };
  collect(files, false);
  collect(excludedAsTooling, true);

  const inSources = tags.filter((t) => !t.tooling);
  const exported = inSources.filter((t) => t.exported && t.symbol !== null);
  const blocks = [];
  for (const tag of exported) {
    for (const fence of tag.fences) {
      if (!TS_FENCE_LANGUAGES.has(fence.language)) continue;
      blocks.push({
        file: tag.file,
        line: tag.line,
        symbol: tag.symbol,
        package: tag.package,
        language: fence.language,
        body: fence.body,
      });
    }
  }
  const withTsFence = exported.filter((t) =>
    t.fences.some((f) => TS_FENCE_LANGUAGES.has(f.language)),
  );

  return {
    files,
    excludedAsTooling,
    tags,
    inSources,
    exported,
    withTsFence,
    otherFenceOnly: exported.filter(
      (t) => t.fences.length > 0 && !t.fences.some((f) => TS_FENCE_LANGUAGES.has(f.language)),
    ),
    bare: exported.filter((t) => t.fences.length === 0),
    blocks,
  };
}

// ── The ledger ───────────────────────────────────────────────────────────────

/**
 * The declared debt: examples that do not compile today, each with the codes it
 * produces, a written reason, and the card that owns it.
 *
 * Keys are `path:line symbol`. The line is the `@example` TAG's line, which is
 * where a reader looking for the block starts; it moves when the file moves, and
 * a row whose key no longer resolves is reported as stale rather than ignored.
 *
 * ⛔ A row is not a place to park a defect. Every row here is a claim that the
 * example is a FRAGMENT (it references context its reader supplies) or that a
 * named card owns the repair. Adding a row to silence a real defect in a
 * documented API is the failure this gate exists to catch, one level up.
 *
 * @type {Record<string, { card: string | null, codes: number[], reason: string }>}
 */
export const UNGATED_EXAMPLES = {
  'packages/auth/src/AuthGuard.tsx:36 AuthGuard': {
    card: null,
    codes: [2657],
    reason:
      'two sibling JSX elements with no wrapper: the block is a render-body excerpt, not a module',
  },
  'packages/auth/src/AuthProvider.tsx:142 AuthProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, which the example never declares',
  },
  'packages/auth/src/AuthProvider.tsx:149 AuthProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, which the example never declares',
  },
  'packages/auth/src/AuthProvider.tsx:155 AuthProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, which the example never declares',
  },
  'packages/auth/src/AuthShell.tsx:66 AuthShell': {
    card: null,
    codes: [2304, 2552],
    reason:
      'usage fragment: references `LoginForm`, `navigate`, which the example never declares',
  },
  'packages/auth/src/createAuthClient.ts:270 createAuthClient': {
    card: null,
    codes: [18004],
    reason:
      'shorthand `{ email, password }` stands for credentials the caller supplies; the example never declares them',
  },
  'packages/auth/src/ForgotPasswordForm.tsx:107 ForgotPasswordForm': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `setShowSuccess`, which the example never declares',
  },
  'packages/auth/src/LoginForm.tsx:126 LoginForm': {
    card: null,
    codes: [2552],
    reason:
      'usage fragment: references `navigate`, which the example never declares',
  },
  'packages/auth/src/RegisterForm.tsx:102 RegisterForm': {
    card: null,
    codes: [2552],
    reason:
      'usage fragment: references `navigate`, which the example never declares',
  },
  'packages/auth/src/useAuth.ts:16 useAuth': {
    card: null,
    codes: [18047],
    reason:
      'guards on `isAuthenticated`, which strict null checking cannot correlate with `user` being non-null',
  },
  'packages/auth/src/UserMenu.tsx:31 UserMenu': {
    card: null,
    codes: [2552],
    reason:
      'usage fragment: references `navigate`, which the example never declares',
  },
  'packages/components/src/notifications/NotificationAlerts.tsx:58 NotificationAlerts': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, `NotificationProvider`, which the example never declares',
  },
  'packages/components/src/notifications/NotificationBanners.tsx:38 NotificationBanners': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Outlet`, which the example never declares',
  },
  'packages/components/src/notifications/NotificationInline.tsx:43 NotificationInline': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `notify`, which the example never declares',
  },
  'packages/components/src/notifications/NotificationSnackbar.tsx:43 NotificationSnackbar': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, `NotificationProvider`, which the example never declares',
  },
  'packages/core/src/actions/TransactionManager.ts:129 TransactionManager': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `actionExecutor`, `createOrderAction`, `manager`, `sendNotificationAction`, `updateInventoryAction`, which the example never declares',
  },
  'packages/core/src/actions/TransactionManager.ts:244 TransactionManager': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, `manager`, which the example never declares',
  },
  'packages/core/src/actions/TransactionManager.ts:324 TransactionManager': {
    card: null,
    codes: [2304, 7006],
    reason:
      'usage fragment: references `items`, `manager`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/core/src/adapters/resolveDataSource.ts:36 resolveDataSource': {
    card: null,
    codes: [2304, 18047],
    reason:
      'usage fragment: references `contextDataSource`, which the example never declares, so what depends on it is judged unbound',
  },
  'packages/core/src/data-scope/DataScopeManager.ts:68 DataScopeManager': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `myDataSource`, which the example never declares',
  },
  'packages/core/src/data-scope/ViewDataProvider.ts:139 ViewDataProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `myFetcher`, which the example never declares',
  },
  'packages/core/src/evaluator/ExpressionEvaluator.ts:264 ExpressionEvaluator': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `evaluator`, which the example never declares',
  },
  'packages/core/src/evaluator/ExpressionEvaluator.ts:334 ExpressionEvaluator': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `evaluator`, which the example never declares',
  },
  'packages/core/src/evaluator/ExpressionEvaluator.ts:534 ExpressionEvaluator': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `fmt`, which the example never declares',
  },
  'packages/core/src/registry/WidgetRegistry.ts:41 WidgetRegistry': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `registry`, which the example never declares',
  },
  'packages/core/src/utils/debug.ts:109 debugLog': {
    card: null,
    codes: [7017],
    reason:
      'sets a debug flag on `globalThis`, which has no index signature under strict mode',
  },
  'packages/core/src/utils/freeze-schema.ts:144 defineSystemView': {
    card: null,
    codes: [2339],
    reason:
      'demonstrates that the returned view is frozen by showing a `push` the readonly type rejects — the diagnostic IS the lesson',
  },
  'packages/core/src/utils/record-source.ts:140 resolveRecordSourceConfig': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `resolveRecordSourceObjectName`, `schema`, `useMemo`, which the example never declares',
  },
  'packages/core/src/utils/record-source.ts:69 resolveRecordSourceObjectName': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `resolveRecordSourceConfig`, `schema`, `useMemo`, which the example never declares',
  },
  'packages/core/src/validation/schema-validator.ts:490 assertValidSchema': {
    card: null,
    codes: [2304, 18046],
    reason:
      'usage fragment: references `schema`, which the example never declares, so what depends on it is judged unbound',
  },
  'packages/core/src/validation/schema-validator.ts:515 isValidSchema': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `data`, `renderSchema`, which the example never declares',
  },
  'packages/data-objectstack/src/cache/MetadataCache.ts:56 MetadataCache': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `MetadataCache`, `fetchSchemaFromServer`, which the example never declares',
  },
  'packages/data-objectstack/src/index.ts:6323 createObjectStackAdapter': {
    card: null,
    codes: [2591],
    reason:
      'usage fragment: references `process`, which the example never declares, so what depends on it is judged unbound',
  },
  'packages/i18n/src/provider.tsx:370 I18nProviderProps': {
    card: null,
    codes: [2304, 7006],
    reason:
      'usage fragment: references `App`, `I18nProvider`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/i18n/src/provider.tsx:393 I18nProviderProps': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, `I18nProvider`, `loadLanguage`, `loadLocales`, which the example never declares',
  },
  'packages/i18n/src/provider.tsx:428 I18nProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, which the example never declares',
  },
  'packages/i18n/src/useObjectLabel.ts:88 useObjectLabel': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `objectDef`, which the example never declares',
  },
  'packages/i18n/src/utils/spec-formatters.ts:64 resolvePlural': {
    card: null,
    codes: [2304],
    reason:
      'annotates with `SpecPluralRule`, a type the example does not import',
  },
  'packages/layout/src/AppSchemaRenderer.tsx:485 AppSchemaRenderer': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Outlet`, `appJson`, `can`, `evaluateVisibility`, `evaluator`, which the example never declares',
  },
  'packages/layout/src/NavigationRenderer.tsx:1243 NavigationRenderer': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `appSchema`, `can`, `evaluateVisibility`, `evaluator`, `saveOrder`, `searchTerm`, `updatePin`, which the example never declares',
  },
  'packages/layout/src/ResponsiveGrid.tsx:119 ResponsiveGrid': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Card`, which the example never declares',
  },
  'packages/mobile/src/useGesture.ts:29 useGesture': {
    card: null,
    codes: [1108],
    reason:
      'a hook-body excerpt: its `return` sits outside any function, so the block is a fragment by shape',
  },
  'packages/mobile/src/useSpecGesture.ts:69 useSpecGesture': {
    card: 'objectui#7974',
    codes: [1108, 2322],
    reason:
      'the scalar `swipe.direction` this example passes is rejected by the declared `SpecSwipeDirection[]` (TS2322). objectui#7974 owns BOTH halves — the example and the lenient cast that hides it — and is on another lane. Delete this row when that card lands; the block also returns outside a function (TS1108), a hook-body excerpt',
  },
  'packages/mobile/src/useTouchTarget.ts:33 useTouchTarget': {
    card: null,
    codes: [1108],
    reason:
      'a hook-body excerpt: its `return` sits outside any function, so the block is a fragment by shape',
  },
  'packages/plugin-designer/src/EditorModeToggle.tsx:46 EditorModeToggle': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `mode`, `setMode`, which the example never declares',
  },
  'packages/plugin-designer/src/hooks/useDesignerHistory.ts:24 useDesignerHistory': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `DesignerState`, `initialState`, `newState`, which the example never declares',
  },
  'packages/plugin-form/src/FormSection.tsx:109 FormSectionContainer': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `FormField`, which the example never declares',
  },
  'packages/plugin-form/src/ObjectForm.tsx:123 ObjectForm': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/plugin-form/src/TabbedForm.tsx:220 TabbedForm': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/plugin-form/src/WizardForm.tsx:361 WizardForm': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/plugin-grid/src/VirtualGrid.tsx:49 VirtualGrid': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `items`, which the example never declares',
  },
  'packages/plugin-list/src/ListView.tsx:808 ListViewHandle': {
    card: null,
    codes: [2304, 2686],
    reason:
      'names the `React` UMD global, which a module-shaped block may not reach without an import',
  },
  'packages/plugin-report/src/LiveReportExporter.ts:150 exportExcelWithFormulas': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `data`, `report`, which the example never declares',
  },
  'packages/plugin-report/src/LiveReportExporter.ts:234 createScheduleTrigger': {
    card: null,
    codes: [1109],
    reason:
      'the block is a prose-and-code mixture that does not parse as TSX in isolation',
  },
  'packages/plugin-report/src/LiveReportExporter.ts:88 exportWithLiveData': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `myAdapter`, `report`, which the example never declares',
  },
  'packages/plugin-view/src/ObjectView.tsx:618 ObjectView': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/plugin-view/src/ObjectView.tsx:632 ObjectView': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/plugin-view/src/ObjectView.tsx:649 ObjectView': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, which the example never declares',
  },
  'packages/react/src/context/ActionContext.tsx:72 ActionProvider': {
    card: null,
    codes: [2304, 18004],
    reason:
      'shorthand `{ user }` stands for context the caller supplies; the example never declares it',
  },
  'packages/react/src/context/DndContext.tsx:128 DndProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `KanbanBoard`, `handleDrop`, which the example never declares',
  },
  'packages/react/src/context/NotificationContext.tsx:377 NotificationProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, `NotificationAlerts`, `NotificationBanners`, `NotificationSnackbar`, `toast`, which the example never declares',
  },
  'packages/react/src/context/ThemeContext.tsx:120 ThemeProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `App`, `myTheme`, which the example never declares',
  },
  'packages/react/src/element-data-source/ElementDataSourceGate.tsx:182 useElementDataSourceSchema': {
    card: null,
    codes: [1108, 2304],
    reason:
      'usage fragment: references `schema`, which the example never declares, so what depends on it is judged unbound',
  },
  'packages/react/src/hooks/useActionRunner.ts:42 useActionRunner': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `formData`, `toast`, which the example never declares',
  },
  'packages/react/src/hooks/useClientNotifications.ts:103 useClientNotifications': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Button`, which the example never declares',
  },
  'packages/react/src/hooks/useCrudShortcuts.ts:37 useCrudShortcuts': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `closeDialog`, `deleteSelected`, `openCreateDialog`, `saveRecord`, which the example never declares',
  },
  'packages/react/src/hooks/useDataRefresh.ts:24 useDataRefresh': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataSource`, `objectName`, `params`, `schema`, `setData`, `useEffect`, which the example never declares',
  },
  'packages/react/src/hooks/useDebugMode.ts:34 useDebugMode': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `DebugPanel`, which the example never declares',
  },
  'packages/react/src/hooks/useDensityMode.ts:77 useDensityMode': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `activeView`, `dataSource`, `obj`, `vid`, which the example never declares',
  },
  'packages/react/src/hooks/useDiscovery.ts:88 useDiscovery': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `AuthProvider`, `LoadingScreen`, which the example never declares',
  },
  'packages/react/src/hooks/useDynamicApp.ts:58 useDynamicApp': {
    card: null,
    codes: [2304, 2307, 2693],
    reason:
      'imports \'../config/app.json\', a sibling file the reader\'s own project supplies, and names `Console` as a value',
  },
  'packages/react/src/hooks/useElementDataSource.ts:125 useElementDataSource': {
    card: null,
    codes: [1108, 2304],
    reason:
      'usage fragment: references `adapter`, `schema`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/react/src/hooks/useETagCache.ts:174 useETagCache': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `User`, `setUser`, `useEffect`, which the example never declares',
  },
  'packages/react/src/hooks/useExpression.ts:163 useExpression': {
    card: null,
    codes: [18004],
    reason:
      'shorthand `{ data, user }` stands for the scope the caller supplies; the example never declares it',
  },
  'packages/react/src/hooks/useKeyboardShortcuts.ts:34 useKeyboardShortcuts': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `closeModal`, `createNew`, `openSearch`, which the example never declares',
  },
  'packages/react/src/hooks/useNavigationOverlay.ts:211 useNavigationOverlay': {
    card: null,
    codes: [1003, 1382],
    reason:
      'the block is a prose-and-code mixture that does not parse as TSX in isolation',
  },
  'packages/react/src/hooks/useOffline.ts:239 useOffline': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Banner`, which the example never declares',
  },
  'packages/react/src/hooks/usePageVariables.tsx:249 usePageVariableBinding': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `record`, `schema`, which the example never declares',
  },
  'packages/react/src/hooks/usePageVariables.tsx:98 PageVariablesProvider': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `MyComponents`, which the example never declares',
  },
  'packages/react/src/hooks/usePerformance.ts:139 usePerformance': {
    card: null,
    codes: [2304, 2345],
    reason:
      'usage fragment: references `NormalList`, `VirtualList`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/react/src/hooks/usePerformanceBudget.ts:131 usePerformanceBudget': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `Dashboard`, `analytics`, which the example never declares',
  },
  'packages/react/src/hooks/useSchemaPersistence.ts:212 useSchemaPersistence': {
    card: null,
    codes: [2304, 2451, 7006],
    reason:
      'usage fragment: references `SchemaPersistenceAdapter`, `pageSchema`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/react/src/hooks/useSettledSchema.ts:112 useSettledSchema': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `dataConfig`, `resolveRecordSourceObjectName`, `schema`, which the example never declares',
  },
  'packages/react/src/hooks/useViewData.ts:72 useViewData': {
    card: null,
    codes: [2304, 7031],
    reason:
      'usage fragment: references `ErrorMessage`, `Spinner`, `Table`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/react/src/hooks/useViewSharing.ts:53 useViewSharing': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `currentFilters`, `currentSort`, `initialViews`, which the example never declares',
  },
  'packages/types/src/data.ts:263 GlobalSearchHit': {
    card: null,
    codes: [2304, 7006],
    reason:
      'usage fragment: references `DataSource`, `User`, `buildQuery`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/types/src/data.ts:740 DataSource': {
    card: null,
    codes: [2304, 7006],
    reason:
      'usage fragment: references `dataSource`, `refreshList`, which the example never declares, so what depends on them is judged unbound',
  },
  'packages/types/src/icon-key-migration.ts:122 migrateIconNodeKeys': {
    card: null,
    codes: [2304],
    reason:
      'usage fragment: references `save`, `storedPage`, which the example never declares',
  },
  'packages/types/src/objectql.ts:1607 ObjectFormSchema': {
    card: null,
    codes: [1005, 1109],
    reason:
      'the block is a prose-and-code mixture that does not parse as TSX in isolation',
  },
  'packages/types/src/plugin-scope.ts:227 AppMetadataPlugin': {
    card: null,
    codes: [1128],
    reason:
      'the block is a prose-and-code mixture that does not parse as TSX in isolation',
  },
};

// ── The run ──────────────────────────────────────────────────────────────────

/**
 * The `dist` twin of one source file, as an ABSOLUTE specifier, or `null`.
 *
 * `packages/NAME/src/a/b.ts` -> `ROOT/packages/NAME/dist/a/b.js`. Absolute, not
 * relative: the virtual directory the sibling compiles blocks in is that file's
 * private detail, and an absolute specifier is one THE BOUND never refuses
 * (`resolvesOnlyThroughRootManifest` exempts specifiers starting with `.` or
 * `/`), so this candidate can never be mistaken for a bare package import.
 *
 * Existence is checked on the `.d.ts` — that is what the program reads, since
 * `moduleResolution: Bundler` maps the `.js` specifier onto it — so a package
 * whose build BUNDLES its declarations has no twin here and is declined. This is
 * a cheap pre-filter, not the answer: the probe below is the authority.
 *
 * @param {string} file repo-relative source path of the documented symbol
 * @param {string} root
 * @returns {string | null}
 */
export function builtTwinSpecifier(file, root = repoRoot) {
  const parts = file.split('/');
  if (parts.length < 4 || parts[0] !== PACKAGES_DIR || parts[2] !== SOURCE_SUBDIR) return null;
  const stem = parts.slice(3).join('/').replace(/\.tsx?$/, '');
  const distDir = join(root, PACKAGES_DIR, parts[1], 'dist');
  if (!existsSync(join(distDir, `${stem}.d.ts`))) return null;
  return join(distDir, `${stem}.js`);
}

/**
 * Which specifier, if any, brings each documented symbol into scope.
 *
 * Probed, never assumed: one throwaway module per `PAIR SPECIFIER` candidate,
 * handed to the same `compileSnippets()` the blocks go through, so the answer
 * comes from the same resolution the verdict does. Candidates are tried in the
 * order `injectionCandidates` lists them and the FIRST that imports wins; a pair
 * no candidate can import is reported by name and its block is judged WITHOUT an
 * injected import, so the gate never blames an example for this transformation.
 *
 * @param {{ root: string, blocks: {package: string, symbol: string, file: string}[], paths: object, declaredSpecifiers: string[] }} options
 * @returns {Map<string, string>} `PACKAGE SYMBOL` -> the specifier that imported it
 */
export function probeInjectionSpecifiers({ root, blocks, paths, declaredSpecifiers }) {
  /** @type {Map<string, string[]>} */
  const candidatesOf = new Map();
  for (const block of [...blocks].sort((a, b) =>
    `${a.package} ${a.symbol}`.localeCompare(`${b.package} ${b.symbol}`),
  )) {
    const pair = `${block.package} ${block.symbol}`;
    if (!candidatesOf.has(pair)) candidatesOf.set(pair, []);
    const list = candidatesOf.get(pair);
    for (const candidate of [block.package, builtTwinSpecifier(block.file, root)]) {
      if (candidate && !list.includes(candidate)) list.push(candidate);
    }
  }

  const probes = [];
  for (const [pair, candidates] of candidatesOf) {
    const symbol = pair.split(' ')[1];
    for (const specifier of candidates) {
      probes.push({
        doc: `probe/${pair}`,
        fenceLine: probes.length,
        language: 'ts',
        quoteDepth: 0,
        fragmentReason: null,
        // `[typeof S]` rather than `typeof S`: a tuple accepts a value position for
        // a name that is only a type, so this probe answers "is it importable"
        // without also asking "is it a value", which is a different question.
        body: `import { ${symbol} } from '${specifier}';\nexport type P = [typeof ${symbol}];\n`,
        pair,
        specifier,
      });
    }
  }
  if (probes.length === 0) return new Map();

  const run = compileSnippets({ root, compiled: probes, paths, declaredSpecifiers });
  const failed = new Set();
  const fail = (block) => failed.add(`${block.pair}|${block.specifier}`);
  for (const { block, diagnostics } of run.semanticFailures) {
    if (diagnostics.some((d) => d.code === 2305 || d.code === 2307)) fail(block);
  }
  // A candidate this harness could not even parse or was refused by THE BOUND is
  // not an importable specifier either; counting only the semantic arm would let
  // one through on a technicality.
  for (const { block } of run.parseFailures) fail(block);
  for (const { block } of run.boundFailures) fail(block);

  const resolved = new Map();
  for (const probe of probes) {
    if (resolved.has(probe.pair)) continue;
    if (!failed.has(`${probe.pair}|${probe.specifier}`)) resolved.set(probe.pair, probe.specifier);
  }
  return resolved;
}

/**
 * The ONE transformation, applied per block. See the header.
 *
 * @param {{ symbol: string, package: string, body: string }} block
 * @param {Map<string, string>} injectableFrom pair -> the specifier that imports it
 */
export function preludeFor(block, injectableFrom) {
  const references = new RegExp(`\\b${block.symbol}\\b`).test(block.body);
  const alreadyImported = new RegExp(`import[^;]*\\b${block.symbol}\\b[^;]*from`).test(block.body);
  const specifier = injectableFrom.get(`${block.package} ${block.symbol}`);
  return references && !alreadyImported && specifier
    ? `import { ${block.symbol} } from '${specifier}';\n`
    : '';
}

/** `path:line symbol` — the ledger key for one block. */
export function ledgerKey(block) {
  return `${block.file}:${block.line} ${block.symbol}`;
}

/**
 * Compare a block's actual diagnostic codes against the row that declares it.
 * Sorted, de-duplicated and compared as a SET: a compiler that reports the same
 * failure twice has not changed the failure.
 *
 * @param {number[]} actual
 * @param {number[]} declared
 */
export function codesMatch(actual, declared) {
  const a = [...new Set(actual)].sort((x, y) => x - y);
  const d = [...new Set(declared)].sort((x, y) => x - y);
  return a.length === d.length && a.every((code, i) => code === d[i]);
}

/**
 * The verdicts, from a completed run. Pure: it prints nothing and it exits
 * nothing, so the test can hand it a fixture ledger and read the same answers
 * `main` reads.
 *
 * @param {{ results: {key: string, codes: number[]}[], ledger: Record<string, {codes: number[], reason: string}> }} input
 */
export function judge({ results, ledger }) {
  const findings = [];
  const seen = new Set(results.map((r) => r.key));
  const exempt = [];
  for (const result of results) {
    const row = ledger[result.key];
    const failed = result.codes.length > 0;
    if (!failed) {
      if (row) {
        findings.push({
          reason: 'stale-ledger-row',
          site: result.key,
          detail:
            'this example COMPILES now — the debt was paid and the row outlived it. Delete the row.',
        });
      }
      continue;
    }
    if (!row) {
      findings.push({ reason: 'undeclared-failure', site: result.key, codes: result.codes });
      continue;
    }
    if (!codesMatch(result.codes, row.codes)) {
      findings.push({
        reason: 'ledger-row-drifted',
        site: result.key,
        detail:
          `declared TS${[...new Set(row.codes)].sort((a, b) => a - b).join(', TS')} but produces ` +
          `TS${[...new Set(result.codes)].sort((a, b) => a - b).join(', TS')} — the failure changed ` +
          'underneath the declaration. Re-derive the row.',
      });
      continue;
    }
    exempt.push(result.key);
  }
  for (const [key, row] of Object.entries(ledger)) {
    if (!seen.has(key)) {
      findings.push({
        reason: 'stale-ledger-row',
        site: key,
        detail: 'no such example in the scan set',
      });
      continue;
    }
    if (!row.reason || row.reason.trim().length < MIN_REASON_LENGTH) {
      findings.push({
        reason: 'unexplained-ledger-row',
        site: key,
        detail: 'an entry with no written reason is not a declaration',
      });
    }
  }
  return { findings, exempt };
}

// ── Reporting ────────────────────────────────────────────────────────────────

/**
 * The funnel. Printed every run so the enforced number stays derived.
 *
 * @param {ReturnType<typeof exampleCensus>} census
 */
export function funnelLines(census) {
  const row = (n, label) => `  ${String(n).padStart(5)}  ${label}`;
  return [
    'Population funnel (every narrowing step, so the enforced number is derived):',
    row(census.files.length, `source files under ${PACKAGES_DIR}/NAME/${SOURCE_SUBDIR} (.ts/.tsx)`),
    row(census.excludedAsTooling.length, '  ... tooling files excluded (tests, mocks, benchmarks, stories)'),
    row(census.tags.length, '`@example` tags found by the AST'),
    row(census.tags.length - census.inSources.length, '  ... in a tooling file'),
    row(
      census.inSources.length - census.exported.length,
      '  ... on a declaration that is not exported (or has no name)',
    ),
    row(census.exported.length, '`@example` tags on EXPORTED declarations'),
    row(census.withTsFence.length, '  ... carrying a ts/tsx/typescript fence'),
    row(census.otherFenceOnly.length, '  ... carrying only a non-ts fence'),
    row(census.bare.length, '  ... BARE, no fence — counted, never compiled (see the header)'),
    row(census.blocks.length, 'BLOCKS in the compiled tier'),
  ];
}

function formatDiagnostic(diagnostic, block) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${block.doc}:${block.fenceLine + line}:${character + 1}  TS${diagnostic.code}: ${message}`;
  }
  return `${block.doc}:${block.fenceLine}  TS${diagnostic.code}: ${message}`;
}

// ── main ─────────────────────────────────────────────────────────────────────

export const EXIT_CODES = {
  /** Every covered example compiles or fails exactly as its row declares. */
  verified: 0,
  /** The gate RAN. An example or the ledger is at fault. */
  examplesFailed: 1,
  /** The gate COULD NOT RUN. Nothing printed is a verdict about any example. */
  couldNotRun: 2,
};

function main() {
  const census = exampleCensus({ root: repoRoot });

  if (census.files.length === 0) {
    console.error(
      `The walk collected 0 file(s) under ${PACKAGES_DIR}/NAME/${SOURCE_SUBDIR}, so every count below ` +
        'would be a zero that means nothing. A walk that collapsed is a verdict about this instrument, ' +
        'never about the corpus.',
    );
    return EXIT_CODES.couldNotRun;
  }
  if (census.blocks.length === 0) {
    console.error(
      'The compiled tier is EMPTY: the walk found files but no ts/tsx fenced `@example` on any exported ' +
        'declaration. A gate that judges nothing must not report a pass.',
    );
    return EXIT_CODES.couldNotRun;
  }

  // The sibling's `analyze()` derives the built-`.d.ts` map and the declared
  // dependency reach for the DOCUMENTATION corpus. Reused wholesale: an
  // `@example` block imports the same workspace packages a documentation fence
  // does, and a gate that re-derived the map would be a second answer to a
  // question that already has one.
  const state = analyze({ root: repoRoot });
  const blocking = state.findings.filter(
    (f) => f.reason === 'unbuilt-package' || f.reason === 'source-typed-package',
  );
  if (blocking.length > 0) {
    console.error('THE GATE COULD NOT RUN — the packages these examples import are not built:');
    for (const f of blocking) console.error(`  ${f.site}: ${f.detail}`);
    console.error(
      '\n  pnpm exec turbo run build $(node scripts/check-doc-snippet-types.mjs --build-filter) --concurrency=2\n' +
        '  pnpm check:doc-examples',
    );
    return EXIT_CODES.couldNotRun;
  }

  const injectableFrom = probeInjectionSpecifiers({
    root: repoRoot,
    blocks: census.blocks,
    paths: state.paths,
    declaredSpecifiers: state.declaredSpecifiers,
  });
  const pairs = [...new Set(census.blocks.map((b) => `${b.package} ${b.symbol}`))].sort();
  const withheld = pairs.filter((pair) => !injectableFrom.has(pair));
  const viaTwin = pairs.filter(
    (pair) => injectableFrom.has(pair) && injectableFrom.get(pair) !== pair.split(' ')[0],
  );

  const compiled = census.blocks.map((block) => {
    const prelude = preludeFor(block, injectableFrom);
    return {
      doc: block.file,
      // `formatDiagnostic` prints `fenceLine + line`. The prelude shifts the
      // body down by its own line count, so the anchor is pulled back by the
      // same amount and a printed number still points at the real source line.
      fenceLine: block.line - (prelude === '' ? 0 : prelude.split('\n').length - 1),
      language: block.language,
      quoteDepth: 0,
      fragmentReason: null,
      body: prelude + block.body,
      key: ledgerKey(block),
      injected: prelude !== '',
    };
  });

  const run = compileSnippets({
    root: repoRoot,
    compiled,
    paths: state.paths,
    declaredSpecifiers: state.declaredSpecifiers,
  });

  // ── the harness's own controls, the sibling's, unmodified ─────────────────
  // A program that resolves everything to `any` reports a clean corpus forever,
  // and a clean corpus is exactly what this card must not manufacture.
  const controls = [];
  if (!run.resolvedFileName || !/[\\/]dist[\\/].*\.d\.ts$/.test(run.resolvedFileName)) {
    controls.push(
      `resolution did not land on a built artifact (${run.resolvedFileName ?? 'unresolved'})`,
    );
  }
  if (run.srcLeaks.length > 0) {
    controls.push(
      `${run.srcLeaks.length} file(s) under a package's src/ entered the program, e.g. ${run.srcLeaks[0]}`,
    );
  }
  if (!run.sentinelDiagnostics.map((d) => d.code).includes(2305)) {
    controls.push("the planted sentinel produced no TS2305 — the program is resolving everything to 'any'");
  }
  if (run.positiveDiagnostics.length > 0) {
    controls.push(
      `the positive control failed (${ts.flattenDiagnosticMessageText(run.positiveDiagnostics[0].messageText, ' ')})`,
    );
  }
  if (controls.length > 0) {
    console.error('HARNESS CONTROL FAILED — no verdict below is a fact about any example:');
    for (const c of controls) console.error(`  - ${c}`);
    return EXIT_CODES.couldNotRun;
  }

  // ── collect one result per block ──────────────────────────────────────────
  const codesOf = new Map();
  const detailOf = new Map();
  for (const { block, diagnostics } of run.parseFailures) {
    codesOf.set(block.key, diagnostics.map((d) => d.code));
    detailOf.set(block.key, diagnostics.map((d) => `[syntax]    ${formatDiagnostic(d, block)}`));
  }
  for (const { block, diagnostics } of run.semanticFailures) {
    codesOf.set(block.key, diagnostics.map((d) => d.code));
    detailOf.set(block.key, diagnostics.map((d) => `[semantic]  ${formatDiagnostic(d, block)}`));
  }
  for (const { block, specifiers } of run.boundFailures) {
    codesOf.set(block.key, [0]);
    detailOf.set(block.key, [
      `[bound]     ${block.doc}:${block.fenceLine}  imports ${specifiers.map((s) => `'${s}'`).join(', ')}, ` +
        "which resolve only through this repository's ROOT package.json",
    ]);
  }
  const results = compiled.map((block) => ({ key: block.key, codes: codesOf.get(block.key) ?? [] }));

  const { findings, exempt } = judge({ results, ledger: UNGATED_EXAMPLES });

  // ── report ───────────────────────────────────────────────────────────────
  for (const line of funnelLines(census)) console.log(line);
  console.log('');
  console.log('Controls:');
  console.log(`  resolution   ${run.resolvedFileName}`);
  console.log(
    `  sentinel     importing a name no package exports produced ${run.sentinelDiagnostics.length} diagnostic(s) (TS2305)`,
  );
  console.log(`  positive     importing a real export produced ${run.positiveDiagnostics.length} diagnostic(s)`);
  console.log(`  src leaks    ${run.srcLeaks.length}`);
  console.log(
    `  injection    ${compiled.filter((b) => b.injected).length} of ${compiled.length} block(s) received the documented symbol's import; ` +
      `${pairs.length - withheld.length} of ${pairs.length} documented symbol(s) are importable, ` +
      `${viaTwin.length} of them only through their module's built declaration`,
  );
  for (const pair of viaTwin) {
    console.log(
      `               via its module's built declaration: ${pair} ` +
        `(${relative(repoRoot, injectableFrom.get(pair)).split(sep).join('/')})`,
    );
  }
  for (const pair of withheld) console.log(`               NOT importable from any probed specifier: ${pair}`);
  console.log('');

  const clean = results.length - codesOf.size;
  console.log(
    `Examples: ${results.length} block(s) — ${clean} compile, ${codesOf.size} fail, ` +
      `${exempt.length} of those declared in the ledger (${Object.keys(UNGATED_EXAMPLES).length} row(s)).`,
  );

  if (findings.length === 0) {
    console.log('\nEvery covered `@example` compiles, or fails exactly as its ledger row declares.');
    return EXIT_CODES.verified;
  }

  console.error('');
  for (const finding of findings) {
    if (finding.reason === 'undeclared-failure') {
      console.error(`UNDECLARED FAILURE  ${finding.site}`);
      for (const line of detailOf.get(finding.site) ?? []) console.error(`  ${line}`);
      console.error(
        `  Fix the example, or declare it: add a row keyed \`${finding.site}\` carrying ` +
          `codes [${[...new Set(finding.codes)].sort((a, b) => a - b).join(', ')}], a written reason and the card that owns it.`,
      );
    } else {
      console.error(`${finding.reason.toUpperCase().replace(/-/g, ' ')}  ${finding.site}`);
      console.error(`  ${finding.detail}`);
    }
  }
  console.error(
    '\n`@example` blocks on exported symbols must compile against the built types. See the header of this script.',
  );
  return EXIT_CODES.examplesFailed;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}

export { main };
