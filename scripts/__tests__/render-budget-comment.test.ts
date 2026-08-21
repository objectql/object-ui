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

  it('writes budget_status on every path the budget step can exit through', () => {
    // pass, fail, and the two "nothing to measure" errors.
    const statuses = [...workflow.matchAll(/budget_status=(\w+)/g)].map((m) => m[1]);
    expect(new Set(statuses)).toEqual(new Set(['pass', 'fail', 'error']));
  });
});
