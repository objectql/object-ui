---
'@object-ui/components': patch
---

The built-in `select`'s empty / dependency-gated branch renders no form control, so its
visible label now emits no `for` (objectui#3991).

`for` may only reference a labelable element (`button`, `input`, `meter`, `output`,
`progress`, `select`, `textarea`). When a built-in `{ type: 'select' }`'s option list
resolves empty — unconfigured, or a `dependsOn` gate still withholding it
(objectui#2284) — the branch renders `BuiltinSelectEmptyState`, a `<div>` carrying the
status text and no control at all, and `<FormControl>`'s Slot put the field's id on that
`div`. The label's `for` therefore named a non-labelable element. Measured before the
fix, for `{ name: 'empty', label: 'Empty', type: 'select', options: [] }`:

```
label for="_r_2_-form-item"  ->  ownerTag = DIV
```

**Impact is author- and test-side, not user-side.** No focusable control exists anywhere
in that state, so neither "clicking the label does nothing" nor "the control has no
accessible name" can occur — the thing a name would name does not exist. What was wrong
is inert, invalid HTML, plus a Testing Library failure that reads like a broken
renderer: `getByLabelText('Empty')` threw *"the element associated with this label
(`<div />`) is non-labellable"*, whose own remedy line then points authors at
`aria-label` / `aria-labelledby` on a `div`.

**What changes in your DOM.** For that branch only, the `<label>` loses its `for`
attribute; it stays visible and still reads as the field's name, and the empty-state
message renders beside it unchanged. A `select` WITH options is byte-identical — its
label still resolves to the trigger `button` (objectui#3976). `getByLabelText` on the
empty branch still finds nothing, now failing with the truthful *"no form control was
found associated to that label"*; there is no control to resolve to, and giving the
empty state an `aria-labelledby` target or a synthetic role was refused as naming a
thing that is not a control.

**Not changed: the registered-widget path.** `field:select` (`@object-ui/fields`'
`SelectField` / `OptionsEmptyState`) has the same fault by a different mechanism — the
branch belongs to a component the registry resolves, and a third-party `field:select`
may render a real control for an empty list, so suppressing the `for` on a host-side
guess would break a widget that had it right. Tracked separately.
