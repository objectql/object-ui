import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * objectui#3944 — every `resolve.alias` target in the root `vitest.config.mts`
 * must exist on disk.
 *
 * Four entries pointed at directories that are not in the workspace:
 * `@object-ui/engine` -> `packages/engine/src`, `@object-ui/renderer` ->
 * `packages/renderer/src`, `@object-ui/plugin-aggrid` ->
 * `packages/plugin-aggrid/src`, `@object-ui/ui` -> `packages/ui/src`.
 * `packages/plugin-aggrid` was published once (the CHANGELOGs still record
 * `@object-ui/plugin-aggrid@0.4.1`) and then removed; the other three never had
 * a package at all. Nothing imported any of the four, so nothing ever resolved
 * through them and no test went red — the entries were inert.
 *
 * Why that still earns a mechanical guard rather than a one-off deletion: this
 * is the same defect class as objectui#3904 — configuration that *declares* a
 * capability the dependency graph does not have. There, `@object-ui/layout` sat
 * in `apps/site`'s `transpilePackages` while being neither a dependency nor an
 * import, read to every reader as "already wired up", and the Playground kept
 * painting the red OBJUI-001 panel until someone drove it in a browser (#3787).
 * A dead entry is worse than a missing one, because it reads as connected. The
 * guard PR #3942 added there is this file's shape sibling; this is the same
 * check for the alias table, so entry #44 cannot arrive the same way.
 *
 * Read from the SOURCE TEXT, not by importing the config: `vitest.config.mts`
 * runs `assertCanonicalVitestInvocation()` at module scope and pulls in the
 * whole Vitest config surface. A unit test that only needs a list of strings
 * should not boot that (the same reason #3904's guard parses
 * `apps/site/next.config.mjs` as text).
 *
 * Reverse verification (direction predicted before running — plain RED, no
 * inversion: the alias table is the sole input, and an added bad entry can only
 * add a finding): add `'@object-ui/ghost-3944'` pointing at
 * `packages/ghost-3944/src` and the "target directory that exists" case fails
 * naming that entry, while the two coverage cases stay green (a well-formed
 * entry is still parsed).
 *
 * Deliberately NOT in scope: `tsconfig.json`'s `paths` carries dead entries of
 * the same shape for three of the four names. That file is outside this issue's
 * surface and belongs to whoever triages it; this guard reads the alias table
 * only, and says so rather than half-covering a second file.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(repoRoot, 'vitest.config.mts');
const configSource = fs.readFileSync(CONFIG_PATH, 'utf8');

interface AliasEntry {
  /** The bare specifier being aliased, e.g. `@object-ui/core`. */
  specifier: string;
  /** The repo-relative target as written in the config. */
  target: string;
}

/**
 * The text of the `resolve.alias` object literal, brace-balanced from its
 * opening `{` so a nested object in a future entry cannot truncate it.
 */
function aliasBlock(): string {
  const header = /alias:\s*\{/.exec(configSource);
  if (!header) throw new Error('vitest.config.mts has no resolve.alias object');

  const open = header.index + header[0].length - 1;
  let depth = 0;
  for (let i = open; i < configSource.length; i += 1) {
    const ch = configSource[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return configSource.slice(open + 1, i);
    }
  }
  throw new Error('vitest.config.mts: resolve.alias object is never closed');
}

/** `//` line comments stripped, so they cannot be miscounted as entries. */
const block = aliasBlock()
  .split('\n')
  .filter((line) => !/^\s*\/\//.test(line))
  .join('\n');

const ENTRY = /(['"])([^'"]+)\1\s*:\s*path\.resolve\(\s*__dirname\s*,\s*(['"])([^'"]+)\3\s*\)/g;

const entries: AliasEntry[] = [...block.matchAll(ENTRY)].map((m) => ({
  specifier: m[2],
  target: m[4],
}));

describe('objectui#3944 — root vitest.config.mts alias table', () => {
  it('parses a plausible table (a zero-hit parse would make every case below vacuous)', () => {
    // The failure mode this guards: the config is reformatted, the regex stops
    // matching, `entries` becomes [] and the existence check passes while
    // checking nothing — the empty-fixture trap.
    expect(entries.length).toBeGreaterThanOrEqual(30);
    expect(entries.map((e) => e.specifier)).toContain('@object-ui/core');
  });

  it('parses EVERY key in the block, so no entry can dodge the existence check', () => {
    // Coverage, not style: an entry whose value is written in some other form
    // (a bare string, a template literal, a helper call) would be skipped by
    // ENTRY and silently escape. Compare the parsed count against the number of
    // keys actually present.
    const keys = [...block.matchAll(/^\s*(['"])([^'"]+)\1\s*:/gm)].map((m) => m[2]);

    expect(
      keys.filter((key) => !entries.some((e) => e.specifier === key)),
      'These alias keys are not written as `path.resolve(__dirname, "<relative path>")`, so the ' +
        'target-exists check below never sees them. Use that form, or teach this test the new one.'
    ).toEqual([]);
    expect(entries).toHaveLength(keys.length);
  });

  it.each(entries)('$specifier resolves to a path that exists ($target)', ({ specifier, target }) => {
    const abs = path.resolve(repoRoot, target);

    expect(
      fs.existsSync(abs),
      `Alias '${specifier}' points at ${target}, which does not exist in the workspace. A dead ` +
        'alias never fails a test — nothing resolves through it — it just reads as if the package ' +
        'were wired up (objectui#3944). Drop the entry, or add the package.'
    ).toBe(true);
  });

  it('aliases an extension-less target to a directory, not a stray file', () => {
    // `@object-ui/types/zod` legitimately targets a single .ts file; every other
    // entry is a package `src/` root. Existence alone would accept a file where
    // a directory is meant, which resolves for the bare specifier and breaks
    // every deep import through it.
    const wrongKind = entries.filter(
      ({ target }) =>
        path.extname(target) === '' &&
        fs.existsSync(path.resolve(repoRoot, target)) &&
        !fs.statSync(path.resolve(repoRoot, target)).isDirectory()
    );

    expect(wrongKind.map((e) => e.specifier)).toEqual([]);
  });

  it('no longer carries the four dead entries', () => {
    // Named explicitly: the generic check above would also go green if someone
    // "fixed" it by re-creating empty `packages/<name>/src` directories.
    const specifiers = entries.map((e) => e.specifier);

    expect(specifiers).not.toContain('@object-ui/engine');
    expect(specifiers).not.toContain('@object-ui/renderer');
    expect(specifiers).not.toContain('@object-ui/plugin-aggrid');
    expect(specifiers).not.toContain('@object-ui/ui');
  });
});
