---
---

CI and build tooling only — this publishes nothing, declared explicitly with an empty
frontmatter rather than left undeclared. No package `src/` is touched.

The console "performance budget" now weighs the **eager closure** instead of one chunk.

`.github/workflows/performance-budget.yml` gzipped `apps/console/dist/assets/index-*.js`
and compared it against a 350 KB line. Measured on `77f846a8b`, that chunk is 25,910 bytes
gzipped, while the closure it statically pulls in — every chunk the browser must fetch and
parse before the app renders — is 3,881,609 bytes across 58 of 507 chunks. The gate passed
on 0.67% of the payload it claimed to govern, and `advancedChunks` routes vendor and
workspace code into named chunks on purpose, so most regressions land outside the entry
chunk. objectui#5266 is the worked example: 89 KiB gzipped added to every page load, landing
in `vendor-objectstack-*.js`, structurally invisible here (objectui#5324).

`emitEagerClosureReport` in `apps/console/vite.config.ts` walks rolldown's own
`chunk.imports` from the entry chunks — static edges only, because the dynamic edge is the
lazy boundary — gzips the bytes actually written to disk, and writes
`dist/eager-closure.json`. `scripts/check-eager-closure-budget.mjs` applies the ceiling.
The split is deliberate: a size ceiling enforced inside `vite build` would fail every
Vercel preview and every local build, which is how a budget gets switched off rather than
fixed. Exit codes are distinct — `1` over budget (a verdict about the bundle), `2` no
trustworthy measurement (a verdict about the gauge) — so a broken gauge is never reported
as a clean bundle, and vice versa.

Every check in that path is a counter-probe, because this gate's failure mode is silent: a
walk that finds too little, a stale report, an absent field read as zero all produce a
SMALL number, and a budget reads a small number as good news. So the build refuses to
publish a figure unless `react-dom` is inside the closure and at least one chunk is outside
it, and the checker refuses a report whose totals disagree with its own chunk list, whose
version it does not recognise, or that has collapsed to its entry chunk — that last one
being precisely the gauge this replaces.

The ceiling is 3,960,000 gzipped bytes: today's measurement plus 78,391 bytes of headroom.
It passes on current `main`, and the headroom is deliberately narrower than the 89 KiB
regression the gate exists to catch, so a repeat of objectui#5266 fails it (verified: the
baseline plus 89 KiB comes out 12.4 KB over). Both constraints are asserted in
`scripts/__tests__/check-eager-closure-budget.test.ts`, not merely argued in a comment.

This is a truthful current-state ceiling, not a target. 3.79 MB gzipped before first render
is a bad payload and the honest long-term line is far below it; lowering it is a separate
decision with its own work behind it. The entry-chunk budget and its 350 KB line are
unchanged — replacing a blind gauge is not licence to drop the check that was already there.
