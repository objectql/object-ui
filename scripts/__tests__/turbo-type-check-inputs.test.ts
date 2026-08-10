import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * objectui#3514 — turbo's `type-check` `inputs` list is hand-maintained, and it
 * has now been wrong twice for the same structural reason: a package's tsc
 * program reaches OUTSIDE its own package directory.
 *
 * Turbo hashes a task from its `inputs`. `$TURBO_DEFAULT$` covers only files
 * inside the package directory, and `globalDependencies` is unset — so any file
 * the program reads from elsewhere in the repo is invisible to the cache key.
 * When such a file changes, turbo does not re-run the task; it REPLAYS the
 * previous verdict. That is a gate whose answer depends on cache state rather
 * than on the code, which is the "looks like enforcement, isn't" failure class
 * this repo has already paid for repeatedly (objectui#3009, objectui#3181,
 * objectui#3494). It is not local-only either: `.github/workflows/ci.yml`
 * persists `.turbo/cache` through `actions/cache`, so one poisoned entry rides
 * into later runs.
 *
 * The two known drifts:
 *
 *  1. `apps/console`'s `tsconfig.node.json` lists `../../scripts/vite-*.ts` —
 *     closed by hand with a `$TURBO_ROOT$/scripts/vite-*.ts` entry.
 *  2. objectui#3476 / PR #3513 added `../../vitest.config.mts` to that same
 *     project, and the `inputs` list did not follow. Measured on that branch: a
 *     real `TS2769` planted in the root config replayed `FULL TURBO` green.
 *     Closed by hand again, with `$TURBO_ROOT$/vitest.config.mts`.
 *
 * Two hand-fixes for one structural cause is this repo's threshold for a gate,
 * so this file DERIVES the requirement instead of restating it. It walks every
 * workspace package's real type-check program the way `tsc` itself assembles it
 * — the projects the `type-check` script actually drives, their `include`/
 * `files` root set, the configs they `extends`, and (for `tsc -b`) their project
 * references — collects every file that lands outside the package directory,
 * and asserts turbo's `inputs` cover each one. A THIRD instance of this class
 * cannot land quietly: a new out-of-package include with no matching input goes
 * red naming the file.
 *
 * The derivation immediately found a third instance, wider than the two known
 * ones: nearly every package's `tsconfig.json` extends the repo-root
 * `tsconfig.json` (and `examples/byo-backend-console` extends the root
 * `tsconfig.base.json`), and neither was in `inputs`. Compiler options are as
 * load-bearing as source — flipping `strict` there changes every package's
 * verdict — so those two entries ship with this guard.
 *
 * Scope, stated so the narrowing is visible rather than assumed:
 *
 *  - ROOT FILES, not the import closure. This asserts over the files tsc is
 *    given (config `include`/`files`/`extends`/`references`), not over every
 *    module they transitively import. Building 40+ real programs to resolve
 *    imports needs a built workspace and minutes of CPU per run. The narrowing
 *    is sound for the failure it guards: a composite project must list every
 *    file in its program, which is exactly why both known drifts were `include`
 *    entries in the first place.
 *  - Cross-package references are still checked. If one package's program
 *    reaches into another package's directory, that is reported like any other
 *    out-of-package file rather than waved through on the assumption that
 *    turbo's `dependsOn: ["^build"]` covers it — `^build` covers declared
 *    DEPENDENCIES, and a tsconfig reference is not required to be one.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const turboConfigPath = path.join(repoRoot, 'turbo.json');
const workspaceConfigPath = path.join(repoRoot, 'pnpm-workspace.yaml');

/** The turbo task this guard is about. */
const TASK = 'type-check';

/**
 * `$TURBO_ROOT$` inputs that are deliberately NOT derivable from any package's
 * tsconfig, each with the reason it cannot be.
 *
 * Empty, and worth keeping that way: an entry nothing derives is an entry
 * nobody can verify, and a glob that matches nothing at all reads as coverage
 * while providing none — the precise shape of the phantom `vitest.setup.ts`
 * include objectui#3476 found in `apps/console/tsconfig.node.json`.
 */
const INPUTS_NOT_DERIVABLE: ReadonlyMap<string, string> = new Map();

/** POSIX-separated, repo-relative. The one path spelling this file compares in. */
function rel(absolute: string): string {
  return path.relative(repoRoot, absolute).split(path.sep).join('/');
}

// ── Workspace discovery ──────────────────────────────────────────────────────

/**
 * Package directories, derived from `pnpm-workspace.yaml` rather than a
 * hardcoded group list.
 *
 * Only the two entry shapes the file actually uses are understood (`dir/*` and
 * a bare `dir`); anything else throws. A workspace layout this guard silently
 * failed to walk would quietly shrink its own coverage back to nothing, which
 * is the failure mode it exists to prevent.
 */
function workspacePackageDirs(): string[] {
  const yaml = fs.readFileSync(workspaceConfigPath, 'utf8');
  const patterns: string[] = [];
  let inPackages = false;
  for (const line of yaml.split('\n')) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages) {
      const item = line.match(/^\s+-\s*['"]?([^'"#]+?)['"]?\s*$/);
      if (item) {
        patterns.push(item[1]);
        continue;
      }
      if (line.trim() !== '') break;
    }
  }
  expect(patterns.length, 'pnpm-workspace.yaml must declare at least one package pattern').
    toBeGreaterThan(0);

  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const group = path.join(repoRoot, pattern.slice(0, -2));
      if (!fs.existsSync(group)) continue;
      for (const entry of fs.readdirSync(group, { withFileTypes: true })) {
        const dir = path.join(group, entry.name);
        if (entry.isDirectory() && fs.existsSync(path.join(dir, 'package.json'))) dirs.push(dir);
      }
      continue;
    }
    if (!pattern.includes('*')) {
      const dir = path.join(repoRoot, pattern);
      if (fs.existsSync(path.join(dir, 'package.json'))) dirs.push(dir);
      continue;
    }
    throw new Error(
      `pnpm-workspace.yaml pattern ${JSON.stringify(pattern)} is a glob shape this guard does ` +
        `not understand. Teach workspacePackageDirs() about it — do not let the sweep skip it.`,
    );
  }
  return dirs.sort();
}

// ── The type-check program, as the scripts actually drive it ─────────────────

interface TscInvocation {
  /** Absolute path of the tsconfig this segment compiles. */
  readonly project: string;
  /** `tsc -b` / `--build`, which also compiles the project's references. */
  readonly build: boolean;
}

/**
 * The tsc projects a package's `type-check` script drives.
 *
 * Every shape in the repo today is a `&&` chain of `tsc` calls: a bare
 * `tsc --noEmit` (the package's own `tsconfig.json`), `tsc -p <config>` for the
 * `tsconfig.test.json` / `tsconfig.typetests.json` companions, and
 * `apps/console`'s `tsc -b tsconfig.node.json --force`. A segment that runs tsc
 * in a shape this parser cannot read throws rather than being skipped: an
 * unparsed segment is an unswept program.
 */
function invocationsFor(pkgDir: string, script: string): TscInvocation[] {
  const invocations: TscInvocation[] = [];
  for (const segment of script.split('&&')) {
    const command = segment.trim();
    if (!/(?:^|\s)tsc(?:\s|$)/.test(command)) continue;

    const build = /(?:^|\s)(?:-b|--build)(?:\s|$)/.test(command);
    const named = command.match(/(?:^|\s)(?:-p|--project|-b|--build)\s+([^\s]+)/);
    if (build && !named) {
      throw new Error(
        `${rel(pkgDir)}: \`${command}\` builds without naming a project. Teach ` +
          `invocationsFor() how to resolve it.`,
      );
    }
    const project = path.resolve(pkgDir, named ? named[1] : 'tsconfig.json');
    if (!fs.existsSync(project)) {
      throw new Error(`${rel(pkgDir)}: \`${command}\` drives ${rel(project)}, which does not exist.`);
    }
    invocations.push({ project, build });
  }
  return invocations;
}

/**
 * A tsconfig parsed the way `tsc` parses it, so `fileNames` is the real program
 * root set rather than a re-implementation of TypeScript's glob semantics.
 *
 * `readJsonConfigFile` (not `readConfigFile`) is what makes `extendedSourceFiles`
 * available — the `extends` chain, which is the half of "the program" that a
 * file-list-only reading misses.
 */
function parseProject(configPath: string): { parsed: ts.ParsedCommandLine; extended: string[] } {
  const sourceFile = ts.readJsonConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    sourceFile,
    ts.sys,
    path.dirname(configPath),
    undefined,
    configPath,
  );
  const fatal = parsed.errors.find((e) => e.category === ts.DiagnosticCategory.Error);
  expect(
    fatal && `${rel(configPath)}: ${ts.flattenDiagnosticMessageText(fatal.messageText, ' ')}`,
    `${rel(configPath)} must parse as a tsconfig`,
  ).toBeFalsy();
  return { parsed, extended: sourceFile.extendedSourceFiles ?? [] };
}

/**
 * Every file a package's type-check program reads from outside the package
 * directory, repo-relative and sorted.
 */
function outOfPackageFiles(pkgDir: string, script: string): string[] {
  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = invocationsFor(pkgDir, script);

  while (queue.length > 0) {
    const { project, build } = queue.shift()!;
    if (seen.has(project)) continue;
    seen.add(project);

    const { parsed, extended } = parseProject(project);
    // The config file itself belongs to the program too — a referenced or
    // extended config living outside the package is exactly as load-bearing as
    // a source file, and just as invisible to `$TURBO_DEFAULT$`.
    for (const file of [project, ...extended, ...parsed.fileNames]) {
      if (path.relative(pkgDir, file).startsWith('..')) found.add(rel(file));
    }

    // `tsc -b` compiles referenced projects as well; `tsc -p` does not.
    if (build) {
      for (const reference of parsed.projectReferences ?? []) {
        const target = reference.path.endsWith('.json')
          ? reference.path
          : path.join(reference.path, 'tsconfig.json');
        queue.push({ project: target, build: true });
      }
    }
  }
  return [...found].sort();
}

/** Every workspace package that turbo's `type-check` task actually runs for. */
function packagesWithTypeCheck(): { name: string; dir: string; script: string }[] {
  const out: { name: string; dir: string; script: string }[] = [];
  for (const dir of workspacePackageDirs()) {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    const script = manifest.scripts?.[TASK];
    if (script) out.push({ name: manifest.name ?? rel(dir), dir, script });
  }
  return out;
}

// ── turbo.json inputs ────────────────────────────────────────────────────────

/**
 * The `$TURBO_ROOT$`-anchored `inputs` of the task, as repo-relative globs.
 *
 * Everything else in the list is package-relative and therefore cannot reach
 * outside the package directory — turbo has no `..` escape, which is why
 * `$TURBO_ROOT$` exists at all.
 */
function rootAnchoredInputs(): string[] {
  const turbo = JSON.parse(fs.readFileSync(turboConfigPath, 'utf8')) as {
    tasks?: Record<string, { inputs?: string[] }>;
  };
  const task = turbo.tasks?.[TASK];
  expect(task, `turbo.json must define a \`${TASK}\` task`).toBeTruthy();
  const inputs = task?.inputs ?? [];
  expect(inputs, `turbo.json \`${TASK}\` must declare \`inputs\``).not.toHaveLength(0);

  return inputs
    .filter((entry) => entry.startsWith('$TURBO_ROOT$/'))
    .map((entry) => entry.slice('$TURBO_ROOT$/'.length));
}

/**
 * A turbo input glob as a regular expression.
 *
 * Deliberately narrow — `**`, `*` and `?` only. Any richer syntax (brace
 * alternation, character classes, `!` negation) throws instead of being
 * approximated, because an approximated match that comes out TRUE is a file
 * this guard would wave through while turbo does not hash it. Wrong-and-red is
 * recoverable; wrong-and-green is the bug.
 */
function globToRegExp(glob: string): RegExp {
  if (/[!{}[\]()+@]/.test(glob)) {
    throw new Error(
      `turbo input ${JSON.stringify(glob)} uses glob syntax this guard does not implement. ` +
        `Teach globToRegExp() about it rather than letting it guess.`,
    );
  }
  let pattern = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        // `**/` spans zero or more directories; a trailing `**` spans the rest.
        if (glob[i + 2] === '/') {
          pattern += '(?:[^/]+/)*';
          i += 2;
        } else {
          pattern += '.*';
          i += 1;
        }
      } else {
        pattern += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      pattern += '[^/]';
      continue;
    }
    pattern += char.replace(/[.^$|\\]/g, '\\$&');
  }
  return new RegExp(`^${pattern}$`);
}

// ── The derivation, computed once ────────────────────────────────────────────

const PACKAGES = packagesWithTypeCheck();
const DERIVED = PACKAGES.map((pkg) => ({ ...pkg, outside: outOfPackageFiles(pkg.dir, pkg.script) }));
const ROOT_INPUTS = rootAnchoredInputs();
const MATCHERS = ROOT_INPUTS.map((glob) => ({ glob, re: globToRegExp(glob) }));

describe('turbo `type-check` inputs cover every out-of-package file (objectui#3514)', () => {
  /**
   * The guard's own liveness. Every assertion below is vacuously true if the
   * sweep found no packages or no out-of-package files — and a sweep that
   * silently degrades to nothing is precisely the failure this file exists to
   * make impossible.
   */
  it('sweeps the whole workspace and finds a non-empty out-of-package set', () => {
    expect(PACKAGES.length).toBeGreaterThan(20);
    const reaching = DERIVED.filter((pkg) => pkg.outside.length > 0);
    expect(
      reaching.map((pkg) => pkg.name),
      'no package program reaches outside its directory — the derivation has stopped working, ' +
        'because at minimum apps/console lists ../../scripts/vite-*.ts',
      ).not.toHaveLength(0);
  });

  it.each(DERIVED.filter((pkg) => pkg.outside.length > 0).map((pkg) => [pkg.name, pkg] as const))(
    '%s',
    (_name, pkg) => {
      const uncovered = pkg.outside.filter((file) => !MATCHERS.some(({ re }) => re.test(file)));
      expect(
        uncovered,
        `${pkg.name}'s type-check program reads ${uncovered.join(', ')} from outside ` +
          `${rel(pkg.dir)}, and turbo hashes ${TASK} from ${JSON.stringify(ROOT_INPUTS)} plus the ` +
          `package directory. Turbo will replay a stale verdict when ${uncovered.length === 1 ? 'that file changes' : 'those files change'}. ` +
          `Add ${uncovered.map((file) => `"$TURBO_ROOT$/${file}"`).join(', ')} to turbo.json's ` +
          `\`${TASK}\` inputs.`,
      ).toEqual([]);
    },
  );

  /**
   * The other direction. A `$TURBO_ROOT$` entry matching nothing is not
   * harmless: it reads as coverage, survives review, and quietly stops covering
   * the file it was written for the moment that file is renamed.
   */
  it('every $TURBO_ROOT$ input matches at least one file on disk', () => {
    const onDisk = new Set<string>();
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs);
        else onDisk.add(rel(abs));
      }
    };
    walk(repoRoot);

    for (const { glob, re } of MATCHERS) {
      expect(
        [...onDisk].some((file) => re.test(file)),
        `turbo.json \`${TASK}\` input "$TURBO_ROOT$/${glob}" matches no file in the repo. It is ` +
          `hashing nothing while reading as coverage — fix the glob or delete the entry.`,
      ).toBe(true);
    }
  });

  /**
   * And the entry is not merely non-empty but actually earned: some package's
   * program reads a file it matches. This is what keeps the list SHRINKING —
   * when a program stops reaching out, its input entry has to go with it.
   */
  it('every $TURBO_ROOT$ input is required by some package program', () => {
    const derivedFiles = [...new Set(DERIVED.flatMap((pkg) => pkg.outside))];
    for (const { glob, re } of MATCHERS) {
      if (INPUTS_NOT_DERIVABLE.has(glob)) continue;
      expect(
        derivedFiles.filter((file) => re.test(file)),
        `turbo.json \`${TASK}\` input "$TURBO_ROOT$/${glob}" is not required by any package's ` +
          `type-check program any more. Delete it, or record why it cannot be derived in ` +
          `INPUTS_NOT_DERIVABLE.`,
      ).not.toHaveLength(0);
    }
  });
});
