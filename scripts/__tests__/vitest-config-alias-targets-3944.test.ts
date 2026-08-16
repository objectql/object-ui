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
 * ---------------------------------------------------------------------------
 * objectui#4804 — this guard now reads TWO tables.
 *
 * The paragraph that used to sit here said `tsconfig.json`'s `paths` carried
 * dead entries of the same shape for three of the four names, and left them to
 * whoever triaged it. #4804 is that triage: it deleted the six lines
 * (`@object-ui/engine`, `@object-ui/ui`, `@object-ui/renderer`, each in bare
 * and `/*`-suffixed form) and folded the table in here instead of starting a
 * second guard file — one guard watching both tables, as PR #4802 suggested.
 * The file name keeps its `3944` provenance; each `describe` names its table.
 *
 * Note the two dead sets are NOT the same: `@object-ui/plugin-aggrid` was in
 * the alias table and never in `paths`, so the pins below differ on purpose.
 *
 * Why `tsconfig.json` is read as TEXT too, when it looks like plain JSON: it is
 * JSONC. Two block comments sit in `compilerOptions` (at :9 and :16 on the
 * post-#4804 file), and `JSON.parse` throws on them — measured: `Expected
 * double-quoted property name in JSON at position 187`. The alternative is to
 * strip comments first, i.e. hand-roll a second parser that has to respect
 * string literals to avoid mangling a target that contains comment-like
 * characters. One brace-balanced text read, shared by both tables, is less
 * surface than that, and keeps the two halves of this file the same shape.
 *
 * Reverse verification for the `paths` half (direction predicted before
 * running — plain RED again, and for the same reason: the table is the sole
 * input, so an added bad entry can only add a finding): add
 * `"@object-ui/ghost-4804": ["packages/ghost-4804/src"]` and the
 * "maps to a path that exists" case fails naming that entry, while the two
 * coverage cases and both pins stay green.
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
 * The text of an object literal, brace-balanced from its opening `{` so a
 * nested object in a future entry cannot truncate it. Shared by both tables.
 */
function balancedObjectLiteral(source: string, header: RegExp, what: string): string {
  const match = header.exec(source);
  if (!match) throw new Error(`${what}: object literal not found`);

  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${what}: object literal is never closed`);
}

/**
 * Comment LINES stripped, so they cannot be miscounted as entries — both the
 * `//` form and a block comment occupying a whole line.
 *
 * Only whole lines: an entry hidden inside a multi-line block comment is still
 * read as live and then fails the existence check. That is the safe direction
 * for a guard (fail loud, never silently drop a key), and the fix is the one
 * this file argues for anyway — delete a dead entry rather than commenting it
 * out.
 */
function withoutCommentLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\/\*.*\*\/\s*$/.test(line))
    .join('\n');
}

const block = withoutCommentLines(
  balancedObjectLiteral(configSource, /alias:\s*\{/, 'vitest.config.mts: resolve.alias')
);

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

// ---------------------------------------------------------------------------
// objectui#4804 — the second table: root `tsconfig.json`'s `compilerOptions.paths`.
// ---------------------------------------------------------------------------

const TSCONFIG_PATH = path.join(repoRoot, 'tsconfig.json');
const tsconfigSource = fs.readFileSync(TSCONFIG_PATH, 'utf8');

const pathsBlock = withoutCommentLines(
  balancedObjectLiteral(tsconfigSource, /"paths"\s*:\s*\{/, 'tsconfig.json: compilerOptions.paths')
);

/** `"<specifier>": ["<target>", ...]` — a `paths` value is always an array. */
const PATHS_ENTRY = /(['"])([^'"]+)\1\s*:\s*\[([^\]]*)\]/g;
const QUOTED = /(['"])([^'"]+)\1/g;

/**
 * Flattened to one row per target: `paths` allows several fallback targets per
 * specifier, and every one of them is a claim that has to hold. Reuses
 * `AliasEntry` — a `paths` mapping is the same (specifier, target) pair.
 */
const pathEntries: AliasEntry[] = [...pathsBlock.matchAll(PATHS_ENTRY)].flatMap((entry) =>
  [...entry[3].matchAll(QUOTED)].map((target) => ({
    specifier: entry[2],
    target: target[2],
  }))
);

/**
 * A `paths` target may carry TypeScript's `*` substitution token
 * (`packages/core/src/*`), which is a pattern, not a path — `existsSync` on it
 * is always false. What has to exist is the prefix it substitutes into, and
 * that prefix has to be a directory for the substitution to mean anything.
 */
function resolveTarget(target: string): { abs: string; isPattern: boolean } {
  const star = target.indexOf('*');
  if (star === -1) return { abs: path.resolve(repoRoot, target), isPattern: false };

  return {
    abs: path.resolve(repoRoot, target.slice(0, star).replace(/\/$/, '')),
    isPattern: true,
  };
}

/**
 * objectui#4820 — two entries whose targets do not exist and which #4804
 * deliberately did NOT delete. They are dead for a different reason: they point
 * into `node_modules` for packages that are not dependencies of this workspace
 * at all (`node_modules/@objectstack/` holds only `spec`; neither name appears
 * in any package.json), so no install can ever produce them. Whether the fix is
 * to drop the lines or to add the dependencies AGENTS.md section 7 prescribes
 * is a maintainer call, not a rider on #4804's six-line deletion.
 *
 * A shrink-only ratchet, not an exemption. The list may not grow — a NEW dead
 * target is still red — and the pin below asserts each listed entry is still
 * declared AND still missing, so resolving #4820 either way turns this file red
 * until the list is emptied with it.
 */
const KNOWN_MISSING_TARGETS: readonly string[] = [
  '@objectstack/plugin-msw',
  '@objectstack/objectql',
];

/** The six lines #4804 removed, in both spellings. */
const REMOVED_BY_4804 = [
  '@object-ui/engine',
  '@object-ui/engine/*',
  '@object-ui/ui',
  '@object-ui/ui/*',
  '@object-ui/renderer',
  '@object-ui/renderer/*',
];

describe('objectui#4804 — root tsconfig.json compilerOptions.paths table', () => {
  it('parses a plausible table (a zero-hit parse would make every case below vacuous)', () => {
    // Same empty-fixture trap as the alias half: if the file is reformatted and
    // the regex stops matching, `pathEntries` becomes [] and every case below
    // passes while checking nothing.
    expect(pathEntries.length).toBeGreaterThanOrEqual(10);
    expect(pathEntries.map((e) => e.specifier)).toContain('@object-ui/core');
  });

  it('parses EVERY key in the block, so no entry can dodge the existence check', () => {
    // Coverage, not style. A key whose value is written in some other form — a
    // bare string instead of an array, or an empty array — would be skipped by
    // PATHS_ENTRY and silently escape.
    const keys = [...pathsBlock.matchAll(/^\s*(['"])([^'"]+)\1\s*:/gm)].map((m) => m[2]);

    expect(
      keys.filter((key) => !pathEntries.some((e) => e.specifier === key)),
      'These `paths` keys are not written as an array of at least one quoted repo-relative ' +
        'target, so the target-exists check below never sees them. Use that form, or teach this ' +
        'test the new one.'
    ).toEqual([]);
    expect(new Set(pathEntries.map((e) => e.specifier)).size).toBe(keys.length);
  });

  it.each(pathEntries.filter((e) => !KNOWN_MISSING_TARGETS.includes(e.specifier)))(
    '$specifier maps to a path that exists ($target)',
    ({ specifier, target }) => {
      const { abs, isPattern } = resolveTarget(target);

      expect(
        fs.existsSync(abs),
        `paths['${specifier}'] maps to ${target}, which does not exist in the workspace. A dead ` +
          'mapping never fails a build — nothing resolves through it — it just reads as if the ' +
          'package were wired up (objectui#4804). Drop the entry, or add the package.'
      ).toBe(true);

      if (isPattern) {
        expect(
          fs.statSync(abs).isDirectory(),
          `paths['${specifier}'] substitutes '*' into ${target.replace(/\*$/, '')}, which exists ` +
            'but is not a directory, so no deep import can resolve through it.'
        ).toBe(true);
      }
    }
  );

  it('maps an extension-less target to a directory, not a stray file', () => {
    // `@object-ui/console` legitimately targets a single `.ts` file; every
    // other non-pattern entry is a package `src/` root. Existence alone would
    // accept a file where a directory is meant.
    const wrongKind = pathEntries.filter(({ specifier, target }) => {
      if (KNOWN_MISSING_TARGETS.includes(specifier)) return false;
      const { abs, isPattern } = resolveTarget(target);
      if (isPattern || path.extname(target) !== '') return false;
      return fs.existsSync(abs) && !fs.statSync(abs).isDirectory();
    });

    expect(wrongKind.map((e) => e.specifier)).toEqual([]);
  });

  it('no longer carries the six dead engine/ui/renderer entries', () => {
    // Named explicitly, for the same reason as the alias half: the generic
    // check above would also go green if someone "fixed" these by creating
    // empty `packages/<name>/src` directories. Note `@object-ui/plugin-aggrid`
    // is absent here on purpose — it was in the alias table, never in `paths`.
    const specifiers = pathEntries.map((e) => e.specifier);

    for (const dead of REMOVED_BY_4804) {
      expect(
        specifiers,
        `objectui#4804 removed paths['${dead}'] because its target never existed. Re-adding it ` +
          'needs the package to exist first.'
      ).not.toContain(dead);
    }
  });

  it('the objectui#4820 carve-out still describes exactly the entries it was written for', () => {
    const declared = pathEntries.filter((e) => KNOWN_MISSING_TARGETS.includes(e.specifier));

    expect(
      [...new Set(declared.map((e) => e.specifier))].sort(),
      'KNOWN_MISSING_TARGETS names an entry that is no longer in tsconfig.json. If objectui#4820 ' +
        'was resolved by deleting the line, delete it from the carve-out too.'
    ).toEqual([...KNOWN_MISSING_TARGETS].sort());

    const nowResolving = declared.filter((e) => fs.existsSync(resolveTarget(e.target).abs));

    expect(
      nowResolving.map((e) => e.specifier),
      'A carved-out target now exists, so the objectui#4820 carve-out is obsolete for it — drop ' +
        'it from KNOWN_MISSING_TARGETS so the entry is guarded like every other one.'
    ).toEqual([]);
  });
});
