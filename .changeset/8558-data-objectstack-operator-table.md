---
---

Re-derive `packages/data-objectstack/README.md`'s filter-operator table against
`@object-ui/core`'s `convertFiltersToAST` and pin it there (objectui#8558).
`$nin` / `$notin` lower to `nin`, not `notin`, and the worked example now shows
the node the server accepts; `$regex` is refused, not lowered to `contains`;
`$startsWith` is the spec spelling and is listed beside its lowercase alias;
`$notContains`, `$endsWith`, `$null` and `$exists` — the four operators the
code's own "Supported operators" message enumerates that had no row — gain rows,
as do the `$and` / `$or` combinators and the `$not` refusal. A test reconciles
every row against the code on every run. Documentation and a test only; no
package is released by this change.
