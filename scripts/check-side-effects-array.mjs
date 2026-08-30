#!/usr/bin/env node
// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * check-side-effects-array -- a `sideEffects` ARRAY must name EXACTLY the
 * modules that register something at load time.
 *
 *   node scripts/check-side-effects-array.mjs           # the verdict
 *   node scripts/check-side-effects-array.mjs --list    # the enumeration, per package
 *
 * ## Why this gate exists (objectui#6683)
 *
 * `sideEffects` is a PUBLISHED CONTRACT: every consumer's bundler reads it and
 * takes it at its word. `@object-ui/app-shell` declares it as an ARRAY because
 * the two simpler answers are both wrong for this package, and both wrongnesses
 * were MEASURED rather than argued:
 *
 *   - omitting the field   -> "assume every module does something on import",
 *                             so nothing in the package is shakeable. Measured
 *                             on the objectui#6683 branch: 3,310,672 bytes
 *                             gzipped in the console's eager closure.
 *   - `sideEffects: false` -> the bundler drops every module whose exports go
 *                             unused, including three live SDUI widget
 *                             registrations (`mcp:connect-agent`,
 *                             `cloud:onboarding-next`, `cloud:ai-model-status`)
 *                             that the barrel pulls in through BARE side-effect
 *                             imports. They fall to 0 chunks. Closed by
 *                             measurement in objectui#6535 / PR #6682.
 *
 * The array is the honest third answer. Its failure mode is the reason this
 * gate is not optional and ships in the SAME change as the array: an array that
 * is INCOMPLETE fails **silently, in someone else's bundle**. No error, no
 * warning, exit 0 -- the bundler believes it is executing a declaration rather
 * than discovering a defect. That is the same failure mode as `false`, only
 * harder to see, and the maintainer ruling of 2026-08-29 refuses a bare array
 * for exactly that reason.
 *
 * ## The rule, stated once
 *
 *     the array names EXACTLY:  entry forms
 *                             + every module in the package's entry graph that
 *                               performs a top-level REGISTRATION,
 *                               in BOTH its source and its published spelling
 *
 * Both directions are checked, because a `sideEffects` array can be wrong in
 * two ways and only one of them is loud:
 *
 *   - MISSING  -- a registering module the array does not name. A bundler drops
 *     it and the registration is gone from a consumer's app. Silent.
 *   - STALE    -- a name whose module no longer registers anything. It costs
 *     every consumer bytes, and it reads to the next author as "this module
 *     registers something", which is how a REAL entry gets deleted as noise.
 *
 * ## The enumeration is DERIVED, never listed
 *
 * The ruling is explicit that the implementing change re-derives the set
 * mechanically and never reuses a hand-copied list, so there is no list of
 * module paths anywhere in this file or in the array's neighbourhood -- the
 * array in `package.json` is the CLAIM and this file is the DERIVATION, and the
 * gate is the comparison of the two. A hand-copied enumeration would be a
 * second source of truth free to rot exactly as quietly as the array it was
 * meant to protect.
 *
 * ## What counts as a registration, and why an UNKNOWN effect is an ERROR
 *
 * {@link classifyEffect} sorts every top-level side effect a module's body
 * performs into exactly three buckets, and refuses anything it does not
 * recognise:
 *
 *   - `registration` -- a top-level CALL or `new`. Not "a call whose name looks
 *     like `register`": a name test is an under-reading, and an under-reading
 *     here is precisely the silent drop. `ComponentRegistry.register(...)`,
 *     `registerAppComponent(...)` and a hypothetical `Registry.add(...)` are
 *     indistinguishable to a bundler and are treated alike here.
 *   - `local-binding-write` -- `X.displayName = 'X'` where `X` is declared in
 *     THIS module and the right-hand side calls nothing. It is provably
 *     module-local: a bundler that drops the module drops its target too, so
 *     nothing outside can observe the difference. This is the carve-out that
 *     keeps three pure React components (and, through them, the route views
 *     they anchor) shakeable.
 *   - `side-effect-only-import` -- `import './x.js';`. A PROPAGATION edge, not
 *     an effect of its own. It is handled by {@link checkReachability} below
 *     rather than by making its importer unshakeable.
 *
 * Anything else is `unknown` and fails the gate with exit 2. That asymmetry is
 * the whole design: a new spelling of a load-time effect must make this gate
 * LOUD, never make it quietly decide the module is pure. "I did not recognise
 * that" and "that is not a registration" must not be the same answer.
 *
 * ## Reachability -- naming a module is not enough
 *
 * A module named in the array is retained only when a RETAINED module still
 * imports it. So the array's promise only holds if every registering module is
 * reachable from an entry form through modules that are THEMSELVES covered.
 * A chain `barrel -> pure-helper -> registrar` breaks: the pure helper is
 * shakeable, so when its exports go unused it is dropped and takes the
 * registrar's edge with it -- the registrar is named, retained by nobody, and
 * gone. {@link checkReachability} rejects that shape.
 *
 * ## Scope, and why this is not the same gate as the consistency pin
 *
 * `scripts/__tests__/side-effects-declaration-consistency.test.ts`
 * (objectui#3943) asks whether a declaration AGREES WITH module bodies across
 * the whole workspace, and proves with a real bundler that the field is honoured
 * at all. It is the wider gate and it stays the authority on that question.
 *
 * This file asks the narrower one the ruling names: for an ARRAY, is the array
 * the exact enumeration? The two are deliberately independent -- they derive the
 * population by different routes (that one folds in the workspace ALIAS tables;
 * this one derives the source barrel and the published spelling from the
 * manifest) -- because two guards that share a derivation fail together.
 *
 * Exit codes follow this tree's convention that a broken gauge must be LOUDER
 * than a reading over the line:
 *
 *   0 -- every array agrees with its enumeration
 *   1 -- an array disagrees (missing / stale / unreachable)
 *   2 -- no trustworthy enumeration (unknown effect, unresolved specifier,
 *        no package found, a spelling map that does not round-trip)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isEntrypoint } from './invoked-as.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Extensions a bundler tries, in Vite's own order. `.tsx` is why this matters. */
const RESOLVE_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx'];

/** Files whose bodies this gate can parse. A `.css` entry form is not one. */
const MODULE_FILE_RE = /\.(ts|tsx|mts|js|jsx|mjs)$/;

export const EXIT_OK = 0;
export const EXIT_DISAGREES = 1;
export const EXIT_NO_MEASUREMENT = 2;

/** `"./dist/index.js"` and `"dist/index.js"` name one file; compare on this. */
export const normalize = (p) => (p.startsWith('./') ? p.slice(2) : p);

/* -------------------------------------------------------------------------- */
/* The workspace.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The `packages:` globs from `pnpm-workspace.yaml`, read rather than hardcoded
 * so a new workspace root is covered the day it is added. Understands only the
 * two shapes the file uses; anything else THROWS rather than being skipped,
 * because a guard that silently stops looking at part of the workspace goes on
 * reporting success over a shrinking surface.
 *
 * @param {string} [root]
 * @returns {string[]}
 */
export function workspaceGlobs(root = REPO_ROOT) {
  const yaml = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => /^packages:\s*$/.test(l));
  if (start === -1) throw new Error('pnpm-workspace.yaml no longer declares a top-level `packages:` key.');

  const globs = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    if (!/^\s/.test(line)) break;
    const match = line.match(/^\s*-\s*['"]?([^'"#\s]+)['"]?\s*(#.*)?$/);
    if (!match) {
      throw new Error(
        `Unparsed entry in pnpm-workspace.yaml \`packages:\`: ${JSON.stringify(line)} — teach this guard the new syntax.`,
      );
    }
    globs.push(match[1]);
  }
  return globs;
}

/** @param {string} [root] @returns {string[]} absolute package directories. */
export function workspacePackageDirs(root = REPO_ROOT) {
  const dirs = [];
  for (const glob of workspaceGlobs(root)) {
    if (glob.endsWith('/*')) {
      const parent = path.join(root, glob.slice(0, -2));
      if (!fs.existsSync(parent)) continue;
      for (const d of fs.readdirSync(parent)) {
        const full = path.join(parent, d);
        if (fs.statSync(full).isDirectory()) dirs.push(full);
      }
    } else if (!glob.includes('*')) {
      dirs.push(path.join(root, glob));
    } else {
      throw new Error(`Unsupported workspace glob ${JSON.stringify(glob)} — teach this guard how to expand it.`);
    }
  }
  return dirs;
}

/**
 * Every workspace package whose `sideEffects` is an ARRAY.
 *
 * `false`, `true` and an omitted field are all out of scope here by design:
 * this gate is about the content of an array. The `false` direction is the
 * objectui#3943 consistency pin's, and `true`/omitted are the conservative
 * claim, which can never lose a registration.
 *
 * @param {string} [root]
 */
export function readArrayPackages(root = REPO_ROOT) {
  const found = [];
  for (const dir of workspacePackageDirs(root)) {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (!manifest.name || !Array.isArray(manifest.sideEffects)) continue;
    if (manifest.sideEffects.some((e) => typeof e !== 'string')) {
      throw new Error(`${manifest.name} declares a non-string \`sideEffects\` entry — teach this guard that shape.`);
    }
    found.push({
      name: manifest.name,
      dir: path.relative(root, dir).split(path.sep).join('/'),
      manifest,
      declared: manifest.sideEffects.map(normalize),
    });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/* -------------------------------------------------------------------------- */
/* The static scan.                                                            */
/* -------------------------------------------------------------------------- */

/** Statement kinds that RUN when the module is evaluated (rather than declaring). */
function isExecutedStatement(stmt) {
  return (
    ts.isIfStatement(stmt) ||
    ts.isForStatement(stmt) ||
    ts.isForOfStatement(stmt) ||
    ts.isForInStatement(stmt) ||
    ts.isWhileStatement(stmt) ||
    ts.isDoStatement(stmt) ||
    // `try { registerLayout(); } catch {}` — objectui#3899's actual shape.
    ts.isTryStatement(stmt) ||
    ts.isSwitchStatement(stmt) ||
    ts.isBlock(stmt) ||
    ts.isLabeledStatement(stmt) ||
    ts.isThrowStatement(stmt)
  );
}

/** Whether `node` contains a call or a construction anywhere inside it. */
function containsCall(node) {
  let hit = false;
  const walk = (n) => {
    if (hit) return;
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) hit = true;
    else ts.forEachChild(n, walk);
  };
  walk(node);
  return hit;
}

/** Every identifier declared at the top level of this source file. */
function moduleScopeBindings(source) {
  const names = new Set();
  for (const stmt of source.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) &&
      stmt.name &&
      ts.isIdentifier(stmt.name)
    ) {
      names.add(stmt.name.text);
    }
  }
  return names;
}

/**
 * The kind of one top-level side effect: `registration`, `local-binding-write`,
 * `side-effect-only-import`, or `unknown`.
 *
 * `unknown` is the load-bearing return. See the header: a spelling this gate
 * does not recognise must be LOUD, not quietly filed as pure.
 *
 * @param {import('typescript').Statement} stmt
 * @param {Set<string>} localBindings identifiers declared at module scope.
 * @returns {'registration' | 'local-binding-write' | 'side-effect-only-import' | 'unknown' | null}
 *          `null` means the statement performs no top-level side effect at all.
 */
export function classifyEffect(stmt, localBindings) {
  if (ts.isImportDeclaration(stmt)) {
    return stmt.importClause ? null : 'side-effect-only-import';
  }
  if (ts.isExportDeclaration(stmt)) return null;

  if (ts.isExpressionStatement(stmt)) {
    // A bare string is a directive prologue (`'use client'`).
    if (ts.isStringLiteral(stmt.expression)) return null;
    if (containsCall(stmt)) return 'registration';

    const expr = stmt.expression;
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(expr.left)
    ) {
      // `X.displayName = 'X'` where `X` is this module's own binding: nothing
      // outside can observe it once the module is dropped, and the right-hand
      // side is already known call-free (`containsCall` above returned false).
      const target = expr.left.expression;
      if (ts.isIdentifier(target) && localBindings.has(target.text)) return 'local-binding-write';
      return 'unknown';
    }
    if (ts.isBinaryExpression(expr) || ts.isElementAccessExpression(expr) || ts.isPropertyAccessExpression(expr)) {
      return 'unknown';
    }
    // Everything left is an expression evaluated for nothing: `1;`, `x;`.
    return null;
  }

  if (isExecutedStatement(stmt)) {
    if (containsCall(stmt)) return 'registration';
    return 'unknown';
  }

  return null;
}

/**
 * One module's top-level effects and its relative import edges.
 *
 * @param {string} absFile
 * @param {string} [root]
 */
export function scanModule(absFile, root = REPO_ROOT) {
  const source = ts.createSourceFile(
    absFile,
    fs.readFileSync(absFile, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const rel = path.relative(root, absFile).split(path.sep).join('/');
  const at = (n) => source.getLineAndCharacterOfPosition(n.getStart(source)).line + 1;
  const firstLine = (n) => n.getText(source).split('\n')[0].trim().slice(0, 120);
  const localBindings = moduleScopeBindings(source);

  const effects = [];
  const edges = [];

  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) {
      const specifier = stmt.moduleSpecifier;
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.')) {
        edges.push({ specifier: specifier.text, bare: ts.isImportDeclaration(stmt) && !stmt.importClause });
      }
    }
    const kind = classifyEffect(stmt, localBindings);
    if (kind !== null) effects.push({ file: rel, line: at(stmt), kind, text: firstLine(stmt) });
  }

  return { effects, edges };
}

/**
 * Resolve a relative specifier the way this repo's TypeScript sources spell
 * them: ESM-style, with a `.js` extension naming the `.ts` file next to it.
 * Getting this wrong does not fail loudly on its own — it silently truncates
 * the reachable set — so the caller REPORTS an unresolved specifier instead of
 * skipping it.
 */
export function resolveRelative(fromFile, specifier) {
  const rewritten = specifier.replace(/\.js$/, '.ts').replace(/\.jsx$/, '.tsx').replace(/\.mjs$/, '.mts');
  for (const candidate of [rewritten, specifier]) {
    const abs = path.resolve(path.dirname(fromFile), candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  const base = path.resolve(path.dirname(fromFile), specifier.replace(/\.(js|jsx|mjs)$/, ''));
  for (const ext of RESOLVE_EXTENSIONS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of RESOLVE_EXTENSIONS) {
      const index = path.join(base, `index${ext}`);
      if (fs.existsSync(index)) return index;
    }
  }
  return undefined;
}

/**
 * The barrel plus every module reachable from it by relative import: the set a
 * bundler may shake, and therefore the set the declaration is a promise about.
 *
 * Bare package specifiers stop the walk — another package's manifest is that
 * package's problem.
 *
 * @param {string} entryFile absolute path to the source barrel.
 * @param {string} [root]
 */
export function walkEntryGraph(entryFile, root = REPO_ROOT) {
  const seen = new Set();
  /** @type {Map<string, {effects: any[], edges: any[]}>} */
  const scans = new Map();
  /** @type {Map<string, {from: string, bare: boolean}[]>} */
  const importedBy = new Map();
  const unresolved = [];
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!MODULE_FILE_RE.test(file) || /\.d\.ts$/.test(file)) continue;

    const scan = scanModule(file, root);
    scans.set(file, scan);
    for (const edge of scan.edges) {
      const resolved = resolveRelative(file, edge.specifier);
      if (!resolved) {
        unresolved.push(`${path.relative(root, file)} -> ${edge.specifier}`);
        continue;
      }
      const list = importedBy.get(resolved) ?? [];
      list.push({ from: file, bare: edge.bare });
      importedBy.set(resolved, list);
      stack.push(resolved);
    }
  }

  return { modules: [...seen], scans, importedBy, unresolved };
}

/* -------------------------------------------------------------------------- */
/* Entry forms and the source <-> published spelling map.                      */
/* -------------------------------------------------------------------------- */

/**
 * Every module path a bundler can resolve the PACKAGE to, package-relative,
 * derived from the manifest.
 *
 * `types` is skipped: type declarations are erased and are never a bundling
 * surface. `*` patterns are skipped because they name no single file — and a
 * package that grows one while declaring an array is reported by
 * {@link evaluatePackage} rather than silently dropped.
 */
export function manifestEntryForms(manifest) {
  const found = new Set();
  for (const field of [manifest.main, manifest.module]) {
    if (typeof field === 'string') found.add(normalize(field));
  }
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      if (node.startsWith('./')) found.add(normalize(node));
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'types') continue;
      walk(value);
    }
  };
  walk(manifest.exports);
  return [...found].sort();
}

/**
 * The map between a package's SOURCE spelling and its PUBLISHED spelling, and
 * the source barrel both are anchored on.
 *
 * Derived, not configured: the published barrel comes from the manifest, the
 * source barrel is found on disk beside it, and the transform is whatever turns
 * one into the other (`src/` -> `dist/`, `.ts`/`.tsx` -> `.js`). The derivation
 * is then required to ROUND-TRIP on the barrel itself, which is the anti-vacuity
 * check: a map that cannot reproduce the one pair it was derived from would
 * quietly mis-spell every other module.
 */
export function deriveSpellingMap(pkg, root = REPO_ROOT) {
  const forms = manifestEntryForms(pkg.manifest);
  const publishedBarrel = forms.find((f) => /(^|\/)index\.(js|mjs|cjs)$/.test(f));
  if (!publishedBarrel) {
    return { error: `${pkg.name}: no published barrel (an \`index.js\`-shaped entry) in main/module/exports` };
  }

  const pkgAbs = path.join(root, pkg.dir);
  let sourceBarrel;
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = `src/index${ext}`;
    if (fs.existsSync(path.join(pkgAbs, candidate))) {
      sourceBarrel = candidate;
      break;
    }
  }
  if (!sourceBarrel) {
    return { error: `${pkg.name}: no source barrel at src/index.* — this gate reads module bodies, so it cannot proceed` };
  }

  const srcRoot = sourceBarrel.split('/')[0];
  const distRoot = publishedBarrel.split('/')[0];
  const publishedExt = path.extname(publishedBarrel);

  /** `src/a/b.tsx` -> `dist/a/b.js`, by the transform derived above. */
  const toPublished = (sourceRel) =>
    `${distRoot}/${sourceRel.slice(srcRoot.length + 1).replace(/\.(tsx|ts|mts|jsx|js|mjs)$/, publishedExt)}`;

  if (toPublished(sourceBarrel) !== publishedBarrel) {
    return {
      error:
        `${pkg.name}: the source/published spelling map does not round-trip on the barrel — ` +
        `${sourceBarrel} maps to ${toPublished(sourceBarrel)} but the manifest publishes ${publishedBarrel}`,
    };
  }

  return { forms, sourceBarrel, publishedBarrel, srcRoot, distRoot, toPublished };
}

/* -------------------------------------------------------------------------- */
/* The verdict.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A registering module is only retained when a RETAINED module still imports
 * it. This walks back from each registrar to an entry form through COVERED
 * modules only, so a `barrel -> pure-helper -> registrar` chain — where the
 * shakeable helper takes the registrar's only edge with it — is a failure and
 * not a green tick.
 */
export function checkReachability(graph, registrars, sourceBarrelAbs, root = REPO_ROOT) {
  const covered = new Set([sourceBarrelAbs, ...registrars]);
  const reachable = new Set([sourceBarrelAbs]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const file of covered) {
      if (reachable.has(file)) continue;
      const importers = graph.importedBy.get(file) ?? [];
      if (importers.some((i) => reachable.has(i.from))) {
        reachable.add(file);
        grew = true;
      }
    }
  }
  return registrars
    .filter((r) => !reachable.has(r))
    .map((r) => path.relative(root, r).split(path.sep).join('/'));
}

/**
 * The whole verdict for one array-declaring package.
 *
 * @returns {{name: string, ok: boolean, gauge: boolean, expected: string[], declared: string[],
 *            missing: string[], stale: string[], registrars: string[], problems: string[],
 *            modulesWalked: number}}
 */
export function evaluatePackage(pkg, root = REPO_ROOT) {
  const problems = [];
  const map = deriveSpellingMap(pkg, root);
  if (map.error) {
    return {
      name: pkg.name, ok: false, gauge: true, expected: [], declared: pkg.declared,
      missing: [], stale: [], registrars: [], problems: [map.error], modulesWalked: 0,
    };
  }

  const pkgAbs = path.join(root, pkg.dir);
  const sourceBarrelAbs = path.join(pkgAbs, map.sourceBarrel);
  const graph = walkEntryGraph(sourceBarrelAbs, root);

  for (const u of graph.unresolved) {
    problems.push(
      `${pkg.name}: unresolved relative specifier ${u} — an unwalked edge silently SHRINKS the enumeration, ` +
        `so it is reported rather than skipped`,
    );
  }

  const registrars = [];
  for (const [file, scan] of graph.scans) {
    for (const effect of scan.effects) {
      if (effect.kind === 'unknown') {
        problems.push(
          `${pkg.name}: ${effect.file}:${effect.line} performs a top-level side effect this gate does not ` +
            `recognise (${effect.text}). Teach \`classifyEffect\` what it is — an unrecognised effect must ` +
            `never be read as "not a registration", which is the silent drop this gate exists to prevent.`,
        );
      }
    }
    if (scan.effects.some((e) => e.kind === 'registration')) registrars.push(file);
  }
  registrars.sort();

  // A registering module needs BOTH spellings: consumers resolve the published
  // one, in-repo bundler aliases resolve the source one, and a bundler reads the
  // same manifest for both.
  const expected = new Set(map.forms);
  expected.add(map.sourceBarrel);
  for (const abs of registrars) {
    const rel = path.relative(pkgAbs, abs).split(path.sep).join('/');
    expected.add(rel);
    expected.add(map.toPublished(rel));
  }

  const declared = new Set(pkg.declared);
  const missing = [...expected].filter((e) => !declared.has(e)).sort();
  const stale = [...declared].filter((d) => !expected.has(d)).sort();

  for (const entry of pkg.declared) {
    if (entry.includes('*')) {
      problems.push(
        `${pkg.name}: "${entry}" is a glob. This gate compares literal paths, so a pattern would make the ` +
          `comparison vacuous on whatever it covers — spell the modules out.`,
      );
    }
  }

  const unreachable = checkReachability(graph, registrars, sourceBarrelAbs, root);
  const reachabilityProblems = unreachable.map(
    (m) =>
      `${pkg.name}: ${m} registers at load time, but no chain of \`sideEffects\`-covered modules reaches it ` +
      `from the barrel. Naming it is not enough — every module on the path to it is shakeable and will take ` +
      `its only edge with it.`,
  );

  if (graph.modules.length < 2) {
    problems.push(
      `${pkg.name}: the entry graph walked ${graph.modules.length} module(s) from ${map.sourceBarrel} — ` +
        `an enumeration over an empty graph agrees with any array at all`,
    );
  }

  return {
    name: pkg.name,
    ok: missing.length === 0 && stale.length === 0 && problems.length === 0 && reachabilityProblems.length === 0,
    gauge: problems.length > 0,
    expected: [...expected].sort(),
    declared: [...declared].sort(),
    missing,
    stale,
    registrars: registrars.map((r) => path.relative(pkgAbs, r).split(path.sep).join('/')),
    problems: [...problems, ...reachabilityProblems],
    modulesWalked: graph.modules.length,
  };
}

/** @param {string} [root] */
export function evaluate(root = REPO_ROOT) {
  const packages = readArrayPackages(root);
  return { packages, results: packages.map((p) => evaluatePackage(p, root)) };
}

/* -------------------------------------------------------------------------- */

export function main(argv = process.argv.slice(2), root = REPO_ROOT) {
  const { packages, results } = evaluate(root);

  // Anti-vacuity, first and loudest. Every assertion below is a set difference,
  // and every set difference passes trivially over nothing.
  if (packages.length === 0) {
    console.error(
      '❌ No workspace package declares `sideEffects` as an array.\n' +
        '   This gate is a set comparison, and a set comparison over an empty population is green for an\n' +
        '   empty reason. Either the field was removed (then this gate has to be retired deliberately, not\n' +
        '   left passing) or the workspace walk has stopped seeing the packages.',
    );
    return EXIT_NO_MEASUREMENT;
  }

  if (argv.includes('--list')) {
    for (const r of results) {
      console.log(`\n${r.name} — ${r.registrars.length} module(s) with a top-level registration, ${r.modulesWalked} walked`);
      for (const m of r.registrars) console.log(`   ${m}`);
    }
    return EXIT_OK;
  }

  let gauge = false;
  let disagrees = false;

  for (const r of results) {
    if (r.problems.length > 0) {
      gauge = true;
      for (const p of r.problems) console.error(`❌ ${p}`);
      continue;
    }
    if (r.missing.length > 0 || r.stale.length > 0) {
      disagrees = true;
      console.error(`❌ ${r.name}: \`sideEffects\` disagrees with the derived enumeration.`);
      for (const m of r.missing) {
        console.error(
          `   MISSING  "./${m}" — this module registers at load time (or is an entry form) and the array does ` +
            `not name it. A bundler will drop it from a consumer's app, silently.`,
        );
      }
      for (const s of r.stale) {
        console.error(
          `   STALE    "./${s}" — the array names it, but nothing in it registers at load time any more. It ` +
            `costs every consumer bytes and it reads to the next author as a live registration.`,
        );
      }
      console.error(
        `   The enumeration is DERIVED here, never listed: fix the array, or fix the module — whichever half\n` +
          `   is currently false. Run \`node scripts/check-side-effects-array.mjs --list\` to see the set.`,
      );
      continue;
    }
    console.log(
      `✅ ${r.name}: \`sideEffects\` names exactly the ${r.registrars.length} module(s) that register at load ` +
        `time, plus its entry forms (${r.declared.length} entries, ${r.modulesWalked} modules walked).`,
    );
  }

  if (gauge) {
    console.error(
      '\nExit 2 — this is a verdict about the GAUGE, not about the array. Nothing above says the declaration\n' +
        'is wrong; it says the enumeration could not be trusted, which must never be reported as a pass.',
    );
    return EXIT_NO_MEASUREMENT;
  }
  return disagrees ? EXIT_DISAGREES : EXIT_OK;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}
