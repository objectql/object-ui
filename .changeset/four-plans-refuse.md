---
'@object-ui/app-shell': patch
---

`RecordDetailView`'s `type: 'api'` action handler now refuses to dispatch a
record-scoped mutation when the record cannot supply the declared
`recordIdParam` key, instead of sending the request anyway with the
parameter silently dropped (objectstack#8018, objectui#4669).

The seeding read routes through the shared `resolveRecordIdParamSeed`
helper (`@object-ui/core`, already adopted by `useConsoleActionRuntime` in
objectui#4670) so both refusal wordings — an absent key vs. a `null`
value, which point at different repairs — are worded consistently across
call sites. This call site's extra fallback sources (a literal `recordId`
override, and the page-record fallback `record_header` actions rely on
when no row is stashed) are preserved; the refusal only fires once every
source has been tried and none can supply the key.

Behaviour change worth noting: an action that previously dispatched an
under-specified request now fails visibly instead. That is the point — the
old path could not report the failure it was causing.
