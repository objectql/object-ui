---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

The capability picker localizes `manage_sharing` (objectui#6285). Before this, "Manage
Sharing" was the one platform capability in `sys_permission_set`'s picker that rendered in
English in every locale, beside seven siblings that translated — a user-visible missing
translation, in all ten packs at once.

The cause was a hand-written copy. `CURATED_CAPABILITY_LABELS` in
`CapabilityMultiSelectField.tsx` listed seven capability names under a doc comment claiming
it mirrored `@objectstack/spec/security`'s `PLATFORM_CAPABILITIES`; the spec grew an eighth
member and the copy did not follow, so `manage_sharing` fell through to the English label
the `sys_capability` registry serves. Nothing could catch it: the i18n gate checked that the
seven names the copy happened to list had keys — which they did — and had no way to notice
the member the copy never named.

So the set is now DERIVED from `PLATFORM_CAPABILITIES` rather than restated, applying the
same dot-to-underscore transform the call site uses (`setup.access` → `setup_access`), and
`capability.label.manage_sharing` is authored in all ten packs and in the field widgets'
provider-less defaults map. A capability the spec adds next now joins the picker on the
version bump, and a new
`CapabilityMultiSelectField.specDerivation-6285.test.tsx` fails in CI if its label has not
been authored — the event this card was, caught before it reaches a screen instead of after.
