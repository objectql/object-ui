---
"@object-ui/plugin-detail": minor
"@object-ui/types": patch
---

Related lists paginate by default and fetch server-side windows (#2711).

`record:related_list` now applies the spec default `limit` of 5 when a node
doesn't declare one, so detail-page related lists render pages with
Previous/Next controls instead of dumping every child row. On the auto-fetch
path RelatedList requests one page at a time (`$top`/`$skip`), reads the
collection size from `QueryResult.total` (`hasMore` fallback), sends user
column sorts as a server `$orderby`, and seeds the initial order from the
node's `sort` prop (new `defaultSort` prop on RelatedList). Caller-provided
`data` keeps the historical client-side slicing. Behavior change: lists that
previously rendered all rows now show 5 per page — declare a larger `limit`
on the `record:related_list` node to widen the window.
