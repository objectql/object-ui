---
'@object-ui/plugin-detail': patch
'@object-ui/fields': patch
'@object-ui/components': patch
'@object-ui/app-shell': patch
---

Record-level inline edit polish (objectui#2572, follow-up to #2407) — the five
rough edges from the live showcase verification pass:

- **Expanded reference values pass through to the picker.** `InlineFieldInput`
  no longer collapses an `$expand`-ed record object to a bare id before
  handing it to `LookupField` / `UserField` — the picker resolves the display
  name it already carries instead of re-fetching the referenced record via
  `findOne` (or sticking on the placeholder when it can't). `LookupField`
  still hands its Level-2 pickers (PeoplePicker / RecordPickerDialog) bare
  ids, collapsed via the existing `normalizeId`.
- **Approval-lock preflight.** The record page now re-reads the approval
  state whenever the record is invalidated (a save can *trigger* an approval
  flow that locks the record), derives one `approvalLocked` signal
  (`approval_status` pending/in_approval OR an open pending request), gates
  the inline-edit session's `canEdit` with it — hiding the pencil affordances
  and no-op'ing `enter()` on a locked record — and drives the save bar's
  `locked`/`lockedHint` so users can't type into a draft that Save would
  reject with `RECORD_LOCKED`.
- **Numeric field types edit with the real numeric widgets.** `number` /
  `currency` / `percent` route to `NumberField` / `CurrencyField` /
  `PercentField` (the same widgets the form uses) instead of a free-text
  input: numeric keyboard, symbol adornment, fraction↔percent display
  conversion, and numbers (not strings) into the draft. `NumberField` and
  `CurrencyField` now surface metadata `min`/`max` on the input, `NumberField`
  honors an explicit `step` and steps by 1 for `scale: 0` (previously fell
  back to `any`).
- **Header Edit CTA stands down during an inline session.** The synthesized
  `sys_edit` action carries `disableDuringInlineEdit`, and the `page:header`
  renderer greys such actions out while `InlineEditContext.editing` — the
  classic form-edit surface can no longer be stacked on top of a live inline
  draft.
- **Keyboard shortcuts for the shared edit session.** `InlineEditSaveBar`
  binds **Esc → cancel** (deferring to any open Radix layer — popover /
  select / dialog — which owns Escape for "close") and **Cmd/Ctrl+Enter →
  save**, both respecting `saving`/`locked`.
