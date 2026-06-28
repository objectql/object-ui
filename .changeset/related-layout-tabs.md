---
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
---

feat(detail): `relatedLayout: 'tabs'` — surface related tables as peer tabs via config

Record detail pages can now show each related table as its own top-level tab
instead of stacking them all inside a single **Related** tab — no custom page
required. Set `detail.relatedLayout: 'tabs'` on the object; the synthesized
record page then emits one tab per related list (label = the related list's
`title`, falling back to its `objectName`, carrying its `icon`), slotted between
the **Details** tab and **Activity** / **History**.

- `buildDefaultPageSchema` (`@object-ui/plugin-detail`): new
  `BuildPageOptions.relatedLayout?: 'stack' | 'tabs'` threaded through
  `buildDefaultTabs` (the single choke point for the related-tab emission).
  `'tabs'` fans the related children out into peer tabs; `'stack'` (default)
  keeps the legacy single **Related** tab — **zero regression** when omitted.
  Still honours `hideRelatedTab` (no related tabs emitted) in both modes.
- `RecordDetailView` (`@object-ui/app-shell`): reads
  `objectDef.detail.relatedLayout` per object and forwards it to the synth.
