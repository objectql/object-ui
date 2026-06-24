---
"@object-ui/app-shell": patch
---

fix(metadata-admin): dataset filter builder ignores incomplete conditions

`groupToCondition` emitted a condition for any row that had a `field`, even when
its value was still blank — producing a silently-wrong filter like
`{ organization_id: { $eq: "" } }` (matches only empty → excludes everything)
instead of "no filter". Now rows with an empty/`undefined`/`[]` value are skipped
(value-less operators like is-empty / is-not-empty are still kept). Applies to both
the dataset Scope filter and per-measure filters. Found by dogfooding.
