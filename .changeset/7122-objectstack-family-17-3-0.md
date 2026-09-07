---
'@object-ui/data-objectstack': patch
---

Reconcile `@object-ui/data-objectstack` with the `@objectstack/*` family at
17.3.0 (objectui#7122).

`@objectstack/client`, `core`, `formula` and `lint` each pin `@objectstack/spec`
EXACTLY, so resolving the spec alone to 17.3.0 left the console bundling TWO
copies of it. Moving the family with it in `pnpm-lock.yaml` collapses the
duplicate; every declared range already admitted 17.3.0, so no manifest moved.

The one source change the family bump forces is a type reconciliation, not a
behaviour change. `client.analytics.query` resolved to `Promise<any>` at 17.2.0
and resolves to `Promise<AnalyticsResult>` at 17.3.0, so the pre-envelope
branches of `aggregate`'s row-shape fallback stopped type-checking. Those
branches are read through a widened alias rather than deleted: the client's own
docblock records the runtime change behind the narrower type ("BREAKING since
objectstack#13079 — read `result.rows`, not `result.data.rows`"), and deleting
them is a runtime compatibility decision about servers older than that, not a
type repair. The alias restores exactly the compile-time latitude 17.2.0 gave
the same expression and changes no runtime byte of it.
