---
'@object-ui/fields': patch
---

Editable `markdown` / `html` / `richtext` fields now carry the host's `id` and `aria-describedby` on the editor.

`RichTextField` — the one widget all three registry keys resolve to — read only
`className` and `disabled` off its props and had no `toDomProps` anywhere in the
file, so everything `<FormControl>`'s Radix `Slot` hands a field widget landed on
no element at all. Measured on a real form with a field carrying a description:

```
markdown  editable  descEl=SET  consumers=0  hostIdEl=NONE  for=DANGLING
text      editable  descEl=SET  consumers=1  hostIdEl=input     for=RESOLVES
textarea  editable  descEl=SET  consumers=1  hostIdEl=textarea  for=RESOLVES
```

Two user-visible consequences: the form's visible label pointed at an id nothing
carried, so clicking it did not reach the editor and the control had no
accessible name; and the `<FormDescription>` the form rendered below the field
had zero consumers, so a screen reader never announced the help text or — on a
failed submit — the error message id that rides in the same `aria-describedby`.

The fix is objectui#3318's standing recipe: `toDomProps(props)` spread onto the
REAL focusable control, which here is the `<Textarea>` inside the shared
`RichTextEditorSurface`. The pass-through is given to the inline surface only —
the fullscreen dialog's copy of the same surface must not carry a duplicate of
the host id, and the description ids it names sit outside the modal Radix
`aria-hidden`s. `aria-invalid` still comes from the widget's own `error` read,
kept after the spread so objectui#3318's PASS entry for this widget is unchanged.

The readonly branch is untouched: the same reading there belongs to
objectui#4788, whose mechanism is still open.
