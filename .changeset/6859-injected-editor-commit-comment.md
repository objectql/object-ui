---
---

No behaviour change, and deliberately so: this is the record being corrected, not the
renderer (objectui#6859).

The data table's document-level `pointerdown` listener — the one that exits a host-injected
inline cell editor when you click away — justified itself with "the injected widgets (text,
number, date, lookup, …) have no such handler". That has not been true since objectui#6780 /
#6802: `onBlur` is a declared DOM pass-through key, and all 27 widgets reachable as an inline
editor deliver it to a real control (26 spread `toDomProps` themselves, `UserField` delegates
to `LookupField`).

A source audit read the same absence as silent DATA LOSS on Tab-out. It is not. Driven in a
real browser against the real widgets, a value typed into a text, date or number cell editor
survives tabbing away, and reads back intact: the host wires each widget's `onChange` to the
table's `stage`, so every keystroke is already in `pendingChanges` while the editor is still
open. The listener exits EDIT MODE; it never rescued the value. Tabbing out does leave the
cell in edit mode until Enter, Escape, or a pointer press outside — a wart, not a lost edit.

The comment now says all of that, and both facts are pinned by tests so they cannot rot back.
