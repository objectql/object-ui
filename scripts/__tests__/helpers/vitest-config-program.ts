import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { rel, repoRoot, type WorkspacePackage } from './turbo-inputs';

/**
 * Derives a workspace package's **Vitest configuration program** — the set of
 * files Vitest reads in order to know how that package's tests run.
 *
 * Extracted as its own module rather than folded into the guard that consumes
 * it (`../turbo-test-inputs.test.ts`, objectui#4178) for two reasons. It is a
 * mechanism, not a policy: the guard decides what must be true of the result,
 * this file decides only what the result IS. And a derivation that can only be
 * exercised through the assertions it feeds is a derivation nobody can probe —
 * which is how a sweep quietly degrades to returning nothing while every
 * assertion over it stays green.
 *
 * ## The program
 *
 *  1. The config file Vitest resolves for the package's `test` script,
 *     following the script's own `--root` / `--config` flags and then Vitest's
 *     upward search.
 *  2. Every file that program statically imports by RELATIVE specifier,
 *     transitively.
 *  3. Every file it DESIGNATES through a file-valued Vitest option
 *     (`setupFiles`, `globalSetup`, `projects`, `workspace`) — themselves
 *     walked as program files, which is how `vitest.setup.tsx` pulls in the
 *     `vitest.setup.dom.tsx` it imports, and how the root config's `projects`
 *     entry pulls in `apps/console/vitest.config.ts` and the two
 *     `scripts/vite-*.ts` plugins that one imports.
 *
 * ## Narrowings, stated so they are visible rather than assumed
 *
 *  - THE CONFIGURATION PROGRAM, not the module closure of the tests. Vitest
 *    resolves `@object-ui/*` through the root config's alias table straight to
 *    other packages' `src/`, so the true read set of any package's test run is
 *    most of the repository. Requiring that is not a stricter version of this
 *    derivation, it is a different (and wrong) one — turbo's
 *    `dependsOn: ["^build"]` and per-package `$TURBO_DEFAULT$` already answer
 *    source. The failure being guarded is "change the SHARED TEST HARNESS, get
 *    a stale verdict", and the harness is exactly this program.
 *  - DESIGNATION IS KEY-DIRECTED, not every string in the file. A literal
 *    counts as a designated path only inside one of the file-valued options
 *    above. The root config also holds ~45 concrete test-file paths in
 *    `domTsTests` / `heavyDomTests`; those are `include` / `exclude` inputs to
 *    project definitions, covered by their own packages' inputs — not files
 *    this program reads. A literal under a designating key that LOOKS like a
 *    concrete source path and does not resolve throws rather than being
 *    skipped, so a renamed setup file cannot quietly leave the program.
 *  - BARE SPECIFIERS ARE NOT FOLLOWED. `vitest.setup.dom.tsx` imports
 *    `@object-ui/components` for its registration side effects; that is the
 *    alias closure of the first point, not a config file.
 *
 * Every narrowing errs the same way: toward requiring MORE files, and toward
 * throwing on a shape not understood. An approximation that comes out
 * "covered" is a file waved through while turbo does not hash it —
 * wrong-and-red is recoverable, wrong-and-green is the bug.
 */

// ── Which config file Vitest actually loads ─────────────────────────────────

/**
 * Vitest's config candidates, in its own precedence order.
 *
 * Mirrors `CONFIG_NAMES` x `CONFIG_EXTENSIONS` from `vitest/dist/chunks/
 * constants.*.js`. The order is load-bearing: `packages/components` has BOTH a
 * `vitest.config.ts` and a `vite.config.ts`, and only the first is the config
 * Vitest reads (the second arrives as one of its imports, which is a different
 * fact).
 */
export const CONFIG_NAMES = ['vitest.config', 'vite.config'];
export const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'];
export const CONFIG_FILES = CONFIG_NAMES.flatMap((name) =>
  CONFIG_EXTENSIONS.map((extension) => name + extension),
);

/** Extensions tried, in order, when a relative specifier carries none. */
export const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Vitest options whose value names FILES rather than globs or data. */
export const FILE_VALUED_OPTIONS = new Set(['setupFiles', 'globalSetup', 'projects', 'workspace']);

export interface VitestInvocation {
  /** The directory Vitest treats as its root (`--root`, else the package dir). */
  readonly root: string;
  /** An explicit `--config`, already resolved; `null` means "search". */
  readonly config: string | null;
}

/**
 * The Vitest invocation a package's `test` script performs.
 *
 * Every shape in the repo today is a single `vitest run [flags] [filters]`.
 * A script that runs a test command this parser cannot read throws rather than
 * being skipped: an unparsed script is an unswept program, and this guard's
 * whole value is that it cannot quietly sweep nothing.
 */
export function invocationFor(pkgDir: string, script: string): VitestInvocation {
  const commands = script
    .split('&&')
    .map((segment) => segment.trim())
    .filter((command) => /(?:^|\s)vitest(?:\s|$)/.test(command));

  if (commands.length !== 1) {
    throw new Error(
      `${rel(pkgDir)}: \`${script}\` does not run exactly one \`vitest\` command ` +
        `(found ${commands.length}). Teach invocationFor() how to read it — do not let the ` +
        `sweep skip this package.`,
    );
  }

  const tokens = commands[0].split(/\s+/);
  let root: string | null = null;
  let config: string | null = null;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const [flag, inlineValue] = token.includes('=')
      ? [token.slice(0, token.indexOf('=')), token.slice(token.indexOf('=') + 1)]
      : [token, null];
    if (flag === '--root' || flag === '-r') root = inlineValue ?? tokens[++i];
    else if (flag === '--config' || flag === '-c') config = inlineValue ?? tokens[++i];
  }

  const resolvedRoot = path.resolve(pkgDir, root ?? '.');
  return { root: resolvedRoot, config: config === null ? null : path.resolve(resolvedRoot, config) };
}

/**
 * The config file Vitest loads for an invocation.
 *
 * Reproduces `any(configFiles, { cwd: root })` — Vitest walks UP from its root,
 * and in each directory takes the first name in `CONFIG_FILES` order that
 * exists. This is why `packages/app-shell`, which has no config of its own,
 * still runs under the repo-root `vitest.config.mts`; verified against the real
 * binary, which refuses that invocation with the root config's own guard
 * message rather than running configless.
 *
 * The walk stops at the repo root: a config above it is not this repo's.
 */
export function resolveConfigFile(invocation: VitestInvocation): string | null {
  if (invocation.config !== null) {
    if (!fs.existsSync(invocation.config)) {
      throw new Error(`--config names ${rel(invocation.config)}, which does not exist.`);
    }
    return invocation.config;
  }
  let dir = invocation.root;
  for (;;) {
    for (const name of CONFIG_FILES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    if (dir === repoRoot) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ── Walking the configuration program ───────────────────────────────────────

/** Resolve a relative specifier to a file on disk, trying Vitest's extensions. */
function resolveRelative(fromFile: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...RESOLVE_EXTENSIONS.map((extension) => base + extension),
    ...RESOLVE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Does this literal look like a concrete source path rather than a glob or a name? */
function looksLikeSourcePath(literal: string): boolean {
  if (/[*?{}[\]]/.test(literal)) return false;
  return RESOLVE_EXTENSIONS.some((extension) => literal.endsWith(extension));
}

/**
 * Every relative module specifier a source file imports, and every path it
 * designates through a file-valued Vitest option.
 *
 * Parsed with TypeScript's own parser rather than regexes — `.mts`, `.tsx` and
 * plain `.mjs` all land here, and a specifier inside a comment or a string must
 * not count.
 */
export function programEdges(file: string): { imports: string[]; designated: string[] } {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    file.endsWith('x') ? ts.ScriptKind.TSX : undefined,
  );

  const imports: string[] = [];
  const designated: string[] = [];

  const literalValue = (node: ts.Node): string | null =>
    ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;

  /** Collect every literal under a file-valued option's value. */
  const collectDesignated = (node: ts.Node): void => {
    const value = literalValue(node);
    if (value !== null) {
      designated.push(value);
      return;
    }
    node.forEachChild(collectDesignated);
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const value = literalValue(node.moduleSpecifier);
      if (value !== null) imports.push(value);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0
    ) {
      const value = literalValue(node.arguments[0]);
      if (value !== null) imports.push(value);
    } else if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      FILE_VALUED_OPTIONS.has(node.name.text)
    ) {
      collectDesignated(node.initializer);
    }
    node.forEachChild(visit);
  };
  visit(source);

  return { imports, designated };
}

/**
 * Every file a package's Vitest configuration program reads from outside the
 * package directory, repo-relative and sorted.
 */
export function outOfPackageFiles(pkg: WorkspacePackage): string[] {
  const entry = resolveConfigFile(invocationFor(pkg.dir, pkg.script));
  if (entry === null) return [];

  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (path.relative(pkg.dir, file).startsWith('..')) found.add(rel(file));

    const { imports, designated } = programEdges(file);

    for (const specifier of imports) {
      // Bare specifiers are node_modules or workspace packages — the alias
      // closure this guard deliberately does not follow (see the docblock).
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveRelative(file, specifier);
      if (resolved === null) {
        throw new Error(
          `${rel(file)} imports ${JSON.stringify(specifier)}, which resolves to no file on disk. ` +
            `Teach resolveRelative() about it rather than letting the program shrink silently.`,
        );
      }
      queue.push(resolved);
    }

    for (const literal of designated) {
      // A designated path is spelled either relative to the designating file
      // (`'../../vitest.setup.tsx'`) or as `path.resolve(<this file's dir>, …)`
      // — `__dirname` / `import.meta.dirname`, which IS that directory. Both
      // resolve the same way, so the base is the file, not the cwd.
      const resolved = resolveRelative(file, literal);
      if (resolved !== null) {
        queue.push(resolved);
        continue;
      }
      if (looksLikeSourcePath(literal)) {
        throw new Error(
          `${rel(file)} designates ${JSON.stringify(literal)} through a file-valued Vitest ` +
            `option, and it resolves to no file on disk. A renamed setup file must go red here, ` +
            `not drop out of the program.`,
        );
      }
    }
  }
  return [...found].sort();
}
