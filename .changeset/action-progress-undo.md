---
"@object-ui/core": minor
"@object-ui/app-shell": minor
"@object-ui/plugin-detail": minor
---

feat: action progress state + Undo affordance

- **core**: `ActionResult.undo` (an `UndoableOperation`) and `ActionDef.undoable`.
  On success the `ActionRunner` pushes the operation onto the global UndoManager
  and the success toast carries an "Undo" affordance (`ToastHandler` gains an
  `undo` option).
- **app-shell**: the console action runtime mounts `useGlobalUndo` (Ctrl+Z /
  Ctrl+Shift+Z) and renders the toast's "Undo" button; its `apiHandler` resolves
  the row id from the list row record and, for `undoable` actions, captures the
  changed fields' prior values so the update can be reverted.
- **plugin-detail**: record-header quick-action buttons show a spinner + disable
  while the action runs (a visible progress state for slow/flow actions).
