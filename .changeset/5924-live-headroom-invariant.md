---
---

Build tooling and CI only — `scripts/check-eager-closure-budget.mjs`, its unit
test, and a comment in `.github/workflows/performance-budget.yml`. Nothing ships
from this change.

The console eager-closure gate stated a binding constraint on its own
sensitivity — the headroom above the measured payload must stay SMALLER than the
89 KiB regression the gate exists to catch — and then checked it between two
constants frozen in the same module. That assertion is an arithmetic fact about
the file, true regardless of what the console weighs. The closure shrank 706,013
gzipped bytes below the pinned baseline without the ceiling following it down,
the live headroom reached 8.6x the regression size, and the check that was
supposed to notice stayed green throughout: a demonstrated +158,006-byte eager
regression, 1.7x the incident this gate was built for, passed with a green tick.

`evaluateHeadroomSensitivity` now derives that headroom from the report the gate
just read, for the aggregate ceiling and for each of the three per-chunk
ceilings, and treats a ceiling that has drifted more than one regression above
its own measurement as an ERROR (exit 2) rather than a size failure — it is a
verdict about the gauge, the same asymmetry a budgeted chunk absent from the
report already carried. The constant-vs-constant assertions stay as a secondary
guard.

The aggregate ceiling is re-baselined downward as the decision this records:
`MAX_EAGER_CLOSURE_GZIP_BYTES` 4,086,000 to 3,345,000 over a `BASELINE` moving
4,005,911 (`4c1623c0c`) to 3,299,898 (`48e53814e`). Headroom goes from 8.63x the
regression size to 0.49x. Lowering a ceiling toward reality is a tightening: no
build that passed before and measures under the new line fails after it. The
floor is unchanged — a ceiling is never put below a measured figure.
