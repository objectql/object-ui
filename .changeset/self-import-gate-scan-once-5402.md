---
---

CI tooling only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared.

`scripts/check-package-self-import.mjs` now separates the SCAN from the JUDGEMENT:
`scanRepository(root)` performs the expensive TypeScript parse once, and `judgeScan(scan,
exemptions)` is a pure filter over its result. `analyze()` keeps its signature and its
behaviour exactly (differentially verified against the previous implementation over both a
fixture tree and this repository, across all six exemption-table shapes), and the CLI's
output is byte-identical.

The reason is `scripts/__tests__/check-package-self-import.test.ts`, which asserts this
repository is green under the repository's own exemption table AND under no exemptions at
all. Those were two calls to `analyze(repoRoot)` — the same full parse of ~3,100 files and
~30 MB of source performed twice — and one of them sat inside a 15-second `it()`. That
fits uninstrumented (measured 8.8 s) and does not fit under v8 coverage (measured 41.3 s),
so `ci.yml`'s `Test (coverage)` job failed 100% of the time from 2026-08-16 — 51 completed
jobs, 0 successes, 50 of them this one file, every one `Test timed out in 15000ms` — and
Codecov received nothing for four days (objectui#5402).

It is a constant factor, not a race. `@vitest/coverage-v8` arms
`Profiler.startPreciseCoverage({ callCount, detailed })` in the worker BEFORE test modules
and their dependencies compile; V8 emits those block counters at compile time and does so
isolate-wide, so `node_modules/typescript` is instrumented too — `coverage.exclude` filters
the report, never the instrumentation. Measured here, the identical parse costs 4.1-4.9 s
uninstrumented and 32-35 s when coverage was armed first, and starting coverage AFTER the
same code is compiled costs nothing at all.

The test file now scans once at module scope and judges it per assertion: the timeout-prone
test drops from 41,268 ms to 1 ms under coverage, and the file's total work halves. No
timeout was raised, nothing is skipped, and coverage is not disabled for anything.

No package `src/` is touched, so no `@object-ui/*` package changes behaviour and there is
nothing here for a consumer to upgrade to.
