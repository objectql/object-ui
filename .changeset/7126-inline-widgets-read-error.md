---
'@object-ui/fields': patch
---

The last five inline edit widgets read the delivered `error` slot, so a failed
required `text` / `boolean` / `date` / `datetime` / `time` control finally
reports `aria-invalid` (objectui#7126).

objectui#7008 made `FieldEditWidget` DELIVER the declared `error` key to
whichever widget it resolves. Of the 27 distinct components in `EDIT_WIDGETS`,
21 read it; five did not — `TextField`, `BooleanField` (serving both `boolean`
and `toggle`), `DateField`, `DateTimeField` and `TimeField` — so for their field
types the delivery was inert and the attribute was still never set.

`text` being in that set is what made this a live defect rather than tidiness.
It is the most common field type in any object, so it is the likeliest thing a
kanban column makes required: `RequiredFieldsDialog` computed the failure, drew
the red "Required" hint, handed the state to the control, and the control said
nothing to assistive tech. The grid's inline cell editor and the detail page's
inline edit (`InlineFieldInput`) compose the same seam.

Each of the five now computes `aria-invalid={!!error}` **after** its DOM
pass-through spread — one existing idiom, the objectui#3222 discipline the other
21 already share, so a valid field says an explicit `"false"` rather than staying
mute. Two judgements worth stating:

- **The FORM path was never broken and is unchanged.** `<FormControl>` is a
  Radix `Slot` whose `aria-invalid` reached each control through the props
  spread; the form also produces `error`, so the widget's own computation now
  agrees with the value it replaces. The gap was every host WITHOUT that Slot.
- **`BooleanField` is the one composite here, and the mark goes on the
  control.** Its Radix `Checkbox` / `Switch` renders a real
  `button[role=checkbox]` / `button[role=switch]`; the wrapping flex `div` is
  deliberately not the target, because a wrapper mark satisfies a subtree query
  while telling a screen-reader user nothing (objectui#5223). The three
  date/time widgets each render one native input, so the browser's picker raises
  no second-element question.

This buys the MARKING only. The objectui#3222 slot drives `aria-invalid` and
renders no text: the visible message stays with the host, and nothing that was
invisible becomes visible.
