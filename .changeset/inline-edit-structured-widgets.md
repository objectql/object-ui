---
"@object-ui/fields": patch
---

feat(fields): inline-edit structured-value fields (color, address, location, geolocation, code, qrcode)

Completes the inline-editor ↔ form-widget parity from the previous fix: the six
structured types that already had lightweight form widgets — `color`,
`address`, `location`, `geolocation`, `code`, `qrcode` — now edit inline with
those same widgets instead of being deferred. All are dependency-light (no map
or code-editor libraries) and use the standard `FieldWidgetProps`. Verified
inline on the field-zoo: color → a color picker, code → a textarea, the rest
their value editors. The drift-guard's exclusion set now contains only the
genuinely-non-inline types (computed, binary, heavy editors, containers).
