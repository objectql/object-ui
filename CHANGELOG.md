# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **@objectstack v3.0.4 Upgrade**: Upgraded all `@objectstack/*` packages from `^3.0.2` to `^3.0.4` across 42 references
- **@objectstack v3.0.0 Upgrade**: Upgraded all `@objectstack/*` packages from `^2.0.7` to `^3.0.0` across 13 package.json files
- **Breaking change migrations**:
  - `Hub` namespace → `Cloud` in @object-ui/types re-exports
  - `definePlugin` removed (only `defineStack` remains)
  - `PaginatedResult.value` → `.records` across all data plugins and adapters
  - `PaginatedResult.count` → `.total` in data-objectstack adapter
  - `client.meta.getObject()` → `client.meta.getItem('object', name)` in data adapter
- Updated spec version references across ROADMAP.md, SPEC_COMPLIANCE_EVALUATION.md, OBJECTSTACK_CLIENT_EVALUATION.md, and console docs
- Updated ROADMAP with v3.0.0 migration table and next phase roadmap (N.1-N.5)
- Updated namespace-exports tests to reflect v3.0.0 exports

### Added

- **Preview Mode** (`@object-ui/auth`): New `previewMode` prop on `AuthProvider` for auto-login with simulated identity — skip login/registration for marketplace demos and app showcases. Includes `PreviewBanner` component, `isPreviewMode` / `previewMode` on `useAuth()`, and `PreviewModeOptions` type. Aligns with `@objectstack/spec` kernel `PreviewModeConfig`.
- **Discovery Preview Detection** (`@object-ui/react`): Extended `DiscoveryInfo` with `mode` and `previewMode` fields for server-driven preview mode detection.
- **Console Preview Support**: `ConditionalAuthWrapper` auto-detects `mode === 'preview'` from server discovery and configures auth accordingly.
- **Console Bundle Optimization**: Split monolithic 3.7 MB main chunk into 17 granular cacheable chunks via `manualChunks` — main entry reduced from 1,008 KB gzip to 48.5 KB gzip (95% reduction)
- **Gzip + Brotli Compression**: Pre-compressed assets via `vite-plugin-compression2` — Brotli main entry at 40 KB
- **Bundle Analysis**: Added `rollup-plugin-visualizer` generating interactive treemap at `dist/stats.html`; new `build:analyze` script
- **Lazy MSW Loading**: MSW mock server now loaded via dynamic `import()` — fully excluded from `build:server` output (~150 KB gzip saved)
- **ROADMAP Console v1.0 Section**: Added production release optimization roadmap with detailed before/after metrics

---

## [0.3.1] - 2026-01-27

### Changed

- Maintenance release - Documentation and build improvements
- Updated internal dependencies across all packages

---

## [0.3.0] - 2026-01-17

### Added

- **New Plugin**: `@object-ui/plugin-object` - ObjectQL plugin for automatic table and form generation
  - `ObjectTable`: Auto-generates tables from ObjectQL object schemas
  - `ObjectForm`: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
  - Full TypeScript support with comprehensive type definitions
- **Type Definitions**: Added `ObjectTableSchema` and `ObjectFormSchema` to `@object-ui/types`
- **ObjectQL Integration**: Enhanced `ObjectQLDataSource` with `getObjectSchema()` method using MetadataApiClient

### Changed

- Updated `@objectql/sdk` from ^1.8.3 to ^1.9.1
- Updated `@objectql/types` from ^1.8.3 to ^1.9.1

---

## [0.2.1] - 2026-01-15

### Changed

- Fixed changeset configuration to remove non-existent @apps/* pattern
- Added automated changeset-based version management and release workflow
- Enhanced CI/CD workflows with GitHub Actions
- Improved documentation for contributing and releasing

## [0.2.0] - 2026-01-15

### Added

- Comprehensive test suite using Vitest and React Testing Library
- Test coverage for @object-ui/core, @object-ui/react, @object-ui/components, and @object-ui/designer packages
- GitHub Actions CI/CD workflows:
  - CI workflow for automated testing, linting, and building
  - Release workflow for publishing new versions
- Test coverage reporting with @vitest/coverage-v8
- Contributing guidelines (CONTRIBUTING.md)
- Documentation for testing and development workflow in README
- README files for all core packages

### Changed

- Updated package.json scripts to use Vitest instead of placeholder test commands
- Enhanced README with testing instructions and CI status badges

## [0.1.0] - Initial Release

### Added

- Core packages:
  - @object-ui/core - Core logic, types, and validation (Zero React dependencies)
  - @object-ui/react - React bindings and SchemaRenderer component
  - @object-ui/components - Standard UI components built with Tailwind CSS & Shadcn
  - @object-ui/designer - Drag-and-drop visual editor
- Monorepo structure using pnpm workspaces
- Basic TypeScript configuration
- Example applications in the examples directory
- Complete documentation site with VitePress

[0.3.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.3.0
[0.2.1]: https://github.com/objectstack-ai/objectui/releases/tag/v0.2.1
[0.2.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.2.0
[0.1.0]: https://github.com/objectstack-ai/objectui/releases/tag/v0.1.0
