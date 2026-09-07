import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

import {
  CENSUS_FLOORS,
  PROBE_BASENAME,
  VACUOUS_GROUPS,
  analyze,
  censusCollapse,
  ruleCountFor,
  walkedFiles,
} from '../check-lint-rule-coverage.mjs';

/**
 * objectui#7908 -- `eslint.config.js` resolves ZERO rules for every
 * `.js`/`.mjs`/`.cjs` file, so a third of what `lint:root` walks is linted
 * vacuously while every exit code downstream reads it as clean.
 *
 * The gate under test reports rule RESOLUTION, not merely whether ESLint ran.
 * What this file pins, in the order the gate can go wrong:
 *
 *  1. **The walk is the same walk.** `walkedFiles` enumerates via
 *     `ESLint#isPathIgnored`; a real `ESLint#lintFiles` over the same fixture
 *     must produce the same set. Without this leg the gate could be measuring a
 *     population ESLint never touches, and every other assertion here would
 *     still pass.
 *  2. **Zero rules is a reading, not a broken call.** Every fixture that
 *     reports a zero also reports a control file in the same run that resolves
 *     a non-zero count, the same shape the card's own measurement used.
 *  3. **All three reds, each through the real mechanism.** Unledgered vacuity,
 *     an over-broad row, and a stale row -- driven by editing the fixture's
 *     ESLint config or its tree, never by hand-constructing the gate's own
 *     internal state.
 *  4. **A green is never "the walk found nothing."** The fixture greens assert
 *     their own counters, and the repository run asserts the census floors.
 *  5. **This repository is green today**, with every ledger row still live.
 *  6. **The gate is wired** in `package.json`. It has no workflow step on
 *     purpose (objectui#8301 owns that question for this shift's gates), and
 *     that absence is asserted as a KNOWN state rather than left ambiguous.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const fixtures: string[] = [];
afterAll(() => {
  for (const dir of fixtures) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * A throwaway repository: a flat ESLint config plus a file tree. Written to
 * disk rather than modelled, because "which files does ESLint walk" is half of
 * what can go wrong and no model of that answers it.
 */
function tree(label: string, files: Record<string, string>): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `lint-rule-coverage-${label}-`)));
  fixtures.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

/** A config whose only rule-bearing block is scoped to `.ts` -- the shape of the defect. */
const TS_ONLY_CONFIG = [
  "export default [",
  "  { ignores: ['**/generated/**'] },",
  "  { files: ['**/*.ts'], rules: { 'no-debugger': 'error', 'no-empty': 'error' } },",
  "];",
  "",
].join('\n');

const FILES = {
  'src/covered.ts': 'export const a = 1;\n',
  'tools/vacuous.mjs': 'export const b = 2;\n',
};

describe('the walk is the walk ESLint actually performs', () => {
  it('enumerates exactly what ESLint#lintFiles reaches', async () => {
    const root = tree('walk', {
      'eslint.config.js': TS_ONLY_CONFIG,
      ...FILES,
      'generated/ignored.ts': 'export const c = 3;\n',
      'notes.md': '# not a linted file\n',
      'data.json': '{}\n',
    });

    const eslint = new ESLint({ cwd: root });
    const mine = await walkedFiles(root, eslint);
    const theirs = (await eslint.lintFiles(['.']))
      .map((r) => path.relative(root, r.filePath).split(path.sep).join('/'))
      .sort();

    expect(mine).toEqual(theirs);
    // ...and the answer is not trivially "everything" or "nothing".
    expect(mine).toContain('src/covered.ts');
    expect(mine).toContain('tools/vacuous.mjs');
    expect(mine).not.toContain('generated/ignored.ts');
    expect(mine).not.toContain('notes.md');
  });

  it('prunes a directory by asking the live config, not by a copied list', async () => {
    const root = tree('prune', {
      'eslint.config.js': TS_ONLY_CONFIG,
      ...FILES,
      'generated/deep/also-ignored.ts': 'export const d = 4;\n',
    });
    const eslint = new ESLint({ cwd: root });

    // The probe is a file that does not exist; the answer comes from the
    // config's own `ignores`, which is what keeps this from drifting.
    expect(await eslint.isPathIgnored(path.join(root, 'generated', PROBE_BASENAME))).toBe(true);
    expect(await eslint.isPathIgnored(path.join(root, 'tools', PROBE_BASENAME))).toBe(false);
    expect(await walkedFiles(root, eslint)).not.toContain('generated/deep/also-ignored.ts');
  });
});

describe('zero rules is a reading, not a broken call', () => {
  it('reports a zero and a non-zero control in the same run', async () => {
    const root = tree('reading', { 'eslint.config.js': TS_ONLY_CONFIG, ...FILES });
    const eslint = new ESLint({ cwd: root });

    expect(await ruleCountFor(eslint, path.join(root, 'tools/vacuous.mjs'))).toBe(0);
    expect(await ruleCountFor(eslint, path.join(root, 'src/covered.ts'))).toBe(2);
  });

  it('separates "walked with no rules" from "not walked at all"', async () => {
    const root = tree('shapes', { 'eslint.config.js': TS_ONLY_CONFIG, ...FILES, 'notes.md': '# x\n' });
    const eslint = new ESLint({ cwd: root });

    // The distinction the gate turns on: `undefined` means ESLint never looks
    // at the file, an object with no `rules` means it looks and has nothing to
    // say. Both would read as "0 rules" to a caller that only counted keys.
    expect(await eslint.calculateConfigForFile(path.join(root, 'notes.md'))).toBeUndefined();
    const vacuous = await eslint.calculateConfigForFile(path.join(root, 'tools/vacuous.mjs'));
    expect(vacuous).toBeDefined();
    expect(vacuous.rules).toBeUndefined();
  });
});

describe('narrowing a glob removes files from the WALK, it does not make them vacuous', () => {
  it('is the measured asymmetry between the default-lint set and `.ts`', async () => {
    // `.js`/`.cjs`/`.mjs` are linted by default; `.ts` is walked only because
    // some config object's `files` names it. So the two fail in opposite
    // directions, and a gate built on the wrong one would measure nothing.
    const root = tree('narrowed', {
      'eslint.config.js': TS_ONLY_CONFIG.replace("files: ['**/*.ts']", "files: ['**/*.tsx']"),
      ...FILES,
    });
    const eslint = new ESLint({ cwd: root });

    expect(await eslint.isPathIgnored(path.join(root, 'src/covered.ts'))).toBe(true);
    expect(await eslint.calculateConfigForFile(path.join(root, 'src/covered.ts'))).toBeUndefined();

    const result = await analyze({ root, groups: [{ glob: '**/*.mjs', reason: 'fixture', card: 'objectui#7908' }, { glob: 'eslint.config.js', reason: 'the fixture config', card: 'objectui#7908' }] });
    expect(result.walked).not.toContain('src/covered.ts');
    expect(result.vacuous).not.toContain('src/covered.ts');
  });

  it('reds when a files: entry ENTERS the walk carrying no rules', async () => {
    // The real-world way this defect is added to a config, and the fourth
    // ablation leg on this gate's own PR.
    const root = tree('widened-walk', {
      'eslint.config.js': TS_ONLY_CONFIG.replace('export default [', "export default [\n  { files: ['**/*.mts'] },"),
      ...FILES,
      'build.mts': 'export const f = 6;\n',
    });
    const result = await analyze({
      root,
      groups: [
        { glob: 'tools/**/*.mjs', reason: 'fixture', card: 'objectui#7908' },
        { glob: 'eslint.config.js', reason: 'the fixture config', card: 'objectui#7908' },
      ],
    });

    const unledgered = result.findings.filter((f) => f.kind === 'unledgered');
    expect(unledgered).toHaveLength(1);
    expect(unledgered[0].files).toEqual(['build.mts']);
  });
});

describe('the ledger, and the three directions it goes red', () => {
  // Two rows, and the second one is not decoration: a flat config is itself a
  // `.js` file that ESLint walks and resolves no rules for, so the fixture
  // reproduces the repository's own shape -- and it is why the real ledger
  // COUNTS `eslint.config.js` instead of exempting it. A gate that special-cased
  // its own config would be green here for the wrong reason.
  const groups = [
    { glob: 'tools/**/*.mjs', reason: 'fixture', card: 'objectui#7908' },
    { glob: 'eslint.config.js', reason: 'the fixture config, counted like the real one', card: 'objectui#7908' },
  ];

  it('is GREEN when every vacuous file is declared, with counters that are not zero', async () => {
    const root = tree('green', { 'eslint.config.js': TS_ONLY_CONFIG, ...FILES });
    const result = await analyze({ root, groups });

    expect(result.findings).toEqual([]);
    expect(result.vacuous).toEqual(['eslint.config.js', 'tools/vacuous.mjs']);
    expect(result.ruleBearing).toEqual(['src/covered.ts']);
    expect(result.rows[0].vacuousMatches).toEqual(['tools/vacuous.mjs']);
    expect(result.rows[1].vacuousMatches).toEqual(['eslint.config.js']);
  });

  it('reds on a NEW zero-rule file outside every row, and names it', async () => {
    const root = tree('unledgered', {
      'eslint.config.js': TS_ONLY_CONFIG,
      ...FILES,
      'elsewhere/new-tool.mjs': 'export const e = 5;\n',
    });
    const result = await analyze({ root, groups });

    const unledgered = result.findings.filter((f) => f.kind === 'unledgered');
    expect(unledgered).toHaveLength(1);
    expect(unledgered[0].files).toEqual(['elsewhere/new-tool.mjs']);
    // The declared file is NOT reported -- the row still does its job.
    expect(unledgered[0].files).not.toContain('tools/vacuous.mjs');
  });

  it('reds on a row that also claims files which now resolve rules', async () => {
    const root = tree('overbroad', { 'eslint.config.js': TS_ONLY_CONFIG, ...FILES });
    const result = await analyze({
      root,
      groups: [{ glob: '**/*.{ts,mjs}', reason: 'too wide', card: 'objectui#7908' }, groups[1]],
    });

    const overBroad = result.findings.filter((f) => f.kind === 'over-broad');
    expect(overBroad).toHaveLength(1);
    expect(overBroad[0].files).toEqual(['src/covered.ts']);
  });

  it('reds as STALE when the config grows to cover a declared row', async () => {
    // The row is honest on the tree above. Here the config's rule-bearing block
    // widens to `.mjs`, so the vacuity the row declares is GONE -- driven
    // through ESLint rather than by editing the row.
    const root = tree('stale-covered', {
      'eslint.config.js': TS_ONLY_CONFIG.replace("files: ['**/*.ts']", "files: ['**/*.{ts,mjs}']"),
      ...FILES,
    });
    const result = await analyze({ root, groups });

    // Only the config file is left unjudged; the row that declared `tools/`
    // now over-claims a covered file AND declares nothing, which is both reds.
    expect(result.vacuous).toEqual(['eslint.config.js']);
    expect(result.findings.map((f) => f.kind).sort()).toEqual(['over-broad', 'stale']);
  });

  it('reds as STALE when a row matches no walked file at all', async () => {
    const root = tree('stale-gone', { 'eslint.config.js': TS_ONLY_CONFIG, ...FILES });
    const result = await analyze({
      root,
      groups: [...groups, { glob: 'deleted/**/*.mjs', reason: 'gone', card: 'objectui#7908' }],
    });

    const stale = result.findings.filter((f) => f.kind === 'stale');
    expect(stale).toHaveLength(1);
    expect(stale[0].glob).toBe('deleted/**/*.mjs');
  });
});

describe('the census cannot pass by collapsing', () => {
  it('rejects a walk that reached nothing', () => {
    expect(censusCollapse({ walked: [], ruleBearing: [], vacuous: [] })).toMatch(/census collapsed/);
  });

  it('rejects a walk that reached files but resolved rules for none of them', () => {
    const walked = Array.from({ length: CENSUS_FLOORS.walked + 1 }, (_, i) => `f${i}.mjs`);
    expect(censusCollapse({ walked, ruleBearing: [], vacuous: walked })).toMatch(/census collapsed/);
  });
});

describe('this repository', () => {
  it('is green, with every ledger row still live and the census standing', async () => {
    const result = await analyze({ root: repoRoot });

    expect(censusCollapse(result)).toBeNull();
    expect(result.findings).toEqual([]);
    // The gate's whole point: this number is NOT zero today, and a green here
    // means it is declared, not absent.
    expect(result.vacuous.length).toBeGreaterThan(0);
    for (const row of result.rows) {
      expect(row.vacuousMatches.length, `ledger row '${row.glob}' declares nothing any more`).toBeGreaterThan(0);
      expect(row.ruleBearingMatches, `ledger row '${row.glob}' over-claims`).toEqual([]);
    }
  }, 60_000);

  it('still has the defect the card measured -- the JS family resolves zero rules', async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    // Two zeros and a control, in one run. The control is what makes the zeros
    // a reading; without it a broken invocation looks identical.
    expect(await ruleCountFor(eslint, path.join(repoRoot, 'eslint.config.js'))).toBe(0);
    expect(await ruleCountFor(eslint, path.join(repoRoot, 'scripts/check-lint-coverage.mjs'))).toBe(0);
    expect(await ruleCountFor(eslint, path.join(repoRoot, 'playwright.config.ts'))).toBeGreaterThan(100);
  }, 30_000);

  it('declares a reason and an owning card on every ledger row', () => {
    expect(VACUOUS_GROUPS.length).toBeGreaterThan(0);
    for (const row of VACUOUS_GROUPS) {
      expect(row.glob, 'a row must be a glob').toBeTruthy();
      expect(row.reason.length, `row '${row.glob}' needs a reason, not a bare glob`).toBeGreaterThan(40);
      expect(row.card, `row '${row.glob}' must name the card that owns it`).toMatch(/objectui#\d+/);
    }
    // Rows are globs on purpose -- a per-path ledger of this population would be
    // over a hundred rows that nobody would ever shrink.
    expect(VACUOUS_GROUPS.length).toBeLessThan(20);
  });

  it('is wired in package.json, and deliberately not in a workflow yet', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(manifest.scripts['check:lint-rule-coverage']).toBe('node scripts/check-lint-rule-coverage.mjs');

    // objectui#8301 owns whether this shift's gates get a workflow step. Pinned
    // as a KNOWN state so the gap is visible here rather than inferred from a
    // missing assertion -- when #8301 lands, this line is what fails and points
    // at the decision.
    const workflows = fs
      .readdirSync(path.join(repoRoot, '.github/workflows'))
      .map((f) => fs.readFileSync(path.join(repoRoot, '.github/workflows', f), 'utf8'))
      .join('\n');
    expect(workflows).not.toContain('check:lint-rule-coverage');
  });
});
