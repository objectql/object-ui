---
"@object-ui/data-objectstack": patch
"@object-ui/app-shell": patch
"@object-ui/types": patch
"@object-ui/i18n": patch
---

fix(app-shell): redo the record-list "Add View" create flow — empty-name 405, invisible drafts, canonical naming

Rebuilds the record-list "Add View" / "Save as view" create path so a
runtime-created view has one canonical identity and is actually verifiable
before publish (supersedes #2754; fixes #2767).

- **Unified identity (P1).** New `viewEnvelope(objectName, spec, { name, label })`
  seam in `runtime-metadata-persistence.ts` emits the canonical ViewItem
  (`{ name: '<object>.<key>', object, viewKind: 'list', label, config }` with
  `config.data = { provider: 'object', object }`), mirroring the Studio
  `anchors.ts:createBuildBody`. The **qualified** name is passed as BOTH the
  `PUT /meta/view/:name` URL segment and `body.name`, so the `sys_metadata`
  row key, the ViewTabBar tab id, and the body identity all agree and the
  draft → read → publish loop resolves. `ObjectView` and `ObjectDataPage` both
  call the single helper — the duplicated envelope block is gone (P6).
- **Empty-name guards (405).** `MetadataClient.save()` and
  `createRuntimeMetadata()` throw a clear contextual error instead of emitting
  `PUT /meta/view/` (empty `:name`, server 405).
- **Draft visibility (P2/P3/P4).** `DataSource.listViews(objectName, { previewDrafts })`:
  in draft-preview mode the `ObjectStackAdapter` makes a **single**
  `MetadataClient.withPreviewDrafts(true).list('view')` request and uses the
  server's already-overlaid list (draft wins by name, `_draft` tagged) —
  replacing, not appending, so a draft that edits a published view can't
  double-tab. No hand-rolled `fetch` of metadata routes at the adapter layer.
  After a create in normal mode the console navigates to the new view with
  `?preview=draft`, so the DraftPreviewBar is visible and Publish is one click.
- **CJK-aware naming (P5).** `CreateViewDialog` gains an editable machine-name
  field, prefilled via `slugify(label)` for Latin labels and required (submit
  disabled) when slugify yields empty for non-Latin labels — no more silent
  random `task_grid_mrsyt56j` names. New `console.objectView.viewName*` keys
  (en/zh).
