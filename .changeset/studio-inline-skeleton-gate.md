---
"@object-ui/app-shell": patch
---

test(studio): extend the create-conformance gate to the inline pillar creators

`createConformance.test.ts` guards that every authorable type's default
create-form output passes spec validation — catching the recurring "the designer
emits a minimal shape the spec rejects, so create→save 422s" dead-end family. But
it read only the metadata-admin registry, so the Studio's **inline** "New X"
creators (Data → object, Automations → flow, Interfaces → app, Access →
permission) — which build their skeletons directly in `StudioDesignSurface.tsx`,
bypassing the registry — were **uncovered**. A future edit to one of those shapes
could turn its "New" button into a silent dead-end with nothing to catch it.

Extracted the four inline skeletons into pure, exported builders
(`studio-design/skeletons.ts`) consumed by BOTH the pillars and a new gate block,
so the test can't drift from what the "New" button actually emits. No behavior
change — the builders return the byte-identical skeletons. The gate now covers all
create paths (registry + inline); the four inline skeletons validate clean.
