---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

Carry `manage_org_presentation`, the ninth platform capability (objectui#7122).

`@objectstack/spec` 17.3.0 declares a ninth member of `PLATFORM_CAPABILITIES`
and the capability picker's curated set carried eight, so
`CapabilityMultiSelectField` fell back to the `sys_capability` registry's
English label for it in every locale — the exact defect objectui#6285 filed
when `manage_sharing` did the same thing.

The label is the spec artifact's own (`Manage Organization Presentation`), read
off the installed build rather than invented, and it is authored everywhere the
widget's docblock requires of any edit to that list: `useFieldTranslation.ts`
and all ten locale packs. Each non-English string is composed from that pack's
own established sibling vocabulary (`manage_org_users`,
`manage_platform_settings`) rather than machine-translated; a native review pass
is welcome on the nine, and nothing about the capability's behaviour depends on
the wording.

The parity pin is unchanged and still fails on ANY difference in either
direction, which is what made this visible before it reached a screen.
