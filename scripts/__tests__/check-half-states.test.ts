import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper; types are INFERRED from the .mjs by `tsconfig.scripts.json`
// (`allowJs`), so no `@ts-expect-error` here. See objectui#3494.
import {
  CLOSED_ISSUE_WINDOW_PAGES,
  DEFAULT_SWEEP_REPO,
  h22ClosedCardPmResidue,
  resolveClosedWindowPages,
  resolveSweepRepo,
  summaryLine,
} from '../pm/check-half-states.mjs';

/**
 * objectui#5791 — the half-state patrol, PORTED from objectstack (PR #11294).
 *
 * ## What this file is for, and what it deliberately is not
 *
 * The sweeper carries its own ~1,077-case `--self-test`, and that suite is the
 * authority on the twenty-odd predicates. Re-asserting predicates here would
 * fork the pin: two copies drifting apart, one of them not the one upstream
 * maintains. So the first test below simply RUNS that suite in CI — the point
 * being that a port whose self-test nobody executes is the #4690 shape again
 * (a check that reads as enforcement while nothing invokes it).
 *
 * Everything after it pins the ADAPTATIONS instead — the handful of places this
 * install diverges from upstream. Those are exactly the lines a future verbatim
 * re-sync from objectstack would clobber silently, and each one is load-bearing:
 * dropping any of them does not break the patrol loudly, it makes the patrol
 * report something false quietly.
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
    expect(out).toMatch(/✓ check-half-states self-test: \d+ cases pass\./);
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

describe('check-half-states — H22 closed-card reader is OFF here (objectui#5791)', () => {
  /**
   * The measurement that decided this, re-measured 2026-08-24 for the port:
   * 815 closed cards in objectui carry `pm:dispatched`, and ~347 of the 400
   * issues inside upstream's window carry some `pm:*` residue label (~87%,
   * against the 26% upstream measured on its own board). Stripping `pm:*` on
   * close was never this lane's practice, so H22 here reports the CONVENTION
   * rather than a defect — ~347 rows that would exhaust the body budget and
   * trim every other predicate out of the anchor on day one.
   */
  it('keeps upstream\'s default in the script, so the port stays a straight copy', () => {
    // The divergence lives in the WORKFLOW, not in the script's default. This
    // is what lets the predicate file be re-synced verbatim.
    expect(CLOSED_ISSUE_WINDOW_PAGES).toBe(4);
    expect(resolveClosedWindowPages({}).pages).toBe(4);
    expect(resolveClosedWindowPages({}).source).toBe('default');
  });

  it('is switched off by the workflow, and visibly so', () => {
    expect(workflow).toMatch(/PM_SWEEP_CLOSED_WINDOW_PAGES: '0'/);
    expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: '0' }).pages).toBe(0);
    expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: '0' }).valid).toBe(true);
  });

  it('refuses a malformed page count instead of silently defaulting', () => {
    // Silently falling back to 4 would re-open the reader this install shut,
    // and the anchor would carry the residue as though someone chose that.
    for (const raw of ['O', '-1', '1.5', 'four']) {
      expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: raw }).valid).toBe(false);
    }
    expect(resolveClosedWindowPages({ PM_SWEEP_CLOSED_WINDOW_PAGES: ' 2 ' }).pages).toBe(2);
  });

  it('leaves the H22 predicate itself untouched', () => {
    // The adaptation is a window, not a rewritten rule: handed a closed card
    // with residue the predicate must still say so. Re-enabling the reader is
    // therefore a one-variable decision, not a code change.
    const closedCard = {
      state: 'closed',
      state_reason: 'completed',
      labels: [{ name: 'pm:dispatched' }],
    };
    expect(h22ClosedCardPmResidue(closedCard)).toContain('`pm:dispatched`');
    expect(h22ClosedCardPmResidue({ ...closedCard, state: 'open' })).toBeNull();
  });

  it('reports the closed surface as UNREAD, never as clean', () => {
    // ⛔ The property the whole adaptation turns on (#4690). A disabled reader
    // and an empty result are the same number and opposite facts; if this ever
    // renders "H22 read 0", the anchor starts asserting a clean closed surface
    // that nothing looked at.
    const counts = { repo: 'objectstack-ai/objectui', issues: 3, unscoped: 4, prs: 1, merged: 2, closed: 0 };
    const disabled = summaryLine({ ...counts, closedWindowDisabled: true }, 0);
    expect(disabled).toContain('is DISABLED in this install');
    expect(disabled).toContain('UNREAD');
    expect(disabled).not.toContain('H22 read 0');
    // …and it names the way back, so the choice is reversible by a reader.
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
