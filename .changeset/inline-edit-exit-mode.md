---
"@object-ui/components": patch
---

fix(components): exit inline edit mode for injected cell editors (#2321)

Non-discrete inline-edit cells (text, number, date, lookup, user, currency,
percent, …) got permanently stuck in edit mode: the host-injected `@object-ui/fields`
widget staged its value on every change but had no way to leave edit mode, so
clicking outside, pressing Enter, and the row Save button all failed to dismiss
the editor. Only discrete pickers (select/boolean/radio/rating), which commit on
selection, exited correctly.

The DataTable now gives injected widget editors the same exit affordances the
built-in `<input>` editors have:

- **Click-outside** commits the staged value and exits, via a capture-phase
  document `pointerdown` listener. It is portal-aware — clicking inside a lookup
  popover / record-picker dialog the widget itself opened does not exit, and a
  modal that merely hosts the grid does not suppress the commit.
- **Enter** commits and exits (a multi-line `textarea` keeps inserting newlines).
- **Escape** reverts this session's staged changes and exits.

Keys that bubble up through a React portal from the widget's own popover keep
driving that popover rather than the cell. Built-in editors are untouched.
