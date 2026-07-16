---
"@object-ui/app-shell": patch
---

fix(attachments): download attachments via authenticated signed URL (framework #2970)

The framework now requires an authenticated session to download an
attachments-scope file (the stable `/storage/files/:fileId` endpoint returns
`401`/`403` for them). `RecordAttachmentsPanel`'s download control no longer
uses a bare `<a href>` (which cannot carry the console's Bearer token) — it
fetches a short-lived signed URL from `/storage/files/:fileId/url` with
`createAuthenticatedFetch`, then opens it. `403 ATTACHMENT_DOWNLOAD_DENIED` and
`401 AUTH_REQUIRED` map to friendly copy instead of a broken link.
