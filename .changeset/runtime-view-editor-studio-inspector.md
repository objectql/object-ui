---
"@object-ui/app-shell": minor
"@object-ui/plugin-view": minor
---

Unify the runtime ObjectView "view editor" onto the studio's spec-driven inspector. The right-rail view editor now hosts the same `ViewVariantInspector` the metadata studio uses (config fields sourced straight from `@objectstack/spec`) instead of the legacy `buildViewConfigSchema` engine, so runtime and studio share one view-editing surface. A new `view-config-adapter` bridges the runtime's flat view shape and the studio's ViewItem draft, keeping the `sys_view` persistence path untouched; field pickers read from the in-memory object definition (no extra network fetch). The legacy `buildViewConfigSchema` engine and its exports are retired; `ConfigPanelRenderer` is retained for the dashboard/report config panels.
