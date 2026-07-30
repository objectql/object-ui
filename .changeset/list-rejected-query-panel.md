---
"@object-ui/plugin-list": minor
"@object-ui/i18n": minor
---

fix(list,i18n): a 400 from the server no longer reads as "check your connection"

`classifyLoadError` was written because a 403 rendered the same
"check your connection and try again" panel as a genuine outage — its own doc
comment says users "were told to debug their network when the server had
(correctly) denied them access." It made that distinction for 401 and 403 and
then sent **everything else**, including 4xx, to the network branch.

A **400** is the server saying it understood the request and will never accept
it. Retrying resends the identical bad request, so "check your connection and
try again" is advice that cannot work — the same mistake the function exists to
prevent, one status code over.

This became reachable from ordinary stored metadata with
objectstack-ai/objectstack#4121: a `$filter` array that is not a filter AST is
now rejected at the protocol with `400 INVALID_FILTER`, where it previously
reached a driver (and, for a lone `['and']`, silently returned every row). A
view saved with such a filter now answers 400 on every load.

Adds a fourth classification, `rejected`, for `status === 400` and for the
server's 400-class codes (`INVALID_FILTER`, `UNSUPPORTED_QUERY_PARAM`,
`INVALID_QUERY`). Its copy points at the filter rather than the network, and
says who can fix it when the view is saved that way. 403/401 keep priority, so a
permission denial can never read as a bad request — pinned by a test.

The two new strings are added to **all ten locale packs**, not just `en`: the
neighbouring panels are translated, and `fallbackLng: 'en'` would have rendered
this one in English beside them. The full-parity gate
(`all-locales-key-parity.test.ts`) caught the pack I missed.

Verified: 5 new tests — numeric status, error code without a status, a status
embedded in the message text, and the 403/401 ordering guard. Reverting the
branch fails four of them. `plugin-list` + `i18n`: **403 tests across 29 files**,
green.
