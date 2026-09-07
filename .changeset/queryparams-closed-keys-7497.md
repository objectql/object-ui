---
'@object-ui/types': minor
---

`QueryParams` (`@object-ui/types`) no longer carries the `[key: string]: any`
index signature; its key set is now exactly the nine declared `$`-prefixed
members — `$select`, `$filter`, `$orderby`, `$skip`, `$top`, `$expand`,
`$search`, `$searchFields`, `$count` (objectui#7497).

**What stops type-checking that type-checked before.** Any object literal
assigned or passed as a `QueryParams` that carries a key outside those nine —
the unprefixed spellings the readers silently dropped (`{ filter }` for
`$filter`, `{ limit }` for `$top`, `{ options: { $top } }`), and any
`$`-prefixed name that is not declared (`{ $limit }`). Reading an undeclared
key off a `QueryParams` value (`params.filter`) is refused too. A published
guide had taught `adapter.find('contacts', { filter: { active: true } })` and
asserted the client saw that `filter`: it compiled, `convertQueryParams`
dropped the key, and the assertion could never pass. That literal is now a
compile error at the call site.

**What does not change.** Every reader in this repository —
`convertQueryParams` and `rawFindWithPopulate` in `@object-ui/data-objectstack`,
`queryParamsToRecord` in `@object-ui/core`, `ValueDataSource.find` — reads only
declared members, so nothing the runtime honoured is refused. A
`Record<string, unknown>` or `Record<string, any>` VALUE (the shape
`@objectstack/spec`'s `ViewData.params` parses to) still passes, as does a
spread of one beside `$top` / `$skip`; a type assertion (`{ limit: 1 } as
QueryParams`) still compiles because assertions skip excess-property checks,
which is why `object-ui/no-unprefixed-query-params` keeps its typed cases.

**Why `minor` and not `patch` or `major`.** Narrowing the accepted set of a
published contract is a breaking change for any downstream caller that relied
on the extra keys. The census behind the grade: across this repository's
packages, apps, examples, e2e and scripts trees (4,362 files), zero `find` /
`findOne` call sites or `QueryParams` literals carry a non-`$` key, and no
adapter reads one — the signature carried nothing but typos. This repository
records its own breaking changes as `minor` with the break spelled out; `major`
is reserved for following `@objectstack` across a major (see AGENTS.md, version
alignment). A `patch` would be wrong: this is a deliberate narrowing, not a
fix inside the accepted set.

Migration for a downstream caller that did pass an extra key: if an adapter of
yours reads it, declare it on your own params type and widen at your adapter's
boundary; if nothing reads it, it was already being dropped — delete it.
