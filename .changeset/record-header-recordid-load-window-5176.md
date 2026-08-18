---
'@object-ui/app-shell': patch
---

Fix `record_header` actions dispatching without their record id while the record page is still loading.

The record header does not wait for the page record: the skeleton's `isLoading`
flag is cleared in a route-keyed microtask, but `pageRecord` only lands one
`findOne` round-trip later, so the real header renders with every
`record_header` action live for that whole window. An `api` action clicked
inside it had no seed for its `recordIdParam` — the fallback chain stopped at
`pageRecord` and never consulted the record id carried in the URL — so the
request was dispatched naming no record and the backend rejected it with
`missing_record_id`. Users saw a button that "did nothing until you clicked it
again".

The id the page is addressed by now seeds the parameter as a last resort, which
is the same fallback this view's other dispatch paths already use. A stashed row
and an explicit `recordId` override still take precedence, actions retargeting
another object are still never handed this page's id, and an action keyed on a
non-default `recordIdField` now takes a named refusal instead of emitting an
under-specified request.
