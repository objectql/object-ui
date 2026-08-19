---
'@object-ui/app-shell': patch
---

A metadata-admin option catalog now carries its own load state, so a picker cannot render a failed catalog as an empty one.

`WidgetContext` spelled each option catalog (`objectNames`, `objectFields`,
`objectViews`, `objectActions`) as a plain array, with the fault travelling
alongside on a separate `catalogErrors` record and a `*Loading` flag beside
that. A FAILED load therefore arrived at the pickers as `[]` — byte-identical
to a load that completed and found nothing — and the rule that a picker must
consult the failure channel first lived in `CatalogErrors`' own doc comment. One
line was enough to ignore it:

```ts
const fields = context?.objectFields ?? [];
```

That is type-correct, reads naturally, and renders a refusal, a dropped
connection or an expired session as the metadata graph's own answer of "this
object has no fields" — the defect objectui#5170 and objectui#5169 were filed
for, reintroduced at the boundary their fix stopped at.

Each catalog is now the four-arm `LoadState` (`idle | loading | loaded | error`)
the loaders already produce, handed over intact instead of projected back down
into a pair. The naive read stops compiling, and reading the list at all goes
through an accessor whose parameter type excludes the failure arm — so a call
site that has not decided what a failure looks like does not compile, at exactly
the sites that must decide. Nothing widens: the set of authored metadata this
renderer accepts does not move.

One real fault is fixed on the way, and it is why the tightening was worth more
than the churn: the View variant inspector is a second host of `WidgetContext`,
and it forwarded only the `fields` third of what its loader knows. A failed field
catalog reached its `field-ref` / `field-multi` pickers as an empty list and the
picker said "No object bound" about an object that is bound and whose catalog
simply could not be fetched. It now renders the same shared failure block the
other pickers use, with the server's own message.

Behaviour is otherwise unchanged: the loading arms, the empty-state copy for a
load that genuinely found nothing, and every already-stored value staying
visible and editable on a failure all render exactly as before.
