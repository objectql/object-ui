---
'@object-ui/app-shell': minor
---

feat(detail): generic record Attachments panel gated on `enable.files: true` (framework#2727)

New `RecordAttachmentsPanel` — Salesforce "Notes & Attachments" parity for
any object that opts in via `enable: { files: true }`:

- Upload via the canonical presigned three-step storage flow
  (`createObjectStackUploadAdapter`; blob → `sys_file`), then a
  `sys_attachment` join row targeting `(parent_object, parent_id)`.
- List (name/size/mime), stable download links
  (`/api/v1/storage/files/:fileId` 302-redirect endpoint), delete.
- Rendered by RecordDetailView in both the page-schema and legacy branches.
  Opt-in: objects without the flag see no panel, and the server
  independently rejects attachment rows targeting them
  (403 FILES_DISABLED).
