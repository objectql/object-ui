import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here —
// re-adding one is now itself an error (TS2578). See objectui#3494.
import { renderBudgetComment, renderFromEnv } from '../render-budget-comment.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(repoRoot, '.github/workflows/performance-budget.yml');
const rendererPath = path.join(repoRoot, 'scripts/render-budget-comment.mjs');
const checkerPath = path.join(repoRoot, 'scripts/check-eager-closure-budget.mjs');
const NO_SUCH_REPORT = path.join(repoRoot, 'scripts/__tests__/__no-size-report__.md');

/**
 * objectui#3152: a cancelled Bundle Analysis run posted
 * "❌ Console Performance Budget / Status: FAIL" with all three metrics empty.
 * The measurement had never happened — `cancel-in-progress` had killed the run
 * — but the renderer treated "not `pass`" as "FAIL". Every PR that got a second
 * push within one build therefore received a fake budget alarm.
 *
 * The invariant these tests pin: FAIL is rendered only when the bundle was
 * measured AND found over budget. Everything else renders as "not measured",
 * never as a verdict.
 */
describe('renderBudgetComment', () => {
  const measured = {
    gzipKb: '28.1',
    budgetKb: '350',
    entryFile: 'index-BRKCVm_4.js',
    // The eager closure — the metric that actually governs a page load
    // (objectui#5324). A measured run now always carries both.
    closureStatus: 'pass',
    closureGzipKb: '3790.6',
    closureBudgetKb: '3867.2',
    closureChunks: '58',
  };

  it('renders PASS with the measurement when the bundle is within budget', () => {
    const { kind, body } = renderBudgetComment({ status: 'pass', ...measured });

    expect(kind).toBe('pass');
    expect(body).toContain('## ✅ Console Performance Budget');
    expect(body).toContain('| **Eager closure** (gzip, 58 chunks) | **3790.6 KB** | 3867.2 KB |');
    expect(body).toContain('| Main entry chunk (gzip) | 28.1 KB | 350 KB |');
    expect(body).toContain('| Entry file | `index-BRKCVm_4.js` | — |');
    expect(body).toContain('| Status | **PASS** | — |');
    expect(body).not.toContain('FAIL');
  });

  it('still renders a full FAIL verdict when the bundle IS over budget', () => {
    const { kind, body } = renderBudgetComment({
      ...measured,
      status: 'fail',
      gzipKb: '412.7',
    });

    expect(kind).toBe('fail');
    expect(body).toContain('## ❌ Console Performance Budget');
    expect(body).toContain('| Main entry chunk (gzip) | 412.7 KB | 350 KB |');
    expect(body).toContain('| Status | **FAIL** | — |');
    // The real signal must stay unambiguous — no hedging language on a
    // genuine violation.
    expect(body).not.toContain('not measured');
  });

  // The regression itself: run 30699128418 (`cancelled`) vs 30699202638
  // (`success`) on the same commit gave FAIL and PASS respectively.
  it('does NOT render FAIL when the budget step never ran (cancelled run)', () => {
    const { kind, body } = renderBudgetComment({
      status: '',
      gzipKb: '',
      budgetKb: '',
      entryFile: '',
      budgetOutcome: 'skipped',
      buildOutcome: 'cancelled',
    });

    expect(kind).toBe('not-measured');
    expect(body).not.toContain('FAIL');
    expect(body).not.toContain('❌');
    expect(body).toContain('## ℹ️ Console Performance Budget — not measured');
    expect(body).toContain('**This is not a budget violation.**');
    // The empty-metric table that made the fake alarm look like a report.
    expect(body).not.toContain('| Main entry chunk (gzip) |  KB |');
    expect(body).not.toContain('| **Eager closure** (gzip) | ** KB** |');
  });

  it.each([
    ['dist directory missing', 'Build output not found at apps/console/dist/assets'],
    ['no JS files in dist', 'No JS files found in apps/console/dist/assets'],
  ])('reports "not measured" with the reason when the budget step errors (%s)', (_label, message) => {
    const { kind, body } = renderBudgetComment({
      status: 'error',
      message,
      budgetOutcome: 'failure',
      buildOutcome: 'success',
    });

    expect(kind).toBe('not-measured');
    expect(body).not.toContain('FAIL');
    expect(body).toContain(`Reason: ${message}`);
    expect(body).toContain('| Check console performance budget | `failure` |');
    expect(body).toContain('| Build packages | `success` |');
  });

  it('treats a status without its measurement as not measured, never as FAIL', () => {
    // Defensive: if the producer ever writes `budget_status` without the
    // numbers, the consumer must not manufacture a verdict out of it.
    for (const partial of [
      { status: 'fail', gzipKb: '', budgetKb: '350', entryFile: 'index.js' },
      { status: 'fail', gzipKb: '412.7', budgetKb: '', entryFile: 'index.js' },
      { status: 'pass', gzipKb: '28.1', budgetKb: '350', entryFile: '' },
    ]) {
      const { kind, body } = renderBudgetComment(partial);
      expect(kind).toBe('not-measured');
      expect(body).not.toContain('| Status | **FAIL** | — |');
    }
  });

  /**
   * objectui#5324: this comment reported the `index-*.js` entry chunk and
   * called it "the performance budget". On `77f846a8b` that chunk is 25.9 KB
   * gzipped while the closure it statically pulls in is 3,790.6 KB — 0.67% of
   * the payload — and the 89 KiB regression of objectui#5266 landed outside it.
   *
   * The invariant these pin: the closure is the number the comment leads with,
   * and an ABSENT closure figure is stated, never silently dropped. A one-row
   * table showing only the entry chunk IS the old gauge, and it reads as a
   * complete report.
   */
  it('leads with the eager closure and de-emphasises the entry chunk', () => {
    const { body } = renderBudgetComment({ status: 'pass', ...measured });

    const closureRow = body.indexOf('| **Eager closure**');
    const entryRow = body.indexOf('| Main entry chunk (gzip)');
    expect(closureRow).toBeGreaterThan(-1);
    expect(entryRow).toBeGreaterThan(closureRow);
    // The entry chunk keeps its row and its 350 KB line — replacing the gauge
    // is not licence to drop the check that was already there.
    expect(body).toContain('| Main entry chunk (gzip) | 28.1 KB | 350 KB |');
    expect(body).toContain('what the browser fetches and parses before the app renders');
  });

  it('says so loudly when the closure was not measured, instead of showing the entry chunk alone', () => {
    const { kind, body } = renderBudgetComment({
      status: 'pass',
      gzipKb: '28.1',
      budgetKb: '350',
      entryFile: 'index-BRKCVm_4.js',
    });

    expect(kind).toBe('pass');
    expect(body).toContain('| **Eager closure** (gzip) | _not measured_ | — |');
    expect(body).toContain('was **not measured** in this run');
    expect(body).toContain('emitEagerClosureReport');
  });

  it('carries no hedging language when both metrics are present on a real violation', () => {
    const { body } = renderBudgetComment({ ...measured, status: 'fail', gzipKb: '412.7' });
    expect(body).not.toContain('not measured');
  });

  it('omits the chunk count from the closure row rather than printing an empty one', () => {
    const { body } = renderBudgetComment({
      status: 'pass',
      ...measured,
      closureChunks: '',
    });
    expect(body).toContain('| **Eager closure** (gzip) | **3790.6 KB** | 3867.2 KB |');
    expect(body).not.toContain(', chunks)');
  });

  it('appends the package size report when one was generated', () => {
    const sizeReport = '## 📦 Bundle Size Report\n\n| Package | Size | Gzipped |';
    const { body } = renderBudgetComment({ status: 'pass', ...measured, sizeReport });

    expect(body).toContain('---\n\n## 📦 Bundle Size Report');
    expect(body).not.toContain('No package size report');
  });

  it('says the size report is missing rather than silently omitting it', () => {
    // A partial report reads exactly like a complete one — the cancelled run in
    // objectui#3152 shipped a report that was silently missing 7 packages.
    const { body } = renderBudgetComment({ status: 'pass', ...measured, sizeReport: '' });

    expect(body).toContain('No package size report');
    expect(body).toContain('only generated from a complete package build');
  });
});

/**
 * objectui#6230: the closure checker evaluates THREE halves — the aggregate
 * ceiling, the per-chunk ceilings (objectui#5490) and ceiling sensitivity
 * (objectui#5924) — and publishes a verdict for each. The step's exit code
 * folds all three into one `budget_status`, so a comment rendering only that
 * says "something objected" and nothing more: a reader had to open the job log
 * to learn whether the total grew, one chunk grew, or a ceiling had stopped
 * measuring anything.
 *
 * The per-chunk case is the one the whole gate family exists for. objectui#5266
 * was a 89 KiB regression that landed OUTSIDE the entry chunk and inside the
 * aggregate ceiling's headroom — exactly the shape where both numbers the
 * comment prints are green and the verdict is still FAIL.
 */
describe('per-half closure verdicts', () => {
  const halves = {
    gzipKb: '28.1',
    budgetKb: '350',
    entryFile: 'index-BRKCVm_4.js',
    closureGzipKb: '3222.6',
    closureBudgetKb: '3266.6',
    closureChunks: '58',
    closureStatus: 'pass',
    closureChunkStatus: 'pass',
    closureHeadroomStatus: 'pass',
  };

  /**
   * The load-bearing leg. An observability change that rewrites the HEALTHY
   * output is a regression: every green PR comment in the repo would change
   * shape to report nothing new.
   */
  it('adds nothing at all to the comment when every half passed', () => {
    const { kind, body } = renderBudgetComment({ status: 'pass', ...halves });

    expect(kind).toBe('pass');
    expect(body).not.toContain('Which half objected');
    expect(body).not.toContain('Eager-closure half');
    expect(body).toContain('| Status | **PASS** | — |');
    expect(body).not.toContain('FAIL');
  });

  it('names the AGGREGATE half when the total is over its ceiling', () => {
    const { body } = renderBudgetComment({
      status: 'fail',
      ...halves,
      closureGzipKb: '3400.0',
      closureStatus: 'fail',
    });

    expect(body).toContain('**Which half objected:**');
    expect(body).toContain('| Aggregate closure ceiling | ❌ over its ceiling |');
    expect(body).toContain('| Per-chunk ceilings | ✅ pass |');
    expect(body).toContain('| Ceiling sensitivity (headroom) | ✅ pass |');
  });

  /**
   * The objectui#5266 shape. Note the numbers here are IDENTICAL to the
   * all-pass case above: before this wiring the two comments differed only in
   * `PASS` vs `FAIL`, with both printed metrics comfortably inside budget and
   * nothing anywhere in the body saying why.
   */
  it('names the PER-CHUNK half when one chunk is over while the total is not', () => {
    const { kind, body } = renderBudgetComment({
      status: 'fail',
      ...halves,
      closureChunkStatus: 'fail',
    });

    expect(kind).toBe('fail');
    // Both printed metrics are green; only the half table explains the FAIL.
    expect(body).toContain('| **Eager closure** (gzip, 58 chunks) | **3222.6 KB** | 3266.6 KB |');
    expect(body).toContain('| Status | **FAIL** | — |');
    expect(body).toContain('| Per-chunk ceilings | ❌ over its ceiling |');
    expect(body).toContain('| Aggregate closure ceiling | ✅ pass |');
  });

  /**
   * A drifted ceiling is exit 2, which `performance-budget.yml` maps to
   * `budget_status=error` — so it lands in the NOT-MEASURED branch, not the
   * verdict branch. It must read as a verdict about the gauge, and must never
   * acquire a ❌: nothing grew.
   */
  it('names a drifted ceiling as a broken GAUGE, never as a size failure', () => {
    const { kind, body } = renderBudgetComment({
      status: 'error',
      ...halves,
      closureHeadroomStatus: 'error',
      message: 'the eager-closure gauge produced no trustworthy measurement',
      budgetOutcome: 'failure',
      buildOutcome: 'success',
    });

    expect(kind).toBe('not-measured');
    expect(body).toContain('| Ceiling sensitivity (headroom) | ⚠️ broken gauge |');
    expect(body).toContain('a verdict about the ceiling, not about the bundle');
    expect(body).not.toContain('❌');
    expect(body).not.toContain('FAIL');
    // The closure WAS measured on this path, so the comment must not claim the
    // opposite two lines above a table showing two ceilings that passed.
    expect(body).not.toContain('Nothing was measured');
    expect(body).toContain('gauge not trustworthy');
  });

  it('keeps the "not measured" wording when nothing really was measured', () => {
    // dist missing / no JS / cancelled: the checker never ran, so it published
    // no closure numbers. This branch must be untouched by the above.
    const { kind, body } = renderBudgetComment({
      status: 'error',
      message: 'Build output not found at apps/console/dist/assets',
      budgetOutcome: 'failure',
      buildOutcome: 'success',
    });

    expect(kind).toBe('not-measured');
    expect(body).toContain('## ℹ️ Console Performance Budget — not measured');
    expect(body).toContain('Nothing was measured');
    expect(body).not.toContain('Which half objected');
  });

  it('renders no half table when no half status was handed over', () => {
    // The objectui#3152 failure mode, in its per-half form: blanks must render
    // as silence, never be inferred into verdicts.
    const { body } = renderBudgetComment({
      status: 'fail',
      ...halves,
      closureStatus: '',
      closureChunkStatus: '',
      closureHeadroomStatus: '',
    });

    expect(body).not.toContain('Which half objected');
    expect(body).not.toContain('| Per-chunk ceilings |');
  });
});

describe('renderFromEnv', () => {
  it('reads the exact env names the workflow sets', () => {
    const { kind, body } = renderFromEnv(
      {
        BUDGET_STATUS: 'pass',
        BUDGET_GZIP_KB: '28.1',
        BUDGET_LIMIT_KB: '350',
        BUDGET_ENTRY_FILE: 'index-BRKCVm_4.js',
        BUDGET_CLOSURE_STATUS: 'pass',
        BUDGET_CLOSURE_GZIP_KB: '3790.6',
        BUDGET_CLOSURE_BUDGET_KB: '3867.2',
        BUDGET_CLOSURE_CHUNKS: '58',
        BUDGET_STEP_OUTCOME: 'success',
        BUILD_PACKAGES_OUTCOME: 'success',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_REPOSITORY: 'objectstack-ai/objectui',
        GITHUB_RUN_ID: '30699202638',
      },
      NO_SUCH_REPORT,
    );

    expect(kind).toBe('pass');
    expect(body).toContain('| Main entry chunk (gzip) | 28.1 KB | 350 KB |');
    expect(body).toContain('| **Eager closure** (gzip, 58 chunks) | **3790.6 KB** | 3867.2 KB |');
  });

  it('links the run so a "not measured" note can be checked against the log', () => {
    const { body } = renderFromEnv(
      {
        BUDGET_STATUS: '',
        BUILD_PACKAGES_OUTCOME: 'failure',
        BUDGET_STEP_OUTCOME: 'skipped',
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_REPOSITORY: 'objectstack-ai/objectui',
        GITHUB_RUN_ID: '30699128418',
      },
      NO_SUCH_REPORT,
    );

    expect(body).toContain(
      'https://github.com/objectstack-ai/objectui/actions/runs/30699128418',
    );
  });

  it('renders without crashing on a completely empty environment', () => {
    const { kind, body } = renderFromEnv({}, NO_SUCH_REPORT);
    expect(kind).toBe('not-measured');
    expect(body).toContain('| Build packages | `unknown` |');
  });
});

/**
 * The renderer can only be correct if the workflow keeps feeding it. These pin
 * the two workflow-level halves of the fix, which no unit test can exercise:
 * the step conditions, and the env contract between the two files.
 */
describe('performance-budget.yml contract', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const renderer = fs.readFileSync(rendererPath, 'utf8');
  // Only the step conditions — prose in `#` comments discusses `always()` and
  // must not be mistaken for a use of it.
  const conditions = [...workflow.matchAll(/^\s*if:\s*(.+)$/gm)].map((m) => m[1]);

  it('never gates a step on always() — it fires on cancelled runs, which measure nothing', () => {
    expect(conditions.filter((c) => c.includes('always()'))).toEqual([]);
  });

  it('gates the size report, the renderer and the comment on !cancelled()', () => {
    expect(conditions.filter((c) => c.includes('!cancelled()'))).toHaveLength(3);
  });

  it('generates the size report only from a complete package build', () => {
    expect(workflow).toContain(
      "if: ${{ !cancelled() && steps.build_packages.outcome == 'success' }}",
    );
    expect(workflow).toContain('id: build_packages');
  });

  it('never interpolates a step output into the comment JS source', () => {
    // `const status = '${{ steps.budget.outputs.budget_status }}'` is how an
    // absent output became the empty string that rendered as FAIL.
    expect(workflow).not.toMatch(/=\s*'\$\{\{\s*steps\.budget\.outputs/);
  });

  it('passes every env var the renderer reads, and reads every one it passes', () => {
    const declared = [...workflow.matchAll(/^\s{10}([A-Z_]+): \$\{\{ steps\./gm)].map((m) => m[1]);

    expect(declared.length).toBeGreaterThan(0);
    for (const name of declared) {
      expect(renderer, `renderer must read env.${name}`).toContain(`env.${name}`);
    }
  });

  /**
   * objectui#6230: `closure_chunk_status` (objectui#5490) and
   * `closure_headroom_status` (objectui#5924) were both published to
   * `$GITHUB_OUTPUT` and never read, each following the precedent of the last.
   * The card's explicit ask was that a THIRD round of this not happen — so the
   * obligation is pinned mechanically rather than left to review: a half added
   * to the checker fails here until it reaches the comment.
   */
  it('passes every closure verdict the checker publishes into the comment step', () => {
    const checker = fs.readFileSync(checkerPath, 'utf8');
    const call = checker.slice(checker.lastIndexOf('writeGithubOutput({'));
    const published = [...call.slice(0, call.indexOf('});')).matchAll(/(closure_\w+):/g)].map(
      (m) => m[1],
    );

    // Guard the guard: a regex that matched nothing would pass silently.
    expect(published).toContain('closure_status');
    expect(published).toContain('closure_chunk_status');
    expect(published).toContain('closure_headroom_status');

    for (const key of published) {
      expect(workflow, `workflow must pass steps.budget.outputs.${key} to the comment step`)
        .toContain(`steps.budget.outputs.${key}`);
    }
  });

  it('writes budget_status on every path the budget step can exit through', () => {
    // pass, fail, and the two "nothing to measure" errors.
    const statuses = [...workflow.matchAll(/budget_status=(\w+)/g)].map((m) => m[1]);
    expect(new Set(statuses)).toEqual(new Set(['pass', 'fail', 'error']));
  });
});
