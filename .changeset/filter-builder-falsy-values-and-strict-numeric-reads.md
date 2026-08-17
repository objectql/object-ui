---
'@object-ui/components': patch
---

`FilterBuilder` shows the falsy values a row actually holds — a boolean `false` and a number `0` are values, not empty boxes.

The value controls asked `!condition.value` and `String(condition.value || "")`,
which folds `false` and `0` in with the rows nobody has filled in yet. Both rows
saved, persisted and filtered by their value the whole time; only the control
said otherwise:

- a boolean column filtered `equals false` snapped back to the **Select value**
  placeholder the moment the user clicked **False**, while the row carried
  `value: false`;
- a number column filtered `equals 0` showed an empty box — and typing `0` into
  one looked like the keystroke had never landed, because the row took the value
  and the very next render blanked the input;
- a single-select whose option id is `0` showed the placeholder too, even though
  the same control's multi-select branch already drew that option as checked.

"No value" is now one judgement (`undefined` / `null` / `''`), read by every
value control and by the two helpers that already spelled it out correctly, so
"not picked yet" and "picked False" stay two distinguishable states rather than
trading places.

The three keyed numeric paths — the token input's commit, a range bound, and the
single value input — no longer read with `parseFloat(raw) || 0`, which takes half
of `"42abc"` and turns `"acme"` into `0`: a filter the user never wrote. All
three now use the same strict reading a field switch uses, so this component
holds one answer to "is this string a number" instead of a strict one and a
lenient one. An unreadable entry becomes an unfilled value, except in the token
input, which declines the commit and leaves the text in the draft box to be
fixed. No behaviour a user can reach today changes: those inputs are
`<input type="number">`, which never hands a non-numeric string to the component
in the first place — this closes the drift, before a text box, a formula or a
paste path opens it.
