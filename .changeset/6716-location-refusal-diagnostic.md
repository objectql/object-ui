---
'@object-ui/fields': patch
---

`LocationField` says WHY it refused an edit, instead of refusing in silence
(objectui#6716).

The widget refuses to emit for input it cannot accept, and used to say nothing
when it did. Two refusals shared that silence: text that is not a
comma-separated pair (pre-existing), and a pair outside the spec's coordinate
range (objectui#6714). In both, `onChange` was never called, so the typed text
vanished with `aria-invalid` reading `"false"` throughout — a screen reader was
told the control was fine right after it had rejected the entry.

- Both arms now render a short reason and set `aria-invalid` on the control. The
  range message is built from `LocationValueSchema`'s own issues, never from a
  hand-copied `-90..90`, so it cannot drift from the spec.
- The box now HOLDS the refused text, so the message has something to point at
  and the entry can be corrected in place. Measured first without it: with the
  value derived straight from the stored one, React restores the control in the
  same tick, so typing a valid coordinate one character at a time left the box
  empty, stored nothing, and lit a refusal on the final keystroke too.
- Refusal is unchanged: a coordinate the platform validator rejects is still
  never emitted, and never stored. The published objectui#3222 `error` slot keeps
  its single author (the form renderer); the widget's own state is separate, as
  `ObjectField`'s `parseError` already is.
