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
 * That table is the MOTIVATING measurement and stays pinned to `77f846a8b`; it
 * is not the current reading. {@link BASELINE} carries today's, and the ceiling
 * section below does the arithmetic against it.
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
 * `MAX_EAGER_CLOSURE_GZIP_BYTES` is today's measurement plus headroom of half
 * {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES}. Two constraints pin it from
 * both sides, and since objectui#5924 BOTH are checked against the report this
 * gate just read, not against a literal frozen next to them:
 *
 *   - It must PASS on today's `main`. A gate that lands red is a gate someone
 *     disables, and this one replaced a gate nobody could fail. Headroom above
 *     the current 3,299,898 bytes: 45,102 (1.37%).
 *   - The headroom must stay SMALLER than the regression the gate exists to
 *     catch. objectui#5266 was 89 KiB = 91,136 bytes; 45,102 < 91,136, so this
 *     ceiling would have failed on that change. Widening the headroom past ~89
 *     KiB would leave the gate green through a repeat of its own motivating
 *     incident.
 *
 * Half the regression size, rather than the ~2% this line used to carry, is a
 * deliberate choice that only became necessary once the second constraint
 * started being enforced live (next section). Headroom H buys H bytes of growth
 * before the gate reds for being over budget, and costs REGRESSION - H bytes of
 * SHRINK before it reds for going blind. H = REGRESSION / 2 is the only value
 * equidistant from the two, and it is the value that maximises the smaller of
 * the two distances: ~45 KB of room in each direction rather than 66 KB one way
 * and 25 KB the other.
 *
 * ## Why the headroom is checked LIVE (objectui#5924)
 *
 * The second constraint above used to be asserted only in the unit test, as
 *
 *     MAX_EAGER_CLOSURE_GZIP_BYTES - BASELINE.gzipBytes < REGRESSION_...
 *
 * Both operands are frozen literals from this module, so that assertion was
 * true regardless of what the console actually weighed, and it stayed true
 * while the closure got ~706 KB SMALLER than the pinned baseline. The invariant
 * was STATED about the live bundle and CHECKED about two constants; it would
 * have stayed green if the closure halved again.
 *
 * What that cost, demonstrated rather than inferred (objectui#5924): with the
 * ceiling at 4,086,000 over a live 3.3 MB payload, an eager
 * `@objectstack/spec/cloud` namespace import into `apps/console/src/main.tsx`
 * added 158,006 gzipped bytes to the closure — 1.7x the incident this gate was
 * built to catch — and the aggregate half printed a green tick with "headroom:
 * 613.4 KB" underneath it.
 *
 * {@link evaluateHeadroomSensitivity} now derives that headroom from the report,
 * for the aggregate ceiling AND for every per-chunk ceiling — four ceilings as
 * of objectui#5490 — and calls a ceiling that sits more than one regression
 * above its own measurement an ERROR (exit 2). That verdict is about the GAUGE,
 * not the bundle, which is why it is an error and not a size failure: a green
 * tick that cannot distinguish "no regression" from "the motivating incident,
 * twice over" carries no information. It is the same shape as a budget keyed on
 * a chunk that is not there, and the same rule applies — measuring nothing must
 * be LOUDER than measuring something over the line, never quieter.
 *
 * The consequence is deliberate: drift in the SHRINKING direction is no longer
 * free. A PR that takes more than ~45 KB out of the closure now has to re-pin
 * the ceiling it just made decorative, in the same commit, instead of leaving a
 * decision that silently comes due and is never taken. The constant-vs-constant
 * assertions stay in the unit test as a secondary guard: they still catch an
 * edit that raises a ceiling past the regression size without any build.
 *
 * ## Why this number has moved (objectui#5328 up, objectui#5924 down)
 *
 * It was 3,960,000 over a 3,881,609 baseline measured on `77f846a8b`. Pinning
 * `@objectstack/spec` and its three siblings to 17.1.0 put the closure 41,689
 * bytes over that ceiling: the release is ~930 KB larger uncompressed, and
 * essentially all of it lands in `vendor-objectstack-*.js`. That is REAL added
 * payload, not a measurement artefact, and it is larger than the #5266
 * regression this gate was sized to catch — the gate did its job.
 *
 * The re-baseline was therefore escalated rather than taken by the seat doing
 * the bump, because #5468 had ruled days earlier that the aggregate ceiling
 * "stays as shipped" and that gate-strength policy is the maintainer's. The
 * maintainer ruled option A on #5531: raise it, permanently, together with the
 * headroom assertion that guards it. Both constants move in ONE commit — raising
 * the ceiling alone leaves headroom at ~200 KB and fails the test below, which
 * is the guard working, not an obstacle to route around.
 *
 * objectui#5924 then lowered it to 3,345,000 over 3,299,898 bytes measured on
 * `48e53814e`: 706,013 bytes BELOW the `4c1623c0c` baseline the previous ceiling
 * was derived from. Nothing was cleaved to earn that — the closure shrank on its
 * own while the ceiling stayed put, which is exactly the drift that opened the
 * blind band above. Lowering a ceiling TOWARD reality is a tightening, not a
 * weakening: no build that passed before the change and measures under 3,345,000
 * fails after it, and the gate's sensitivity is once again larger than the
 * headroom it guards. This was taken as a card's stated decision (objectui#5924,
 * triage disposition 3) rather than silently, which is what the "Raising it"
 * note below asks of a re-baseline in either direction.
 *
 * ⛔ The floor is unchanged and applies to a LOWERING too: never put a ceiling
 * below a measured figure to express an aspiration. That is not a tighter
 * ratchet, it is a gate that lands red on `main`, which is how a budget gets
 * switched off rather than met.
 *
 * What did NOT move: {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES}. That is the
 * gate's sensitivity, the ruling did not touch it, and re-baselining must never
 * become an excuse to widen it — a ceiling that rises while the sensitivity
 * relaxes is a gate quietly retiring itself.
 *
 * This is a truthful CURRENT-STATE ceiling, not a target. 3.15 MB gzipped
 * before first render is a bad payload, and the honest long-term line is far
 * below it — but lowering the line to a TARGET is a separate decision with its
 * own work behind it (objectui#5324 names the candidates), and re-baselining
 * onto a fresh measurement is not that. Nothing here should be read as a
 * finding that 3.19 MB is acceptable.
 *
 * ## Per-chunk ceilings (objectui#5490)
 *
 * One total over 52 chunks cannot say WHERE the payload moved, and inside its
 * headroom one chunk can grow by the whole allowance while the others shrink.
 * {@link PER_CHUNK_GZIP_CEILINGS} adds a line per big chunk on top of the
 * aggregate — same truthful-current-state discipline, same checked constraints,
 * keyed on the chunk names the REPORT carries so a renamed or vanished chunk
 * fails loudly instead of passing by weighing nothing. See that constant's
 * comment for the reasoning and for how to move one.
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
import { isEntrypoint } from './invoked-as.mjs';

/**
 * Ceiling for the console eager closure, in gzipped bytes. See the header for
 * how this number was chosen; measured 3,299,898 on `48e53814e`.
 *
 * Re-baselined DOWNWARD by objectui#5924 from 4,086,000 (derived from the
 * 4,005,911 reading on `4c1623c0c`, which the payload had since fallen 706,013
 * bytes below). Headroom is now 45,102 bytes — 0.49x
 * {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES}, where it had drifted to 8.6x.
 */
export const MAX_EAGER_CLOSURE_GZIP_BYTES = 3_345_000;

/**
 * The measurement the ceiling above was derived from. Exported so the two
 * constraints in the header are CHECKED rather than merely argued
 * (`scripts/__tests__/check-eager-closure-budget.test.ts`): a future edit that
 * raises the ceiling past the regression size it is meant to catch fails a
 * test instead of quietly becoming decorative.
 */
export const BASELINE = Object.freeze({
  /** `emitEagerClosureReport`'s `eagerGzipBytes` on this commit. */
  gzipBytes: 3_299_898,
  chunks: 52,
  totalChunks: 508,
  commit: '48e53814e',
});

/**
 * 89 KiB gzipped — the per-page-load cost objectui#5266 added, landing in
 * `vendor-objectstack-*.js` where the entry-chunk budget could not see it. The
 * headroom above {@link BASELINE} must stay under this, or the gate is green
 * through a repeat of the incident that motivated it.
 */
export const REGRESSION_THIS_GATE_MUST_CATCH_BYTES = 89 * 1024;

/**
 * Per-chunk ceilings, in gzipped bytes, keyed by the chunk NAME the report
 * carries (objectui#5490, the ruled follow-up of objectui#5468: option A now,
 * option C next, option B — a comparison against `main` — rejected).
 *
 * ## Why the aggregate ceiling is not enough
 *
 * The aggregate is one number over 52 chunks. Inside its headroom, a single
 * chunk can grow by the whole allowance while every other chunk shrinks by the
 * same amount, and the gate reports a green tick either way. That is not a
 * hypothetical shape: objectui#5266 put 89 KiB on every page load and ALL of it
 * landed in `vendor-objectstack`, the chunk that is 29% of the closure today.
 * The aggregate says whether the payload grew; these say WHERE.
 *
 * ## Why the keys are names from the report and not names written here
 *
 * The names are decided by `advancedChunks.groups` in
 * `apps/console/vite.config.ts`, emitted by rolldown, and published in
 * `files[].name`. This file looks them up; it does not re-derive them by
 * stripping `-<hash>.js` off a file name, and it does not carry a list of
 * chunks it EXPECTS to exist independent of the measurement.
 *
 * The distinction is the whole design, because the failure mode is silent. A
 * budget keyed on a chunk name that no longer exists is VACUOUSLY GREEN: it
 * passes because there is nothing to weigh. So a budgeted name that is absent
 * from the report is an ERROR here (exit 2, "the gauge cannot be trusted"),
 * never a skip — the same asymmetry {@link validateReport} exists for. If a
 * group is renamed or removed in `vite.config.ts`, this gate stops the build
 * and says so, and the mapping is re-pinned deliberately.
 *
 * ## Raising one
 *
 * Same discipline as {@link MAX_EAGER_CLOSURE_GZIP_BYTES}, and the same two
 * constraints, both CHECKED in `scripts/__tests__/check-eager-closure-budget.test.ts`:
 * every ceiling passes on the measurement in {@link PER_CHUNK_BASELINE}, and its
 * headroom stays under {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES} so a repeat
 * of the incident that motivated the gate cannot fit inside it. ⛔ Do not LOWER
 * one below the measured figure to express an aspiration: this is a ratchet, and
 * a ceiling under today's reality is a gate that lands red on `main`, which is
 * how a budget gets switched off rather than met. Shrinking the payload is real
 * work with its own cards (objectui#5324 names the candidates); when it lands,
 * re-measure and lower both numbers together.
 */
export const PER_CHUNK_GZIP_CEILINGS = Object.freeze({
  'vendor-objectstack': 967_000,
  framework: 502_000,
  'ui-components': 399_000,
});

/**
 * The measurement {@link PER_CHUNK_GZIP_CEILINGS} was derived from: one
 * `vite build` of `apps/console` on `2c8474c04`, read out of the report that
 * build wrote. Exported so the ceilings are CHECKED against it instead of
 * merely asserted in this comment.
 *
 * ⚠️ This is a DIFFERENT and LATER reading than {@link BASELINE} above, which
 * still carries `4c1623c0c`. On `2c8474c04` the same build measures the closure
 * at 3,298,620 bytes — 707,291 BELOW that recorded aggregate baseline, almost
 * all of it in `vendor-objectstack` (1,493 KB in the objectui#5490 card, 926 KB
 * here). The aggregate ceiling and its baseline were deliberately NOT touched
 * by objectui#5490: objectui#5468 ruled that the aggregate line "stays as
 * shipped", and moving it — in either direction — is the maintainer's call, not
 * this card's. The consequence is recorded rather than quietly fixed: the
 * aggregate ceiling now sits ~787 KB above today's payload, which is far more
 * than the {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES} it was sized to catch,
 * and until that is re-decided these per-chunk ceilings are what actually holds
 * the three biggest chunks in place.
 *
 * Keys must match {@link PER_CHUNK_GZIP_CEILINGS} exactly (a test enforces it):
 * a ceiling with no measurement behind it is a number someone guessed, and a
 * measurement with no ceiling weighs nothing.
 */
export const PER_CHUNK_BASELINE = Object.freeze({
  'vendor-objectstack': 948_461,
  framework: 492_399,
  'ui-components': 391_095,
});

/**
 * The report shape this checker understands. v2 added `files[].name` — the
 * chunk name rolldown itself recorded — which is what the per-chunk ceilings
 * below are keyed on. Refusing a v1 report is the point: without those names
 * every budgeted chunk would be "absent", and the difference between "this
 * build predates per-chunk budgets" and "vendor-objectstack has vanished from
 * the closure" must not be a guess.
 */
export const SUPPORTED_REPORT_VERSION = 2;

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
  // v2: every member carries the chunk name rolldown recorded, and that name is
  // the key the per-chunk ceilings look up. A member without one is not a
  // cosmetic gap — its bytes would be weighed by the aggregate and by nothing
  // else, and a budgeted chunk hiding in it would read as ABSENT.
  const unnamed = files.filter((f) => typeof f?.name !== 'string' || f.name === '');
  if (unnamed.length > 0) {
    const shown = unnamed.slice(0, 5).map((f) => f?.fileName ?? '<no fileName>');
    problems.push(
      `${unnamed.length} of ${files.length} files carry no chunk \`name\` (${shown.join(', ')}` +
        `${unnamed.length > shown.length ? ', …' : ''}) — per-chunk ceilings key on that field, ` +
        `so a report without it cannot be weighed per chunk`,
    );
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
 * Fold the report's eager members into `name -> { gzipBytes, fileNames }`.
 *
 * Chunks are SUMMED per name rather than matched one-to-one, so a group that
 * one day emits two chunks under the same name cannot let bytes out from under
 * its ceiling by splitting. Members with no name are skipped here and refused
 * upstream by {@link validateReport}, which is the only place that refusal
 * belongs — dropping them silently here would be the under-count this whole
 * file exists to prevent.
 *
 * @param {{ files?: { fileName: string, name?: string, gzipBytes: number }[] }} report
 * @returns {Map<string, { name: string, gzipBytes: number, fileNames: string[] }>}
 */
export function measureChunksByName(report) {
  const byName = new Map();
  for (const file of report?.files ?? []) {
    const name = file?.name;
    if (typeof name !== 'string' || name === '') continue;
    const entry = byName.get(name) ?? { name, gzipBytes: 0, fileNames: [] };
    entry.gzipBytes += file.gzipBytes;
    entry.fileNames.push(file.fileName);
    byName.set(name, entry);
  }
  return byName;
}

/**
 * Weigh each budgeted chunk against its own ceiling.
 *
 * Three verdicts, and the ORDER between them is the design:
 *
 *   - `error` — the report cannot be read, yielded no named chunks at all, or
 *     is missing a chunk this file budgets. All three are verdicts about the
 *     GAUGE. The missing-chunk case is the one worth stating out loud: a budget
 *     whose subject is absent passes trivially, so "absent" must be louder than
 *     "over", not quieter. A collapsed measurement is never under budget.
 *   - `fail` — a budgeted chunk is over its ceiling. Names the chunk and BOTH
 *     numbers, because "over budget" without the measurement is a tick in the
 *     other direction.
 *   - `pass` — every budgeted chunk with its measured size and remaining
 *     headroom, so a reader watching a chunk creep upward sees it coming
 *     instead of learning about it the day the gate turns red.
 *
 * @param {object} input
 * @param {unknown} input.report
 * @param {Record<string, number>} [input.ceilings]
 * @param {string} [input.reportPath]
 * @returns {{ status: 'pass' | 'fail' | 'error', message: string,
 *             chunks: { name: string, gzipBytes: number, ceilingBytes: number,
 *                       headroomBytes: number, fileNames: string[] }[],
 *             missing: string[], over: string[] }}
 */
export function evaluatePerChunkBudgets({
  report,
  ceilings = PER_CHUNK_GZIP_CEILINGS,
  reportPath = DEFAULT_REPORT_PATH,
} = {}) {
  const base = { chunks: [], missing: [], over: [] };
  const budgeted = Object.keys(ceilings);

  if (report === null || report === undefined) {
    return {
      ...base,
      status: 'error',
      message:
        `No eager-closure report at ${reportPath}, so no chunk was weighed. Per-chunk ` +
        `ceilings measure nothing without a build — this is a broken gauge, not ` +
        `${budgeted.length} budgets that all passed.`,
    };
  }

  const problems = validateReport(report);
  if (problems.length > 0) {
    return {
      ...base,
      status: 'error',
      message:
        `Per-chunk budgets cannot be read from ${reportPath}:\n  - ${problems.join('\n  - ')}`,
    };
  }

  // A ceiling map with no entries is the same vacuity as a ceiling whose chunk
  // is missing, one level up: nothing is weighed, so nothing can fail.
  if (budgeted.length === 0) {
    return {
      ...base,
      status: 'error',
      message:
        `No per-chunk ceilings are configured, so this half of the gate weighs nothing. ` +
        `An empty PER_CHUNK_GZIP_CEILINGS is a disabled check, not a passing one — ` +
        `objectui#5490 exists because a budget with no subject is green forever.`,
    };
  }

  const measured = measureChunksByName(report);
  // Defence in depth: {@link validateReport} above already refuses a report with
  // no files or with unnamed ones, so this branch should be unreachable through
  // this function. It stays because the direction it guards is the silent one —
  // if a future report shape ever slips an empty measurement past validation,
  // "zero chunks" must read as a broken gauge, never as an under-budget bundle.
  if (measured.size === 0) {
    return {
      ...base,
      status: 'error',
      message:
        `The eager-closure report at ${reportPath} yielded ZERO named chunks, so every ` +
        `per-chunk budget would pass by measuring nothing. A collapsed measurement is not an ` +
        `under-budget bundle.`,
    };
  }

  const present = [...measured.values()].sort((a, b) => b.gzipBytes - a.gzipBytes);
  const missing = budgeted.filter((name) => !measured.has(name));
  if (missing.length > 0) {
    return {
      ...base,
      missing,
      status: 'error',
      message:
        `Budgeted chunk${missing.length === 1 ? '' : 's'} ${missing.map((n) => `\`${n}\``).join(', ')} ` +
        `${missing.length === 1 ? 'is' : 'are'} ABSENT from the eager closure reported at ` +
        `${reportPath}. That is a FAILURE, not a pass: a ceiling whose chunk does not exist ` +
        `weighs nothing and would be green forever.\n` +
        `Either the chunk left the eager closure — good news that must be RE-PINNED here, not ` +
        `inferred — or an \`advancedChunks\` group in apps/console/vite.config.ts was renamed ` +
        `or removed and PER_CHUNK_GZIP_CEILINGS still names the old spelling.\n` +
        `The ${present.length} chunks the report DOES carry, largest first:\n` +
        present.map((c) => `  ${kb(c.gzipBytes).padStart(9)} KB  ${c.name}`).join('\n'),
    };
  }

  const chunks = budgeted
    .map((name) => {
      const entry = /** @type {{ name: string, gzipBytes: number, fileNames: string[] }} */ (
        measured.get(name)
      );
      const ceilingBytes = ceilings[name];
      return {
        name,
        gzipBytes: entry.gzipBytes,
        ceilingBytes,
        headroomBytes: ceilingBytes - entry.gzipBytes,
        fileNames: entry.fileNames,
      };
    })
    .sort((a, b) => b.gzipBytes - a.gzipBytes);

  const over = chunks.filter((c) => c.gzipBytes > c.ceilingBytes);
  // Measured sizes belong in the verdict either way — a reader should see
  // headroom shrinking, not just the tick that precedes a red gate.
  const table = chunks
    .map(
      (c) =>
        `  ${c.gzipBytes > c.ceilingBytes ? '❌' : '✅'} ${c.name.padEnd(20)} ` +
        `${kb(c.gzipBytes).padStart(9)} KB / ${kb(c.ceilingBytes)} KB ceiling ` +
        `(${c.headroomBytes >= 0 ? `headroom ${kb(c.headroomBytes)}` : `OVER by ${kb(-c.headroomBytes)}`} KB)` +
        `${c.fileNames.length > 1 ? ` [${c.fileNames.length} chunks]` : ''}`,
    )
    .join('\n');

  if (over.length > 0) {
    return {
      ...base,
      chunks,
      over: over.map((c) => c.name),
      status: 'fail',
      message:
        `${over.length} eager chunk${over.length === 1 ? ' is' : 's are'} over ` +
        `${over.length === 1 ? 'its' : 'their'} per-chunk budget:\n${table}\n` +
        `These bytes are inside the aggregate ceiling's headroom, which is exactly why this ` +
        `check exists (objectui#5490): one chunk growing while others shrink is invisible to a ` +
        `single total.\n` +
        `If the growth is intended, raise that chunk's entry in PER_CHUNK_GZIP_CEILINGS in ` +
        `scripts/check-eager-closure-budget.mjs deliberately, move PER_CHUNK_BASELINE with it, ` +
        `and say in the PR what the bytes buy — do not widen it just to get a green check.`,
    };
  }

  return {
    ...base,
    chunks,
    status: 'pass',
    message: `Per-chunk eager budgets (${chunks.length} chunks weighed):\n${table}`,
  };
}

/**
 * Weigh every ceiling against the payload it governs, and refuse a ceiling that
 * has drifted out of range of the regression it exists to catch (objectui#5924).
 *
 * ## The failure this exists for
 *
 * Both other halves answer "is the bundle under its line?". Neither can answer
 * "is that line still close enough to the bundle to mean anything?", and that
 * question has a silent wrong answer: a ceiling far above the payload passes
 * everything, prints a green tick with a large `headroom:` figure beside it, and
 * reads as a healthy bundle. The header records the measurement — the aggregate
 * ceiling was 8.6x the regression size above the live payload, and a +154 KB
 * eager regression went green through it.
 *
 * The invariant was not missing, it was checked in the wrong place: the unit
 * test compared {@link MAX_EAGER_CLOSURE_GZIP_BYTES} with
 * {@link BASELINE}.gzipBytes, two literals frozen in this module, so it was true
 * no matter what the console weighed. This function computes the same quantity
 * from the report the gate just read, so drift reds the moment it opens instead
 * of the day someone re-measures by hand.
 *
 * ## Why `error` and not `fail`
 *
 * `fail` is a verdict about the BUNDLE — it grew past a line. Nothing has grown
 * here; the ceiling has stopped being a measurement of anything. That is a
 * verdict about the GAUGE, which is what exit 2 means in this file, and it is
 * the same asymmetry {@link evaluatePerChunkBudgets} applies to a budgeted chunk
 * that is absent: a check that passes by measuring nothing must be LOUDER than
 * one that fails by measuring something, never quieter.
 *
 * ## What it deliberately does not do
 *
 * It does not treat a NEGATIVE headroom — a ceiling under the payload — as its
 * business. That is an over-budget bundle, the other two halves own it, and
 * reporting it here as well would turn one regression into an error and teach a
 * reader to distrust the exit code. Over-budget rows are still printed, marked
 * as such, so the table is a complete picture of every ceiling.
 *
 * @param {object} input
 * @param {unknown} input.report
 * @param {number} [input.budgetBytes]      the aggregate ceiling
 * @param {Record<string, number>} [input.ceilings]  the per-chunk ceilings
 * @param {number} [input.regressionBytes]  the size this gate must stay able to catch
 * @param {string} [input.reportPath]
 * @returns {{ status: 'pass' | 'fail' | 'error', message: string,
 *             sites: { key: string, label: string, constant: string, measuredBytes: number,
 *                      ceilingBytes: number, headroomBytes: number, multiple: number }[],
 *             blind: string[] }}
 */
export function evaluateHeadroomSensitivity({
  report,
  budgetBytes = MAX_EAGER_CLOSURE_GZIP_BYTES,
  ceilings = PER_CHUNK_GZIP_CEILINGS,
  regressionBytes = REGRESSION_THIS_GATE_MUST_CATCH_BYTES,
  reportPath = DEFAULT_REPORT_PATH,
} = {}) {
  const base = { sites: [], blind: [] };

  if (report === null || report === undefined) {
    return {
      ...base,
      status: 'error',
      message:
        `No eager-closure report at ${reportPath}, so no ceiling could be weighed against the ` +
        `payload it governs. Sensitivity is a property of the ceiling AND the measurement — ` +
        `with only one of them there is nothing to check. This is a broken gauge, not a ` +
        `sensitive gate.`,
    };
  }

  const problems = validateReport(report);
  if (problems.length > 0) {
    return {
      ...base,
      status: 'error',
      message: `Ceiling sensitivity cannot be judged from ${reportPath}:\n  - ${problems.join('\n  - ')}`,
    };
  }

  const measured = measureChunksByName(report);
  const sites = [
    {
      key: 'aggregate',
      label: 'aggregate closure',
      constant: 'MAX_EAGER_CLOSURE_GZIP_BYTES',
      measuredBytes: /** @type {{ eagerGzipBytes: number }} */ (report).eagerGzipBytes,
      ceilingBytes: budgetBytes,
    },
  ];
  const absent = [];
  for (const [name, ceilingBytes] of Object.entries(ceilings)) {
    const entry = measured.get(name);
    // A budgeted chunk with nothing to weigh has no headroom to judge. It is
    // already an ERROR one level up, and inventing a verdict for it here (0
    // bytes measured, so "drifted") would be a second wrong reason for the
    // right exit code. Refuse the whole judgement instead of guessing part of it.
    if (entry === undefined) {
      absent.push(name);
      continue;
    }
    sites.push({
      key: name,
      label: `chunk \`${name}\``,
      constant: `PER_CHUNK_GZIP_CEILINGS['${name}']`,
      measuredBytes: entry.gzipBytes,
      ceilingBytes,
    });
  }

  if (absent.length > 0) {
    return {
      ...base,
      status: 'error',
      message:
        `Cannot judge ceiling sensitivity: budgeted chunk${absent.length === 1 ? '' : 's'} ` +
        `${absent.map((n) => `\`${n}\``).join(', ')} ${absent.length === 1 ? 'is' : 'are'} absent ` +
        `from ${reportPath}, so ${absent.length === 1 ? 'its ceiling governs' : 'their ceilings govern'} ` +
        `nothing measurable. See the per-chunk verdict for what to do about it.`,
    };
  }

  const rows = sites.map((site) => {
    const headroomBytes = site.ceilingBytes - site.measuredBytes;
    return { ...site, headroomBytes, multiple: headroomBytes / regressionBytes };
  });
  const blind = rows.filter((row) => row.headroomBytes >= regressionBytes);

  const table = rows
    .map((row) => {
      const band =
        row.headroomBytes < 0
          ? `OVER by ${kb(-row.headroomBytes)} KB — the size verdict owns this row, not this one`
          : `headroom ${kb(row.headroomBytes)} KB = ${row.multiple.toFixed(2)}x the ` +
            `${kb(regressionBytes)} KB regression`;
      return (
        `  ${row.headroomBytes >= regressionBytes ? '❌' : '✅'} ${row.label.padEnd(28)} ` +
        `${kb(row.measuredBytes).padStart(9)} KB measured / ${kb(row.ceilingBytes)} KB ceiling ` +
        `(${band})  [${row.constant}]`
      );
    })
    .join('\n');

  if (blind.length > 0) {
    return {
      sites: rows,
      blind: blind.map((row) => row.key),
      status: 'error',
      message:
        `${blind.length} ceiling${blind.length === 1 ? '' : 's'} ` +
        `${blind.length === 1 ? 'has' : 'have'} DRIFTED more than one ` +
        `${kb(regressionBytes)} KB regression above the payload ` +
        `${blind.length === 1 ? 'it governs' : 'they govern'}:\n${table}\n` +
        `A ceiling that far above today's measurement cannot tell "no regression" from a repeat ` +
        `of objectui#5266 — its green tick carries no information, which makes this a verdict ` +
        `about the GAUGE and not about the bundle (objectui#5924: an aggregate ceiling at 8.6x ` +
        `passed a demonstrated +154 KB eager regression).\n` +
        `The payload almost certainly SHRANK, which is good news — and good news is RE-PINNED ` +
        `deliberately, never inferred: lower the named constant, move its baseline with it in ` +
        `the same commit, and say in the PR what the new headroom is.\n` +
        `⛔ Never lower a ceiling BELOW the measured figure to express an aspiration. A ceiling ` +
        `under today's reality lands red on \`main\`, which is how a budget gets switched off ` +
        `rather than met.`,
    };
  }

  return {
    sites: rows,
    blind: [],
    status: 'pass',
    message:
      `Ceiling sensitivity (${rows.length} ceilings, each weighed against the report just read):\n` +
      `${table}`,
  };
}

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
 * Exit codes: `0` within budget, `1` over budget — the aggregate ceiling or any
 * per-chunk ceiling — and `2` no trustworthy measurement (report missing,
 * stale-shaped, internally inconsistent, missing a budgeted chunk, or governed
 * by a ceiling that has drifted out of range of the regression it must catch).
 *
 * `2` covers the unbuilt tree, and deliberately so: with no
 * `apps/console/dist/eager-closure.json` this check reports a BROKEN GAUGE and
 * the workflow fails the step. It never prints a verdict about a bundle nobody
 * weighed, and it never exits 0 having measured nothing.
 *
 * All three halves are evaluated and printed before any of them decides the
 * code: a run that reports the total and hides which chunk moved (or hides
 * whether either line still means anything) teaches readers to ignore the half
 * they cannot see.
 */
export function main(argv = process.argv.slice(2)) {
  const flagIndex = argv.indexOf('--report');
  const reportPath = flagIndex === -1 ? DEFAULT_REPORT_PATH : argv[flagIndex + 1];
  const resolved = path.resolve(reportPath);
  const report = readReport(resolved);
  const result = evaluateClosureBudget({ report, reportPath });
  const perChunk = evaluatePerChunkBudgets({ report, reportPath });
  const sensitivity = evaluateHeadroomSensitivity({ report, reportPath });

  if (result.status === 'pass') {
    console.log(`✅ ${result.message}`);
  } else {
    console.error(`❌ ${result.message}`);
  }
  if (perChunk.status === 'pass') {
    console.log(`✅ ${perChunk.message}`);
  } else {
    console.error(`❌ ${perChunk.message}`);
  }
  if (sensitivity.status === 'pass') {
    console.log(`✅ ${sensitivity.message}`);
  } else {
    console.error(`❌ ${sensitivity.message}`);
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
    closure_chunk_status: perChunk.status,
    closure_headroom_status: sensitivity.status,
  });

  // Distinct codes so the workflow can tell "over budget" (a real verdict about
  // the bundle) from "the gauge produced nothing" (a verdict about the gauge).
  // Collapsing them to 1 would let a broken report be reported as a size
  // regression, and a size regression reported as a broken report — each of
  // which teaches readers to ignore the other.
  //
  // `error` outranks `fail` across ALL THREE halves for the same reason it does
  // within one: a report that cannot be trusted — or a ceiling that no longer
  // measures the thing it names — makes its own size verdict meaningless,
  // whichever half noticed first. objectui#5490 established that ordering over
  // two halves; objectui#5924 adds the third under the same rule rather than
  // giving sensitivity a code of its own.
  const statuses = [result.status, perChunk.status, sensitivity.status];
  if (statuses.includes('error')) return 2;
  return statuses.includes('fail') ? 1 : 0;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}
