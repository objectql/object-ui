---
"@object-ui/app-shell": patch
---

chore(metadata-admin): stop surfacing metadata fields the spec dropped (framework#2377)

`@objectstack/spec` removes a batch of dead, unenforced author-facing metadata
properties (ADR-0049 enforce-or-remove, framework PR #3176). Two of them were
still *displayed* — never enforced, but shown — in the Studio metadata-admin,
which is the same false affordance on the UI side. Both were read defensively
off raw documents, so this is a display-only cleanup with no runtime impact:

- **`dataset` measure `certified`** — `useDatasetCatalog` populated a
  `DatasetMeasureInfo.certified` flag (and `DatasetDefaultInspector` carried it
  in its local `Measure` type) that nothing ever rendered. Dropped both; the
  measure picker/inspector is unchanged otherwise.
- **`agent.planning.strategy` / `allowReplan`** — `AgentPreview`'s Planning rail
  listed both alongside the one live knob. Narrowed the `KeyVals` keys to
  `['maxIterations']` (the only planning field the runtime reads).

Test fixtures that set `certified` were updated. No public component API change.
