---
'@object-ui/fields': patch
---

A `Field.address` value now reads as a formatted postal address on the record detail page, instead of stringified JSON.

The display (read) registry mapped `address` straight to `JsonCellRenderer`, so a populated address rendered as `{"street":"中策路 1 号","city":"杭州",…}` — while a `location` field sitting next to it in the same field group rendered formatted, and the create/edit dialog rendered the very same value as proper Street / City / State / ZIP / Country inputs. The gap was display-side only: the input registry has always carried `address`. Both read surfaces the detail page exposes are affected and both are fixed, because they share one `displayValue` path — read mode, and the inline-edit read state (the row carrying the pencil affordance, before a field is actually being edited).

Layout is not invented for the read side. `AddressField`'s readonly branch already collapsed a stored address to a single line, and that rule — `Street, City, State ZIP, Country`, with `state` and the postal code sharing one comma group — is now the *only* implementation, moved into a pure `address-format` module that both surfaces call. A readonly form and a detail page therefore cannot spell one stored address two ways; a second copy next to the renderer would have been a rule that drifts. The module is deliberately React-free, so the eagerly-loaded barrel can format a cell without pulling `AddressField` and its inputs out of the lazy widget chunk.

Partial values degrade the way the readonly line already did: absent, non-string and whitespace-only parts are dropped rather than spaced over, so a street-only address renders as `中策路 1 号` and never as `, , ,` or as the string `undefined`. Legacy records whose postal code was written under `zipCode` (objectstack#5143) still render it, matching what the input widget reads.

Nothing is silently swallowed by the change: a value the formatter cannot recognize — an object carrying no known part — keeps today's compact-JSON rendering rather than disappearing, and `{}` or a null value shows the usual empty placeholder. A plain string address passes straight through. `location`, `geolocation`, and the genuinely structural `json` / `object` types are untouched.

The address *input* is unchanged on every surface, including the create/edit dialog.
