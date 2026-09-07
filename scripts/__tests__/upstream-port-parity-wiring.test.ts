import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { selfTestCases, stripAnsi, verdictCount } from './helpers/child-verdict';

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

  it("the patrol's own ported unit is pinned, in both directions", () => {
    // ⚠️ Re-scoped by objectui#7263, which registered the first entry OUTSIDE
    // `scripts/`. This assertion used to read `pinned ⊆ watched` — every pinned
    // file must appear in the patrol's paths filter — which silently encoded
    // "the ledger only ever pins the sweeper's unit". That was true of the two
    // entries that existed and is not a property of the ledger: the patrol runs
    // ONE ported program, and a hook self-test has no business in its filter.
    //
    // Both directions are kept, each scoped to the thing it is actually about:
    // a ported file the patrol watches but nothing pins drifts unwatched, and a
    // pinned file from the patrol's own unit that the patrol dropped is a stale
    // obligation. The reach of the pin BEYOND that unit is the next test's job.
    const patrol = parseYaml(
      fs.readFileSync(path.join(ROOT, '.github/workflows/half-state-patrol.yml'), 'utf8'),
    );
    const watched: string[] = patrol.on.pull_request.paths;
    const pin = JSON.parse(fs.readFileSync(path.join(ROOT, PIN), 'utf8'));
    const pinned: string[] = pin.files.map((f: { ported: string }) => f.ported);
    // forward: everything the patrol watches, other than the workflow file that
    // declares the watch, is a ported program and must be pinned.
    for (const p of watched.filter((w) => !w.startsWith('.github/'))) expect(pinned).toContain(p);
    // back: the patrol's own unit, identified by where the sweeper lives, must
    // still be in that filter.
    for (const p of pinned.filter((f) => f.startsWith('scripts/pm/'))) expect(watched).toContain(p);
  });

  it('every pinned file is one the gate actually runs on when it drifts', () => {
    // The wiring claim that had to exist once the ledger reached past
    // `scripts/` (objectui#7263). `lint.yml` runs this gate, and its `relevant`
    // step skips every step below it when a pull request touches ONLY the paths
    // it ignores. A ported file inside that ignore set would be pinned and
    // unwatched at the same time: the PR that drifts it is exactly the PR on
    // which the gate does not run, and the drift lands green — the failure this
    // whole mechanism exists to make impossible, one level up.
    const lintYml = fs.readFileSync(path.join(ROOT, '.github/workflows/lint.yml'), 'utf8');
    const relevant = lintYml.slice(lintYml.indexOf('id: relevant'));
    const ignored = [...relevant.matchAll(/':\(exclude,glob\)([^']+)'/g)].map((m) => m[1]);
    // Tokenised, not chained replaces: a chain rewrites the `*` it has already
    // emitted into a substitution, and the resulting pattern matches nothing —
    // an assertion that passes because it recognises nothing, which is the
    // shape this whole file is about.
    const matches = (glob: string, file: string) =>
      new RegExp(
        `^${glob
          .split(/(\*\*\/|\*\*|\*|\?)/)
          .map((tok) =>
            tok === '**/'
              ? '(?:.*/)?'
              : tok === '**'
                ? '.*'
                : tok === '*'
                  ? '[^/]*'
                  : tok === '?'
                    ? '[^/]'
                    : tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          )
          .join('')}$`,
      ).test(file);

    // The control leg: every glob in that list must actually recognise a file
    // it is there to ignore. Without this the loop below is green on a matcher
    // that never matches.
    expect(ignored).toEqual(expect.arrayContaining(['**/*.md', 'content/**', 'docs/**', '.changeset/**']));
    expect(ignored.filter((g) => matches(g, 'docs/adr/0001-example.md'))).toEqual(['**/*.md', 'docs/**']);
    expect(ignored.filter((g) => matches(g, 'content/docs/guide/a.md'))).toEqual(['**/*.md', 'content/**']);
    expect(ignored.filter((g) => matches(g, '.changeset/lucky-pans-smile.md'))).toEqual(['**/*.md', '.changeset/**']);

    const pin = JSON.parse(fs.readFileSync(path.join(ROOT, PIN), 'utf8'));
    const pinned: string[] = pin.files.map((f: { ported: string }) => f.ported);
    for (const file of pinned) {
      expect({ file, ignoredBy: ignored.filter((g) => matches(g, file)) }).toEqual({ file, ignoredBy: [] });
    }
  });

  it('its self-test passes — the half that makes a green comparison mean something', () => {
    const out = execFileSync('node', [GATE, '--self-test'], { cwd: ROOT, encoding: 'utf8' });
    // objectui#7897 — the COUNT, not the shape. `\d+ cases pass` is satisfied
    // by `0 cases pass`, so the old spelling passed for a self-test whose case
    // table had gone empty: the outcome it exists to refuse. `selfTestCases`
    // also strips ANSI, the second belt for a child that starts colouring.
    expect(stripAnsi(out)).toMatch(/check-upstream-port-parity self-test: \d+ cases pass/);
    expect(
      selfTestCases(out, 'check-upstream-port-parity'),
      'a self-test that ran no cases is not a passing self-test',
    ).toBeGreaterThan(0);
  });

  it('and the tree itself is at parity right now', () => {
    // Not a duplicate of the CI step: this is the assertion that the pin
    // shipped in this commit describes the files shipped in this commit. A pin
    // updated without its file, or the reverse, fails here at review time
    // rather than on someone else's branch.
    const out = execFileSync('node', [GATE], { cwd: ROOT, encoding: 'utf8' });
    // objectui#7897 — `/ported file\(s\) match/` is satisfied by `0 ported
    // file(s) match`: an EMPTY pin, checked against nothing, reads exactly like
    // a tree at parity. The count is read out of the verdict and reconciled
    // with the pin shipped in this commit, so the two cannot drift apart
    // silently. ANSI is stripped as the second belt (this gate does not colour).
    const pinned = JSON.parse(fs.readFileSync(path.join(ROOT, PIN), 'utf8')) as { files: unknown[] };
    expect(pinned.files.length, 'a pin with no files would make the verdict below vacuous').toBeGreaterThan(0);
    expect(verdictCount(out, /(\d+) ported file\(s\) match/, 'ported file count')).toBe(pinned.files.length);
  });
});
