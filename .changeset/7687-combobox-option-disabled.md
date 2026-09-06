---
'@object-ui/components': minor
---

Honour `options[].disabled` on a `combobox` node (objectui#7687).

**User-visible behaviour change, deliberately — hence `minor`, not `patch`.** The
member was already declared by `@object-ui/types` (`ComboboxOption.disabled`) and
already validated by the zod mirror (`ComboboxOptionSchema`, pinned as `boolean`
on both faces by the objectui#7087 twin-symmetry ruling), but the component never
read it: `Combobox` mapped each option to a `CommandItem` carrying `key`, `value`
and `onSelect` only. So an option authored `{ value, label, disabled: true }`
passed `safeValidateSchema`, type-checked against the published `ComboboxSchema`,
and then rendered as an ordinary, fully selectable option — a declared key with no
read site behind it, the class the enforce-or-remove ledgers exist to close.

An author who already writes `disabled: true` today gets a different combobox
after this change: that option now renders dimmed and can no longer be chosen, by
click or by keyboard. That is the intended repair — declared and validated should
mean enforced — but it is a change in what existing metadata does, not a silent
internal fix, so it is priced as a behaviour change rather than a patch.

The alternative remedy, retiring `disabled` from `ComboboxOption` and the zod
mirror, was weighed and **not** adopted: it narrows a published surface and would
require the objectui#7087 twin-symmetry pin to be changed, where honouring the key
restores declared = enforced at the cost of one prop. The spelling follows the
sibling select renderer, which already sets `disabled={opt.disabled}` on its
`SelectItem`.

Nothing else moves. The whole-control `disabled` prop (the one forwarded to the
trigger button) is untouched, `@object-ui/types` is untouched, and no new key is
introduced — this release only starts reading one that was already published.
