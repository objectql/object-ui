---
"@object-ui/fields": patch
"@object-ui/i18n": patch
"@object-ui/console": patch
---

fix(i18n): localize FileField upload widget + approvals snapshot field labels

- `FileField` (the shared upload widget) hard-coded every visible string
  ("Drag & drop files here", "or click to browse", "Take photo", "Uploading…",
  size/upload validation messages, …). They now route through
  `useObjectTranslation` with new `fields.file.*` keys, translated across all
  10 locale bundles. This is why the approvals Approve/Reject dialog's
  attachment dropzone was English in a Chinese console.
- The approvals inbox record-snapshot summary title-cased raw machine keys
  instead of the target object's field labels. It now consumes the
  server-sent `payload_labels` in `payloadSummary`/`decisionAmountEntry`,
  falling back to the prettified key when absent; `approvalsApi`'s row type
  gains `payload_labels`.
