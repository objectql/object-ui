---
'@object-ui/app-shell': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/console': patch
---

Fix four `find()` calls that passed a query option without its `$`, and gate the shape.

`QueryParams` declares every query option `$`-prefixed and `convertQueryParams` copies
exactly those keys, so an unprefixed spelling reaches no branch and is dropped — no throw,
no warning, and it type-checks because the type carries `[key: string]: any` for
adapter-specific params. For a dropped cap the result is an **unbounded** read rather than
a truncated one: the platform's GET list route has no default page size, so the query
returns the whole match set and stays invisible until the object is large.

- `app-shell` `ObjectView` fetched the footer's record count with `{ limit: 0 }`. This one
  **inverted** rather than widened — `$top: 0` is honoured end to end as "no records", so
  the dropped key turned "count only, fetch nothing" into "fetch every row in the object",
  on every mount and every refresh of every list view. It now sends `$top: 0` and reads
  the count off `total` only; the row-counting fallbacks are gone rather than repointed,
  because once zero rows are requested an empty `data` means "you asked for none", not
  "the object is empty", and counting it would assert a confident `0`. With no total the
  footer line is omitted instead.
- `app-shell` `AssignedUsersSection` looked a permission set up with `{ …, limit: 1 }`,
  one line from three correct `$top` calls.
- `plugin-dashboard` `DashboardFilterBar` passed `fields` **and** `top` in one literal, so
  a filter's option list read every row and every column of its source object while its
  own comment described it as capped at 200. The same call read `records.items`, which is
  not a `QueryResult` member, so against a real adapter the fallback produced no options
  at all.
- `console` `sdui-workbench-preview` passed `{ top: 200 }` and read `.records` off the
  result in its page-source metadata.

A new `object-ui/no-unprefixed-query-params` ESLint rule rejects the shape at write time:
a known query-option name missing its `$` in the second argument of a `find`/`findOne`
call. It is narrow on purpose — a closed list of spellings, anchored to the call — because
the index signature exists so adapters can take adapter-specific params, and a rule that
flagged any unprefixed key would report the shape the type was written to allow. Its
sibling `no-query-params-under-options` (the `{ options: { $top } }` half) is unchanged.
