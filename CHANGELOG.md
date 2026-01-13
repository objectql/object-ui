# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/objectql/objectui/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/objectql/objectui/releases/tag/v0.1.0
