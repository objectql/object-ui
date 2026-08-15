---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
'@object-ui/plugin-list': patch
'@object-ui/react': patch
---

RecordAttachmentsPanel no longer offers a Retry for an api-disabled `sys_attachment` read.

`OBJECT_API_DISABLED` (404, `enable.apiEnabled: false`) and its sibling
`OBJECT_API_METHOD_NOT_ALLOWED` (405, the operation is absent from
`enable.apiMethods`) are pure functions of the object's metadata — no user, no
session, no request body — so every retry of every persona re-fetches the
identical refusal. Before this change both landed in `RecordAttachmentsPanel`'s
`unavailable` state and offered a Retry that was guaranteed to change nothing,
the same wrong advice `ListView`'s error panel already stops giving for list
reads.

The panel gains a fifth status, `api-unavailable`: no Retry button, and honest
copy ("The attachments list is not available on this object.", new
`detail.attachmentsApiUnavailable` key in all ten locale packs) instead of
"We couldn't load the attachments for this record." The pre-existing `denied`
(authorization) and `unavailable` (network/5xx/expired-session) states and
their affordances are unchanged.

`ListView.classifyLoadError` — the classifier that already separated this case
into its own `api-disabled` kind for list views — is lifted out of
`packages/plugin-list/src/ListView.tsx`'s module scope into
`@object-ui/react` (`classifyLoadError`, `LoadErrorKind`), so both surfaces
consume one classification instead of `RecordAttachmentsPanel` re-deriving it.
`ListView`'s own behavior is unchanged — it now imports the function it
previously defined locally. The classifier delegates its api-disabled check to
`isApiAccessDeniedError` (`@object-ui/data-objectstack`), removing a second,
independently-maintained copy of the same code list.
