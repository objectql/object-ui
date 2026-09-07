---
'@object-ui/components': patch
---

`@object-ui/components` no longer declares `recharts`. The dependency became
unused when objectui#7397 deleted `src/ui/chart.tsx`, which was its only
consumer inside this package; `@object-ui/plugin-charts` declares its own
`recharts` and remains the single implementation (objectui#7625).

**No migration.** Nothing is added to or removed from the published surface, no
type changes, no behaviour changes. Since objectui#7397 this package publishes
no recharts-typed export at all, so there is no supported import that reaches
`recharts` through `@object-ui/components`.

**What actually changes** is the install graph: every consumer of
`@object-ui/components` was resolving and installing a charting library it could
not reach. AGENTS.md section 3 constrains this package — the Atoms layer — to
"Shadcn primitives, zero heavy 3rd-party deps", and heavy widget dependencies
belong in `@object-ui/plugin-*`; the declaration outlived the reason it existed.

- **Why `patch` and not `minor`.** This repo ships its own breaking changes as
  `minor` with the break spelled out (`scripts/check-changeset-no-major.mjs`),
  so the bump has to state which of the two this is. Nothing breaks for a
  supported consumer: the built output is byte-identical (this package's Vite
  `external` predicate is path-based and never reads `dependencies`, so no
  import graph, chunk or `.d.ts` moves), and the package exposes no recharts
  surface to import. The one consumer this can reach is someone importing
  `recharts` without declaring it and getting it hoisted out of this package's
  dependency by a FLAT `node_modules` layout (npm/yarn). That is a phantom
  dependency — undeclared, unsupported, and un-typed here since objectui#7397 —
  and it is named rather than omitted so the trade is on the record.
- **Not a bundle-size change.** `vendor-charts` stays eagerly reachable through
  the plugins, so `check:eager-closure` is unaffected in both directions. The
  cost this removes is install-graph weight, not shipped bytes.
