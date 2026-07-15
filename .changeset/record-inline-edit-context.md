---
"@object-ui/react": minor
"@object-ui/plugin-detail": minor
---

feat(detail): record-level inline edit — shared `InlineEditContext` + one atomic Save (objectui#2407 P1)

Lift the inline-edit session out of `DetailView`'s private state into a
record-level, shared context so a record page's surfaces can share ONE draft and
commit it in ONE atomic, cross-field-validated write (replacing the per-field
save loop).

- **`InlineEditContext` / `InlineEditProvider` / `useInlineEdit`** (@object-ui/react)
  — pure UI state (`editing`, `canEdit`, `draft`, `autoFocusField`, `saving`,
  `error` + `enter` / `setField` / `cancel` / `reset`). A *separate* context from
  `RecordContext` (mirrors `HighlightFieldsContext`) so per-keystroke draft churn
  doesn't re-render other `record:*` consumers.
- **`<InlineEditSaveBar>`** (@object-ui/plugin-detail) — the record-level sticky
  Save/Cancel bar. Commits the whole draft in ONE
  `dataSource.update(obj, id, draft, { ifMatch: data.updated_at })` → `refresh()`;
  a `409 CONCURRENT_UPDATE` reuses `<ConcurrentUpdateDialog>` (reload / overwrite).
  A callback mode (`onFieldSave`) preserves the drawer's per-field persistence
  contract with plugin-gantt/calendar/kanban.
- **`DetailView`** now consumes `useInlineEdit()` instead of owning inline-edit
  state; its header/inline Save-Cancel bars and per-field batch-save are removed
  (the approval-lock badge stays). Rendered without a provider it is simply
  read-only.
- **`record:details`** and **`RecordDetailDrawer`** each wrap their `DetailView`
  in an `<InlineEditProvider>` + `<InlineEditSaveBar>`. The object-lifecycle /
  permission gate flows through `canEdit`; computed / readonly / system fields
  and the OCC path are unchanged.

Guardrails preserved: computed (`formula`/`summary`/`rollup`/`auto_number`) +
`readonly` + system fields expose no editor; `canEdit` gate; OCC (`ifMatch` +
`ConcurrentUpdateDialog`); the atomic partial update carries only user-edited
keys (never computed/read-only). Editable highlights ride on top of this in P2.
