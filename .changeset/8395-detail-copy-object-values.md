---
'@object-ui/plugin-detail': minor
---

`DetailSection`'s click-to-copy no longer writes `[object Object]` for object-valued
cells (objectui#8395).

The copy affordance built its payload with `String(value)`, and `String()` of an object
is the literal text `[object Object]`. Because the affordance is offered for every
non-empty value — objects included — a reader clicking the copy button, the row, or
pressing Enter on an **address**, **geolocation**, **JSON**, **file/attachment**,
**expanded lookup**, **repeater** or **image** cell silently got that placeholder on the
clipboard, while the cell beside the button rendered the same value correctly. Nothing
errored; it was noticed only on paste.

Objects are now serialized with `JSON.stringify`, so those cells copy the stored value
losslessly and parseably.

**Non-objects are byte-identical.** A number still copies `16` (not the rendered
`16.00`), a currency `1234.5` (not `1,234.50`), a percent `0.123` (not `12%`), a date
`2026-03-04` (not `Mar 4`), and a select its stored `won` (not `Closed Won`). Copying
the *rendered* text was measured and rejected: it is the worse contract for 9 of 17
field types and loses data silently.

**One payload moves without having been broken:** a multiselect stored as
`['alpha','beta']` copied `alpha,beta` and now copies `["alpha","beta"]` — an array is
an object. The new form is lossless where the old one was ambiguous for any value
containing a comma.

The JSON blob is a **defensible default, not a settled contract**. What an object cell
*should* copy (a formatted postal address, `lat, lng`, a filename) is a per-kind product
question tracked separately as objectui#8395's option B; the read site says so in place
so the default is not mistaken for the answer. The `password` / `secret` branch of the
same handler is untouched here — it is its own open card.
