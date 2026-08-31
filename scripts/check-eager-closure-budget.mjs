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
 *     the current 3,254,004 bytes: 45,996 (1.41%).
 *   - The headroom must stay SMALLER than the regression the gate exists to
 *     catch. objectui#5266 was 89 KiB = 91,136 bytes; 45,996 < 91,136, so this
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
 * objectui#6683 lowered it again, to 3,300,000 over 3,254,004 — and this one was
 * EARNED rather than drifted into. `@object-ui/app-shell` now publishes a
 * precise `sideEffects` array (guarded by
 * `scripts/check-side-effects-array.mjs`), which made 56,668 gzipped bytes of
 * the barrel's closure shakeable. That is LARGER than the 45,102 bytes of
 * headroom the 3,345,000 ceiling carried, so the ceiling had to move with it or
 * the aggregate gauge would sit at 1.00x its own sensitivity — the blind band
 * reopening the same day it was measured shut. The two numbers move in ONE
 * commit for the reason the paragraph above gives.
 *
 * objectui#6776 lowered it a third time, to 3,268,000 over 3,222,314, and this
 * one was earned the same way. `views/metadata-admin/index.ts` stopped being a
 * registering module — its five load-time registrations moved to a leaf the
 * PACKAGE ENTRY bare-imports — so the `sideEffects` array stopped naming it, the
 * package barrel's 25 runtime re-exports were re-pointed at leaf modules, and
 * the whole `metadata-admin` chunk (172,945 gzipped bytes, 144 modules) left the
 * eager closure: 3,254,230 -> 3,222,314, −31,916 bytes, measured on two full
 * console builds. The maintainer ruling of 2026-08-30 made the re-baseline part
 * of the change rather than a follow-up, in its own words:
 *
 *     ⛔ ceiling 处置写死(不作实施者临场判断):-31KB 把余量推到 ~0.89x 门禁
 *     89KB 回归阈值(近盲),同批重设 `MAX_EAGER_CLOSURE_GZIP_BYTES`;抬 ceiling
 *     是有申报程序的 ratchet,裁决原话引入 PR 正文。
 *
 * Measured, the drift was 0.85x rather than 0.89x — the gate printed
 * `headroom 75.9 KB = 0.85x the 89.0 KB regression` on the post-change build
 * before this constant moved. Either way it is the blind band reopening, and the
 * direction of this edit is DOWN: no build that passed before it and measures
 * under 3,268,000 fails after it.
 *
 * ⚠️ Read the direction correctly: the closure did NOT fall by the 242.6 KB the
 * objectui#6683 card projected. That figure was measured for
 * `"sideEffects": false`, which is closed by measurement because it also DROPS
 * three live SDUI widget registrations. The precise array keeps them, and
 * keeping them keeps their import closure eager; 56,668 bytes is what the
 * correct declaration actually buys. The gap is not a defect in the array — it
 * is the price of the correctness the ruling required, and the difference is
 * recorded here rather than smoothed over.
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
 * This is a truthful CURRENT-STATE ceiling, not a target. 3.07 MB gzipped
 * before first render is a bad payload, and the honest long-term line is far
 * below it — but lowering the line to a TARGET is a separate decision with its
 * own work behind it (objectui#5324 names the candidates), and re-baselining
 * onto a fresh measurement is not that. Nothing here should be read as a
 * finding that 3.12 MB is acceptable.
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
 * ## Is the ceiling still the one in force? (objectui#6245)
 *
 * The three halves above all read this file's constants and take them as given.
 * None of them can ask whether the constants THEMSELVES are current, and on a
 * `pull_request` run that question has a wrong answer that is invisible from
 * inside the checkout: `Bundle Analysis` is a required context, GitHub does not
 * re-run a PR's checks when the base branch moves, so a green verdict can be
 * computed against ceilings `main` has since replaced — and the merge is gated
 * on it. Measured, not inferred: run 32804357171 started 6m50s AFTER
 * `0409b766d` lowered the aggregate ceiling to 3,345,000 and published
 * `BUDGET_CLOSURE_BUDGET_KB: 3990.2` — the retired 4,086,000 — as a success.
 *
 * {@link evaluateCeilingFreshness} is the fourth half and closes that window
 * inside the tool: it compares {@link VERDICT_CEILING_CONSTANTS} across three
 * readings of this file — this checkout, the base commit the checkout was made
 * from, and the base branch tip — and calls a ceiling the base branch moved out
 * from under this run an ERROR (exit 2). Three readings rather than two because
 * a re-baseline PR differs from the base branch deliberately and must still
 * land; see that function for the rule and for the residual window it cannot
 * close.
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
import { fileURLToPath } from 'node:url';
import { isEntrypoint } from './invoked-as.mjs';

/**
 * Ceiling for the console eager closure, in gzipped bytes. See the header for
 * how this number was chosen; measured 3,222,314 on `3d257c85a`.
 *
 * Re-baselined DOWNWARD three times, each time toward a measurement the payload
 * had already fallen to:
 *
 *   - objectui#5924, from 4,086,000 (derived from the 4,005,911 reading on
 *     `4c1623c0c`) to 3,345,000 over 3,299,898 on `48e53814e`.
 *   - objectui#6683, to 3,300,000 over 3,254,004. `@object-ui/app-shell` now
 *     declares a precise `sideEffects` ARRAY, which took 56,668 gzipped bytes
 *     out of the closure — more than the 45,102 of headroom the previous
 *     ceiling had, so leaving it in place would have parked the aggregate gauge
 *     at 1.00x its own sensitivity and, on the next byte of shrink, tripped the
 *     exit-2 verdict about the gauge. Lowering it in the SAME change is the
 *     tightening the maintainer ruling of 2026-08-29 asked for.
 *   - objectui#6776, to 3,268,000 over 3,222,314. The metadata-admin engine's
 *     five load-time registrations moved out of the page barrel, so the barrel
 *     stopped being named by the `sideEffects` array and the 172,945-byte
 *     `metadata-admin` chunk left the eager closure (−31,916 bytes). The
 *     3,300,000 ceiling was measured carrying 75.9 KB of headroom afterwards —
 *     0.85x the regression this gate must catch, the blind band reopening — and
 *     the 2026-08-30 ruling made moving it part of the same change.
 *
 * Headroom is 45,686 bytes — 0.50x {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES}.
 */
export const MAX_EAGER_CLOSURE_GZIP_BYTES = 3_268_000;

/**
 * The measurement the ceiling above was derived from. Exported so the two
 * constraints in the header are CHECKED rather than merely argued
 * (`scripts/__tests__/check-eager-closure-budget.test.ts`): a future edit that
 * raises the ceiling past the regression size it is meant to catch fails a
 * test instead of quietly becoming decorative.
 */
export const BASELINE = Object.freeze({
  /**
   * `emitEagerClosureReport`'s `eagerGzipBytes` on this commit.
   *
   * `3d257c85a` is the commit that carries the metadata-admin split
   * (objectui#6776); this constant was written one commit later, and the two
   * trees differ ONLY by this file. That is safe to state rather than hope, and
   * it is the same argument the previous baseline (`bd2a7ec50`) made: the
   * console build's turbo `inputs` cover `scripts/vite-*.ts`, not
   * `scripts/check-*.mjs`, so nothing in this file reaches the bundler.
   */
  gzipBytes: 3_222_314,
  chunks: 48,
  totalChunks: 517,
  commit: '3d257c85a',
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
 * ## Why `framework` moved (objectui#6759)
 *
 * From 502,000 over a 492,399 reading on `2c8474c04` to 512,000 over 502,405
 * on `a64e96ca8`. What the added bytes buy is user-facing diagnostic text, in
 * ten locales, for two ordinary author mistakes that used to be unreported:
 *
 *   - a malformed or absent gantt date crashed the render outright
 *     (`RangeError: Invalid time value`), and
 *   - an inverted author-pinned range drew a bar at `width: -4.3%` under a
 *     header row with zero cells, and said nothing at all.
 *
 * A hard crash and a confidently-wrong render, both reachable from a typo in
 * authored metadata, replaced by a refusal that names the offending value.
 *
 * The CODE that fix added buys none of this chunk, which is why there was
 * nothing to trim instead: `plugin-timeline` is lazy and is not in the eager
 * closure at all, so the guard, the value speller and both refusal branches
 * cost this budget zero. Every byte of the growth is `packages/i18n` locale
 * data, which lands here. Measured on the built chunk by deleting the twenty
 * strings and re-gzipping: the ten locales' message text is 1,999 of the
 * ~2,283 bytes the chunk grew by, and PER MESSAGE it costs 1,000 bytes
 * against the 1,002 that objectui#6655's single refusal — the neighbour whose
 * shape this one copied — already costs in the same chunk. The only lever
 * left was to say less, in ten languages, about what the author got wrong.
 *
 * ⚠️ Most of the headroom this consumed was not spent by that card. The
 * previous ceiling carried 9,601 bytes and `main` had already drifted to
 * 488.4 KB of the 490.2 KB it allowed — 1.8 KB left, 0.02x the regression
 * this gate must catch — before objectui#6759 added a byte (`b98352a15`,
 * this PR's base, the gate's own printed line). Re-pinning the baseline onto
 * a fresh measurement is what puts the gauge back in range. The drift itself,
 * and that nobody could say which side moved it, is objectui#6631; this card
 * does not close it and deliberately leaves the other two entries alone.
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
  framework: 512_000,
  'ui-components': 399_000,
});

/**
 * The measurement {@link PER_CHUNK_GZIP_CEILINGS} was derived from, read out of
 * the report a `vite build` of `apps/console` wrote. Provenance is per KEY, not
 * per file, and saying so is the point — a comment that names one commit for
 * three numbers taken on two is the drift objectui#6631 is open about:
 *
 *   - `vendor-objectstack`, `ui-components` — `2c8474c04` (objectui#5490).
 *   - `framework` — `a64e96ca8` (objectui#6759); see "Why `framework` moved"
 *     above. Safe to state rather than hope, for the reason {@link BASELINE}
 *     gives about its own commit: the console build's turbo `inputs` cover
 *     `scripts/vite-*.ts`, not `scripts/check-*.mjs`, so the commit that
 *     records this figure cannot have changed the figure.
 *
 * Exported so the ceilings are CHECKED against it instead of merely asserted
 * in this comment.
 *
 * ⚠️ These readings are on DIFFERENT commits from {@link BASELINE} above, and
 * WHICH ONE IS LATER flips every time either side is re-baselined — so read the
 * commit names, never a direction asserted here. As of objectui#6776 the
 * AGGREGATE is the later reading: BASELINE's `3d257c85a` is dated 2026-08-30
 * against `2c8474c04` on 2026-08-25 here, and `a64e96ca8` was recorded by
 * objectui#6759, which landed 2026-08-29. This paragraph asserted the reverse,
 * in the present tense, from objectui#5490 until objectui#6778 — true when it
 * was written, then left standing while three aggregate re-baselines moved
 * {@link BASELINE} out from under it.
 *
 * ⚠️ Do not expect `git show` to answer for all of these. Squash-merge keeps the
 * landing commit and drops the PR branch, so of the three named above only
 * `2c8474c04` is an ancestor of `main`; `3d257c85a` still resolves as an object
 * but is not on `main` (it landed as `350509b53`), and `a64e96ca8` is not an
 * object in this repository at all. That is why every hash here is cited WITH
 * its issue: the issue outlives the hash.
 *
 * The aggregate ceiling and its baseline were deliberately NOT touched by
 * objectui#5490: objectui#5468 had ruled that the aggregate line "stays as
 * shipped", and moving it — in either direction — is the maintainer's call. That
 * is why the provenance splits in the first place.
 *
 * ⛔ The stale direction is the cheap half. The expensive half is the CONCLUSION
 * this paragraph used to draw from it: that the aggregate ceiling sat far above
 * the payload — 4,086,000 over the 3,298,620 reading, 787,380 bytes of headroom,
 * 8.64x {@link REGRESSION_THIS_GATE_MUST_CATCH_BYTES} — and that these per-chunk
 * ceilings were therefore the only lines holding the three biggest chunks in
 * place. That was accurate for objectui#5490 and is now false: objectui#5924,
 * objectui#6683 and objectui#6776 lowered the aggregate ceiling three times,
 * onto 3,268,000, and it is back in range and doing work.
 *
 * Checked rather than argued, which is the rule everywhere else in this file. A
 * full console build on `e33b44796` and `pnpm check:eager-closure` printed:
 *
 *     ✅ aggregate closure          3149.2 KB measured / 3191.4 KB ceiling (headroom 42.2 KB = 0.47x)
 *     ✅ chunk `vendor-objectstack`  925.7 KB measured /  944.3 KB ceiling (headroom 18.6 KB = 0.21x)
 *     ✅ chunk `framework`           492.9 KB measured /  500.0 KB ceiling (headroom  7.1 KB = 0.08x)
 *     ✅ chunk `ui-components`       386.2 KB measured /  389.6 KB ceiling (headroom  3.4 KB = 0.04x)
 *
 * All four sit inside one regression, which is the whole of what "in range"
 * means here — {@link evaluateHeadroomSensitivity} calls 1.00x an error. So the
 * relationship these ceilings have to the aggregate is no longer "we are the
 * half that still works". It is narrower, and still worth having: they are the
 * TIGHTER half — 0.21x, 0.08x, 0.04x against the aggregate's 0.47x — so growth
 * in these three chunks reds the gate well before the aggregate would, and they
 * say WHERE, which one total never can.
 *
 * ⛔ Do not size a re-baseline off the figures above. They are ONE dated run,
 * recorded so this paragraph rests on a measurement instead of an argument; the
 * answer in force is the table the gate prints on YOUR build. That this prose
 * went three re-baselines stale while the numbers beside it could not
 * (objectui#6778) is the reason to distrust the prose first.
 *
 * Keys must match {@link PER_CHUNK_GZIP_CEILINGS} exactly (a test enforces it):
 * a ceiling with no measurement behind it is a number someone guessed, and a
 * measurement with no ceiling weighs nothing.
 */
export const PER_CHUNK_BASELINE = Object.freeze({
  'vendor-objectstack': 948_461,
  framework: 502_405,
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
 * The constants a verdict from this file is COMPUTED FROM — the three the three
 * evaluators above take as their defaults, and no others.
 *
 * {@link BASELINE} and {@link PER_CHUNK_BASELINE} are deliberately absent. They
 * record the measurements the ceilings were derived from and are read by the
 * unit test and by a human; no verdict depends on them. Listing them here would
 * make a baseline-only or comment-only edit on the base branch read as a
 * superseded ceiling, and a freshness check that cries wolf is one people learn
 * to click past.
 */
export const VERDICT_CEILING_CONSTANTS = Object.freeze([
  'MAX_EAGER_CLOSURE_GZIP_BYTES',
  'PER_CHUNK_GZIP_CEILINGS',
  'REGRESSION_THIS_GATE_MUST_CATCH_BYTES',
]);

/**
 * Read one `export const NAME = ...;` initializer out of module SOURCE TEXT,
 * with comments dropped and formatting normalised.
 *
 * Text, not values, because the two sides of the freshness comparison are this
 * file at two different commits and only one of them can be imported: the other
 * is a blob from the base branch. Comparing `89 * 1024` against `91136` would
 * be comparing an expression with an evaluation, so both sides are read the
 * same way — through this function — and a difference means a difference.
 *
 * What normalisation deliberately erases, because none of it moves a ceiling:
 * comments, line breaks and indentation, trailing commas, and the `_` numeric
 * separators (`3_345_000` and `3345000` are the same number). What it keeps is
 * everything else, so a changed digit is a changed ceiling.
 *
 * @param {string} source
 * @param {number} from index just past the `=`
 * @returns {string | null} the normalised initializer, or null if unterminated
 */
function readInitializer(source, from) {
  let depth = 0;
  const out = [];
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    const pair = source.slice(i, i + 2);
    if (pair === '//') {
      while (i < source.length && source[i] !== '\n') i += 1;
      out.push(' ');
      continue;
    }
    if (pair === '/*') {
      const end = source.indexOf('*/', i + 2);
      if (end === -1) return null;
      i = end + 2;
      out.push(' ');
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const literal = readStringLiteral(source, i);
      if (literal === null) return null;
      out.push(literal.text);
      i = literal.end;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
    if (ch === ';' && depth === 0) return normaliseDeclaration(out.join(''));
    out.push(ch);
    i += 1;
  }
  return null;
}

/** @param {string} source @param {number} start index of the opening quote */
function readStringLiteral(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return { text: source.slice(start, i + 1), end: i + 1 };
    i += 1;
  }
  return null;
}

/** @param {string} text */
function normaliseDeclaration(text) {
  return text
    .replace(/(\d)_(?=\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/,(\s*[}\])])/g, '$1')
    .trim();
}

/**
 * Pull the {@link VERDICT_CEILING_CONSTANTS} declarations out of module source.
 *
 * A name this cannot find goes in `missing` and is an ERROR upstream, never a
 * skipped comparison: "I could not read the ceiling" and "the ceiling agrees"
 * are the two answers a freshness check must never confuse, and only one of
 * them is safe to be quiet about.
 *
 * @param {string | null | undefined} source
 * @param {readonly string[]} [names]
 * @returns {{ declarations: Map<string, string>, missing: string[] }}
 */
export function extractCeilingDeclarations(source, names = VERDICT_CEILING_CONSTANTS) {
  const declarations = new Map();
  const missing = [];
  const text = typeof source === 'string' ? source : '';
  for (const name of names) {
    const anchor = new RegExp(`^export const ${name}\\s*=`, 'm').exec(text);
    const initializer = anchor === null ? null : readInitializer(text, anchor.index + anchor[0].length);
    if (initializer === null || initializer === '') {
      missing.push(name);
      continue;
    }
    declarations.set(name, initializer);
  }
  return { declarations, missing };
}

/**
 * The FOURTH half: is the ceiling this run weighed against still the ceiling in
 * force on the base branch? (objectui#6245)
 *
 * ## The race
 *
 * `Bundle Analysis` is a required context, and a `pull_request` run checks out
 * the MERGE REF — a merge of the PR head with the base branch as GitHub last
 * computed it. GitHub does not re-run a PR's checks when the base branch moves,
 * so a green verdict can be computed against ceiling constants that `main` has
 * since replaced, and the merge is then gated on a verdict about a ceiling that
 * no longer exists.
 *
 * Observed live rather than reasoned about: run 32804357171 started at
 * 03:13:27Z, six minutes and fifty seconds after `0409b766d` lowered
 * {@link MAX_EAGER_CLOSURE_GZIP_BYTES} from 4,086,000 to 3,345,000 on `main`,
 * and published `BUDGET_CLOSURE_BUDGET_KB: 3990.2` — 4,086,000 bytes, the
 * retired ceiling — with `conclusion: success`. It did not bite: the payload was
 * 3222.6 KB, under both numbers. With the aggregate headroom now 44.0 KB against
 * an 89.0 KB regression class, the next one has half a regression of room to
 * hide in.
 *
 * ## Why THREE readings and not two
 *
 * Comparing this checkout's ceilings against the base branch's is not enough: a
 * re-baseline PR differs from the base branch ON PURPOSE, and failing it would
 * make the one PR that must land unlandable. So the question is not "do they
 * differ" but "did the BASE BRANCH move them out from under this checkout":
 *
 *   - `prBaseSource` — the checker at the base commit this checkout was
 *     computed from. What the base branch said when the merge ref was made.
 *   - `baseSource` — the checker at the base branch tip right now. What the
 *     merge would actually land on.
 *   - `headSource` — the checker in this checkout. What the verdict used.
 *
 * A ceiling is SUPERSEDED when it moved between the first two AND this checkout
 * does not carry the move. A re-baseline PR moves it in `headSource` only, the
 * first two agree, and nothing fires.
 *
 * ## Why `error` (exit 2) and not `fail`
 *
 * `fail` is a verdict about the BUNDLE — it grew past a line. Nothing has grown
 * here and no ceiling has drifted; the measurement above is sound and the
 * ceilings on the base branch are sound. What is wrong is that they were never
 * weighed against each other. That is a verdict about the GAUGE, which is what
 * exit 2 means in this file, and the message says so in as many words — a
 * freshness failure that reads like "the bundle grew" would send its reader
 * hunting a regression that is not there.
 *
 * ## What this closes, and what it does not
 *
 * It closes the window this card recorded: a run that EXECUTES after the
 * constants move, with a checkout that predates it. It cannot close the window
 * where the run finishes BEFORE the constants move and the PR is merged after —
 * no code of ours runs at that moment. That residual is what the `push`-on-main
 * run detects after the fact, and closing it needs "require branches to be up to
 * date before merging", a repository setting and a maintainer-floor decision
 * this file has no business making.
 *
 * @param {object} input
 * @param {string} [input.eventName]     `GITHUB_EVENT_NAME`
 * @param {string | null} [input.headSource]     this checkout's copy of this file
 * @param {string | null} [input.prBaseSource]   this file at the checkout's base commit
 * @param {string | null} [input.baseSource]     this file at the base branch tip
 * @param {string} [input.prBaseSha]
 * @param {string} [input.baseSha]
 * @param {string} [input.baseRef]
 * @returns {{ status: 'pass' | 'error' | 'not-applicable', message: string,
 *             moved: string[], superseded: string[] }}
 */
export function evaluateCeilingFreshness({
  eventName,
  headSource,
  prBaseSource,
  baseSource,
  prBaseSha,
  baseSha,
  baseRef,
} = {}) {
  const base = { moved: [], superseded: [] };
  const branch = baseRef ? `\`${baseRef}\`` : 'the base branch';

  // A `push` run's checkout IS the branch being weighed, and a local run has no
  // merge to gate. Neither can hold a superseded ceiling, so neither gets a
  // verdict — this half exists for the merge ref and nothing else.
  if (eventName !== 'pull_request') {
    return {
      ...base,
      status: 'not-applicable',
      message:
        `Ceiling freshness: not applicable to a ${eventName ? `\`${eventName}\`` : 'local'} run. ` +
        `This check compares a pull_request merge ref against the branch it would land on; a ` +
        `checkout that IS that branch cannot be behind it.`,
    };
  }

  const absent = [
    prBaseSource ? null : 'EAGER_CLOSURE_PR_BASE_SOURCE',
    baseSource ? null : 'EAGER_CLOSURE_BASE_SOURCE',
  ].filter((name) => name !== null);
  if (absent.length > 0) {
    return {
      ...base,
      status: 'error',
      message:
        `Ceiling freshness cannot be judged on this pull_request run: ${absent.join(' and ')} ` +
        `named no readable file.\n` +
        `Those are exported by the \`Resolve the base-branch ceiling constants\` step in ` +
        `.github/workflows/performance-budget.yml; on a pull_request run their absence means ` +
        `that step did not complete, NOT that the ceilings agree.\n` +
        `An unreadable base branch is an ERROR and never a quiet pass: from inside this ` +
        `checkout a superseded ceiling looks exactly like a current one.`,
    };
  }

  const sides = /** @type {[string, string | null | undefined][]} */ ([
    ['this checkout', headSource],
    ['the base commit this checkout was made from', prBaseSource],
    [`the ${baseRef ? `\`${baseRef}\`` : 'base branch'} tip`, baseSource],
  ]);
  const read = sides.map(([label, source]) => ({ label, ...extractCeilingDeclarations(source) }));
  const unreadable = read.filter((side) => side.missing.length > 0);
  if (unreadable.length > 0) {
    return {
      ...base,
      status: 'error',
      message:
        `Ceiling freshness cannot be judged — the ceiling declarations could not be located:\n` +
        unreadable
          .map((side) => `  - in ${side.label}: ${side.missing.map((n) => `\`${n}\``).join(', ')}`)
          .join('\n') +
        `\nBoth sides are read by \`extractCeilingDeclarations\`, which looks for ` +
        `\`export const NAME = ... ;\` at the top level of this file. A name it cannot find has ` +
        `been renamed, moved, or reshaped — re-point VERDICT_CEILING_CONSTANTS at the ceilings ` +
        `the verdict is now computed from. It is an error rather than a skipped comparison for ` +
        `the same reason an absent budgeted chunk is: a check that weighs nothing passes forever.`,
    };
  }

  const [head, prBase, current] = read.map((side) => side.declarations);
  const moved = [...VERDICT_CEILING_CONSTANTS].filter(
    (name) => prBase.get(name) !== current.get(name),
  );
  const superseded = moved.filter((name) => head.get(name) !== current.get(name));

  if (superseded.length === 0) {
    return {
      ...base,
      moved,
      status: 'pass',
      message:
        moved.length === 0
          ? `Ceiling freshness: all ${VERDICT_CEILING_CONSTANTS.length} ceiling constants are ` +
            `unchanged on ${branch} since this checkout's base${baseSha ? ` (${baseSha})` : ''}, ` +
            `so the verdicts above were weighed against the ceilings actually in force.`
          : `Ceiling freshness: ${moved.map((n) => `\`${n}\``).join(', ')} moved on ${branch} ` +
            `since this checkout's base, and this checkout already carries the new ` +
            `value${moved.length === 1 ? '' : 's'} — the verdicts above are current.`,
    };
  }

  const table = superseded
    .map(
      (name) =>
        `  ❌ ${name}\n` +
        `       weighed here : ${head.get(name)}\n` +
        `       in force now : ${current.get(name)}`,
    )
    .join('\n');

  return {
    moved,
    superseded,
    status: 'error',
    message:
      `${superseded.length} ceiling constant${superseded.length === 1 ? '' : 's'} this run ` +
      `weighed against ${superseded.length === 1 ? 'has' : 'have'} been SUPERSEDED: ${branch} ` +
      `moved ${superseded.length === 1 ? 'it' : 'them'} after this checkout was made` +
      `${prBaseSha && baseSha ? ` (${prBaseSha} -> ${baseSha})` : ''}, and nothing re-ran the ` +
      `verdicts above.\n${table}\n` +
      `⛔ NOTHING GREW. This is not a size regression and it is not a drifted ceiling: the ` +
      `measurement above is sound, and so are the ceilings on ${branch}. The only thing wrong is ` +
      `that they were never weighed against each other, so a green tick here would gate the ` +
      `merge on a ceiling that no longer exists (objectui#6245).\n` +
      `Fix: update this branch onto ${branch} — merge or rebase — and let Bundle Analysis run ` +
      `again. ⛔ Do NOT widen a ceiling to clear this; re-baselining is a separate, deliberate ` +
      `act and this run has no evidence for one.`,
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

/**
 * Read a source file for {@link evaluateCeilingFreshness}, or null when the
 * path is absent or unreadable. Null is never "the same as" — it routes to a
 * loud ERROR upstream.
 * @param {string | undefined} sourcePath
 */
export function readSource(sourcePath) {
  if (!sourcePath) return null;
  try {
    return fs.readFileSync(sourcePath, 'utf8');
  } catch {
    return null;
  }
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
 * per-chunk ceiling — and `2` no trustworthy verdict (report missing,
 * stale-shaped, internally inconsistent, missing a budgeted chunk, governed by
 * a ceiling that has drifted out of range of the regression it must catch, or —
 * objectui#6245 — weighed against a ceiling the base branch has since replaced).
 *
 * The last of those is the one exit 2 case with a PERFECTLY GOOD measurement
 * behind it, so nothing downstream may word exit 2 as "nothing was measured".
 *
 * `2` covers the unbuilt tree, and deliberately so: with no
 * `apps/console/dist/eager-closure.json` this check reports a BROKEN GAUGE and
 * the workflow fails the step. It never prints a verdict about a bundle nobody
 * weighed, and it never exits 0 having measured nothing.
 *
 * All FOUR halves are evaluated and printed before any of them decides the
 * code: a run that reports the total and hides which chunk moved (or hides
 * whether either line still means anything, or whether the line it used is the
 * line in force) teaches readers to ignore the half they cannot see.
 */
export function main(argv = process.argv.slice(2), env = process.env) {
  const flagIndex = argv.indexOf('--report');
  const reportPath = flagIndex === -1 ? DEFAULT_REPORT_PATH : argv[flagIndex + 1];
  const resolved = path.resolve(reportPath);
  const report = readReport(resolved);
  const result = evaluateClosureBudget({ report, reportPath });
  const perChunk = evaluatePerChunkBudgets({ report, reportPath });
  const sensitivity = evaluateHeadroomSensitivity({ report, reportPath });
  // The fourth half asks about the CEILING rather than the payload, so its
  // inputs are source texts and not the report: this file as checked out,
  // and this file at two commits on the base branch. See
  // {@link evaluateCeilingFreshness}.
  const freshness = evaluateCeilingFreshness({
    eventName: env.GITHUB_EVENT_NAME,
    headSource: readSource(fileURLToPath(import.meta.url)),
    prBaseSource: readSource(env.EAGER_CLOSURE_PR_BASE_SOURCE),
    baseSource: readSource(env.EAGER_CLOSURE_BASE_SOURCE),
    prBaseSha: env.EAGER_CLOSURE_PR_BASE_SHA,
    baseSha: env.EAGER_CLOSURE_BASE_SHA,
    baseRef: env.EAGER_CLOSURE_BASE_REF,
  });

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
  // `not-applicable` is printed rather than skipped. A half that says nothing
  // is indistinguishable from a half that was switched off, and this file's
  // whole argument is that silence must never read as a pass.
  if (freshness.status === 'pass') {
    console.log(`✅ ${freshness.message}`);
  } else if (freshness.status === 'not-applicable') {
    console.log(`ℹ️  ${freshness.message}`);
  } else {
    console.error(`❌ ${freshness.message}`);
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
    // Empty on a run this half does not apply to, so the PR comment's half
    // table filters it out instead of rendering a blank verdict as a row.
    closure_freshness_status: freshness.status === 'not-applicable' ? '' : freshness.status,
    // `env`, not `process.env`: every other input this function reads comes from
    // the injected environment, and a default that reaches around it would make
    // the outputs untestable through the same seam as the verdicts.
  }, env.GITHUB_OUTPUT);

  // Distinct codes so the workflow can tell "over budget" (a real verdict about
  // the bundle) from "the gauge produced nothing" (a verdict about the gauge).
  // Collapsing them to 1 would let a broken report be reported as a size
  // regression, and a size regression reported as a broken report — each of
  // which teaches readers to ignore the other.
  //
  // `error` outranks `fail` across ALL FOUR halves for the same reason it does
  // within one: a report that cannot be trusted — or a ceiling that no longer
  // measures the thing it names, or that is no longer the ceiling in force —
  // makes its own size verdict meaningless, whichever half noticed first.
  // objectui#5490 established that ordering over two halves; objectui#5924
  // added the third and objectui#6245 the fourth, each under the same rule
  // rather than taking a code of its own. `not-applicable` is inert in the
  // fold: it is the absence of a question, not the answer `pass`.
  const statuses = [result.status, perChunk.status, sensitivity.status, freshness.status];
  if (statuses.includes('error')) return 2;
  return statuses.includes('fail') ? 1 : 0;
}

if (isEntrypoint(import.meta.url)) {
  process.exit(main());
}
