---
---

Tooling-only change; no published behaviour changes. The docs route's eager closure now has
an instrument. `check:eager-closure` reads `apps/console/dist/eager-closure.json` and weighs
the console, so the budget objectui#4616 set over `/docs/[[...slug]]` — the route every one
of the docs pages shares, and the one `apps/site/app/components/registerCatalogBlocks.ts`
adds side-effect imports to — was governed by nothing, and its only measurement was
reconstructed by hand, once. `pnpm check:docs-route-closure` weighs it structurally instead
of in bytes (objectui#6316, triage ruling shape 2, so no docs-site build in CI): every
package the registrar names must be already reachable from that route's static module graph
— a declaration and no payload, which the gate proves for `@object-ui/plugin-form` and
`@object-ui/plugin-grid` through `@object-ui/plugin-view` — or recorded in the script's
`MEASURED_PAYLOAD` with what it is for. Anything else is a genuinely new graph, and it fails
so that a human argues for it in review.
