---
"@object-ui/app-shell": patch
---

feat(studio): WYSIWYG form-layout designer in the Data pillar

The Data pillar's Form view gains a **布局 (Layout)** designer: the object's default
form rendered WYSIWYG, where an admin adds **sections**, drag-reorders fields within
a section and drags them **across** sections, and clicks a field to edit it in the
**same** protocol inspector the grid uses — one screen, no Data↔Interface switch.

Sections persist as the object's `fieldGroups`, and membership/order as `field.group`
plus field order, via the existing draft → publish. The drag/section chrome (dnd-kit)
is the only new code; the data model and all mutations reuse the existing, tested
`object-fields-io` helpers (`readGroups`/`addGroup`/`renameGroup`/`removeGroup`/
`moveGroup`/`clearFieldGroup`/`groupEntries`).

Also fixes the Data pillar clobbering an in-progress draft when the metadata client
identity churned (e.g. toggling the live preview): the object baseline is now loaded
exactly once per selected object.
