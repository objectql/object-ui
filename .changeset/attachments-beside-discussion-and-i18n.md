---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
"@object-ui/components": patch
"@object-ui/i18n": patch
---

fix(detail): record Attachments become their own tab (with count badge) and their copy is translated — objectstack#4358

Two defects on `enable.files: true` record detail pages:

1. **Buried placement.** `RecordDetailView` appended `RecordAttachmentsPanel`
   AFTER the schema-rendered page tree, whose synthesized default embeds
   `record:discussion` as the last main component — so the panel always
   landed below an ever-growing feed timeline, undiscoverable without
   scrolling to the very bottom, with no metadata knob to move it.

   `buildDefaultTabs` now emits a peer **Attachments** tab (a new
   `record:attachments` node rendered by an app-shell registration wrapping
   the existing panel via RecordContext) between Related and
   Activity/History. `PageTabsRenderer` derives the tab's count badge from a
   `sys_attachment` probe scoped to `(parent_object, parent_id)`, riding the
   same RelatedCountStore cache/invalidation bus as related-list badges — so
   uploads and deletes update the badge live. A `hideAttachments` synthesizer
   option suppresses the tab; RecordDetailView keeps its legacy bottom append
   only as the fallback for authored pages without the node
   (`hasExplicitAttachments`).

2. **Untranslated copy.** The panel's eleven `detail.*` keys (`attachments`,
   `uploadAttachment`, `loadingAttachments`, `noAttachments`,
   `downloadAttachment`, `deleteAttachment`, and the five
   `attachment*Denied/Required` friendly errors) existed only as inline
   English `defaultValue`s — no locale bundle carried them, so non-English
   consoles always showed English. All ten locales now define them; the tab
   label rides the existing well-known-label dictionary (→ 附件 etc.).
