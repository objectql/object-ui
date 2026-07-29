---
"@object-ui/components": patch
---

fix(fields): a `select` no longer wipes itself when its value outruns its options (#2968)

Radix keeps a hidden native `<select>` mirror so a Select's value takes part in
native form submission. Assigning a value that mirror has no `<option>` for is a
no-op — the element stays on `''` — but Radix still dispatches the synthetic
`change`, so `''` comes straight back out through `onValueChange` and lands in
react-hook-form on top of the value the caller just set.

The window is not theoretical: `SelectContent` registers its native options a
commit AFTER the trigger mounts, so a record that lands after first paint — an
edit modal whose `findOne` is still in flight — resets the form into exactly
that gap. Every rendered select came back empty while RHF's `_defaultValues`
still held the right value. When one of the wiped fields is the one a
`visibleWhen` predicate reads, the predicate flips back to false, the
conditional fields hide again and the form **latches** in the broken state:
pressing Update then fails validation, or submits an empty enum, on a form the
user never touched. The wipe is also recorded as a user edit, so Cancel prompts
"discard changes?" on an untouched form.

`SelectItem` rejects `value=""` outright, so `''` can never be a value the user
actually picked — it is always the mirror talking. It is now dropped at the
single `Select` chokepoint, which covers every surface that renders one (object
form, inline grid editor, action param dialog). Clearing a select still goes
through `undefined`, which is untouched — the `dependsOn` cascade-clear behaves
exactly as before.
