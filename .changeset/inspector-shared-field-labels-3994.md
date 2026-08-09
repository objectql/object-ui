---
"@object-ui/app-shell": patch
---

Metadata-admin inspectors: the shared text / number / select field labels now name their control

The three generic field atoms of every scoped inspector — `InspectorTextField`,
`InspectorNumberField`, `InspectorSelectField` — rendered a `Label` as a plain sibling of
their control, with no `htmlFor`, no `id` and no `aria-label` fallback. Label and control
were adjacent only visually: assistive tech announced an anonymous "edit box" / "combobox"
while the visible field name sat above it as unowned text, and clicking the label did
nothing. Measured before the fix, `getByLabelText('Group')` — the same `for`→id chain a
screen reader walks — found zero matches for all three.

These atoms are consumed by 16 non-test modules (page-block, flow-node, report, dataset,
permission and object-field inspectors, plus the object-group inspector in Studio design),
so every inspector panel rendered nameless inputs the moment it opened.

Each atom now mints its own id with `React.useId()` and closes the pair. The id is minted
inside the atom rather than taken as a prop deliberately: these atoms render in loops over
array items (`record:details.sections[i]`, `page:tabs.items[i]`) where every item repeats
the same label, which is precisely where a caller-supplied id collides — and a collision is
invisible, because both labels would still resolve, to the first control. `useId()` cannot
collide by construction; per-instance uniqueness is pinned rather than assumed.

For the select the id lands on `SelectTrigger`, never on `Select`: Radix's `Select.Root`
renders no DOM element of its own, so an id handed to it is silently dropped and the
label's `for` dangles — the same mechanism objectui#3976 fixed one directory over. The
trigger renders the real `button[role=combobox]`, a labelable element, so one `for`/`id`
pair names it with no second `aria-labelledby` channel. `disabled` stays on Root (single
authority over trigger, items and the hidden native mirror) and a disabled select is still
named.

`InspectorCheckboxField` was already correct — it uses a wrapping `label`, a valid
association that needs no id — and is untouched, serving as the positive control in the
tests.

Follow-on for test authors: `PageBlockInspector.sectionName.test.tsx` located its section
name boxes by placeholder *because* `getByLabelText` could not reach them. That workaround
is gone; the boxes are located by their label, and the `snake_case` placeholder convention
keeps its own dedicated assertion.
