/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

/**
 * Registers the plugin blocks the **catalog gallery** renders. A companion to
 * `./registerLayoutBlocks`, which every example host imports directly and which
 * this module deliberately does NOT re-export: `scripts/__tests__/site-
 * playground-layout-registration-3904.test.ts` discovers each `SchemaRenderer`
 * host and reads its imports, so a host reaching the layout registrar through
 * here would read as a host that registers nothing. Two imports, two
 * responsibilities, one visible in each host.
 *
 * Why this exists (objectui#4600): `ComponentRegistry` only knows a type once
 * the package owning it has been loaded, and `/docs/guide/schema-catalog`
 * loads no plugin at all — `SchemaCatalogIndex` -> `SchemaThumbnail` imported
 * `@object-ui/react`, `@object-ui/components` and the layout blocks, and
 * nothing else. `PluginLoader` covers the individual docs pages that embed a
 * demo, but the gallery embeds EVERY example and never wraps them in one.
 *
 * Measured on `origin/main` before this file: all 9 `plugin-dashboard` entries
 * rendered the registry's red "Unknown component type: dashboard (OBJUI-001)"
 * panel in the gallery — not the dashboard, and not the retired-widget
 * placeholder that the entries produce once the plugin IS loaded. This is the
 * objectui#3787 defect one layer up: there it was `page-header` resolving to
 * nothing, here it is the whole `dashboard` block.
 *
 * `@object-ui/plugin-charts` comes with it because it owns `chart` — what a
 * dashboard's widgets (static, provider-backed and dataset-bound alike) draw
 * with, and the root type of the `plugin-charts/*` catalog entries.
 *
 * EAGER, at module scope, for the same reason `./registerLayoutBlocks` is
 * eager: registration has then already happened for the server render, so the
 * thumbnails stay in the prerendered HTML instead of appearing on hydration.
 * Neither package declares `sideEffects: false`, so a bare side-effect import
 * survives bundling (checked); the layout package is the one that needs an
 * explicit call, which its own module does.
 *
 * Deliberately NOT imported by `InteractiveDemo` / `LiveSplitDemo`: those host
 * demos on ordinary docs pages, which opt into their plugins through
 * `PluginLoader`, and making them eager would pull the chart + dashboard graphs
 * into every page carrying any demo. The gallery page's own modal preview is
 * unaffected — it renders after `SchemaThumbnail` has already registered these
 * on that page.
 *
 * Guarded by `examples/schema-catalog/test/plugin-dashboard-gallery-render.
 * test.tsx`, which mirrors this registration set and fails if this file stops
 * loading either package.
 */
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';
