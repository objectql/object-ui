---
"@object-ui/app-shell": minor
---

fix(studio): the form-layout canvas resolves the object's field and section translations (#3134)

`ObjectFormDesigner` bills itself as a preview of the end-user form, but it read
labels straight off the object draft — `entry.def.label` for fields, `group.label`
for section headers. Every other surface for the same object (`ObjectForm`,
`RecordDetailView`, the data grid) resolves those through the project's object
translations first, so a fully translated object rendered `Opportunity Name` /
`Basic Information` on the layout canvas while the very same fields read
`商机名称` / `基本信息` one click away.

The designer now goes through `useSafeFieldLabel()` — `fieldLabel()` for field
cards (including the drag overlay) and `sectionLabel()` for section headers —
which is the same resolver the runtime form uses, with the authored metadata
label as fallback when no translation exists. The lookup root is the object's
API name; `StudioDesignSurface` now passes it explicitly (`objectName`) so a
draft body that has not been re-named still resolves, falling back to
`draft.name`.

Observable rendering change (translated labels now appear where English source
labels did), hence `minor`.
