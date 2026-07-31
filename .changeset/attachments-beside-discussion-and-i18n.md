---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
"@object-ui/i18n": patch
---

fix(detail): the record Attachments panel renders beside the discussion feed and its copy is translated — objectstack#4358

Two defects on `enable.files: true` record detail pages:

1. **Buried placement.** `RecordAttachmentsPanel` was appended by
   `RecordDetailView` AFTER the schema-rendered page tree, whose synthesized
   default embeds `record:discussion` as the last main component — so the
   panel always landed below an ever-growing feed timeline, undiscoverable
   without scrolling to the very bottom, with no metadata knob to move it.

   `buildDefaultPageSchema` now emits a footer grid row placing a new
   `record:attachments` node to the LEFT of the discussion feed (1/3–2/3 on
   `lg+`, stacked attachments-first below). The node is rendered by a new
   app-shell registration wrapping the existing panel via RecordContext; a
   new `attachments` slot and `hideAttachments` option cover slotted pages,
   and RecordDetailView keeps its bottom append only as a fallback for
   authored pages that omit the node (detected via `hasExplicitAttachments`).

2. **Untranslated copy.** The panel's eleven `detail.*` keys (`attachments`,
   `uploadAttachment`, `loadingAttachments`, `noAttachments`,
   `downloadAttachment`, `deleteAttachment`, and the five
   `attachment*Denied/Required` friendly errors) existed only as inline
   English `defaultValue`s — no locale bundle carried them, so non-English
   consoles always showed English. All ten locales now define them.
