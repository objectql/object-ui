#!/usr/bin/env node
// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Every name a `packages/<pkg>/README.md` imports FROM ITS OWN PACKAGE must be a
 * name that package really exports.
 *
 * Run:  node scripts/check-readme-exports.mjs        (also `pnpm check:readme-exports`)
 *       node scripts/check-readme-exports.mjs --list  # every self-binding judged
 *       node scripts/check-readme-exports.mjs --json
 *       node scripts/check-readme-exports.mjs --readme packages/plugin-gantt/README.md=/tmp/x.md
 * Exit: 0 = every self-import names a real export, 1 = a fabricated name, a
 *       wrong-path name, a package that cannot be judged, or a collapsed scan.
 *
 * ## The defect (objectui#5043, the root cause of the #5010-#5016 family)
 *
 * A README in `packages/<pkg>/` teaches `import { X } from '@object-ui/<pkg>'`.
 * Nothing checked that `<pkg>` exports `X`. `check-doc-links.mjs` parses links
 * and never looks inside a code block; `check-doc-component-types.mjs` scans
 * `content/docs` and never enters `packages/<pkg>/README.md`. So a name could be
 * invented, or survive the export that once backed it being renamed, and every
 * gate in the repository stayed green.
 *
 * These READMEs are listed in each package's `files`, so they ship in the npm
 * tarball. A reader who copies the snippet gets a `TypeError` at runtime or a
 * TS2305/TS2724 at build time. One manual sweep found drift in SEVEN packages
 * (#5010 calendar, #5011 form, gantt, grid, view, #5015 dashboard, #5016
 * report), and the person who did it recorded that number as a LOWER BOUND: the
 * method they had could only see single-line import statements.
 *
 * ## Why this is an AST walk and not a regex (measured, objectui#5043)
 *
 * The card's original sketch was one cross-line regex, comments stripped, split
 * on commas. Run on `plugin-gantt` it reported FIVE names that are not imports
 * at all -- `weeks`, `title`, `selection`, `target`, `dataSource` -- and MISSED
 * both real fabrications. The root cause is a shape this whole family of
 * READMEs uses: a SIDE-EFFECT import (`import '@object-ui/plugin-gantt';`, no
 * `from`). A lazy quantifier starting there runs on to the next
 * `from '@object-ui/plugin-gantt'` twenty lines later and swallows the prose
 * and a schema literal in between as an import clause. Stripping comments and
 * splitting on commas then happens to CONTAMINATED text, so words out of the
 * prose are reported as fabricated import names.
 *
 * Extracting fenced blocks and handing each to `ts.createSourceFile` does not
 * defend against those traps -- it makes them unrepresentable:
 *
 *   - a multi-line import block is ONE `ImportDeclaration` node, so no fence
 *     and no paragraph can end up inside an import clause;
 *   - a trailing `//` comment is trivia and can never contribute a name, which
 *     is the false positive the second prototype produced;
 *   - `A as B` gives `propertyName = A` and `name = B`, so the EXPORT name is
 *     available separately from the local alias. This gate judges
 *     `propertyName` -- `import { madeUp as Real }` is a fabrication of
 *     `madeUp`, and reporting it as `Real` would send the reader to the wrong
 *     word.
 *
 * ## Why the export set is symbols, and never a grep
 *
 * Same card, measured: `GanttSchema` grepped against `packages/types/src` has
 * six hits, so a grep-based check calls it real. All six are substrings of
 * `ObjectGanttSchema`; `\bGanttSchema\b` has zero. So the export set here comes
 * from the TypeScript checker's `getExportsOfModule` over the package's own
 * declared type entry -- the exact set a consumer's editor resolves.
 *
 * ALIASES ARE RESOLVED BEFORE THE VALUE/TYPE FLAGS ARE READ. `export { Foo }`
 * from a barrel is an Alias symbol that does NOT itself carry the Value flag,
 * so reading flags off the alias marks every re-export in the repo as
 * type-only. The prototype's first version did exactly that. The flags are a
 * census-and-hint field here rather than a verdict (a `import { T }` of a
 * type-only export is legal TypeScript), but a hint that lies is worse than no
 * hint, so the resolution is done properly and pinned by the test suite.
 *
 * ## Three states, because two of them have different fixes
 *
 *   real        the package exports that name.
 *   fabricated  no package in the workspace exports it. Delete or rename it.
 *   wrong-path  the name is real but belongs to ANOTHER package. #5010's
 *               `CalendarViewSchema` is this: it lives in `@object-ui/types`,
 *               and the fix is the import PATH, not the name. Collapsing it
 *               into "fabricated" tells the reader to delete a correct symbol.
 *
 * All three are reported; `fabricated` and `wrong-path` both FAIL.
 *
 * ## A package whose types are not on disk is a FAILURE, never a skip
 *
 * The export set is read from the package's declared type entry
 * (`exports['.'].types`, else `types`/`typings`), which for almost every
 * package here is a BUILT `dist/index.d.ts`. Two ways that file can be absent,
 * and both directions of silence are wrong:
 *
 *   - treating a missing entry as "this package exports nothing" makes every
 *     import in its README read as fabricated -- a wall of false reds that
 *     ends with the gate being deleted;
 *   - skipping it shrinks the judged population invisibly, which is the same
 *     defect this gate exists to close, one level up: a scan that quietly
 *     stops looking still prints a green.
 *
 * So a package is recorded in one of four states, all of them in the census:
 *   `read`          type entry declared and present -> exports read.
 *   `unbuilt`       type entry declared, file absent -> run the build.
 *   `no-type-entry` package declares no types at all (an app bundle, an
 *                   extension). Its README cannot teach a named import.
 *   `no-readme`     nothing to judge.
 * `unbuilt` and `no-type-entry` FAIL if -- and only if -- that package's README
 * actually carries a self-binding, which is the only case where the missing
 * exports would have changed a verdict. Either way the count is printed.
 *
 * ## Non-vacuity
 *
 * The tree is expected to be GREEN AT REST, so on an ordinary day this gate's
 * output is indistinguishable from a gate that does nothing -- which is the
 * defect it exists to catch. `FLOORS` turns a collapsed walk (no READMEs, no
 * import declarations, no export symbols) into a FAILURE, and the verdict line
 * carries the census rather than a bare OK. Same discipline as
 * `scripts/check-vi-mock-specifiers.mjs` (objectui#5646).
 *
 * ## The population is TRACKED files (objectui#6545)
 *
 * Both walks are `git ls-files -- packages/`, so the population is what git
 * TRACKS, not what is on disk. A brand-new `packages/<pkg>/README.md` written
 * but not yet `git add`-ed is outside it, and this gate reports OK without ever
 * having opened the file -- true of the population it scanned, and silent about
 * the one file its author was asking about. CI never sees this (a committed
 * tree has no untracked files); it bites only the local pre-flight, which is
 * exactly where an author runs a gate to avoid a red push.
 *
 * The verdict line therefore says `tracked` beside both counts, so a green
 * reads as "green over N tracked READMEs" rather than a claim about the
 * directory. Same wording, and the same reason, as
 * `scripts/check-control-bytes.mjs`, `scripts/check-vi-mock-specifiers.mjs` and
 * `scripts/check-vi-mock-inherit.mjs`. WIDENING the population to untracked
 * files, or refusing to run on a dirty worktree, would change what this gate
 * MEANS and is deliberately not done here -- that is a decision, not a patch.
 *
 * ## Deliberately out of scope
 *
 * Extracting the code blocks and COMPILING them (objectui#5043's "stronger
 * tier", with the bidirectional pins for documented `interface` blocks) is a
 * separate card: the entry price is a batch of pre-existing reds that need a
 * baseline decision first. This gate answers one question -- does the imported
 * NAME exist -- and says so rather than implying more.
 *
 * Also invisible to it, and documented on the card: authorable-JSON KEY
 * surfaces. `BaseSchema` carries an index signature and its Zod mirror is
 * `.passthrough()`, so no amount of type checking rejects an invented schema
 * key. That needs a third instrument, not a wider version of this one.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { isEntrypoint } from './invoked-as.mjs';

/** Fence info strings whose body is parsed as TypeScript/JavaScript. */
export const CODE_LANGS = Object.freeze([
  'ts',
  'tsx',
  'typescript',
  'typescriptreact',
  'mts',
  'cts',
  'js',
  'jsx',
  'javascript',
  'mjs',
  'cjs',
]);

const LANG_SET = new Set(CODE_LANGS);

/** Info strings that are JSX-flavoured, so the block is parsed as TSX. */
const JSX_LANGS = new Set(['tsx', 'jsx', 'typescriptreact']);

/**
 * Floors below which a green verdict is a claim about coverage rather than a
 * statement about the tree. Set with room: the point is to catch a walk that
 * COLLAPSED, not to pin today's numbers, which move with every package added.
 */
export const FLOORS = Object.freeze({
  readmes: 25,
  codeBlocks: 150,
  importBindings: 100,
  selfBindings: 40,
  packagesRead: 25,
  exportSymbols: 400,
});

/** The NUL that `git ls-files -z` delimits with, built from its code point. */
const NUL = String.fromCharCode(0);

/**
 * Every tracked `README.md` under `packages/`, package-root and nested alike.
 *
 * The card scoped this at "packages/<pkg>/README.md". Written as a git
 * pathspec that reads as exactly that, it ALSO matches four nested ones --
 * git's default pathspec is fnmatch without FNM_PATHNAME, so `*` crosses `/`.
 * Rather than tighten the glob and lose them, they are kept and resolved to
 * their OWNING package (`packageDirOf`): `packages/types/src/zod/README.md`
 * teaching `import { X } from '@object-ui/types'` is the same defect, and
 * `packages/types` ships its whole `src/` in the tarball. The filter is done
 * here in JS so the population is a stated rule rather than an accident of
 * which pathspec magic was in force.
 */
function trackedReadmes(root) {
  return execFileSync('git', ['ls-files', '-z', '--', 'packages/'], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split(NUL)
    .filter((file) => file.endsWith('/README.md'))
    .sort();
}

/**
 * Every `packages/<pkg>/` that carries a manifest.
 *
 * Enumerated in its OWN right and not derived from the README walk. The
 * wrong-path verdict needs to know which package owns a name, and a package
 * with no README would otherwise never have its exports read -- so a README
 * naming one of ITS symbols would be reported as `fabricated`, sending the
 * reader to delete a real export instead of correcting a path. Every package
 * here happens to have a README today, which is exactly why the difference
 * would have gone unnoticed; the fixture suite is what surfaced it.
 */
function trackedPackages(root) {
  return execFileSync('git', ['ls-files', '-z', '--', 'packages/'], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split(NUL)
    .filter((file) => /^packages\/[^/]+\/package\.json$/.test(file))
    .map(dirname)
    .sort();
}

/**
 * The package directory a README belongs to: the nearest ancestor carrying a
 * `package.json` with a `name`, never deeper than `packages/<pkg>`. Derived so
 * a nested README is judged against the package that actually publishes it.
 */
export function packageDirOf(root, readmePath) {
  let dir = dirname(readmePath);
  while (dir.startsWith('packages/') && dir !== 'packages') {
    const manifest = readJson(join(root, dir, 'package.json'));
    if (manifest?.name) return dir;
    dir = dirname(dir);
  }
  return null;
}

/**
 * Every fenced block in a markdown document.
 *
 * Written against the fence rules the CommonMark spec actually states, because
 * the shortcuts are what let a scan silently lose blocks: a closing fence must
 * be at least as long as the opening one (so a ```` ```` ```` block may CONTAIN
 * a ``` line), and it carries no info string. An unterminated fence is counted
 * rather than dropped -- it is a README bug in its own right, and a scan that
 * swallowed the rest of the file would report fewer imports with no sign why.
 *
 * @returns {{ lang: string, startLine: number, body: string, terminated: boolean }[]}
 *   `startLine` is the 1-based line of the OPENING fence, so a node at body
 *   line L sits on README line `startLine + L`.
 */
export function extractCodeBlocks(markdown) {
  const lines = markdown.split('\n');
  const blocks = [];
  let open = null;
  const FENCE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const m = FENCE.exec(lines[i]);
    if (open === null) {
      if (m) open = { char: m[2][0], len: m[2].length, info: m[3].trim(), startLine: i + 1, body: [] };
      continue;
    }
    const closes = m && m[2][0] === open.char && m[2].length >= open.len && m[3].trim() === '';
    if (closes) {
      blocks.push({ lang: open.info.split(/\s+/)[0].toLowerCase(), startLine: open.startLine, body: open.body.join('\n'), terminated: true });
      open = null;
      continue;
    }
    open.body.push(lines[i]);
  }
  if (open !== null) {
    blocks.push({ lang: open.info.split(/\s+/)[0].toLowerCase(), startLine: open.startLine, body: open.body.join('\n'), terminated: false });
  }
  return blocks;
}

/**
 * Every import binding one code block declares, as the AST reports them.
 *
 * `ImportDeclaration` and a re-exporting `ExportDeclaration` are both walked:
 * `export { X } from '@object-ui/pkg'` names an export of that package exactly
 * as an import does, and a README that re-exports a name it invented is the
 * same defect.
 *
 * `kind` separates what can be judged from what cannot:
 *   `named`      a named binding -- `exportName` is the name to judge.
 *   `default`    a default import; judged against the `default` export.
 *   `namespace`  `* as X`; the whole module, no name to judge.
 *   `side-effect` no clause at all. THIS is the shape that broke the regex
 *                approach, so it is counted explicitly rather than ignored.
 *
 * @returns {{ specifier: string, kind: string, exportName: string | null,
 *             local: string | null, typeOnly: boolean, line: number }[]}
 *   `line` is 1-based WITHIN the block body.
 */
export function findImportBindings(body, { jsx = false } = {}) {
  const source = ts.createSourceFile(
    jsx ? 'block.tsx' : 'block.ts',
    body,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const out = [];
  const lineOf = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  // The line is taken from the NARROWEST node that carries the binding, not
  // from the declaration. A 14-name multi-line import is one node; reporting
  // the declaration's line for all fourteen sends the reader to `import {` and
  // makes them find the offending name themselves.
  const push = (node, specifier, kind, exportName, local, typeOnly) => {
    out.push({ specifier, kind, exportName, local, typeOnly, line: lineOf(node) });
  };

  const readNamed = (specifier, elements, clauseTypeOnly) => {
    for (const element of elements) {
      // `A as B` -> propertyName = A (the EXPORT name), name = B (the alias).
      // Judging B would name the reader's own variable, not the package's.
      const exportName = element.propertyName ? element.propertyName.text : element.name.text;
      push(element, specifier, 'named', exportName, element.name.text, clauseTypeOnly || Boolean(element.isTypeOnly));
    }
  };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifierNode = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifierNode)) continue;
      const specifier = specifierNode.text;
      const clause = statement.importClause;
      if (!clause) {
        push(statement, specifier, 'side-effect', null, null, false);
        continue;
      }
      const clauseTypeOnly = Boolean(clause.isTypeOnly);
      if (clause.name) push(clause.name, specifier, 'default', 'default', clause.name.text, clauseTypeOnly);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) {
        push(bindings.name, specifier, 'namespace', null, bindings.name.text, clauseTypeOnly);
      } else if (bindings && ts.isNamedImports(bindings)) {
        readNamed(specifier, bindings.elements, clauseTypeOnly);
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifierNode = statement.moduleSpecifier;
      if (!ts.isStringLiteral(specifierNode)) continue;
      const specifier = specifierNode.text;
      const clauseTypeOnly = Boolean(statement.isTypeOnly);
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        readNamed(specifier, clause.elements, clauseTypeOnly);
      } else {
        // `export * from '…'` / `export * as ns from '…'` -- the whole module.
        push(statement, specifier, 'namespace', null, clause && ts.isNamespaceExport(clause) ? clause.name.text : null, clauseTypeOnly);
      }
    }
  }

  return out;
}

/**
 * The type entry a consumer of this package resolves, as the package itself
 * declares it. Derived, never assumed to be `dist/index.d.ts`: `test-support`
 * points its `exports['.'].types` straight at `src/index.ts`, and reading that
 * one correctly is the difference between a real judgement and a false red.
 *
 * @returns {{ declared: string | null, path: string | null }}
 */
export function typeEntryOf(packageJson, packageDir) {
  const dot = packageJson?.exports?.['.'];
  const fromExports =
    typeof dot === 'object' && dot !== null
      ? dot.types ?? dot.import?.types ?? dot.require?.types ?? dot.default?.types
      : null;
  const declared = fromExports ?? packageJson?.types ?? packageJson?.typings ?? null;
  if (typeof declared !== 'string') return { declared: null, path: null };
  return { declared, path: resolve(packageDir, declared) };
}

function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Compiler options for the export-surface program. */
const PROGRAM_OPTIONS = Object.freeze({
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  allowJs: true,
  skipLibCheck: true,
  noEmit: true,
  strict: false,
  resolveJsonModule: true,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
});

/**
 * `entryPath -> Map<exportName, { isValue, isType, alias }>`, from ONE program
 * over every entry at once (the packages import each other, so a program per
 * package would re-read the same declaration files 39 times).
 */
export function readExportSurfaces(entryPaths) {
  const surfaces = new Map();
  if (entryPaths.length === 0) return surfaces;

  const program = ts.createProgram({ rootNames: [...entryPaths], options: { ...PROGRAM_OPTIONS } });
  const checker = program.getTypeChecker();

  for (const entry of entryPaths) {
    const names = new Map();
    surfaces.set(entry, names);
    const sourceFile = program.getSourceFile(entry);
    if (!sourceFile) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;

    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      // Resolve the alias FIRST. `export { Foo } from './foo'` is an Alias
      // symbol with no Value flag of its own; reading flags off it marks every
      // re-export as type-only, which is what the prototype's first version did.
      const alias = Boolean(symbol.flags & ts.SymbolFlags.Alias);
      let resolved = symbol;
      if (alias) {
        try {
          resolved = checker.getAliasedSymbol(symbol) ?? symbol;
        } catch {
          resolved = symbol;
        }
      }
      names.set(symbol.name, {
        isValue: Boolean(resolved.flags & ts.SymbolFlags.Value),
        isType: Boolean(resolved.flags & (ts.SymbolFlags.Type | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface)),
        alias,
      });
    }
  }
  return surfaces;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The one scan. `main()`, `--list`, `--json` and the test suite all go through
 * here, so the tests exercise the real code path rather than an imitation.
 *
 * @param {string} root Repository root.
 * @param {{ readmes?: string[] | null,
 *           packageDirs?: string[] | null,
 *           readmeOverrides?: Record<string, string>,
 *           floors?: Record<string, number> }} [options]
 *   `readmes` and `packageDirs` override the two `git ls-files` walks. `readmeOverrides` maps a
 *   README path (`packages/plugin-gantt/README.md`) to a file that stands in
 *   for it -- which is how the planted-mutation self-test runs without ever
 *   writing to the working tree. `floors` overrides `FLOORS`; pass `{}` to
 *   switch the collapse check off for a fixture tree.
 */
export function scan(root, { readmes = null, packageDirs = null, readmeOverrides = {}, floors = FLOORS } = {}) {
  const readmeFiles = readmes ?? trackedReadmes(root);

  // 1. Every package, its declared type entry, and its state. The whole
  //    workspace, not only the packages that happen to carry a README --
  //    see `trackedPackages`.
  const packages = new Map(); // packageDir -> record
  for (const packageDir of packageDirs ?? trackedPackages(root)) {
    const manifest = readJson(join(root, packageDir, 'package.json'));
    const { declared, path } = typeEntryOf(manifest, join(root, packageDir));
    packages.set(packageDir, {
      dir: packageDir,
      name: manifest?.name ?? null,
      declaredEntry: declared,
      entryPath: path,
      state: declared === null ? 'no-type-entry' : isFile(path) ? 'read' : 'unbuilt',
      readmes: [],
      selfBindings: 0,
    });
  }

  const ownerOf = new Map(); // readme path -> packageDir
  const orphans = [];
  for (const readme of readmeFiles) {
    const packageDir = packageDirOf(root, readme);
    if (packageDir === null || !packages.has(packageDir)) {
      orphans.push(readme);
      continue;
    }
    ownerOf.set(readme, packageDir);
    packages.get(packageDir).readmes.push(readme);
  }

  // 2. One program over every entry that is actually on disk.
  const entryPaths = [...packages.values()].filter((p) => p.state === 'read').map((p) => p.entryPath);
  const surfaces = readExportSurfaces(entryPaths);

  /** `exportName -> package names that export it`, for the wrong-path verdict. */
  const nameOwners = new Map();
  let exportSymbols = 0;
  for (const record of packages.values()) {
    if (record.state !== 'read') continue;
    const names = surfaces.get(record.entryPath) ?? new Map();
    record.exportCount = names.size;
    exportSymbols += names.size;
    for (const name of names.keys()) {
      if (!nameOwners.has(name)) nameOwners.set(name, []);
      nameOwners.get(name).push(record.name ?? record.dir);
    }
  }

  // 3. Walk each README.
  const bindings = [];
  const findings = [];
  const counters = {
    codeBlocks: 0,
    codeBlocksParsed: 0,
    codeBlocksUntagged: 0,
    codeBlocksUnterminated: 0,
    importBindings: 0,
    selfBindings: 0,
    sideEffect: 0,
    namespace: 0,
    deepSelf: 0,
    external: 0,
    real: 0,
    fabricated: 0,
    wrongPath: 0,
  };

  for (const readme of readmeFiles) {
    const record = packages.get(ownerOf.get(readme));
    if (!record) continue; // an orphan README -- counted, never judged
    const override = readmeOverrides[readme];
    const onDisk = override ?? join(root, readme);
    let markdown;
    try {
      markdown = readFileSync(onDisk, 'utf8');
    } catch {
      continue;
    }

    for (const block of extractCodeBlocks(markdown)) {
      counters.codeBlocks++;
      if (!block.terminated) counters.codeBlocksUnterminated++;
      if (block.lang === '') counters.codeBlocksUntagged++;
      if (!LANG_SET.has(block.lang)) continue;
      counters.codeBlocksParsed++;

      for (const binding of findImportBindings(block.body, { jsx: JSX_LANGS.has(block.lang) })) {
        // `...binding` FIRST: it carries its own block-relative `line`, and
        // spreading it last silently overwrote the README line number with it.
        const site = { ...binding, file: readme, line: block.startLine + binding.line, package: record.name };

        counters.importBindings++;
        if (binding.kind === 'side-effect') counters.sideEffect++;
        if (binding.kind === 'namespace') counters.namespace++;

        const isSelf = record.name !== null && binding.specifier === record.name;
        const isDeepSelf = record.name !== null && binding.specifier.startsWith(`${record.name}/`);
        if (isDeepSelf) counters.deepSelf++;
        if (!isSelf) {
          if (!isDeepSelf) counters.external++;
          bindings.push({ ...site, verdict: 'not-self' });
          continue;
        }
        if (binding.exportName === null) {
          bindings.push({ ...site, verdict: 'no-name' });
          continue;
        }

        counters.selfBindings++;
        record.selfBindings++;

        // Every finding carries the SAME key set, `owners`/`reason` included.
        // Three differently-shaped literals here infer as a union, and the
        // pin tests then cannot read a field without narrowing first.
        const finding = (verdict, extra) => ({
          ...site,
          verdict,
          owners: [],
          reason: null,
          declaredEntry: record.declaredEntry,
          ...extra,
        });

        if (record.state !== 'read') {
          bindings.push({ ...site, verdict: 'unjudgeable' });
          findings.push(finding('unjudgeable', { reason: record.state }));
          continue;
        }

        const names = surfaces.get(record.entryPath) ?? new Map();
        const hit = names.get(binding.exportName);
        if (hit) {
          counters.real++;
          bindings.push({ ...site, verdict: 'real', ...hit });
          continue;
        }
        const owners = (nameOwners.get(binding.exportName) ?? []).filter((owner) => owner !== record.name);
        if (owners.length > 0) {
          counters.wrongPath++;
          bindings.push({ ...site, verdict: 'wrong-path', owners });
          findings.push(finding('wrong-path', { owners }));
        } else {
          counters.fabricated++;
          bindings.push({ ...site, verdict: 'fabricated' });
          findings.push(finding('fabricated'));
        }
      }
    }
  }

  const states = { read: 0, unbuilt: 0, 'no-type-entry': 0 };
  for (const record of packages.values()) states[record.state]++;

  const census = {
    readmes: readmeFiles.length,
    readmesOrphaned: orphans.length,
    packages: packages.size,
    packagesWithReadme: [...packages.values()].filter((p) => p.readmes.length > 0).length,
    packagesRead: states.read,
    packagesUnbuilt: states.unbuilt,
    packagesNoTypeEntry: states['no-type-entry'],
    exportSymbols,
    ...counters,
  };

  const vacuous = [];
  for (const [counter, floor] of Object.entries(floors)) {
    if (census[counter] < floor) vacuous.push({ counter, value: census[counter], floor });
  }

  return { census, packages: [...packages.values()], orphans, bindings, findings, vacuous };
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** The census, as one line, for the verdict. */
export function summarise({ census }) {
  return (
    `${census.readmes} tracked README(s) under packages/ (${census.readmesOrphaned} outside any package), ` +
    `${census.codeBlocks} fenced block(s) ` +
    `(${census.codeBlocksParsed} parsed as code, ${census.codeBlocksUntagged} untagged); ` +
    `${census.importBindings} import binding(s), ${census.selfBindings} of them self-imports judged ` +
    `(${census.real} real, ${census.wrongPath} wrong-path, ${census.fabricated} fabricated); ` +
    `${census.exportSymbols} export symbol(s) read from ${census.packagesRead} of ${census.packages} tracked package(s) ` +
    `(${census.packagesWithReadme} carry a README) ` +
    `(${census.packagesUnbuilt} unbuilt, ${census.packagesNoTypeEntry} declare no types); ` +
    `${census.sideEffect} side-effect import(s), ${census.namespace} namespace, ${census.deepSelf} deep self-path, ` +
    `${census.external} to other packages`
  );
}

/** Parses `--readme packages/x/README.md=/path/to.md` (repeatable) out of argv. */
export function parseReadmeOverrides(argv) {
  const overrides = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--readme') continue;
    const [dir, ...rest] = (argv[i + 1] ?? '').split('=');
    if (!dir || rest.length === 0) {
      throw new Error('--readme needs `<readmePath>=<path>`, e.g. --readme packages/plugin-gantt/README.md=/tmp/x.md');
    }
    overrides[dir] = rest.join('=');
  }
  return overrides;
}

function main(overrides) {
  const result = scan(repoRoot(), { readmeOverrides: overrides });
  const { findings, vacuous } = result;

  if (findings.length === 0 && vacuous.length === 0) {
    console.log(`✅  check-readme-exports: OK (${summarise(result)}).`);
    process.exit(0);
  }

  const fabricated = findings.filter((f) => f.verdict === 'fabricated');
  const wrongPath = findings.filter((f) => f.verdict === 'wrong-path');
  const unjudgeable = findings.filter((f) => f.verdict === 'unjudgeable');

  if (fabricated.length > 0) {
    console.error(`❌  check-readme-exports: ${fabricated.length} README import name(s) NO package exports\n`);
    console.error('  These READMEs ship in the npm tarball. A reader who copies the snippet');
    console.error('  gets TS2305/TS2724 at build time or a TypeError at runtime:\n');
    for (const f of fabricated) {
      console.error(`    - ${f.file}:${f.line} -- import { ${f.exportName} } from '${f.specifier}'`);
    }
    console.error('\n  Fix the README, or export the name. The judged name is the EXPORT name:');
    console.error("  in `import { madeUp as Real }` the fabrication is `madeUp`.\n");
  }

  if (wrongPath.length > 0) {
    console.error(`❌  check-readme-exports: ${wrongPath.length} README import name(s) belong to ANOTHER package\n`);
    console.error('  The name is real. The PATH is wrong -- do not delete the symbol:\n');
    for (const f of wrongPath) {
      console.error(`    - ${f.file}:${f.line} -- '${f.exportName}' is exported by ${f.owners.join(', ')}, not by ${f.package}`);
    }
    console.error('');
  }

  if (unjudgeable.length > 0) {
    console.error(`❌  check-readme-exports: ${unjudgeable.length} self-import(s) could not be judged\n`);
    for (const f of unjudgeable) {
      const why =
        f.reason === 'unbuilt'
          ? `its type entry \`${f.declaredEntry}\` is not on disk -- run \`pnpm build\` first`
          : 'its package declares no `types` entry at all, so it publishes no named exports to import';
      console.error(`    - ${f.file}:${f.line} -- ${f.package} imports '${f.exportName}', but ${why}`);
    }
    console.error(`
This is a FAILURE and not a skip on purpose. Counting a missing type entry as
"exports nothing" would mark every one of these fabricated; skipping it would
shrink the judged population with nothing in the output to say so. Both are the
defect this gate exists to catch, one level up.
`);
  }

  if (vacuous.length > 0) {
    console.error('\n❌  check-readme-exports: the population COLLAPSED -- this run proves nothing\n');
    for (const v of vacuous) {
      console.error(`    - ${v.counter}: found ${v.value}, floor is ${v.floor}`);
    }
    console.error(`
A scan that finds nothing reports OK, and reads as coverage. Something upstream
of the judgement broke: \`git ls-files\` returned little or nothing, the fence
extraction stopped matching, or the packages were never built. Fix the walk. If
a floor is genuinely too high because the tree changed shape, move it in
\`FLOORS\` deliberately and say why -- never to make a red run green.
`);
  }

  console.error(`Census: ${summarise(result)}`);
  process.exit(1);
}

if (isEntrypoint(import.meta.url)) {
  const overrides = parseReadmeOverrides(process.argv.slice(2));
  if (process.argv.includes('--json')) {
    const result = scan(repoRoot(), { readmeOverrides: overrides });
    console.log(JSON.stringify({ census: result.census, findings: result.findings, vacuous: result.vacuous }, null, 2));
  } else if (process.argv.includes('--list')) {
    const result = scan(repoRoot(), { readmeOverrides: overrides });
    for (const b of result.bindings) {
      if (b.verdict === 'not-self') continue;
      const mark = b.verdict.padEnd(11);
      console.log(`${mark}  ${b.file}:${b.line}  ${b.exportName ?? `(${b.kind})`}  <- ${b.specifier}`);
    }
    console.log(`\n${summarise(result)}`);
  } else {
    main(overrides);
  }
}
