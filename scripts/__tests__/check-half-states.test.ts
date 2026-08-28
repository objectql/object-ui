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
  resolveClosureFloor,
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
