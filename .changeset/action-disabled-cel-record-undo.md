---
"@object-ui/components": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-detail": minor
"@object-ui/app-shell": minor
---

feat: evaluate CEL `disabled` on action buttons + record-page Undo wiring

- **components (page header)**: the `record_header` action toolbar now evaluates
  a CEL `disabled` predicate against the record (boolean was the only honoured
  form before), mirroring its existing `visible` evaluation. An action can now
  grey out conditionally (e.g. "Reassign" on a converted lead) instead of only
  hiding via `visible`.
- **plugin-grid (row menu)**: `RowActionMenu` items likewise evaluate `disabled`
  (boolean or CEL against the row), and skip the click when disabled.
- **components (action-button)**: forward `undoable` / `recordIdField` when
  executing, so undoable update actions keep their Undo affordance through the
  `action:button` path.
- **app-shell (RecordDetailView)**: mount `useGlobalUndo` and wire the record
  action runtime's success toast to offer "Undo" for `undoable` actions
  (capturing the changed fields' prior values from the loaded record).
- **plugin-detail (record:quick_actions)**: the widget's buttons now evaluate a
  CEL `disabled` and show a spinner + disable while running.
