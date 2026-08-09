---
'@object-ui/plugin-detail': patch
---

`record:related_list`: an `add` without `add.picker` no longer takes the whole related list down.

The Add-picker gate compared only `add` for truthiness and then read `add.picker.object` bare, so page metadata declaring `add` but omitting the (spec-required) `picker` threw during render and `SchemaRenderer` replaced the entire related list with a "Component failed to render" card whose message never mentioned `picker`. Both the Add button and the picker dialog now gate on the resolved `add.picker.object` — the list body renders as usual, only the unconfigured Add affordance is withheld, and a console hint names the missing key. Off-spec `add` still does nothing, so no lenient second dialect is introduced; producing-side validation of page metadata is tracked separately.
