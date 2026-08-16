---
'@object-ui/plugin-form': patch
---

Fix: a `drawer` form with no `sections` now renders the object's declared
`fieldGroups` as sections, matching `ObjectForm` and `ModalForm`.

`deriveFieldGroupSections` had exactly two call sites in the repo —
`ObjectForm` and `ModalForm` — so the same object, with the same metadata,
rendered one section per declared group in the modal create dialog and one
ungrouped flat list in the drawer. The author who laid the groups out in the
object designer saw them honoured on two surfaces out of three.

`DrawerForm` now runs the same fallback the modal does: gated on "no explicit
`sections`, no `customFields`", over the same auto-layout-filtered field list
(system fields dropped, auto-generated fields dropped in create mode), with the
flat path's inferred column count carried onto the grouped layout. A curated
`sections` list from a form view still wins, and an object whose fields join no
declared group keeps its flat layout untouched. A derived group declaring
ADR-0085 `collapse` renders as a collapsible header, like an authored one.
