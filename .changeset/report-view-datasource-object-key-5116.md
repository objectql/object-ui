---
'@object-ui/app-shell': minor
---

`ReportView` reads a report's data binding through the one key the contract declares — `dataSource.object`.

The view accepted `resource` as a second spelling of `object`, in two places, and
named that spelling in a warning the user could read:

```
:171  liveReport?.objectName || liveReport?.dataSource?.object
                             || liveReport?.dataSource?.resource
:273  dataFetchSource.dataSource.object || dataFetchSource.dataSource.resource
:275  console.warn('ReportView: dataSource missing object/resource property')
```

`resource` is not on this binding. `ElementDataSourceConfig` declares `object`,
`view?`, `filter?`, `sort?` and `limit?`; its `@objectstack/spec` twin
`ElementDataSourceSchema` is a strict object, so an extra `resource` key is
*rejected* there rather than ignored; and the binding's own predicate
`isElementDataSourceConfig` decides on `object`. A `resource`-only binding
therefore was never a binding on any other renderer in the system — it rendered
here and silently produced nothing anywhere else, with neither end reporting a
problem. That divergence is what a consumer-side alias buys: one renderer
answering a question the contract says has no answer.

`resource` is a real key on other surfaces — `CRUDSchema.resource`, the
`DataSource` adapter's first parameter, `LiveExportOptions.resource` — and all
three are untouched. None of them is this one.

Behaviour, measured by rendering each input shape before and after. Only the
`resource`-only shape moves:

| binding | before | after |
| --- | --- | --- |
| `object` only | queries that object | unchanged |
| `resource` only | queries it as if declared | not queried; named warning, no rows, fallback field list |
| both | queries `object` | unchanged |
| neither | not queried; warning | unchanged |

So off-spec report metadata that used to render now fails loudly instead of
appearing to work. A producer census found nothing that would notice: no site in
this repository, and none in the `objectstack` framework repository, writes
`resource` onto a report `dataSource`. The limb was speculative in the commit
that introduced it, and per AGENTS.md #0.1 an off-spec spelling is corrected at
the producer, never taught a second dialect by the renderer.

The `:275` wording now names only `object`. A diagnostic that lists a key the
contract does not declare is not a small thing: it is the system telling an
author — increasingly, an author's code generator — that the wrong spelling is
supported.
