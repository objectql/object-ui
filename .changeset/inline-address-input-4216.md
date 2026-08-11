---
'@object-ui/plugin-detail': patch
---

Inline-editing an `address` on the record detail page now edits it as real sub-fields, instead of collapsing it to one text box reading `[Object]` and saving a string over the structured value.

`InlineFieldInput`'s type switch routed the scalar and relational families to their dedicated widgets; every structured-object type matched nothing and fell through to the terminal raw text input at the end of the component. That fallback stringifies an object value through `coerceToSafeValue`, whose general-object case extracts `name || label || externalId || id || _id` and otherwise returns the literal `[Object]`. A stored address carries none of those keys, so the edit box read `[Object]`.

The display half was cosmetic; the write half was not. The fallback is a plain input wired to `onChange(v)`, so whatever the user typed was emitted as a **string** that replaced the whole `{ street, city, state, postalCode, country }` object on save — and `[Object]` was what the user saw as the current value they were correcting, which makes typing over it the natural gesture. An ordinary double-click inline edit therefore destroyed the sub-field structure. This is the input path only: objectui#4037 fixed the display registry, and read mode (including the inline-edit read state before editing starts) already rendered a formatted address.

`location` and `geolocation` are fixed with it. Both store objects too (`{ latitude, longitude }`), both reached the same terminal input, and both produced the identical `[Object]`-then-overwrite pair — one defect in three spellings, not three defects.

No new editor was written and no consumer-side tolerance was added. All three route to the widgets the create/edit dialog already uses (`AddressField` / `LocationField` / `GeolocationField`, the form's own structured-value editors), so the two entry points cannot diverge on the value shape they write back, and `coerceToSafeValue` is left untouched — the routing is what stops an address from ever reaching it. `autoFocus` follows the numeric branches' convention and lands on each widget's first sub-input (street / the coordinate box / latitude).

String-valued types are unchanged: `text`, `textarea`, `email`, `phone`, `url`, `color`, `code`, `time`, `qrcode` and the rest keep the terminal text input, where stringification is the identity and nothing is lost.
