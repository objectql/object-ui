import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import {
  derivePreInstallSteps,
  isBuiltinSpecifier,
  parseWorkflowJobs,
  scan,
  staticSpecifiers,
  walkImportGraph,
} from '../check-pre-install-import-graph.mjs';
import { REQUIRED_CONTEXTS } from '../dependabot-merge-gate.mjs';

/**
 * objectui#6148 — the gate for the property that lets a gate run pre-install.
 *
 * Eight workflow steps ran a `scripts/` gate before any `pnpm install`, and
 * exactly one of them had a test pinning its import graph to node builtins. The
 * other seven held the property by accident of what they happened to import,
 * and a violation is invisible to `tsc`, to ESLint, to a local run and to the
 * suite — it surfaces only as `ERR_MODULE_NOT_FOUND` in one CI job. For the
 * gates that carry no path filter *precisely so* they see every PR shape, that
 * is a gate which stops running rather than one that fails loudly.
 *
 * What this file pins, in the order the gate can go wrong:
 *
 *  1. **the derivation is a derivation** — the population comes from the
 *     workflows, so moving a step across `pnpm install` moves the population. A
 *     gate reporting "13 steps" while reading a constant is the defect it was
 *     written to prevent, and the only way to tell the two apart is to move a
 *     step in a fixture and watch the number follow;
 *  2. **the walk follows the graph** — a package ONE HOP away must be caught
 *     and its chain named, because the assertion this generalises could not see
 *     one;
 *  3. **the floor over the real tree** — every step objectui#6148 measured is
 *     still derived, by workflow and job rather than by count;
 *  4. **the wiring** — a gate nobody runs is indistinguishable from a gate that
 *     passes, so the workflow, the alias and the Dependabot classification are
 *     asserted here rather than trusted by reading.
 *
 * Deliberately NOT asserted: the total number of pre-install steps. That number
 * is the gate's own output and moves whenever a workflow does; a hand-copied
 * count here would drift by construction, which is the lesson
 * `lint-workflow.test.ts` records at length.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowDir = path.join(repoRoot, '.github/workflows');
const SCRIPT = 'scripts/check-pre-install-import-graph.mjs';
const WORKFLOW = 'pre-install-import-graph.yml';
const CHECK_NAME = 'Pre-Install Import Graph Check';

/** A workflow's YAML with whole-line comments removed — every file here discusses the shapes in prose. */
const withoutComments = (yaml: string): string =>
  yaml
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

const readWorkflow = (file: string): string => fs.readFileSync(path.join(workflowDir, file), 'utf8');

// ── 1. the derivation is a derivation ────────────────────────────────────────

describe('the population follows the workflows', () => {
  const fixture = (installStepIndex: number): string => {
    const gate = '      - name: Gate\n        run: node scripts/probe.mjs\n';
    const install = '      - name: Install dependencies\n        run: pnpm install --frozen-lockfile\n';
    const filler = '      - name: Checkout code\n        uses: actions/checkout@v7\n';
    const steps = [filler, gate, filler];
    steps.splice(installStepIndex, 0, install);
    return `on:\n  pull_request:\njobs:\n  probe:\n    steps:\n${steps.join('')}`;
  };

  const derive = (text: string): string[] =>
    derivePreInstallSteps([{ file: 'probe.yml', text }]).map((s: { script: string }) => s.script);

  it('SHRINKS when the install moves above the gate', () => {
    // Install first, gate second: the gate is no longer pre-install.
    expect(derive(fixture(0))).toEqual([]);
  });

  it('GROWS when the install moves below the gate', () => {
    // The same file with the install one place later — nothing else changed.
    expect(derive(fixture(2))).toEqual(['scripts/probe.mjs']);
  });

  it('counts a job that never installs entirely', () => {
    const noInstall = 'jobs:\n  j:\n    steps:\n      - name: Gate\n        run: node scripts/probe.mjs\n';
    expect(derive(noInstall)).toEqual(['scripts/probe.mjs']);
  });

  it('measures the boundary PER JOB, not per file', () => {
    const twoJobs = `jobs:
  installs:
    steps:
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Late
        run: node scripts/late.mjs
  does-not:
    steps:
      - name: Early
        run: node scripts/early.mjs
`;
    expect(derive(twoJobs)).toEqual(['scripts/early.mjs']);
  });

  it('does not read an install out of a shell comment or a quoted argument', () => {
    // Both shapes are in this repository: `dependabot-auto-merge.yml` configures
    // a merge driver whose VALUE is `"pnpm install --no-frozen-lockfile"` in a
    // job that never installs, and block scalars carry `#` lines that are shell
    // comments rather than YAML ones. Reading either as an install moves the
    // boundary earlier and silently drops a script out of the population — the
    // shrinking direction, which costs coverage rather than raising a false red.
    const tricky = `jobs:
  j:
    steps:
      - name: Configure Git merge driver for pnpm-lock.yaml
        run: |
          # pnpm install --frozen-lockfile
          git config merge.pnpm-merge.driver "pnpm install --no-frozen-lockfile"
      - name: Browsers are not node_modules
        run: pnpm exec playwright install chromium
      - name: Gate
        run: node scripts/probe.mjs
`;
    expect(derive(tricky)).toEqual(['scripts/probe.mjs']);
  });

  it('reads block scalars, and ignores an invocation commented out inside one', () => {
    const block = `jobs:
  j:
    steps:
      - name: Two legs
        run: |
          node scripts/probe.mjs --self-test
          node scripts/probe.mjs
      - name: Commented out
        run: |
          # node scripts/ghost.mjs
          echo done
`;
    // One row per (step, script) — two invocations of one script in one step is
    // one step, not two.
    expect(derive(block)).toEqual(['scripts/probe.mjs']);
  });

  it('parses jobs and steps in order — the index is what "before" means', () => {
    const jobs = parseWorkflowJobs(fixture(2)) as Array<{ id: string; steps: Array<{ name: string }> }>;
    expect(jobs.map((j) => j.id)).toEqual(['probe']);
    expect(jobs[0].steps.map((s) => s.name)).toEqual([
      'Checkout code',
      'Gate',
      'Install dependencies',
      'Checkout code',
    ]);
  });
});

// ── 2. the walk follows the graph ────────────────────────────────────────────

describe('the import-graph walk sees past the entry file', () => {
  const graphOf = (files: Record<string, string>, entry: string) =>
    walkImportGraph(entry, { read: (p: string) => (Object.hasOwn(files, p) ? files[p] : null) }) as {
      modules: string[];
      violations: Array<{ chain: string[]; specifier: string }>;
      unresolved: Array<{ chain: string[]; specifier: string }>;
    };

  it('catches a package ONE HOP away and names the chain', () => {
    // The control objectui#6148 hands this gate: `import ts from 'typescript'`
    // in `scripts/invoked-as.mjs` is invisible to any check that reads only the
    // entry's own import lines, and every pre-install script imports it.
    const graph = graphOf(
      {
        'scripts/gate.mjs': "import { isEntrypoint } from './invoked-as.mjs';\n",
        'scripts/invoked-as.mjs': "import ts from 'typescript';\nexport const isEntrypoint = ts;\n",
      },
      'scripts/gate.mjs',
    );
    expect(graph.violations).toHaveLength(1);
    expect(graph.violations[0].specifier).toBe('typescript');
    expect(graph.violations[0].chain.join(' -> ')).toBe(
      'scripts/gate.mjs -> scripts/invoked-as.mjs -> typescript',
    );
  });

  it('accepts a bare builtin, which the narrower predicate called a violation', () => {
    // `check-changeset-fixed.mjs` and `check-type-check-coverage.mjs` really do
    // spell theirs `from "fs"`. That is install-free, so requiring the `node:`
    // prefix would be a style rule wearing a gate's clothes.
    expect(isBuiltinSpecifier('fs')).toBe(true);
    expect(isBuiltinSpecifier('node:fs')).toBe(true);
    expect(isBuiltinSpecifier('typescript')).toBe(false);
    expect(graphOf({ 'scripts/a.mjs': 'import { readFileSync } from "fs";\n' }, 'scripts/a.mjs').violations).toEqual(
      [],
    );
  });

  it('reads an import in a comment or a string literal as prose, not as code', () => {
    // `check-entry-guard.mjs` carries `'require("fs").writeFileSync(…)'` inside
    // a corpus string, and the gate's own self-test spells a `typescript` import
    // inside a fixture. A scan that counted either would invent findings.
    const source = [
      "import { readFileSync } from 'node:fs';",
      "// import ts from 'typescript';",
      'const FIXTURE = "import ts from \'typescript\';";',
      'export const x = [readFileSync, FIXTURE];',
    ].join('\n');
    expect(staticSpecifiers(source)).toEqual(['node:fs']);
  });

  it('reports a relative import that resolves to nothing instead of walking past it', () => {
    const graph = graphOf({ 'scripts/a.mjs': "import './gone.mjs';\n" }, 'scripts/a.mjs');
    expect(graph.unresolved.map((u) => u.specifier)).toEqual(['./gone.mjs']);
  });

  it('terminates on a cycle', () => {
    const graph = graphOf(
      { 'scripts/a.mjs': "import './b.mjs';\n", 'scripts/b.mjs': "import './a.mjs';\n" },
      'scripts/a.mjs',
    );
    expect(graph.modules.sort()).toEqual(['scripts/a.mjs', 'scripts/b.mjs']);
  });
});

// ── 3. the floor over the real tree ──────────────────────────────────────────

describe('the real tree — every step objectui#6148 measured is still derived', () => {
  const result = scan(repoRoot) as {
    steps: Array<{ workflow: string; job: string; script: string }>;
    scripts: string[];
    modules: string[];
    findings: Array<{ script: string; chain: string[]; kind: string }>;
  };
  const rows = new Set(result.steps.map((s) => `${s.workflow} : ${s.job} -> ${s.script}`));

  /**
   * The table objectui#6148 measured, plus `lint.yml`'s entry-guard step, which
   * the card named separately. A FLOOR, not an inventory: the assertion is that
   * none of these silently leaves the population. The gate's own `--list` is
   * where the current total lives, and pinning a total here would drift.
   */
  const MEASURED = [
    'changeset-guard.yml : no-major -> scripts/check-changeset-no-major.mjs',
    'changeset-presence.yml : changeset-presence -> scripts/check-changeset-presence.mjs',
    'ci.yml : changeset-check -> scripts/check-changeset-fixed.mjs',
    'ci.yml : type-check -> scripts/check-type-check-coverage.mjs',
    'control-bytes.yml : control-bytes -> scripts/check-control-bytes.mjs',
    'doc-component-types.yml : doc-component-types -> scripts/check-doc-component-types.mjs',
    'docs-links.yml : docs-links -> scripts/check-doc-links.mjs',
    'skills-paths.yml : skills-paths -> scripts/check-skills-paths.mjs',
    'lint.yml : lint -> scripts/check-entry-guard.mjs',
  ];

  it.each(MEASURED)('still derives %s', (row) => {
    expect([...rows], `the population no longer contains this step — was it moved below an install?`).toContain(row);
  });

  it('walks every pre-install script it derived, and reaches past the entries', () => {
    // The walk is only worth anything if it follows relative edges: since
    // objectui#6092 these scripts share `scripts/invoked-as.mjs`, which is
    // reached by no workflow step directly.
    expect(result.modules).toContain('scripts/invoked-as.mjs');
    expect(result.modules.length).toBeGreaterThan(result.scripts.length);
  });

  it('is in its own population — the gate walks its own import graph', () => {
    // A floor that exempted its own enforcer would be the first thing to rot.
    expect(result.scripts).toContain(SCRIPT);
  });

  it('finds no pre-install gate reaching a package', () => {
    expect(
      result.findings.map((f) => `${f.kind}: ${f.chain.join(' -> ')}`),
      'a script this repository runs before `pnpm install` needs `node_modules` to load',
    ).toEqual([]);
  });
});

// ── 4. the wiring ────────────────────────────────────────────────────────────

describe('the gate is wired, not merely present', () => {
  const yaml = withoutComments(readWorkflow(WORKFLOW));

  it('exists, with a package.json alias that names the same file', () => {
    expect(fs.existsSync(path.join(repoRoot, SCRIPT))).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:pre-install-import-graph']).toContain(SCRIPT);
  });

  it('runs both legs — the self-test first, then the scan', () => {
    expect(yaml).toContain(`node ${SCRIPT} --self-test`);
    expect(yaml.split('\n').some((l) => l.trim() === `node ${SCRIPT}`)).toBe(true);
  });

  it('needs no install, which is the property it exists to protect', () => {
    expect(yaml).not.toMatch(/pnpm install/);
    expect(yaml).not.toMatch(/corepack/);
  });

  it('carries NO path filter of any kind', () => {
    // Deliberate: its input is the workflows themselves, and a workflow edit is
    // the change most likely to break it. A filter would also make the check
    // unrequirable (objectui#3523).
    expect(yaml).not.toMatch(/paths-ignore:/);
    expect(yaml).not.toMatch(/^\s+paths:/m);
  });

  it('subscribes merge_group, so a queue build is not stalled by a silent context', () => {
    expect(yaml).toMatch(/^\s{2}merge_group:/m);
  });

  it('is the only workflow that runs it — one gate, one home', () => {
    const runners = fs
      .readdirSync(workflowDir)
      .filter((f) => f.endsWith('.yml'))
      .filter((f) => withoutComments(readWorkflow(f)).includes(SCRIPT));
    expect(runners).toEqual([WORKFLOW]);
  });

  it('is classified by the Dependabot merge gate as a blocking check', () => {
    // objectui#6135: an UNCLASSIFIED blocking check is one a Dependabot merge
    // would be let past. `dependabot-merge-gate.test.ts` asserts the partition
    // itself; this asserts the direction that matters for this check.
    expect(REQUIRED_CONTEXTS).toContain(CHECK_NAME);
  });

  it('names the same check in the workflow as the gate requires', () => {
    expect(yaml).toContain(`name: ${CHECK_NAME}`);
  });

  it('passes its own self-test', () => {
    // A scan whose recogniser is broken reports a clean tree.
    const out = execFileSync('node', [SCRIPT, '--self-test'], { cwd: repoRoot, encoding: 'utf8' });
    expect(out).toContain('self-test:');
    expect(out).toMatch(/^✓/);
  });
});
