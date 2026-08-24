import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { census, listDocuments as fenceDocuments, TS_FENCE_LANGUAGES as GUARD_TS_FENCES } from '../check-doc-fence-languages.mjs';
import { listDocuments as snippetDocuments, TS_FENCE_LANGUAGES as GATE_TS_FENCES } from '../check-doc-snippet-types.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const GUARD = 'scripts/check-doc-fence-languages.mjs';
const WORKFLOW = 'doc-fence-languages.yml';

/**
 * objectui#6135. `check-doc-snippet-types` reads `ts` / `tsx` / `typescript`
 * fences, so a TypeScript block fenced any other way is invisible to it, and
 * objectui#5867's remediation lane collected its population from `plaintext`
 * fences only — one spelling of an unhighlighted fence out of several. A
 * ```text block opening `interface FileUploadSchema {` was outside both.
 *
 * `check-doc-fence-languages.mjs` closes that by reading BODIES rather than
 * pinning a list of languages. This file pins the two things its correctness
 * rests on and cannot check about itself:
 *
 *   1. **The scan surface really is the gate's.** The guard re-implements
 *      `listDocuments` so it needs no `pnpm install` — the gate imports
 *      `typescript`, and an install-gated docs check is one a docs-only pull
 *      request skips, which is the hole `doc-component-types.yml`'s header
 *      records. A copy that is never compared is a copy free to drift, and the
 *      drift direction is silent: a document the guard stops walking is a
 *      document nothing reports on. So both walks are imported and compared.
 *   2. **The wiring.** A gate nobody runs is indistinguishable from a gate that
 *      passes (`entry-guard-wiring.test.ts` records that lesson for its own
 *      subject). The alias, the workflow, the self-test leg and the
 *      unfiltered triggers are asserted here.
 *
 * Deliberately NOT asserted: the size of the baseline or the number of blocks it
 * carries. Those move with every objectui#5867 batch, and a hand-copied
 * enumeration in a test drifts by construction — the lesson `lint-workflow.test.ts`
 * records for this repository at length. The guard's own output is the honest
 * place for those numbers.
 */
describe('check-doc-fence-languages: the scan surface is check-doc-snippet-types’s', () => {
  it('walks exactly the documents the snippet gate walks', () => {
    expect(fenceDocuments(ROOT)).toEqual(snippetDocuments(ROOT));
  });

  it('…and that is a non-empty set, so the comparison is not vacuous', () => {
    expect(fenceDocuments(ROOT).length).toBeGreaterThan(100);
  });

  it('treats exactly the snippet gate’s fence languages as already-covered', () => {
    expect([...GUARD_TS_FENCES].sort()).toEqual([...GATE_TS_FENCES].sort());
  });
});

describe('check-doc-fence-languages: non-vacuity, through the shipped module', () => {
  const TS_BODY = 'interface FileUploadSchema {\n  accept?: string;\n}';
  const doc = (info: string, body: string = TS_BODY) => [
    { rel: 'probe.mdx', source: ['```' + info, body, '```'].join('\n') },
  ];
  const modes = (info: string, body?: string) =>
    census(doc(info, body)).sites.map((s: { mode: string }) => s.mode);

  // The three spellings the 2026-08-24 ruling on objectui#6135 named by hand.
  it.each(['text', 'txt', ''])('a TypeScript block fenced %o is found', (info) => {
    expect(modes(info)).toEqual(['synonym']);
  });

  it('names the file and the fence line, rather than only counting', () => {
    const [site] = census(doc('text')).sites;
    expect(site).toMatchObject({ rel: 'probe.mdx', line: 1, language: 'text', mode: 'synonym' });
  });

  it.each(['ts', 'tsx', 'typescript'])('the same block fenced %o is not a finding', (info) => {
    expect(modes(info)).toEqual([]);
  });

  it('a spelling nobody has thought of is the OTHER failure mode', () => {
    expect(modes('console')).toEqual(['unknown']);
  });

  it('prose under an unhighlighted fence is not a finding — the classifier is quoted, not widened', () => {
    expect(modes('plaintext', 'Upload a file, then press Save.')).toEqual([]);
  });
});

describe('check-doc-fence-languages is wired, not merely present', () => {
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, '.github/workflows', WORKFLOW), 'utf8'));
  const steps: Array<Record<string, unknown>> = workflow.jobs['doc-fence-languages'].steps;
  const gateSteps = steps.filter((s) => typeof s.run === 'string' && (s.run as string).includes(GUARD));

  it('the guard script exists', () => {
    expect(fs.existsSync(path.join(ROOT, GUARD))).toBe(true);
  });

  it('package.json aliases it, and the alias points at the script that exists', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:doc-fences']).toContain(GUARD);
  });

  it('the workflow runs it — one step, both legs', () => {
    expect(gateSteps).toHaveLength(1);
    const run = gateSteps[0].run as string;
    expect(run).toContain(`node ${GUARD} --self-test`);
    expect(run.split('\n').some((l) => l.trim() === `node ${GUARD}`)).toBe(true);
  });

  it('one gate, one home — no other workflow runs the same script', () => {
    const dir = path.join(ROOT, '.github/workflows');
    const others = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.yml') && f !== WORKFLOW)
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(GUARD));
    expect(others).toEqual([]);
  });

  it('has no paths filter — the defect it catches arrives in a docs-only pull request', () => {
    // `on` parses as the boolean `true` in YAML 1.1; `yaml` gives back `on`.
    const on = workflow.on ?? workflow[true as unknown as string];
    expect(Object.keys(on)).toContain('pull_request');
    expect(on.pull_request).not.toHaveProperty('paths');
    expect(on.pull_request).not.toHaveProperty('paths-ignore');
  });

  it('subscribes to the merge queue, so it cannot stall one if it becomes required', () => {
    const on = workflow.on ?? workflow[true as unknown as string];
    expect(Object.keys(on)).toContain('merge_group');
  });

  it('needs no install — nothing in the job runs pnpm', () => {
    const runs = steps.map((s) => (typeof s.run === 'string' ? s.run : '')).join('\n');
    expect(runs).not.toContain('pnpm');
  });

  it('its self-test passes — the half that makes a green scan mean something', () => {
    const out = execFileSync('node', [GUARD, '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/check-doc-fence-languages self-test: \d+ cases pass/);
  });
});
