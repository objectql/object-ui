---
title: "Release Notes"
description: "Release notes for ObjectUI — highlights, breaking changes and migration notes for each version."
---

# Release Notes

This page summarises every released version of ObjectUI. For the granular
package-level changelog, see the monorepo
[CHANGELOG.md](https://github.com/objectstack-ai/objectui/blob/main/CHANGELOG.md).

## v3.3.0 — 2026-04-17 · First Official Release 🚀

v3.3.0 is the **first official release** of ObjectUI published for third-party
consumption. All 39 packages under `packages/*` are now published to npm with
complete release metadata and aligned with `@objectstack/spec` v3.3.0 and
`@objectstack/client` v3.3.0.

### Highlights

- **39 published packages** (`@object-ui/*`, `@objectstack/plugin-ui`) with
  standardized `package.json` metadata, per-package `LICENSE` and
  `CHANGELOG.md`.
- **Standard README template** applied across every package (Installation →
  Quick Start → API → Compatibility → Links → License).
- **Refreshed docs site** with up-to-date architecture overview, plugin
  coverage and schema reference.
- **Thin integration packages** — `@object-ui/app-shell` (~50 KB) and
  `@object-ui/providers` (~10 KB) enable third-party integrations without
  inheriting the full console.
- **Spec v4 alignment** — plain-string `label` types across Navigation
  schemas; Protocol bridges (`DndProtocol`, `KeyboardProtocol`,
  `NotificationProtocol`) updated.
- **Unified Copilot Skills** — single `skills/objectui/` tree aligned with
  shadcn/ui best practices.

### Upgrade Notes

If you were pinning to the earlier `0.x` prerelease tags:

1. Bump every `@object-ui/*` dependency to `^3.3.0`.
2. Ensure peer dependencies match the new baselines
   (`react ^18 || ^19`, `react-dom ^18 || ^19`, TypeScript `>=5.0`).
3. Replace any `i18n` label objects (`{ key, defaultValue }`) on Navigation
   schemas with plain strings — runtime `resolveI18nLabel()` still handles
   both formats for backward compatibility.
4. Remove imports of the deprecated `ViewDesigner` — its capabilities are now
   delivered by `ViewConfigPanel`.

### Compatibility Matrix

| Package | Version |
| --- | --- |
| `@object-ui/*` | `3.3.0` |
| `@objectstack/spec` | `3.3.0` |
| `@objectstack/client` | `3.3.0` |
| React | `18.x` or `19.x` |
| Node.js | `≥ 18` |
| TypeScript | `≥ 5.0` (strict) |
| Tailwind CSS | `≥ 3.4` |

## Previous Versions

See the [monorepo CHANGELOG](https://github.com/objectstack-ai/objectui/blob/main/CHANGELOG.md)
for the full history, including the `0.x` development series.
