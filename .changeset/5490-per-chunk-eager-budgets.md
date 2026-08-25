---
---

Build tooling and CI only — `apps/console/vite.config.ts` (not published source:
`@object-ui/console`'s `files` list carries `dist`, `plugin.*` and `README.md`),
`scripts/check-eager-closure-budget.mjs` and its unit test. Nothing ships from
this change.

The console eager-closure budget weighed one total across 52 chunks. Inside its
headroom a single chunk can absorb the whole allowance while the others shrink,
and the total never moves — the shape of objectui#5266, whose 89 KiB landed
entirely in `vendor-objectstack`. Per-chunk gzipped ceilings now sit on top of
the aggregate for the three largest eager chunks, set at the measured current
state plus ~2%, with each headroom narrower than the regression the gate exists
to catch.

The ceilings key on the chunk names the report itself carries (`files[].name`,
new in report v2, taken from rolldown's own `chunk.name`) rather than on names
this checker expects to exist. A budgeted chunk that is absent — renamed group,
chunk gone — is therefore an error, not a skip: a ceiling with no subject weighs
nothing and would be green forever.
