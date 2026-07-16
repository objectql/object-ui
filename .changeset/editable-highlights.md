---
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
---

feat(detail): editable record highlights on the shared inline-edit draft (objectui#2407 P2)

The highlights strip is now editable in place and shares ONE draft + ONE atomic
Save with the details body (building on the P1 `InlineEditContext` / `#2529`
`InlineFieldInput`).

- **`HeaderHighlight`** consumes `useInlineEdit()`: hovering a highlight shows a
  pencil and double-click enters the shared record edit session; each editable
  highlight renders the same `<InlineFieldInput>` the body uses (value =
  `draft[name] ?? data[name]`, write via `setField`). Computed
  (`formula`/`summary`/`rollup`/`auto_number`), `readonly`, and system fields
  expose no editor. Empty highlights are kept while editing so they can be
  filled. Compact-layout UX: an actively-edited column widens and renders the
  editor full-width (Salesforce-style expand-on-edit).
- **`RecordDetailView`** (app-shell) hosts ONE `<InlineEditProvider>` (with the
  object-lifecycle `canEdit` gate) spanning both `record:highlights` and
  `record:details`, plus the single record-level `<InlineEditSaveBar>` — so a
  highlight edit and a body edit commit together in ONE
  `update(obj, id, draft, { ifMatch })`.
- **`record:details`** drops its P1-local provider/save bar (it would otherwise
  split the draft from the highlights) and just consumes the shared context;
  **`record:highlights`** threads the DataSource through for lookup/user editors.

Guardrails preserved: computed/readonly/system highlights non-editable; `canEdit`
gate; OCC (`ifMatch` + `ConcurrentUpdateDialog`); only user-edited keys are sent.
