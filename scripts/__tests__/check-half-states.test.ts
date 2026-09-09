import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

// Plain-JS CI helper; types are INFERRED from the .mjs by `tsconfig.scripts.json`
// (`allowJs`), so no `@ts-expect-error` here. See objectui#3494.
import {
  CLOSED_ISSUE_WINDOW_PAGES,
  DEFAULT_SWEEP_REPO,
  h22ClosedCardPmResidue,
  resolveClosedWindowPages,
  resolveClosureFloor,
  resolveSweepRepo,
  seatLane,
  summaryLine,
} from '../pm/check-half-states.mjs';

import { selfTestCases, stripAnsi } from './helpers/child-verdict';

/**
 * objectui#5791 — the half-state patrol, PORTED from objectstack (PR #11294).
 *
 * ## What this file is for, and what it deliberately is not
 *
 * The sweeper carries its own `--self-test`, and that suite is the authority on
 * the twenty-odd predicates. Re-asserting predicates here would fork the pin:
 * two copies drifting apart, one of them not the one upstream maintains. So the
 * first test below simply RUNS that suite in CI — the point being that a port
 * whose self-test nobody executes is the #4690 shape again (a check that reads
 * as enforcement while nothing invokes it).
 *
 * ⚠️ REPLACED PIN (objectui#6642): that sentence used to say "~1,077-case", and
 * the figure was 1,116 by then and is 1,574 after the re-sync. The count is
 * deliberately gone rather than refreshed — a hand-copied enumeration drifts by
 * construction and a stale one reads exactly as authoritative as a fresh one,
 * which is the lesson `lint-workflow.test.ts` records at length for this repo.
 * The assertion below never read the number and still does not.
 *
 * Everything after it pins the ADAPTATIONS instead — the handful of places this
 * install diverges from upstream. Those are exactly the lines a future verbatim
 * re-sync from objectstack would clobber silently, and each one is load-bearing:
 * dropping any of them does not break the patrol loudly, it makes the patrol
 * report something false quietly.
 *
 * ## What this file cannot see, and what now can (objectui#6642)
 *
 * By construction it looks only at THIS copy. It cannot tell whether upstream
 * has moved, which is how the port drifted 4,637 lines behind while every test
 * here stayed green. `scripts/check-upstream-port-parity.mjs` is the half that
 * looks the other way: it pins the ported files against a named upstream commit
 * modulo the same adaptations, byte-for-byte. The two are complements — that
 * gate proves the copy still IS the copy; this file proves the adaptations
 * survived being one.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sweeperPath = path.join(repoRoot, 'scripts/pm/check-half-states.mjs');
const workflowPath = path.join(repoRoot, '.github/workflows/half-state-patrol.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

describe('check-half-states — the ported sweeper', () => {
  it('passes its own self-test', () => {
    // Exit status is the assertion; a non-zero exit throws out of execFileSync.
    const out = execFileSync(process.execPath, [sweeperPath, '--self-test'], {
      encoding: 'utf8',
      cwd: repoRoot,
    });
    // objectui#7897 — the COUNT, not the shape. `\d+ cases pass` is satisfied
    // by `0 cases pass`, so the old spelling passed for a self-test whose case
    // table had gone empty: the outcome it exists to refuse. `selfTestCases`
    // also strips ANSI, the second belt for a child that starts colouring —
    // that is the CI-only direction, and no repo gate colours today.
    expect(stripAnsi(out)).toMatch(/✓ check-half-states self-test: \d+ cases pass\./);
    expect(
      selfTestCases(out, 'check-half-states'),
      'a self-test that ran no cases is not a passing self-test',
    ).toBeGreaterThan(0);
  });

  it('lives at the path the workflow invokes', () => {
    // Path parity with objectstack is what keeps a re-sync a straight copy. If
    // the file moves, the workflow's `node scripts/pm/...` line and its
    // `paths:` filter both rot — and the patrol would simply stop running.
    expect(fs.existsSync(sweeperPath)).toBe(true);
    expect(workflow).toContain('node scripts/pm/check-half-states.mjs');
  });

  it('ports the helper it imports, rather than the import alone', () => {
    // `scripts/invoked-as.mjs` is objectstack-resident and had no objectui
    // equivalent; without it the sweeper cannot even be loaded.
    expect(fs.existsSync(path.join(repoRoot, 'scripts/invoked-as.mjs'))).toBe(true);
  });
});

describe('check-half-states — sweeps THIS board (objectui#5791 adaptation)', () => {
  it('defaults to this repository, not the repository it was ported from', () => {
    // Upstream's constant is `objectstack-ai/objectstack`. Carried over
    // unchanged, a bare `node scripts/pm/check-half-states.mjs` in this repo
    // would render a fully green report about a DIFFERENT board — the precise
    // "report about the wrong repo reads exactly like a report about this one"
    // failure the parameterisation exists to prevent.
    expect(DEFAULT_SWEEP_REPO).toBe('objectstack-ai/objectui');
    expect(resolveSweepRepo({}).repo).toBe('objectstack-ai/objectui');
  });

  it('still lets an explicit target win, so the workflow wiring is unchanged', () => {
    expect(resolveSweepRepo({ GITHUB_REPOSITORY: 'objectstack-ai/cloud' }).repo).toBe('objectstack-ai/cloud');
    expect(workflow).toContain('PM_SWEEP_REPO: ${{ github.repository }}');
  });
});

describe('check-half-states — H32 lane foreignness inverts here (objectui#6642)', () => {
  /**
   * A divergence the re-sync DISCOVERED rather than one it authored, and the
   * only one that made a verbatim copy impossible outright: upstream's H32 rows
   * do not merely read oddly here, they FAIL. Three of them, on the first run
   * of upstream's suite against this install.
   *
   * `seatLane` decides whether a seat post's lane is readable from this sweep by
   * comparing the title's `@ <repo>` suffix against the RESOLVED sweep repo —
   * a live value, not a constant. Upstream's self-test rows hard-code
   * `@ objectui` as the foreign specimen and `@ objectstack` as the own-board
   * one, which is correct there and exactly backwards here.
   *
   * The property being asserted is identical in both installs; only the
   * specimens swap. ⚠️ Which is why this block is the one adaptation that
   * should NOT be defended: the day upstream derives its specimen from the
   * resolved repo instead of writing the name, three pin entries disappear and
   * these rows become redundant with upstream's own.
   */
  const seat = (title: string) => ({ title });

  it('reads a SIBLING board\'s lane as foreign — and the sibling here is objectstack', () => {
    expect(seatLane(seat('[PM seat] domain:devx @ objectstack — 🟢 os-x')).foreign).toBe(true);
  });

  it('…and this board\'s own lane as readable, keeping the bare label', () => {
    const own = seatLane(seat('[PM seat] domain:devx @ objectui — 🟢 os-x'));
    expect(own.foreign).toBe(false);
    expect(own.lane).toBe('domain:devx');
  });

  it('the specimens follow the RESOLVED sweep repo, which is what makes this a divergence', () => {
    // Pinning the coupling itself rather than a value: this line is the reason
    // upstream's rows cannot be carried verbatim, and its removal upstream is
    // the event that retires this whole block plus three pin entries.
    const src = fs.readFileSync(sweeperPath, 'utf8');
    expect(src).toContain("SWEEP_REPO.repo.split('/')[1]");
    // Both places this install resolves that value agree, so the rows above
    // hold on a runner (GITHUB_REPOSITORY) and in a bare terminal (the default).
    expect(resolveSweepRepo({}).repo).toBe('objectstack-ai/objectui');
    expect(resolveSweepRepo({ GITHUB_REPOSITORY: 'objectstack-ai/objectui' }).repo).toBe('objectstack-ai/objectui');
  });
});

describe('check-half-states — H22 runs here behind a DATED CLOSURE FLOOR (objectui#5985)', () => {
  /**
   * ⚠️ REPLACED PIN, not a respelled one. Until 2026-08-28 this block pinned the
   * opposite arrangement: the reader fully OFF via `PM_SWEEP_CLOSED_WINDOW_PAGES:
   * '0'`, under a ruling that stripping `pm:*` on close was not this lane's
   * convention. That ruling is superseded — fleet practice now strips `pm:*` in
   * the landing/close stroke, and the convention is written into the pm-dispatch
   * protocol's label-discipline section as of 2026-08-28.
   *
   * The measurement that forced the original hold still stands and is why the
   * re-enable is FLOORED rather than plain (re-measured 2026-08-24 for the
   * port): 815 closed cards here carry `pm:dispatched`, and ~347 of the 400
   * issues inside upstream's window carry some `pm:*` residue label (~87%,
   * against the 26% upstream measured on its own board). An unfloored re-enable
   * would report the CONVENTION rather than defects — ~347 rows that exhaust
   * the body budget and trim every other predicate out of the anchor on day one.
   *
   * ⛔ The floor is what makes the re-enable cheap: no backfill of the 815
   * historical carriers was run, and none is owed. The sweeper writes no label
   * under any code path, so no bulk rewrite is even reachable from here.
   */
  it('keeps upstream\'s page default in the script, so the port stays a straight copy', () => {
    // The divergence lives in the WORKFLOW, not in the script's default. This
    // is what lets the predicate file be re-synced verbatim.
    expect(CLOSED_ISSUE_WINDOW_PAGES).toBe(4);
    expect(resolveClosedWindowPages({}).pages).toBe(4);
    expect(resolveClosedWindowPages({}).source).toBe('default');
  });

  it('is switched ON by the workflow — the page-window hold is GONE', () => {
    // The hold's absence is asserted directly. Left in place beside a floor it
    // would win silently (0 pages reads nothing whatever the floor says), and
    // the anchor would keep reporting UNREAD while looking re-enabled.
    expect(workflow).not.toMatch(/^\s*PM_SWEEP_CLOSED_WINDOW_PAGES:/m);
    expect(resolveClosedWindowPages({}).pages).toBe(4);
  });

  it('sets a dated floor in the workflow, and visibly so', () => {
    expect(workflow).toMatch(/PM_SWEEP_CLOSED_FLOOR: '2026-08-28'/);
    const resolved = resolveClosureFloor({ PM_SWEEP_CLOSED_FLOOR: '2026-08-28' });
    expect(resolved.valid).toBe(true);
    expect(resolved.floor?.toISOString()).toBe('2026-08-28T00:00:00.000Z');
  });

  it('refuses a malformed page count instead of silently defaulting', () => {
    // The knob still exists and still refuses garbage — it is simply not what
    // holds the historical residue out any more.
    for (const raw of ['O', '-1', '1.5', 'four']) {
      expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: raw }).valid).toBe(false);
    }
    expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: ' 2 ' }).pages).toBe(2);
  });

  it('refuses a malformed floor instead of silently running unfloored', () => {
    // ⛔ The property the re-enable turns on. A floor that degraded to "no
    // floor" would put ~347 convention rows in the anchor four times a day,
    // and a flooded anchor reads exactly like a working patrol.
    for (const raw of ['28-08-2026', '2026/08/28', 'yesterday', '2026-8-28', 'O']) {
      expect(resolveClosureFloor({ PM_SWEEP_CLOSED_FLOOR: raw }).valid).toBe(false);
      expect(resolveClosureFloor({ PM_SWEEP_CLOSED_FLOOR: raw }).floor).toBeNull();
    }
    // …including a shape-valid date that does not exist. `Date.parse` rolls
    // `2026-02-31` to March rather than rejecting it, so the resolver
    // round-trips the parse instead of trusting it.
    expect(resolveClosureFloor({ PM_SWEEP_CLOSED_FLOOR: '2026-02-31' }).valid).toBe(false);
    // Unset is valid and means "no floor" — upstream's own behaviour.
    expect(resolveClosureFloor({}).valid).toBe(true);
    expect(resolveClosureFloor({}).floor).toBeNull();
  });

  it('applies the floor to the H22 predicate: old closures out, new ones judged', () => {
    // The whole re-enable, in two assertions. The old card is the ~815-card
    // backlog in miniature — real residue, deliberately NOT a finding.
    const closedCard = {
      state: 'closed',
      state_reason: 'completed',
      labels: [{ name: 'pm:dispatched' }],
    };
    const floor = resolveClosureFloor({ PM_SWEEP_CLOSED_FLOOR: '2026-08-28' }).floor;
    expect(h22ClosedCardPmResidue({ ...closedCard, closed_at: '2026-01-01T00:00:00Z' }, floor)).toBeNull();
    expect(h22ClosedCardPmResidue({ ...closedCard, closed_at: '2026-08-29T00:00:00Z' }, floor)).toContain('`pm:dispatched`');
    // The cutover date itself is judged: it is the first day the convention
    // applies, so cards closed within it are the convention's own population.
    expect(h22ClosedCardPmResidue({ ...closedCard, closed_at: '2026-08-28T12:00:00Z' }, floor)).toContain('`pm:dispatched`');
    // Unfloored, the predicate is byte-for-byte upstream's — the port stays a
    // straight copy and the floor is opt-in.
    expect(h22ClosedCardPmResidue({ ...closedCard, closed_at: '2026-01-01T00:00:00Z' })).toContain('`pm:dispatched`');
    expect(h22ClosedCardPmResidue({ ...closedCard, state: 'open' }, floor)).toBeNull();
  });

  it('names the floor in the summary, so a floored pass cannot read as a full one', () => {
    // ⛔ #4690, in the shape this change could newly break: "H22 read 200" with
    // a floor silently applied overstates what was judged. The line must carry
    // the floor date, and must say the earlier closures are UNJUDGED rather
    // than clean.
    const counts = { repo: 'objectstack-ai/objectui', issues: 3, unscoped: 4, prs: 1, merged: 2, closed: 200 };
    const floored = summaryLine({ ...counts, closedFloor: '2026-08-28' }, 0);
    expect(floored).toContain('H22 read 200 recently-closed issue(s)');
    expect(floored).toContain('only cards closed on/after 2026-08-28 are judged');
    expect(floored).toContain('NOT a reading about them');
    // An unfloored pass must not grow the clause.
    expect(summaryLine(counts, 0)).not.toContain('are judged');
  });

  it('still reports a DISABLED reader as UNREAD, never as clean', () => {
    // The disabled branch is no longer wired here, but it is still live code
    // and still the property the port turned on (#4690): a disabled reader and
    // an empty result are the same number and opposite facts. Kept pinned so
    // re-adding the hold cannot quietly render "H22 read 0".
    const counts = { repo: 'objectstack-ai/objectui', issues: 3, unscoped: 4, prs: 1, merged: 2, closed: 0 };
    const disabled = summaryLine({ ...counts, closedWindowDisabled: true }, 0);
    expect(disabled).toContain('is DISABLED in this install');
    expect(disabled).toContain('UNREAD');
    expect(disabled).not.toContain('H22 read 0');
    expect(disabled).toContain('PM_SWEEP_CLOSED_WINDOW_PAGES');

    // The other direction: an enabled reader that found nothing IS a clean
    // reading of the surface and must keep saying so.
    const enabled = summaryLine(counts, 0);
    expect(enabled).toContain('H22 read 0 recently-closed issue(s)');
    expect(enabled).not.toContain('is DISABLED in this install');
  });
});

describe('half-state-patrol.yml — report-only, as ruled on objectui#5791', () => {
  it('writes exactly one issue body and nothing else', () => {
    // The patrol surfaces half-states for a human or a seat to action. A patrol
    // that acts on its own findings is a different and much larger card, so the
    // mutating calls are pinned ABSENT rather than left to review.
    for (const forbidden of [
      'addLabels',
      'removeLabel',
      'setLabels',
      'createComment',
      'addAssignees',
      'issues.create(',
    ]) {
      expect(workflow, `the patrol must not call ${forbidden} — it is report-only`).not.toContain(forbidden);
    }
    expect(workflow).toContain('issues.update(');
  });

  it('asks for no permission beyond that one write', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*issues: write/);
  });

  it('never fails the run on findings, only on a sweep that could not run', () => {
    // `exit 1` is reachable only through the sweep's own non-zero exit code.
    expect(workflow).toContain("if: steps.sweep.outputs.exit_code != '0'");
  });

  it('does not rewrite the board from a pull_request run', () => {
    // This PR's own run proves the sweep on a real runner; it must not touch
    // the anchor. Both board-writing steps carry the guard.
    const guards = workflow.match(/if: github\.event_name != 'pull_request'/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('exercises the ported helper through its paths filter', () => {
    expect(workflow).toContain("- 'scripts/invoked-as.mjs'");
  });
});

describe('half-state-patrol.yml — an UNCONFIGURED anchor is a supported configuration (objectui#8740)', () => {
  /**
   * The maintainer closed objectui#7852 and #5986 verbatim with 「7852 太麻烦，
   * 直接关闭」, so the anchor setup this install was waiting for will not happen.
   * Until this card the empty-anchor branch emitted `::error::` and `exit 1`,
   * which made a four-times-a-day scheduled job permanently red for a SETTLED
   * configuration — the shape objectui#6596 already ruled on: a check red on
   * the healthy case trains everyone to ignore red.
   *
   * ## Why this file executes the step instead of grepping it
   *
   * The acceptance criterion is about a scheduled run, and no test can start
   * one. What it can do is take the step's own `run:` body out of the YAML and
   * drive it, which is the same posture `ci-setup-pnpm-wiring.test.ts` takes for
   * its shell. A pin written as `expect(workflow).toContain('::notice::')` would
   * be satisfied by a file that emits the notice and then exits 1 anyway — it
   * pins the spelling of the fix, not the fix.
   *
   * ## Both directions, because only one of them is the bug
   *
   * ⛔ The carve-out is EMPTY-ONLY. "Nobody asked for delivery" (exit 0) and
   * "delivery was asked for and failed" (exit 1) are opposite facts, and a test
   * that pinned only the first would pass on the widened change that makes the
   * anchor step never fail — which is precisely what this card forbids. So the
   * malformed direction is asserted here in the same shape, and a green run of
   * this block means the empty branch was carved out of a guard that still
   * guards.
   *
   * The THIRD property is the one neither direction shows on its own: exiting 0
   * with no anchor means the job carries on into the write step, so that step
   * must be guarded by the SAME decision this step took. Guarded instead by a
   * second `env.ANCHOR_ISSUE != ''` test it would disagree with this step on a
   * whitespace-only value and PATCH `Number(' ')` — issue 0.
   */
  const workflowSteps: { name?: string; id?: string; if?: string; run?: string }[] =
    parseYaml(workflow).jobs.patrol.steps;

  const step = (name: string) => {
    const found = workflowSteps.find((s) => s.name === name);
    // Anti-vacuity: a renamed step must fail this file rather than silently
    // stop asserting anything, which is the whole failure mode of a wiring pin.
    expect(found, `no step named "${name}" — this block would assert nothing`).toBeTruthy();
    return found!;
  };

  const resolveStep = step('Resolve the anchor issue');
  const writeStep = step('Update the pinned anchor issue');
  const summaryStep = step('Publish the rendered body to the run summary');

  /** The resolve step's shell, with the one Actions expression it carries bound. */
  const resolveScript = (resolveStep.run ?? '').replace(
    /\$\{\{\s*github\.repository\s*\}\}/g,
    'objectstack-ai/objectui',
  );

  it('carries no unbound Actions expression into the shell this file executes', () => {
    // `${{ … }}` is a bad substitution to bash, so an expression this helper
    // does not bind would make every run below fail for the wrong reason.
    expect(resolveScript).not.toContain('${{');
    expect(resolveScript).toContain('ANCHOR_ISSUE');
  });

  /** Drive the real step body with a given anchor value. */
  const resolve = (anchor: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'half-state-anchor-'));
    const outputs = path.join(dir, 'github_output');
    fs.writeFileSync(outputs, '');
    const run = spawnSync('bash', ['-c', resolveScript], {
      encoding: 'utf8',
      env: { ...process.env, ANCHOR_ISSUE: anchor, GITHUB_OUTPUT: outputs },
    });
    const written = fs.readFileSync(outputs, 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: run.status, out: `${run.stdout}${run.stderr}`, outputs: written };
  };

  it('EMPTY anchor: notices the variable and exits 0 — the job goes on to publish the sweep', () => {
    for (const empty of ['', ' ', '\t', '\n  ']) {
      const run = resolve(empty);
      expect(run.status, `an unset anchor must not fail the run (input ${JSON.stringify(empty)})`).toBe(0);
      expect(run.out).toContain('::notice::');
      expect(run.out, 'the notice must name the variable that would enable delivery').toContain(
        'HALF_STATE_ANCHOR_ISSUE',
      );
      // ⛔ The regression this card is: the same sentence emitted as an error.
      expect(run.out).not.toContain('::error::');
      expect(run.outputs.trim()).toBe('configured=false');
    }
  });

  it('MALFORMED anchor: still `::error::` + exit 1, because delivery WAS asked for', () => {
    for (const bad of ['abc', '#9857', '98 57', '9857x', '-1']) {
      const run = resolve(bad);
      expect(run.status, `a bad anchor number must still fail the run (input ${JSON.stringify(bad)})`).toBe(1);
      expect(run.out).toContain('::error::');
      expect(run.out).not.toContain('::notice::');
      expect(run.outputs, 'a failed resolve must not declare a delivery target').not.toContain('configured=');
    }
  });

  it('NUMERIC anchor: resolves to a delivery, quietly', () => {
    const run = resolve('9857');
    expect(run.status).toBe(0);
    expect(run.outputs.trim()).toBe('configured=true');
    expect(run.out).toContain('anchor: #9857');
    expect(run.out).not.toContain('::notice::');
    expect(run.out).not.toContain('::error::');
  });

  it('the board write is guarded by THIS step\'s decision, not by a second reading of the variable', () => {
    // Exiting 0 with no anchor means the write step is now reachable with an
    // empty `ANCHOR_ISSUE`; `Number('')` is 0, so an unguarded write would PATCH
    // issue 0 on every scheduled run of an unconfigured install.
    expect(resolveStep.id, 'the write guard names this step by id').toBe('anchor');
    expect(writeStep.if).toContain("steps.anchor.outputs.configured == 'true'");
    // The pull_request guard is unchanged and still first — a PR run must not
    // touch the board whatever the anchor says.
    expect(writeStep.if).toContain("github.event_name != 'pull_request'");
    // ⛔ Not `env.ANCHOR_ISSUE != ''`: that is the second spelling of emptiness
    // this step exists to prevent (the resolve step strips whitespace, the
    // expression would not).
    expect(writeStep.if).not.toContain('env.ANCHOR_ISSUE');
  });

  it('the run summary is the delivery when there is no anchor, and says which delivery happened', () => {
    // `always()` is what makes the summary the fallback channel at all, and the
    // rendered body is read from the same file the anchor write would have used.
    expect(summaryStep.if).toBe('always()');
    expect(summaryStep.run).toContain('$RUNNER_TEMP/report.md');
    // ⛔ #4690 in the shape this card newly opens: a delivered run and an
    // undelivered one must not read alike in the only place a reader looks.
    expect(summaryStep.run).toContain("steps.anchor.outputs.configured }}\" = \"false\"");
    expect(summaryStep.run).toContain('HALF_STATE_ANCHOR_ISSUE');
  });

  it('the sibling install keeps its literal anchor, and keeps failing loudly on it', () => {
    // ⛔ Untouched by this card: objectstack resolves 9857 from the repository
    // guard, so it takes the NUMERIC branch above and every anchor failure
    // there is still a red run.
    expect(workflow).toContain("(github.repository == 'objectstack-ai/objectstack' && '9857')");
  });
});
