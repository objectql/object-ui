---
"@object-ui/types": patch
"@object-ui/components": patch
"@object-ui/plugin-form": patch
---

fix(form): the runtime `field` metadata slot is declared instead of smuggled, and importing the spec's FormField is a lint error — #3090

`FormField.field` — the slot where object-bound form paths stash the resolved
field-metadata **object** for widgets — rode through the index signature,
undeclared, readable only via `as any`. Same key, different layer: in the spec
form-view vocabulary `field` is a *string* (the referenced object-field name),
and the undeclared slot kept that pun latent. The slot is now declared
(`field?: Record<string, any>`) with the invariant in its JSDoc: on a runtime
FormField it is never a string — the authored string form ends at the
`normalizeSectionField` chokepoint, and a tripwire test pins that across all
three input shapes. Assigning a string is now a compile error; the `as any`
casts at the read sites are gone.

A `no-restricted-imports` tripwire bans importing `FormField`/
`FormFieldSchema` from `@objectstack/spec/ui` inside this repo: the spec's
FormField TYPE erases to `any` in its dist (objectstack#4171), so the
misimport silently deletes type safety — tsc says nothing. The lint message
names the two layers and the correct import. The drift-guard parity test is
the one legitimate importer, exempted inline with its reason.

Ledger: `FormField` and `FormFieldSchema` move from untriaged DEBT to ALLOW
with the two-layer rationale written down (122 → 120).
