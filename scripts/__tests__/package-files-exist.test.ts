import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3663: nothing in this repo ever checked that the paths a package
 * PROMISES to ship in `package.json` `files` actually exist on disk.
 *
 * npm skips a missing `files` entry **silently** — no error, no warning, exit
 * code 0. `npm publish`, `npm pack` and CI are all green while the tarball
 * quietly lacks something the manifest says is in it. There is no output to
 * read, so the drift is not "hard to notice", it is *invisible*.
 *
 * objectui#3647 is that mechanism's specimen: `@object-ui/plugin-tree` listed
 * `"LICENSE"` in `files` while `packages/plugin-tree/LICENSE` did not exist.
 * Every published tarball shipped without the MIT text its own manifest
 * promised, for the package's entire life, and the only reason anyone found out
 * is that a human diffed all 39 packages' `files` fields by hand while chasing
 * an unrelated README problem (objectui#3622). PR #3662 restored the file; this
 * guard is what makes the next one impossible to miss.
 *
 * ## Why the check cannot simply be "the path exists"
 *
 * 40 of the 159 declared entries are BUILD OUTPUT (`dist`, `apps/console`'s
 * `plugin.js`/`plugin.d.ts`). In an unbuilt worktree — which is what CI has when
 * this test runs, and what a contributor has after a fresh clone — those are
 * legitimately absent. Demanding they exist would make the guard fail for
 * everyone always, and a guard that is always red gets deleted or `.skip`ped.
 *
 * So an absent entry is forgiven only when the repo has ALREADY DECLARED,
 * elsewhere and for its own reasons, that the path is generated:
 *
 *   1. it is git-ignored (`.gitignore` says the build writes here), AND
 *   2. it is not git-tracked (a force-added ignored file is a real file and
 *      must exist), AND
 *   3. its package has a `build` script (a package that builds nothing cannot
 *      be about to generate anything).
 *
 * That criterion is DERIVED, never hand-listed. The alternative — a whitelist of
 * blessed entry names in this file — would have to be edited to stay correct,
 * and the edit that silences a real defect looks exactly like the edit that
 * teaches the guard about a new build directory. Deriving it means the only way
 * to exempt a path is to state in `.gitignore` that a build produces it, which
 * is a reviewable claim that is wrong in an obvious way when it is wrong.
 *
 * ## What this guard deliberately does NOT prove
 *
 * That a build output is really produced. Proving that needs an actual build,
 * which is not a static check's job; `dist` is taken on the repo's word here.
 * The gap is narrow and named on purpose: the whole objectui#3647 family —
 * source files (LICENSE, README, CHANGELOG, `src`, `templates`) declared and
 * absent — is inside this guard, and that is where the drift has actually
 * happened.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Entries that are declared, absent, and NOT excused by the derived criterion
 * above — i.e. real objectui#3663 defects that were already on `main` when this
 * guard landed.
 *
 * A RATCHET, not an allowlist, in the shape
 * `scripts/i18n-call-site-key-baseline.json` established: a NEW violation fails
 * the build, and an entry here whose defect is GONE fails it too, so this map
 * can only shrink. Fix one by deleting the stale `files` entry from the
 * package's `package.json` and deleting its line here.
 *
 * Currently empty, which is the intended resting state — the ratchet still
 * fails on any NEW violation. It landed carrying two entries measured on
 * main@dae1ac41e, `packages/cli/templates` and
 * `packages/create-plugin/templates`: vestigial declarations for directories
 * that never existed on disk, never existed anywhere in this repo's git
 * history, and that no build step or workflow creates. Both packages inline
 * their templates instead. objectui#3665 banked both by deleting the two
 * `files` entries, and deleting a declaration retires a baseline line exactly
 * as creating the file would.
 */
const KNOWN_MISSING: Record<string, { issue: string }> = {};

interface WorkspacePackage {
  name: string;
  dir: string;
  private: boolean;
  files: string[] | undefined;
  hasBuildScript: boolean;
}

/**
 * The `packages:` globs from `pnpm-workspace.yaml`, read rather than hardcoded
 * so a new workspace root is covered the day it is added.
 *
 * Understands only the two shapes the file actually uses (`dir/*` and a bare
 * `dir`); anything else throws instead of being skipped. A guard that silently
 * stops looking at part of the workspace is worse than no guard, because it
 * goes on reporting success over a shrinking surface.
 */
function workspaceGlobs(): string[] {
  const yaml = fs.readFileSync(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => /^packages:\s*$/.test(l));
  expect(start, '`pnpm-workspace.yaml` must still declare a top-level `packages:` key').toBeGreaterThan(-1);

  const globs: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    // A non-indented line ends the `packages:` block.
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

function readWorkspacePackages(): WorkspacePackage[] {
  const found: WorkspacePackage[] = [];
  for (const glob of workspaceGlobs()) {
    let dirs: string[];
    if (glob.endsWith('/*')) {
      const parent = path.join(repoRoot, glob.slice(0, -2));
      dirs = fs.existsSync(parent)
        ? fs
            .readdirSync(parent)
            .map((d) => path.join(parent, d))
            .filter((d) => fs.statSync(d).isDirectory())
        : [];
    } else if (!glob.includes('*')) {
      dirs = [path.join(repoRoot, glob)];
    } else {
      throw new Error(`Unsupported workspace glob ${JSON.stringify(glob)} — teach this guard how to expand it.`);
    }

    for (const dir of dirs) {
      const pkgPath = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgPath)) continue;
      const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (!json.name) continue;
      found.push({
        name: json.name,
        dir: path.relative(repoRoot, dir).split(path.sep).join('/'),
        private: Boolean(json.private),
        files: Array.isArray(json.files) ? json.files : undefined,
        hasBuildScript: Boolean(json.scripts?.build),
      });
    }
  }
  return found;
}

/**
 * Every path git has in its index, plus every ancestor directory of one, so a
 * DIRECTORY entry such as `src` can be asked the same question as a file entry.
 *
 * Fails loudly if git is not usable. Returning an empty set instead would make
 * every entry look untracked, which quietly WIDENS the exemption below — the
 * failure mode this whole file exists to prevent.
 */
function gitTrackedPaths(): Set<string> {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  if (result.status !== 0) {
    throw new Error(
      `\`git ls-files\` failed in ${repoRoot} (status ${result.status}): ${result.stderr}\n` +
        'This guard derives its build-output exemption from git, so it fails closed rather than passing over an unknown tree.',
    );
  }
  const tracked = new Set<string>();
  for (const file of result.stdout.split('\0')) {
    if (!file) continue;
    tracked.add(file);
    let dir = path.posix.dirname(file);
    while (dir && dir !== '.') {
      tracked.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  return tracked;
}

/**
 * Which of `candidates` `.gitignore` excludes, resolved in ONE `git
 * check-ignore` call. Same fail-closed contract as {@link gitTrackedPaths}:
 * exit 0 means "some were ignored", 1 means "none were", anything else is an
 * error rather than an empty answer.
 */
function gitIgnoredPaths(candidates: string[]): Set<string> {
  if (candidates.length === 0) return new Set();
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd: repoRoot,
    input: candidates.join('\n'),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `\`git check-ignore\` failed in ${repoRoot} (status ${result.status}): ${result.stderr}\n` +
        'This guard derives its build-output exemption from git, so it fails closed rather than passing over an unknown tree.',
    );
  }
  return new Set(result.stdout.split('\n').filter(Boolean));
}

interface DeclaredEntry {
  pkg: WorkspacePackage;
  entry: string;
  /** Repo-relative, forward-slashed — the key used by git and by KNOWN_MISSING. */
  relPath: string;
  onDisk: boolean;
}

const packages = readWorkspacePackages();
const packagesWithFiles = packages.filter((p) => p.files !== undefined);

const declared: DeclaredEntry[] = packagesWithFiles.flatMap((pkg) =>
  pkg.files!.map((entry) => {
    const relPath = path.posix.join(pkg.dir, entry);
    return { pkg, entry, relPath, onDisk: fs.existsSync(path.join(repoRoot, relPath)) };
  }),
);

const tracked = gitTrackedPaths();
const ignored = gitIgnoredPaths(declared.filter((d) => !d.onDisk).map((d) => d.relPath));

/** An absent entry the repo has already declared to be build output. */
function isDeclaredBuildOutput(d: DeclaredEntry): boolean {
  return ignored.has(d.relPath) && !tracked.has(d.relPath) && d.pkg.hasBuildScript;
}

const missing = declared.filter((d) => !d.onDisk && !isDeclaredBuildOutput(d));

describe('package.json `files` entries exist on disk (objectui#3663)', () => {
  it('discovers the workspace (guard cannot pass by finding nothing)', () => {
    // npm's silence is the whole hazard here, so a guard that inspects an empty
    // list would reproduce it exactly: green output, nothing checked. These
    // floors sit just under the measured values on main@dae1ac41e (40 packages
    // declaring `files`, 159 entries) so that losing a workspace root, a broken
    // glob parser or a moved directory is a failure and not a quiet pass.
    expect(packagesWithFiles.length).toBeGreaterThanOrEqual(38);
    expect(declared.length).toBeGreaterThanOrEqual(150);

    // The specimen package must be in scope by name: if plugin-tree ever drops
    // out of the scan, the guard has stopped watching the exact spot that
    // motivated it.
    const pluginTree = packagesWithFiles.find((p) => p.name === '@object-ui/plugin-tree');
    expect(pluginTree, '@object-ui/plugin-tree must still be scanned').toBeDefined();
    expect(pluginTree!.files).toContain('LICENSE');
  });

  it('declares no glob patterns (this guard resolves literal paths only)', () => {
    // npm's `files` accepts globs and `!` negations. None are used today, and
    // `fs.existsSync('dist/**')` is false for a perfectly healthy package — so
    // the first glob to land here would be reported as a missing file. Naming
    // that as its own failure means the next author gets "teach the guard" and
    // not a baffling false positive on a path they know is fine.
    const globbed = declared.filter((d) => /[*?[\]{}!]/.test(d.entry)).map((d) => `${d.pkg.name}: ${d.entry}`);

    expect(
      globbed,
      [
        'A `files` entry uses glob syntax, which this guard cannot resolve.',
        'Teach scripts/__tests__/package-files-exist.test.ts to expand globs before adding one.',
        '',
        ...globbed,
      ].join('\n'),
    ).toEqual([]);
  });

  it('every declared entry exists on disk, or is declared build output', () => {
    const violations = missing
      .filter((d) => !Object.hasOwn(KNOWN_MISSING, d.relPath))
      .map(
        (d) =>
          `${d.pkg.name}${d.pkg.private ? ' (private)' : ''} declares "${d.entry}" in package.json "files", ` +
          `but ${d.relPath} does not exist` +
          (d.pkg.hasBuildScript ? '' : ' (and the package has no `build` script that could create it)'),
      );

    expect(
      violations,
      [
        'A package promises to publish a path that is not there.',
        'npm skips a missing `files` entry SILENTLY — no error, no warning, exit code 0 — so',
        'the tarball ships without it and nothing downstream ever says so (objectui#3647/#3663).',
        '',
        'Fix it in whichever direction is true:',
        '  - the file should ship  -> create it (that was the fix in PR #3662)',
        '  - the file is obsolete  -> delete the entry from `files`',
        '  - it is build output    -> git-ignore the path and give the package a `build` script,',
        '                             which is how this guard recognises generated paths',
        '',
        ...violations,
      ].join('\n'),
    ).toEqual([]);
  });

  it('the objectui#3647 baseline only shrinks', () => {
    // The other half of a ratchet. Without this, a fixed entry could sit here
    // forever and the next reader would take a stale line as a live defect —
    // and the file would slowly turn into the permanent allowlist it is not.
    const stillMissing = new Set(missing.map((d) => d.relPath));
    const stale = Object.keys(KNOWN_MISSING).filter((relPath) => !stillMissing.has(relPath));

    // WHY an entry stopped being a live defect, reported per entry instead of
    // assumed. An entry leaves `missing` by exactly the three routes the
    // assertion above sanctions as fixes, and only the first makes the path
    // resolve — so a message hardcoded to "the path now resolves" is wrong two
    // times in three, and sends the reader off to `ls` a path that is still
    // absent (objectui#3674, seen for real in objectui#3665). Derived from the
    // same `declared`/`missing` data the predicate reads, so it cannot drift
    // from the verdict it explains.
    const causeOf = (relPath: string): string => {
      const entry = declared.find((d) => d.relPath === relPath);
      if (!entry)
        return 'no `files` entry declares it: the declaration was deleted, its package left the workspace, or this baseline key never matched one';
      if (entry.onDisk) return 'the path now exists on disk';
      return 'still declared and still absent, but now excused as build output (git-ignored, untracked, package has a `build` script)';
    };

    expect(
      stale,
      [
        'A KNOWN_MISSING entry no longer describes a live defect.',
        'Delete its line from KNOWN_MISSING in this file to bank the progress — that is the',
        'right move under every cause below.',
        '',
        'The cause is reported per entry rather than assumed, because only one of the three',
        'routes out of the baseline makes the path resolve; do not read a stale line as',
        'proof that the file is now there.',
        '',
        ...stale.map((relPath) => `${relPath} (${KNOWN_MISSING[relPath].issue}) — ${causeOf(relPath)}`),
      ].join('\n'),
    ).toEqual([]);
  });

  it('pins the package fixed in objectui#3647', () => {
    // The general assertion above covers this too, but naming it means a revert
    // points straight at the issue that explains why the file has to be there.
    const licensePath = path.join(repoRoot, 'packages/plugin-tree/LICENSE');
    expect(
      fs.existsSync(licensePath),
      '@object-ui/plugin-tree lists "LICENSE" in `files`; PR #3662 added packages/plugin-tree/LICENSE ' +
        'because every published tarball had been shipping without it. npm will not complain if it goes missing again.',
    ).toBe(true);
  });
});
