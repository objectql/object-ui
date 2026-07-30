---
"@object-ui/fields": patch
---

fix(fields): PeoplePicker's keyboard cursor can no longer be eaten by a late reset

The cursor reset on new results lived in a `useEffect`. Effects flush
asynchronously after the render that delivered the records — so a reset queued
by their arrival could land AFTER a subsequent ArrowDown and wipe the just-set
cursor. That was the residual ArrowDown→Enter flake in
`PeoplePicker.test.tsx` (the earlier signature-keyed fix closed the
too-often resets, not the too-late one), and a real fast-fingers UX bug: rows
appear, the user presses ArrowDown, the highlight vanishes.

The reset now runs in the render phase (the "adjusting state during render"
pattern), in the same render that shows the new rows — by the time a row is
visible, the reset has already happened, so it can never race a keypress.
Semantics unchanged and now pinned by a test: a replaced result set does not
inherit the previous set's cursor.
