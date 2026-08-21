#!/usr/bin/env node
/**
 * The console performance budget, weighed over the EAGER CLOSURE.
 *
 * ## What this replaces
 *
 * `.github/workflows/performance-budget.yml` is named "Bundle Analysis" and its
 * step is "Check console performance budget", but until objectui#5324 it gzipped
 * exactly one file:
 *
 *     ENTRY_FILE=$(find "$DIST_DIR" -name 'index-*.js' ... | head -1)
 *     GZIP_BYTES=$(gzip -c "$ENTRY_FILE" | wc -c)
 *
 * The entry chunk is not what a page load costs. It statically imports a closure
 * of other chunks, and the browser fetches and parses all of them before the app
 * renders. Measured on `77f846a8b`:
 *
 *   | index-*.js alone (what the budget weighed) |    25,910 bytes gzipped |
 *   | the eager closure — 58 of 507 chunks       | 3,881,609 bytes gzipped |
 *
 * So the gate passed on 0.67% of the payload it claimed to govern. That is not
 * theoretical: objectui#5266 put 89 KiB gzipped on every console page load, it
 * landed in `vendor-objectstack-*.js`, and this gate could not see it.
 * `advancedChunks` deliberately routes vendor and workspace code into named
 * chunks, so MOST regressions land outside `index-*.js`.
 *
 * ## Where the number comes from
 *
 * `apps/console/vite.config.ts` (`emitEagerClosureReport`) writes
 * `apps/console/dist/eager-closure.json` from rolldown's own `chunk.imports` —
 * a BFS from the entry chunks over STATIC imports only, gzipping the bytes that
 * were actually written to disk. This file only applies a ceiling to it. The
 * split keeps graph knowledge where the graph is and policy where it can be unit
 * tested (`scripts/__tests__/check-eager-closure-budget.test.ts`), and it keeps a
 * size regression from failing every Vercel preview and local build — which is
 * how a budget gets switched off rather than fixed.
 *
 * ## The ceiling, and why it is this number
 *
 * `MAX_EAGER_CLOSURE_GZIP_BYTES` is today's measurement plus ~2% of headroom.
 * Two constraints pin it from both sides:
 *
 *   - It must PASS on today's `main`. A gate that lands red is a gate someone
 *     disables, and this one is landing as a replacement for a gate nobody could
 *     fail. Headroom above the current 3,881,609 bytes: 78,391 (2.02%).
 *   - The headroom must stay SMALLER than the regression the gate exists to
 *     catch. objectui#5266 was 89 KiB = 91,136 bytes; 78,391 < 91,136, so this
 *     ceiling would have failed on that change. Widening the headroom past ~89
 *     KiB would leave the gate green through a repeat of its own motivating
 *     incident.
 *
 * This is a truthful CURRENT-STATE ceiling, not a target. 3.7 MB gzipped before
 * first render is a bad payload, and the honest long-term line is far below it —
 * but lowering the line is a separate decision with its own work behind it
 * (objectui#5324 names the candidates: per-chunk budgets, a ratchet against
 * `main`, or actually cleaving the closure). Nothing here should be read as a
 * finding that 3.79 MB is acceptable.
 *
 * ## Raising it
 *
 * Re-baselining is legitimate — it is how a ratchet advances — but it is a
 * DECISION, so make it visible: update the constant, update the measured figure
 * in this comment, and say in the PR what the added bytes buy. Silently bumping
 * the number to make CI green reproduces the gate this file replaced.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Ceiling for the console eager closure, in gzipped bytes. See the header for
 * how this number was chosen; measured 3,881,609 on `77f846a8b`.
 */
export const MAX_EAGER_CLOSURE_GZIP_BYTES = 3_960_000;

/**
 * The measurement the ceiling above was derived from. Exported so the two
 * constraints in the header are CHECKED rather than merely argued
 * (`scripts/__tests__/check-eager-closure-budget.test.ts`): a future edit that
 * raises the ceiling past the regression size it is meant to catch fails a
 * test instead of quietly becoming decorative.
 */
export const BASELINE = Object.freeze({
  /** `emitEagerClosureReport`'s `eagerGzipBytes` on this commit. */
  gzipBytes: 3_881_609,
  chunks: 58,
  totalChunks: 507,
  commit: '77f846a8b',
});

/**
 * 89 KiB gzipped — the per-page-load cost objectui#5266 added, landing in
 * `vendor-objectstack-*.js` where the entry-chunk budget could not see it. The
 * headroom above {@link BASELINE} must stay under this, or the gate is green
 * through a repeat of the incident that motivated it.
 */
export const REGRESSION_THIS_GATE_MUST_CATCH_BYTES = 89 * 1024;

/** The report shape this checker understands. */
export const SUPPORTED_REPORT_VERSION = 1;

const DEFAULT_REPORT_PATH = 'apps/console/dist/eager-closure.json';

/**
 * Validate a parsed report before any verdict is read from it.
 *
 * Every check here is a counter-probe, and they all guard the same asymmetry:
 * this gate's failure mode is SILENT. A missing field read as zero, a report
 * left over from an older build, a walk that returned the entry chunk alone —
 * each produces a SMALL number, and a budget check reads a small number as good
 * news. So a report that cannot be trusted must be an ERROR, never a pass.
 *
 * @param {unknown} report
 * @returns {string[]} problems; empty means the report may be read
 */
export function validateReport(report) {
  const problems = [];
  if (report === null || typeof report !== 'object') {
    return ['report is not an object'];
  }
  const r = /** @type {Record<string, unknown>} */ (report);

  if (r.reportVersion !== SUPPORTED_REPORT_VERSION) {
    problems.push(
      `reportVersion is ${JSON.stringify(r.reportVersion)}, expected ${SUPPORTED_REPORT_VERSION} — ` +
        `the emitter in apps/console/vite.config.ts and this checker have drifted apart`,
    );
    // Every field check below assumes v1's names, so they would report noise.
    return problems;
  }

  for (const key of ['eagerChunkCount', 'totalChunkCount', 'eagerGzipBytes', 'eagerRawBytes']) {
    if (typeof r[key] !== 'number' || !Number.isFinite(r[key]) || r[key] < 0) {
      problems.push(`${key} is ${JSON.stringify(r[key])}, expected a non-negative number`);
    }
  }
  if (!Array.isArray(r.files)) problems.push('files is not an array');
  if (!Array.isArray(r.entryChunks) || r.entryChunks.length === 0) {
    problems.push('entryChunks is empty — the walk had no roots, so it measured nothing');
  }
  if (problems.length > 0) return problems;

  const files = /** @type {{ fileName: string, gzipBytes: number }[]} */ (r.files);
  const eagerChunkCount = /** @type {number} */ (r.eagerChunkCount);
  const totalChunkCount = /** @type {number} */ (r.totalChunkCount);
  const eagerGzipBytes = /** @type {number} */ (r.eagerGzipBytes);

  // The entry chunk alone IS the gauge this replaces. One chunk is not a
  // closure, and a walk that collapsed to its roots must not be read as a
  // shrinking bundle.
  if (eagerChunkCount < 2) {
    problems.push(
      `eagerChunkCount is ${eagerChunkCount} — the closure collapsed to its entry chunk(s), ` +
        `which is exactly the blind gauge this check replaces (objectui#5324)`,
    );
  }
  // The other direction: if everything is eager there is no lazy boundary and
  // the number is "the whole bundle", which no page load pays.
  if (eagerChunkCount >= totalChunkCount) {
    problems.push(
      `eagerChunkCount (${eagerChunkCount}) is not less than totalChunkCount (${totalChunkCount}) — ` +
        `the walk is not separating static from dynamic imports`,
    );
  }
  if (files.length !== eagerChunkCount) {
    problems.push(`files has ${files.length} entries but eagerChunkCount is ${eagerChunkCount}`);
  }
  const summed = files.reduce((n, f) => n + (typeof f?.gzipBytes === 'number' ? f.gzipBytes : NaN), 0);
  if (!Number.isFinite(summed) || summed !== eagerGzipBytes) {
    problems.push(
      `eagerGzipBytes (${eagerGzipBytes}) does not equal the sum of files[].gzipBytes (${summed}) — ` +
        `the report is internally inconsistent, so neither number can be trusted`,
    );
  }
  return problems;
}

/**
 * @param {object} input
 * @param {unknown} input.report        parsed `eager-closure.json`, or null when absent
 * @param {number} [input.budgetBytes]  ceiling to compare against
 * @param {string} [input.reportPath]   path the report was read from, for messages
 * @returns {{ status: 'pass' | 'fail' | 'error', message: string, gzipBytes: number | null,
 *             budgetBytes: number, chunkCount: number | null, totalChunkCount: number | null }}
 */
export function evaluateClosureBudget({
  report,
  budgetBytes = MAX_EAGER_CLOSURE_GZIP_BYTES,
  reportPath = DEFAULT_REPORT_PATH,
} = {}) {
  const base = { budgetBytes, gzipBytes: null, chunkCount: null, totalChunkCount: null };

  if (report === null || report === undefined) {
    return {
      ...base,
      status: 'error',
      message:
        `No eager-closure report at ${reportPath}. It is written by ` +
        `\`emitEagerClosureReport\` in apps/console/vite.config.ts during \`vite build\`, so an ` +
        `absent report means the console was not built — or was built by a config that no ` +
        `longer emits it. This is a broken gauge, not a passing budget.`,
    };
  }

  const problems = validateReport(report);
  if (problems.length > 0) {
    return {
      ...base,
      status: 'error',
      message: `Eager-closure report at ${reportPath} cannot be trusted:\n  - ${problems.join('\n  - ')}`,
    };
  }

  const r = /** @type {{ eagerGzipBytes: number, eagerChunkCount: number, totalChunkCount: number }} */ (report);
  const gzipBytes = r.eagerGzipBytes;
  const shared = {
    budgetBytes,
    gzipBytes,
    chunkCount: r.eagerChunkCount,
    totalChunkCount: r.totalChunkCount,
  };

  if (gzipBytes > budgetBytes) {
    const over = gzipBytes - budgetBytes;
    return {
      ...shared,
      status: 'fail',
      message:
        `Console eager closure is ${kb(gzipBytes)} KB gzipped across ${r.eagerChunkCount} chunks — ` +
        `${kb(over)} KB over the ${kb(budgetBytes)} KB budget.\n` +
        `These are the bytes every console page load fetches and parses before the app renders; ` +
        `they are not deferred by any lazy import.\n` +
        `If the growth is intended, raise MAX_EAGER_CLOSURE_GZIP_BYTES in ` +
        `scripts/check-eager-closure-budget.mjs deliberately and say in the PR what the bytes ` +
        `buy — do not widen it just to get a green check.`,
    };
  }

  return {
    ...shared,
    status: 'pass',
    message:
      `Console eager closure is ${kb(gzipBytes)} KB gzipped across ${r.eagerChunkCount} of ` +
      `${r.totalChunkCount} chunks (budget: ${kb(budgetBytes)} KB, ` +
      `headroom: ${kb(budgetBytes - gzipBytes)} KB).`,
  };
}

const kb = (bytes) => (bytes / 1024).toFixed(1);

/**
 * The biggest eager chunks, so a failure names suspects instead of a total.
 * @param {{ files?: { fileName: string, gzipBytes: number }[] }} report
 * @param {number} [limit]
 */
export function renderTopChunks(report, limit = 12) {
  const files = [...(report?.files ?? [])].sort((a, b) => b.gzipBytes - a.gzipBytes).slice(0, limit);
  return files.map((f) => `  ${kb(f.gzipBytes).padStart(9)} KB  ${f.fileName}`).join('\n');
}

/** @param {string} reportPath */
export function readReport(reportPath) {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

/** Appends `name=value` lines to $GITHUB_OUTPUT when running in Actions. */
function writeGithubOutput(entries, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) return;
  const lines = Object.entries(entries).map(([k, v]) => `${k}=${v}\n`);
  fs.appendFileSync(outputPath, lines.join(''));
}

/**
 * Exit codes: `0` within budget, `1` over budget, `2` no trustworthy
 * measurement (report missing, stale-shaped, or internally inconsistent).
 */
export function main(argv = process.argv.slice(2)) {
  const flagIndex = argv.indexOf('--report');
  const reportPath = flagIndex === -1 ? DEFAULT_REPORT_PATH : argv[flagIndex + 1];
  const resolved = path.resolve(reportPath);
  const report = readReport(resolved);
  const result = evaluateClosureBudget({ report, reportPath });

  if (result.status === 'pass') {
    console.log(`✅ ${result.message}`);
  } else {
    console.error(`❌ ${result.message}`);
  }
  if (report?.files?.length) {
    console.log('');
    console.log('Largest eagerly loaded chunks (gzipped):');
    console.log(renderTopChunks(report));
  }

  writeGithubOutput({
    closure_status: result.status,
    closure_gzip_kb: result.gzipBytes === null ? '' : kb(result.gzipBytes),
    closure_budget_kb: kb(result.budgetBytes),
    closure_chunks: result.chunkCount === null ? '' : String(result.chunkCount),
  });

  // Distinct codes so the workflow can tell "over budget" (a real verdict about
  // the bundle) from "the gauge produced nothing" (a verdict about the gauge).
  // Collapsing them to 1 would let a broken report be reported as a size
  // regression, and a size regression reported as a broken report — each of
  // which teaches readers to ignore the other.
  if (result.status === 'pass') return 0;
  return result.status === 'fail' ? 1 : 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
