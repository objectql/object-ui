import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { extractPathTokens, scan, PATH_PREFIXES, readBaseline, BASELINE_FILE } from '../check-skills-paths.mjs';

/**
 * objectui#3735 — the test for `scripts/check-skills-paths.mjs`.
 *
 * The guides under `skills/objectui/` are read by every agent that writes code
 * here, and they give in-repo paths as coordinates. Nothing checked those paths
 * existed, so two rounds of dead ones (#3713 / PR #3729 and #3730 / PR #3734,
 * 13+ in one guide) were found by eye while reading. This suite holds the gate
 * that makes the third round mechanical.
 *
 * The fixtures are temporary trees built here, never the real `skills/`
 * directory: a committed fixture guide would have to contain a deliberately dead
 * path, and something else in the repo would eventually scan it.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** No exemptions — the shape most fixtures want. */
const NO_BASELINE = { allowedMissing: {} };

const baselineFor = (file: string, token: string, reason = 'fixture') => ({
  allowedMissing: { [file]: { [token]: { reason, issue: 'objectui#3735' } } },
});

/** Builds a throwaway tree and runs the REAL `scan()` over it. */
function withTree<T>(build: (write: (rel: string, contents: string) => void) => void, run: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-skills-paths-'));
  const write = (rel: string, contents: string) => {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  try {
    build(write);
    return run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

type Hit = { line: number; token: string; pattern: boolean };
const tokensOf = (source: string): string[] => extractPathTokens(source).map((h: Hit) => h.token);

describe('extractPathTokens — what a guide is taken to be asserting', () => {
  it('reads inline code spans in prose, and reports the line', () => {
    const hits: Hit[] = extractPathTokens(
      ['# Guide', '', 'The sidebar lives in `packages/app-shell/src/layout/UnifiedSidebar.tsx`.', ''].join('\n'),
    );
    expect(hits).toEqual([
      { line: 3, token: 'packages/app-shell/src/layout/UnifiedSidebar.tsx', pattern: false },
    ]);
  });

  it('reads several spans on one line', () => {
    expect(tokensOf('Both `apps/console/src/main.tsx` and `packages/core/src/index.ts` matter.')).toEqual([
      'apps/console/src/main.tsx',
      'packages/core/src/index.ts',
    ]);
  });

  it('ignores spans that are not in-repo paths at all', () => {
    // Package specifiers, symbols, skill-relative links and site routes. None of
    // them is a repo-root-relative path, and treating any as one would produce
    // permanent false red.
    expect(
      tokensOf(
        [
          'Import from `@object-ui/app-shell`, call `useNavigation()`, read `rules/protocol.md`,',
          'link to `/docs/guide/plugins` or `./architecture.md`.',
        ].join('\n'),
      ),
    ).toEqual([]);
  });

  it('rejects a span containing whitespace — prose and command lines are not paths', () => {
    // The live instance: PR #3856 added a self-check command line to
    // `console-development.md` naming `packages/app-shell`. It is out of scope by
    // this rule alone, with no baseline entry anywhere.
    expect(
      tokensOf('Run `grep -rn "UnifiedSidebar" packages/app-shell/src` to confirm, or read `apps/console 目录`.'),
    ).toEqual([]);
  });

  it('classifies globs and placeholders as patterns, not as paths', () => {
    const hits: Hit[] = extractPathTokens(
      [
        'Protected: `packages/components/src/ui/**`.',
        'Schemas go in `packages/spec/src/<domain>/`.',
        'Apps are `packages/platform-objects/src/apps/*.app.ts`.',
        'Docs are `content/docs/guide/*.md`.',
        'Real one: `packages/core/src/index.ts`.',
      ].join('\n'),
    );
    expect(hits.filter((h) => h.pattern).map((h) => h.token)).toEqual([
      'packages/components/src/ui/**',
      'packages/spec/src/<domain>/',
      'packages/platform-objects/src/apps/*.app.ts',
      'content/docs/guide/*.md',
    ]);
    expect(hits.filter((h) => !h.pattern).map((h) => h.token)).toEqual(['packages/core/src/index.ts']);
  });

  it('never reads inside a fenced block, backticks or tildes', () => {
    // A fence is a worked example; a tutorial fence may name a file the reader is
    // about to create. Only prose asserts where code already lives.
    expect(
      tokensOf(
        [
          'Prose says `packages/core/src/index.ts`.',
          '```bash',
          'mkdir -p `packages/brand-new/src`',
          '```',
          '~~~ts',
          "import x from `packages/also-new/src/x.ts`;",
          '~~~',
        ].join('\n'),
      ),
    ).toEqual(['packages/core/src/index.ts']);
  });

  it('keeps a longer fence open until a fence at least as long closes it', () => {
    expect(
      tokensOf(
        ['````md', '```', 'inner `packages/nope/src` stays hidden', '```', '````', 'after: `packages/yes/src`'].join(
          '\n',
        ),
      ),
    ).toEqual(['packages/yes/src']);
  });

  it('reads a multi-backtick span', () => {
    expect(tokensOf('Doubled: ``packages/core/src/index.ts``.')).toEqual(['packages/core/src/index.ts']);
  });

  it('covers each declared prefix', () => {
    for (const prefix of PATH_PREFIXES as string[]) {
      expect(tokensOf(`See \`${prefix}/x/y.ts\`.`)).toEqual([`${prefix}/x/y.ts`]);
    }
  });
});

describe('scan — a seeded dead path turns the gate red and gets named', () => {
  it('reports the guide, the line and the token', () => {
    const result = withTree(
      (write) => {
        write('skills/objectui/guides/demo.md', 'The sidebar lives in `packages/app-shell/src/layout/Gone.tsx`.\n');
      },
      (dir) => scan(dir, NO_BASELINE),
    );
    expect(result.missing).toEqual([
      { file: 'skills/objectui/guides/demo.md', line: 1, token: 'packages/app-shell/src/layout/Gone.tsx' },
    ]);
    expect(result.checked).toBe(1);
    expect(result.resolved).toBe(0);
  });

  it('finds the dead one among the live ones, in a nested guide tree', () => {
    const result = withTree(
      (write) => {
        write('packages/core/src/index.ts', 'export {};\n');
        write('apps/console/src/main.tsx', 'export {};\n');
        write('skills/objectui/SKILL.md', 'Entry: `packages/core/src/index.ts`.\n');
        write(
          'skills/objectui/guides/console-development.md',
          ['Boot: `apps/console/src/main.tsx`.', '', 'Contexts: `apps/console/src/context/`.'].join('\n'),
        );
      },
      (dir) => scan(dir, NO_BASELINE),
    );
    expect(result.missing.map((m: { file: string; line: number }) => `${m.file}:${m.line}`)).toEqual([
      'skills/objectui/guides/console-development.md:3',
    ]);
    expect(result.files).toBe(2);
    expect(result.checked).toBe(3);
    expect(result.resolved).toBe(2);
  });

  it('stays green when every stated path exists, directories included', () => {
    const result = withTree(
      (write) => {
        write('packages/app-shell/src/layout/UnifiedSidebar.tsx', 'export {};\n');
        write('packages/app-shell/src/providers/AppProvider.tsx', 'export {};\n');
        write(
          'skills/objectui/guides/architecture.md',
          [
            'Sidebar: `packages/app-shell/src/layout/UnifiedSidebar.tsx`.',
            'Providers live under `packages/app-shell/src/providers/`.',
          ].join('\n'),
        );
      },
      (dir) => scan(dir, NO_BASELINE),
    );
    expect(result.missing).toEqual([]);
    expect(result.resolved).toBe(2);
  });

  it('does not count pattern tokens as assertions', () => {
    const result = withTree(
      (write) => {
        write('skills/objectui/rules/no-touch-zones.md', 'Never touch `packages/components/src/ui/**`.\n');
      },
      (dir) => scan(dir, NO_BASELINE),
    );
    expect(result.missing).toEqual([]);
    expect(result.checked).toBe(0);
    expect(result.patterns.map((p: { token: string }) => p.token)).toEqual(['packages/components/src/ui/**']);
  });
});

describe('scan — the baseline is a ratchet, red in both directions', () => {
  const GUIDE = 'skills/objectui/guides/console-development.md';
  const TOKEN = 'apps/console/src/context/';
  const negativeSentence = `There is no \`${TOKEN}\` directory at all.\n`;

  it('lets a declared negative statement through without hiding it', () => {
    const result = withTree(
      (write) => write(GUIDE, negativeSentence),
      (dir) => scan(dir, baselineFor(GUIDE, TOKEN, 'deliberate negative statement')),
    );
    expect(result.missing).toEqual([]);
    // Baselined is not the same as invisible: it is still reported, with reason.
    expect(result.exempt).toHaveLength(1);
    expect(result.exempt[0].token).toBe(TOKEN);
    expect(result.exempt[0].reason).toBe('deliberate negative statement');
    expect(result.exempt[0].issue).toBe('objectui#3735');
    expect(result.staleNowExists).toEqual([]);
    expect(result.staleUnseen).toEqual([]);
  });

  it('goes red, naming the entry, when the exempted path APPEARS on disk', () => {
    // The prose was written around "this does not exist". The day it exists, the
    // sentence is false — and a plain existence check would have gone quietly
    // green, which is how an exemption list rots.
    const result = withTree(
      (write) => {
        write(GUIDE, negativeSentence);
        write(`${TOKEN}NavigationContext.tsx`, 'export {};\n');
      },
      (dir) => scan(dir, baselineFor(GUIDE, TOKEN)),
    );
    expect(result.missing).toEqual([]);
    expect(result.exempt).toEqual([]);
    expect(result.staleNowExists).toHaveLength(1);
    expect(result.staleNowExists[0].file).toBe(GUIDE);
    expect(result.staleNowExists[0].token).toBe(TOKEN);
    expect(result.staleNowExists[0].issue).toBe('objectui#3735');
  });

  it('goes red when the scan never meets a baseline entry', () => {
    // The sentence was rewritten (or the guide moved). The entry is dead weight,
    // and an entry nobody removes is how a baseline becomes a skip-list.
    const result = withTree(
      (write) => write(GUIDE, 'The five contexts live in `packages/app-shell/src/context/`.\n'),
      (dir) => scan(dir, baselineFor(GUIDE, TOKEN)),
    );
    expect(result.staleUnseen).toEqual([`${GUIDE} ${TOKEN}`]);
    // The one real path in the rewritten sentence is still judged normally.
    expect(result.missing.map((m: { token: string }) => m.token)).toEqual(['packages/app-shell/src/context/']);
  });

  it('goes red when the baselined guide file is gone entirely', () => {
    const result = withTree(
      (write) => write('skills/objectui/guides/other.md', '# Other\n'),
      (dir) => scan(dir, baselineFor(GUIDE, TOKEN)),
    );
    expect(result.staleUnseen).toEqual([`${GUIDE} ${TOKEN}`]);
  });

  it('exempts one token in one file, not the token everywhere', () => {
    // An exemption is a statement about a sentence, so it must not travel: the
    // same dead path stated as fact in another guide is still a defect.
    const result = withTree(
      (write) => {
        write(GUIDE, negativeSentence);
        write('skills/objectui/guides/app-composition.md', `Contexts live in \`${TOKEN}\`.\n`);
      },
      (dir) => scan(dir, baselineFor(GUIDE, TOKEN)),
    );
    expect(result.exempt).toHaveLength(1);
    expect(result.missing).toEqual([
      { file: 'skills/objectui/guides/app-composition.md', line: 1, token: TOKEN },
    ]);
  });
});

describe('repo state — the gate is green on this tree', () => {
  const result = scan(repoRoot);

  it('has no dead path stated in any guide', () => {
    expect(
      result.missing.map((m: { file: string; line: number; token: string }) => `${m.file}:${m.line} ${m.token}`),
      'Run `pnpm check:skills-paths` for the full report and the fix guidance.',
    ).toEqual([]);
  });

  it('has no stale baseline entry in either direction', () => {
    expect(
      result.staleNowExists.map((s: { file: string; token: string }) => `${s.file} ${s.token}`),
      `These paths now exist — fix the prose, then delete the entry from ${BASELINE_FILE}.`,
    ).toEqual([]);
    expect(result.staleUnseen, `These entries are no longer stated in any guide — delete them.`).toEqual([]);
  });

  it('actually read the guides rather than silently matching nothing', () => {
    // The empty-verdict trap: a broken extractor or a moved scan root satisfies
    // both assertions above by finding nothing. Floors, not exact counts, so
    // ordinary guide edits do not touch this file — measured at 18 files and
    // 86 assertions on main@6422aa891, then at 16 files and 27 assertions after
    // objectui#7251 moved the contributor-only guides out of `skills/`.
    //
    // The `checked` floor dropped from 50 to 20 because that move took 55 of
    // the 93 assertions with it: 49 in `console-development.md` and 6 in
    // `no-touch-zones.md`, both now under `.claude/skills/`, which SCAN_ROOT
    // does not reach. Lowering a floor is normally how a gate rots, so the
    // reason is recorded here and the follow-up is named: widening SCAN_ROOT to
    // cover `.claude/skills` would bring those 55 back under the gate, and that
    // is a deliberate decision with its own measurement (see the docblock's
    // "The prefix allow-list is a decision, not an accident"), not a rider on
    // the move.
    expect(result.files).toBeGreaterThanOrEqual(15);
    expect(result.checked).toBeGreaterThan(20);
    expect(result.resolved).toBe(result.checked - result.exempt.length);
  });

  it('keeps every baseline entry attached to a reason and an issue', () => {
    const baseline = readBaseline(repoRoot) as {
      allowedMissing: Record<string, Record<string, { reason: string; issue: string }>>;
    };
    for (const [file, tokens] of Object.entries(baseline.allowedMissing)) {
      for (const [token, entry] of Object.entries(tokens)) {
        expect(entry.issue, `${file} ${token} must name the issue that granted the exemption`).toMatch(/#\d+/);
        expect(
          entry.reason?.length ?? 0,
          `${file} ${token} must say WHY the prose states a path that does not exist`,
        ).toBeGreaterThan(20);
      }
    }
  });

  it('exits 0 when run as the CLI', () => {
    const out = execFileSync('node', ['scripts/check-skills-paths.mjs'], { cwd: repoRoot, encoding: 'utf8' });
    expect(out).toMatch(/check-skills-paths: OK/);
  });
});

describe('objectui#3713 / #3730 — the guide those two rounds corrected by hand', () => {
  // That guide is `console-development.md`, and objectui#7251 moved it out of
  // the scan root to `.claude/skills/objectui-contributor/guides/` because it
  // addresses a maintainer of this repo, not a customer of the published
  // bundle. So the three pins this block used to carry cannot be restated as
  // they were: `scan(repoRoot)` no longer sees the file, and a filter on its
  // old path would pass by finding nothing — the exact empty-verdict failure
  // the block above exists to catch.
  //
  // What survives is the half that never needed the scan: the file still
  // states path coordinates, `extractPathTokens` still reads them, and #3730
  // alone corrected 13 of them by hand. Pinning the count keeps that fact
  // visible, and keeps the follow-up honest — the day SCAN_ROOT covers
  // `.claude/skills`, these coordinates come back under the gate and this
  // block can go back to asserting `result.missing` on them.
  const MOVED_GUIDE = '.claude/skills/objectui-contributor/guides/console-development.md';

  it('still lives where the move put it', () => {
    expect(fs.existsSync(path.join(repoRoot, MOVED_GUIDE))).toBe(true);
  });

  it('is still dense in stated paths, which is why it needed a gate', () => {
    const stated = extractPathTokens(fs.readFileSync(path.join(repoRoot, MOVED_GUIDE), 'utf8')).filter(
      (h: Hit) => !h.pattern,
    );
    expect(stated.length).toBeGreaterThan(40);
  });

  it('is NOT covered by the gate today, and that is the open follow-up', () => {
    // Red the day someone widens SCAN_ROOT: delete this and restore the
    // `result.missing` assertion above it.
    const result = scan(repoRoot);
    expect(result.missing.map((m: { file: string }) => m.file)).not.toContain(MOVED_GUIDE);
    expect(result.exempt.map((e: { file: string }) => e.file)).not.toContain(MOVED_GUIDE);
  });
});

describe('wiring — the gate is reachable and a markdown-only PR starts it', () => {
  const SCRIPT = 'scripts/check-skills-paths.mjs';
  const workflowDir = path.join(repoRoot, '.github/workflows');
  const workflowPath = path.join(workflowDir, 'skills-paths.yml');
  const workflowFiles = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml'));

  /**
   * A workflow's YAML with whole-line comments removed — this file's own header
   * discusses `paths` and `paths-ignore` in prose, and `docs-links.yml` /
   * `control-bytes.yml` name each other's scripts in theirs. A scan that counted
   * comments would report filters and duplicate homes that no file has.
   */
  const yamlOf = (file: string) =>
    fs
      .readFileSync(path.join(workflowDir, file), 'utf8')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

  it('is exposed as a root package script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:skills-paths']).toBe(`node ${SCRIPT}`);
  });

  it('has a workflow that gates pull requests, not just pushes', () => {
    expect(fs.existsSync(workflowPath), 'a check nothing runs is not a gate').toBe(true);
    const yaml = yamlOf('skills-paths.yml');
    expect(yaml).toMatch(new RegExp(`run:\\s*node\\s+${SCRIPT.replace(/[.]/g, '\\.')}`));
    expect(yaml).toMatch(/^\s*pull_request:/m);
    expect(yaml).toMatch(/^\s*push:/m);
  });

  it('runs it in NO path-filtered workflow — the scan surface is entirely markdown', () => {
    // The whole reason this is its own workflow. `ci.yml` lists `'**/*.md'` under
    // the `paths-ignore` of its `push` trigger and GitHub has no per-job path
    // filter, so a push that only edits guides would never start it. That is
    // exactly the hole #3448 (docs links) and control-bytes.yml were split out
    // to close; a gate whose entire surface is markdown cannot afford to
    // rebuild it.
    expect(workflowFiles.length, 'the workflow directory scan returned implausibly few files').toBeGreaterThan(5);
    for (const file of workflowFiles) {
      const yaml = yamlOf(file);
      if (!yaml.includes(SCRIPT)) continue;
      expect(yaml, `${file} runs ${SCRIPT} behind a paths-ignore — a guide-only change would not start it`).not.toMatch(
        /paths-ignore:/,
      );
      expect(yaml, `${file} runs ${SCRIPT} behind a paths filter — see objectui#3448`).not.toMatch(/^\s+paths:/m);
    }
  });

  it('has exactly one home', () => {
    // A second copy in a path-filtered workflow is how a gate ends up looking
    // covered while the change it exists for still slips past.
    expect(workflowFiles.filter((f) => yamlOf(f).includes(SCRIPT))).toEqual(['skills-paths.yml']);
  });

  it('ships its baseline next to the script', () => {
    expect(fs.existsSync(path.join(repoRoot, BASELINE_FILE))).toBe(true);
  });
});
