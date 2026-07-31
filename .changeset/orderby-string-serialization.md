---
"@object-ui/data-objectstack": patch
---

fix(data-objectstack): a string `$orderby` reaches the server as a sort instead of a list of character indices — #3106

`QueryParams['$orderby']` declares four shapes — `string`, `string[]`,
`SortNode[]`, `Record<field, direction>`. Both of this adapter's `find()` routes
(`convertQueryParams` for a plain read, `rawFindWithPopulate` for one carrying
`$expand`/`$search`) carried their own copy of the fold that serializes it, and
both copies handled the same three. The bare string fell through to the
`Record` branch, where `Object.entries('name asc')` enumerates the string's
character indices — so the request went out as `sort=0,1,2,3,4,5,6,7`.

Since `objectstack#4226` the server refuses a sort it cannot read
(`400 INVALID_SORT`) rather than dropping it silently, so this was not a
degraded ordering but a list that failed to load outright — and `"${field}
${order}"` is exactly the shape `ObjectGrid` builds from its view metadata's
`sort`, making every standalone grid with a configured sort a broken one.

Both routes now share one exported `serializeOrderBy`, for the same reason the
filter path already shares one: two copies of a fold can only agree by
inspection, and these two did not.
