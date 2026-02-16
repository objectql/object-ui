# Changelog

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1
- @object-ui/core@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/core@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0

## 0.3.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.1.2

### Patch Changes

- Updated dependencies
  - @object-ui/types@0.3.0
  - @object-ui/core@0.2.2

## 0.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@0.2.1
  - @object-ui/core@0.2.1

All notable changes to the Object UI VSCode extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of Object UI VSCode extension
- Syntax highlighting for Object UI JSON schemas
- IntelliSense and auto-completion for component types and properties
- Live preview functionality with auto-refresh
- Schema validation with real-time error checking
- Code snippets for common patterns (forms, cards, layouts, etc.)
- Export to React component functionality
- Schema formatting command
- Template-based schema creation
- Hover documentation for properties and components
- Support for `.objectui.json` and `.oui.json` file extensions

### Features

- **Preview System**: Side-by-side live preview of schemas
- **Validation**: Real-time validation with helpful error messages
- **Snippets**: 12+ code snippets for rapid development
- **IntelliSense**: Context-aware auto-completion
- **Export**: One-click export to React components

## [0.1.0] - TBD

### Added

- Initial beta release
- Core functionality for Object UI schema development
- Documentation and examples
