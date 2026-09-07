---
'@object-ui/types': minor
'@object-ui/components': minor
---

Combobox: honour `description`, retire `defaultValue`, pin the `name` delivery
that was already there (objectui#8140).

`ComboboxSchema` declares eight authorable members and the `combobox` node
renderer forwarded four. The three the card named as unread got three different
verdicts, because the measurement did not give them the same answer.

**`description` — now honoured.** It renders as a paragraph below the control
and is tied to the trigger with `aria-describedby`, so it is the control's
accessible DESCRIPTION rather than loose decoration next to it (the shape
objectui#5735 established for `element:text_input`). The published
`ComboboxProps` is unchanged: help text sits below the control, so it belongs to
the node renderer's own output and not to the button `<Combobox>` renders. A node
that authors no `description` renders exactly the DOM it rendered before —
including no `aria-describedby`, since an attribute naming an absent element is
worse than none. An `aria-describedby` the author put on the node is COMPOSED
with, never overwritten.

**`name` — was never missing.** There is no `schema.name` read site in the
renderer and there should not be one: `SchemaRenderer` spreads every non-metadata
top-level schema key as a React prop, and `name` is one of the two keys the
form-control DOM pass-through adds to the SDUI baseline for exactly this class of
host, so an authored `name` already lands on the focusable `role="combobox"`
trigger. A grep for the spelling says otherwise; the DOM says this. Behaviour is
unchanged and now pinned, so it cannot regress as silently as an unread key
would.

**`defaultValue` — RETIRED (ADR-0049), breaking, deliberately.** Authoring it is
now a `tsc` error and a named `safeValidateSchema` refusal whose message carries
the remedy: write `value`. It was retired rather than implemented to match the
sibling `select` renderer, because the two differ in the property that makes a
"default value" mean anything distinct from a value:

- `combobox` is a **standalone node type only**. It is not a built-in form field
  type and no `field:combobox` widget is registered, so a form field authored
  `type: "combobox"` (or `field:combobox`, or `ui:combobox`) never reaches this
  renderer at all — it renders a plain text input. On the form-field path, which
  is where "a default the user then edits" is a real concept, the form's own
  value plumbing already supplies the default and never consults this key.
- On the node path the selection is **frozen**: the renderer passes no
  `onValueChange` and the DOM pass-through forwards neither `onChange` nor
  `onValueChange`, so no host can supply one. Selecting a different option leaves
  the trigger unchanged. `select`'s renderer does pass a change handler, which is
  precisely why `defaultValue` is a real initial value there.

On a control whose selection cannot change, honouring the key could only have
made it a second spelling of `value` — the consumer-side alias AGENTS.md #0.1
forbids. It is kept declared and unwritable rather than deleted because the
mirror extends the passthrough `BaseSchema`: a deleted member parses green and is
ignored, trading one silent no-op for another.

**Migration.** Replace `defaultValue` with `value` on any `combobox` node. No
occurrence exists in this repository's corpus — the schema catalog's five
combobox examples and the published docs' schema block never carried the key,
and the docs block never documented it.

⛔ Not part of this change: `label` and `error`, which are also declared on
`ComboboxSchema` and also unrendered by this renderer. They were fenced out of
the card and were not measured on the node path, so they are untouched here.
