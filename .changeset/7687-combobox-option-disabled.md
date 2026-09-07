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
trigger button) is untouched, no key is added to `@object-ui/types`, and no new
key is introduced — this release only starts reading one that was already
published.

`@object-ui/types` is deliberately **not** given its own bump. The one file that
changes there is a test, `component-docs-disabled-inherited-7239.test.ts`: its
census over `content/docs/components` counts every documented `disabled?:` row,
and documenting the member adds a legitimate row that the ledger now claims as
INDEPENDENT (the shipped `ComboboxOption` declares `disabled` itself and does not
extend `BaseSchema`, so the narrow `boolean` spelling is correct for it). No
shipped type or value moves in that package, so there is no behaviour there to
version.
