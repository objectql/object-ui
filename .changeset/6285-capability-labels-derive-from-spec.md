---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

The capability picker localizes `manage_sharing` (objectui#6285). Before this, "Manage
Sharing" was the one platform capability in `sys_permission_set`'s picker that rendered in
English in every locale, beside seven siblings that translated — a user-visible missing
translation, in all ten packs at once.

The cause was an unchecked copy. `CURATED_CAPABILITY_LABELS` in
`CapabilityMultiSelectField.tsx` listed seven capability names under a doc comment claiming
it mirrored `@objectstack/spec/security`'s `PLATFORM_CAPABILITIES`; the spec grew an eighth
member and the list did not follow, so `manage_sharing` fell through to the English label
the `sys_capability` registry serves. Nothing could catch it: the i18n gate reads that list
as this key family's vocabulary and checks the members it names — all seven had keys — and
no instrument compared the vocabulary to the array it was named after.

`capability.label.manage_sharing` is now authored in all ten packs and in the field widgets'
provider-less defaults map, the list carries the member, and the prose claim is replaced by
a check: `CapabilityMultiSelectField.specParity-6285.test.tsx` imports `PLATFORM_CAPABILITIES`
and fails on any difference in either direction, reading the declaration through the i18n
gate's own source reader so what it pins is exactly what that gate consumes. `labelFor` also
gains a `defaultValue`, so a capability that arrives in a future spec bump before its
translation is authored degrades to the registry's English label rather than rendering a raw
i18n key at the user.
