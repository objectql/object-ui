---
"@object-ui/core": minor
---

ADR-0080 M5: curated PUBLIC block contract (capability ≠ contract). Adds `PUBLIC_BLOCKS` — the single, reviewable list of ~36 object-aware + layout/content blocks that form the AI/contract surface (Salesforce-App-Builder-shaped). `getPublicConfigs()` now returns the curated set (plus any `tier:'public'` opt-in), keyed by bare tag and deduped across the registry's dual-key registrations. The full ~244 registered types remain a rendering capability.
