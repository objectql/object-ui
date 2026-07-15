---
"@object-ui/plugin-detail": patch
---

refactor(plugin-detail): extract `<InlineFieldInput>` from `DetailSection`

Lift the inline-edit input branch out of `DetailSection` into a standalone,
reusable `<InlineFieldInput>` component (objectui#2407, step 0 — the
behavior-preserving refactor that precedes the record-level `InlineEditContext`
and editable-highlights work).

Behavior is unchanged: `<InlineFieldInput>` renders the exact same type-aware
editors the detail body handled inline — `SelectField`, `BooleanField`,
`LookupField`, `UserField`, `CapabilityMultiSelectField`, the
`permission-facet-link` read-only facet, and the plain number/date/text input
(with ISO-date coercion and `$expand`-ed-reference safety so an object value
never leaks `"[object Object]"`). `DetailSection` now delegates to it and keeps
the field-editability gate (computed / `readonly` / system-field / object
lifecycle) exactly as before. The `extractLookupId` helper and the
`TEXTUAL_REF_FALLBACK_TYPES` set move alongside the component.

This lets any record-level surface (the details body **and** the highlights
strip) share one editor, shrinking the surface of the follow-up
editable-highlights change. Covered by the existing `DetailSection` inline-edit
suites plus a new `InlineFieldInput` parity test.
