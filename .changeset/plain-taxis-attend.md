---
'@object-ui/console': patch
---

Approvals drawer: the business summary card no longer renders a field the object
declares `hidden: true`.

`payloadSummary` built the card from the request's `payload_json` snapshot behind
five filters (system keys, the lead amount key, null/object/empty values,
unresolved opaque ids, a six-field cut) and no field-visibility filter, so a
hidden field that survived to the first six survivors rendered in the card,
labelled. The drawer now reads the open request's object metadata and drops the
declared-hidden keys before the six-field cut, so the next business field is
promoted into the freed slot rather than the card silently shrinking. The lead
amount figure at the top of the same card takes the same trim.

Per the platform ruling, `hidden: true` is a UI-only contract and `internal: true`
is the serialization primitive, so this is the UI enforcing the only contract
`hidden` has — not a client-side compensation. Field-level security is unchanged
and remains the server's answer. The metadata read is the same cached
`GET /meta/object/:name` the record form already performs, once per object per
page visit, and an unanswered read leaves the card exactly as it renders today.
