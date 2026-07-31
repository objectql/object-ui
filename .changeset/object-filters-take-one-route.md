---
"@object-ui/core": patch
"@object-ui/data-objectstack": patch
---

fix(data-objectstack,core): an object filter no longer depends on whether the query expands a lookup

#3072 single-sourced the ARRAY branch of the adapter's two `find()` routes. The
object branch was left as it was: `convertQueryParams` converted a MongoDB-style
filter to AST while `translateFilterToAST` returned it verbatim — so the same
`$filter` went out in two formats, decided by whether the query happened to
expand a lookup.

Measured across 21 operator shapes, **four diverged**. Most of the gap turned
out to be harmless — `{$and: […]}` survives the plain route as a
`['$and','=',[…]]` comparison that `parseFilterAST` reads back as a real `$and`,
and `$exists` vs `$null` is a difference the server treats identically. Two were
not harmless:

- **The unknown-operator guard only ran on one route.** `convertFiltersToAST`
  throws on an unrecognised operator, with a comment saying it does so "to avoid
  silent failure" — but the expanded route never called it, so a typo'd operator
  threw on a plain read and shipped silently whenever a lookup was expanded.
- **`$regex` was silently rewritten to `contains`.** `$regex: 'a.c'` matches
  "abc"; `contains 'a.c'` matches only those three literal characters. That is a
  *different question*, not a weaker version of the same one, and neither result
  looks wrong on screen. The rewrite sat behind a `console.warn`, which is not
  an error channel in a deployed app — and the function's own unknown-operator
  message never listed `$regex` among the supported set. The spec has no
  `$regex` (`FILTER_OPERATORS`, `data/filter.zod.ts`), so there is nothing to
  translate it into: it is now refused, the same treatment the neighbouring
  unknown operator already got. Nothing in the repo depended on the conversion.

Both refusals now throw `FilterOperatorError`, carrying `code: 'INVALID_FILTER'`
/ `httpStatus: 400`. The pre-existing unknown-operator throw was a bare `Error`,
which `classifyLoadError` classifies as a network fault — so a malformed filter
told the user to check their connection (#3066), the one thing it definitely
was not.
