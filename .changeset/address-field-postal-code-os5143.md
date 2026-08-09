---
"@object-ui/fields": patch
---

`address` widget: the ZIP box now reads and writes `postalCode`, the part name the platform stores

`AddressField` bound its ZIP input to `zipCode` — a part name that appears
nowhere in `@objectstack/spec`. The stored value uses `postalCode`, which
`AddressValueSchema` declares and enforces with `$strip` semantics, so the two
sides never met:

- opening a stored address showed an **empty** ZIP box (no input read
  `postalCode`), while street / city / state / country all populated — four of
  five parts working is what let this survive review;
- anything the user then typed into that box was written back as `zipCode` and
  **stripped at the contract boundary**. On a new record the postal code was
  lost outright; on an existing one the correction was silently discarded and
  the stale stored code remained, with no error anywhere.

The widget now uses `postalCode` throughout — state key, sub-input id, the
`onChange` part name and the read-only formatter. Data written by the previous
builds is still **read** through `zipCode` as a compatibility limb, and the
first edit of any part normalizes such a record onto `postalCode` rather than
writing the split shape back out. Nothing writes `zipCode` any more, and it is
deliberately not part of the exported `AddressValue` type, so authoring code
cannot spell it.

`AddressValue` is otherwise unchanged in shape; consumers that referenced
`AddressValue['zipCode']` must read `postalCode`.

Fixes objectstack-ai/objectstack#5143.
