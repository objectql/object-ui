---
"@object-ui/app-shell": patch
---

fix(studio): flow wait-node inspector tolerates the loose `config` shape

The wait-node property form read only the spec-canonical
`waitEventConfig.{eventType,signalName,…}`, but the engine also accepts a looser
`config.{eventType,…}` shape — which the canonical `showcase_budget_approval`
(and AI-authored flows) use. So a showcase-shaped wait node opened in the
designer showed blank "Wait for" / "Signal name" fields.

Flow config fields gain an optional `fallbackPath`: reads fall back to it (so
loose-shape wait nodes display, and dependent fields reveal), writes target the
canonical path and prune the fallback (migrate-on-edit), and the fallback's
config key is suppressed from the Advanced block. The `wait` fields now fall
back to `config.*`, so the designer matches the engine's tolerance. Pairs with
the ADR-0044 revise-loop authoring (#1954).
