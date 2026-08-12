---
'@object-ui/plugin-charts': patch
---

Analytics: `ObjectChart` consumes the shared label-net helpers instead of a third copy

objectui#4389 (PR #4404) named two copies of the analytics label-net glue — the dashboard's `DatasetWidget` and plugin-report's dataset block — and retired both into `@object-ui/core` + `@object-ui/react`. There was a THIRD, which that card did not name and its PR deliberately left out of scope: `packages/plugin-charts/src/ObjectChart.tsx` carried its own `translatorFor` closure, its own `buildDimensionLabelMap` loop, and its own base-object-read-then-walk composition. The `translatorFor` copy was logically identical to the two that were deleted, down to the comment explaining the binding.

`ObjectChart` now calls core's `dimensionOptionTranslator`, `deriveDimensionLabelMaps` and `loadDimensionFieldMeta` directly. Nothing about what a label IS changes — those helpers are the same code the two retired copies were rewritten onto, so the part that was genuinely duplicated three times is now written once.

Behaviour is unchanged by construction: same two metadata reads in the same order on the dataset path, same one read on the aggregate path, same best-effort fallback (an unresolvable path yields no entry and the raw value survives), same locale-applying memo boundary. `plugin-charts`' 22 test files / 170 assertions pass unchanged and their files are byte-identical to before, which is the acceptance evidence for a pure swap.

The card's second, optional step — moving the DATASET path's metadata read onto `@object-ui/react`'s `useDatasetDimensionMeta` — was attempted and declined on measurement; the shape blocker is recorded on objectui#4405 and in the PR. The two bug-fix properties the family exists to state (the read rides the host's authenticated `apiFetch`, objectui#4121; the fetched metadata stays locale-free, objectui#4030 / PR #4324) therefore remain stated locally in this file, exactly as before, and are undisturbed by this change.
