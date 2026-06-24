---
'@object-ui/app-shell': patch
---

Designer derives create defaults from the spec's create seed (/meta/types)

The metadata create flow now builds a new item's body from the server's authoritative `createSeed` (delivered per type on the `/meta/types` registry entry — the single source of truth in `@objectstack/spec`) instead of the locally hardcoded `createDefaults`, falling back to `createDefaults` when the server provides no seed (older server, or canvas-create types). This closes the drift loop behind the "designer emits a minimal shape the spec rejects → create→save 422" family (dashboard `layout`, action `body`): the structural create defaults now come from the same place the spec validates against, so they cannot diverge. Extracted as the pure, unit-tested `buildCreateModeBody`.
