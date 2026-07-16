---
"@object-ui/app-shell": patch
---

fix(attachments): authenticated uploads + friendly denial copy in RecordAttachmentsPanel (framework #2755)

The framework now gates the storage upload routes on an authenticated session
and enforces parent-derived attachment access. The panel's upload adapter
accordingly authenticates with the console's Bearer token
(`createAuthenticatedFetch` — the token console has no session cookie for
`credentials: 'include'` to carry), and the new fail-closed 403 codes
(`ATTACHMENT_DELETE_DENIED`, `ATTACHMENT_PARENT_ACCESS`, `PERMISSION_DENIED`)
map to friendly copy instead of raw server errors. The delete button still
renders for every row by design — the server is the gate, and the client
lacks the parent-edit data to pre-compute it. `uploaded_by` is still sent for
back-compat with older servers; current servers stamp it from the session.
