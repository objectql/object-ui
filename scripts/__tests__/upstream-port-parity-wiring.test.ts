import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const GATE = 'scripts/check-upstream-port-parity.mjs';
const PIN = 'scripts/upstream-port-pin.json';

/**
 * objectui#6642: `scripts/pm/check-half-states.mjs` was copied here from
 * objectstack (objectui#5791) and then drifted for months with nothing able to
 * see it. Measured the day this gate landed: 9,340 lines here against 12,948
 * upstream — a 4,637-line `diff` — and 1,116 self-test cases here against
 * upstream's 1,574. The patrol kept rendering a confident report with the
 * missing predicates' rows simply absent.
 *
 * The gate closes that. This file pins the gate to its WIRING, in the direction
 * that goes wrong quietly: a parity check nobody runs is indistinguishable from
 * a parity check that passes — which is exactly the state the ported sweeper
 * was already in, one level down.
 *
 * Deliberately NOT asserted here: any digest, any line count, or the number of
 * declared divergences. Those live in the pin, they move every time someone
 * re-syncs, and a copy of them here would be a second thing to keep honest —
 * the lesson `lint-workflow.test.ts` records at length for this same workflow.
 * What is asserted is that the mechanism is reachable, runs, and is not
 * vacuous.
 */
describe('check-upstream-port-parity is wired, not merely present', () => {
  const workflow = parseYaml(fs.readFileSync(path.join(ROOT, '.github/workflows/lint.yml'), 'utf8'));
  const steps: Array<Record<string, unknown>> = workflow.jobs.lint.steps;
  const gateSteps = steps.filter((s) => typeof s.run === 'string' && (s.run as string).includes(GATE));

  it('the gate script and its pin both exist', () => {
    expect(fs.existsSync(path.join(ROOT, GATE))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, PIN))).toBe(true);
  });

  it('package.json aliases it, and the alias points at the script that exists', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const alias = pkg.scripts['check:upstream-port-parity'];
    expect(alias).toBeTruthy();
    expect(alias).toContain(GATE);
  });

  it('lint.yml runs it — exactly one step, both legs', () => {
    expect(gateSteps).toHaveLength(1);
    const run = gateSteps[0].run as string;
    expect(run).toContain(`node ${GATE} --self-test`);
    expect(run.split('\n').some((l) => l.trim() === `node ${GATE}`)).toBe(true);
  });

  it('that step is not disabled — it runs whenever the job runs its other steps', () => {
    // The same guard the rest of the job uses, read off a sibling rather than
    // hard-coded: objectui#3523's shape may be renamed, and a test pinning the
    // literal would fail on a rename while a step commented out with
    // `if: false` would not.
    const condition = gateSteps[0].if;
    const others = steps
      .filter((s) => s !== gateSteps[0] && typeof s.uses !== 'undefined')
      .map((s) => s.if);
    expect(others).toContain(condition);
  });

  it('it runs BEFORE pnpm install, so an install failure cannot take it with it', () => {
    const gateIndex = steps.indexOf(gateSteps[0]);
    const installIndex = steps.findIndex(
      (s) => typeof s.run === 'string' && (s.run as string).includes('pnpm install'),
    );
    expect(installIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(installIndex);
  });

  it('the pin really pins the ported sweeper — the file the card is about', () => {
    // The one content assertion, and it is about COVERAGE rather than about
    // values: a pin that stopped naming `check-half-states.mjs` would leave the
    // gate green while the drift it was written for resumed.
    const pin = JSON.parse(fs.readFileSync(path.join(ROOT, PIN), 'utf8'));
    const pinned = pin.files.map((f: { ported: string }) => f.ported);
    expect(pinned).toContain('scripts/pm/check-half-states.mjs');
    // …and its helper, which the patrol workflow's own `paths:` filter already
    // treats as part of the same unit.
    expect(pinned).toContain('scripts/invoked-as.mjs');
  });

  it('the pinned files are the ones the patrol workflow watches', () => {
    // Both directions of the same claim: a file added to the patrol's paths
    // filter but not to the pin drifts unwatched, and a file in the pin that
    // the patrol no longer uses is a stale obligation.
    const patrol = parseYaml(
      fs.readFileSync(path.join(ROOT, '.github/workflows/half-state-patrol.yml'), 'utf8'),
    );
    const watched: string[] = patrol.on.pull_request.paths;
    const pin = JSON.parse(fs.readFileSync(path.join(ROOT, PIN), 'utf8'));
    const pinned: string[] = pin.files.map((f: { ported: string }) => f.ported);
    for (const p of pinned) expect(watched).toContain(p);
  });

  it('its self-test passes — the half that makes a green comparison mean something', () => {
    const out = execFileSync('node', [GATE, '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/check-upstream-port-parity self-test: \d+ cases pass/);
  });

  it('and the tree itself is at parity right now', () => {
    // Not a duplicate of the CI step: this is the assertion that the pin
    // shipped in this commit describes the files shipped in this commit. A pin
    // updated without its file, or the reverse, fails here at review time
    // rather than on someone else's branch.
    const out = execFileSync('node', [GATE], { cwd: ROOT, encoding: 'utf8' });
    expect(out).toMatch(/ported file\(s\) match/);
  });
});
