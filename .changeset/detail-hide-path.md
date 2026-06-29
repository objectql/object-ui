---
'@object-ui/app-shell': minor
---

feat(app-shell): `detail.hidePath` opt-out for the auto record:path stepper

Surface the synth's existing `hidePath` option through `objectDef.detail.hidePath`.
Set `detail: { hidePath: true }` to suppress the auto-prepended Lightning
Path-style status stepper on a record detail page — useful when the detected
status picklist is not a linear pipeline (e.g. a field that folds a risk
gradient into the status, where marking earlier options as "completed" is
misleading). Default (unset) keeps the stepper — zero regression.
