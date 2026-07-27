---
"@object-ui/app-shell": patch
---

fix(attachments): read the storage service's new error envelope so gated downloads keep their friendly copy (objectstack#3675)

`RecordAttachmentsPanel` mapped the server's fail-closed 40x codes
(`AUTH_REQUIRED`, `ATTACHMENT_DOWNLOAD_DENIED`) to human copy by reading
`code` off the top level of the error body. The storage service has moved that
code into the envelope its contract declares —
`{ success: false, error: { code, message } }` — so the top-level read now
returns `undefined`, and every gated download would have degraded from
"You don't have access to download this attachment." to the generic
"Download failed (403)".

The download handler now reads `body?.error?.code ?? body?.code`, mirroring how
the success branch two lines below already reads `body?.url ?? body?.data?.url`.
Both dialects on purpose: the console ships independently of the server it
talks to, so a current console must keep understanding an older one. A test
covers each shape, and the fix is mutation-checked — dropping the nested read
fails the two new-envelope cases.
