---
"@object-ui/fields": patch
---

`field:select` now announces its validation state to assistive tech: the
widget's DOM pass-through lands on the Radix `SelectTrigger` — the focusable
`<button role="combobox">` a user actually interacts with — instead of
`Select.Root`, which renders no DOM element of its own and silently dropped
every `aria-*` the form renderer delivered (objectui#3306).

Before this, a required select that failed validation showed the red message
while a screen reader was told nothing: `aria-invalid`, `aria-describedby`
(the link to the message text) and `aria-required` (objectui#3290's state
channel) all landed on Root and vanished. All three now reach the trigger,
and the widget computes `aria-invalid` from the published `error` slot after
the spread, the objectui#3222 discipline — a valid field explicitly says
`aria-invalid="false"` rather than staying mute.

Two keys deliberately stay on Root: `name` (Root forwards it to the hidden
native `<select>` that takes part in form submission) and `disabled` (Root is
the single authority that disables trigger, items and hidden select together).

Guarding the whole class forward, a new registry-wide sweep
(`widget-aria-invalid-registry-e2e.test.tsx`, the objectui#3291 leak-sweep
paradigm) renders every registered field widget through the real form, drives
a real validation failure, and asserts `aria-invalid="true"` appears inside
the field's row. The 29 widget types measured not to deliver yet are pinned in
a ratchet ledger (tracked in objectui#3318): fixing one turns its ledger row
red until the entry is removed, so the ledger only ever shrinks.
