---
'@object-ui/plugin-detail': patch
---

detail synth: `stageField: false` (or `null`) now explicitly opts a record page
out of the auto status-path stepper.

`detectStatusField()` previously only treated a truthy `stageField` (a field
name) specially and otherwise auto-detected a `status` / `stage` / `state` /
`phase` field by name or type. Objects with a non-linear `status` picklist
(e.g. 正常 / 暂停 / 作废) had no way to suppress the inappropriate ordered
`record:path` stepper. Setting `stageField: false` / `null` on the object def
now short-circuits detection and renders no path. Default behavior unchanged.
