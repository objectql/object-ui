---
title: "Versioning & Releases"
description: "How ObjectUI versions and releases work"
---

# Versioning & Releases

ObjectUI follows [Semantic Versioning](https://semver.org/) (SemVer) and uses [Changesets](https://github.com/changesets/changesets) for version management.

## Semantic Versioning

We use SemVer format: `MAJOR.MINOR.PATCH`

### Version Numbers

- **MAJOR** (1.0.0) - Incompatible API changes
- **MINOR** (0.1.0) - New features, backwards compatible
- **PATCH** (0.0.1) - Bug fixes, backwards compatible

### Examples

```
0.1.0 → 0.1.1   # Patch: Bug fix
0.1.1 → 0.2.0   # Minor: New feature
0.2.0 → 1.0.0   # Major: Breaking change
```

## Pre-1.0 Releases

Currently, ObjectUI is in **beta** (version 0.x.x). During this phase:

- **Minor versions** (0.x.0) may include breaking changes
- **Patch versions** (0.0.x) are for bug fixes and minor improvements
- We aim for API stability but reserve the right to make changes

**Target for 1.0.0**: Q2 2026

## Release Schedule

### Regular Releases

- **Minor releases**: Every 4-6 weeks
- **Patch releases**: As needed for bug fixes
- **Major releases**: When breaking changes are necessary

### Security Releases

Critical security fixes are released immediately as patch versions.

## Package Versioning

All packages in the ObjectUI monorepo are versioned together:

```json
{
  "@object-ui/core": "0.3.0",
  "@object-ui/react": "0.3.0",
  "@object-ui/components": "0.3.0",
  "@object-ui/designer": "0.3.0"
}
```

**Why unified versioning?**
- Simpler dependency management
- Ensures compatibility between packages
- Clearer release communication

## Changelog

All changes are documented in [CHANGELOG.md](/CHANGELOG.md) following [Keep a Changelog](https://keepachangelog.com/) format.

### Changelog Categories

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security fixes

## Release Process

### 1. Development

Contributors create changesets when making changes:

```bash
# Add a changeset
pnpm changeset

# Follow prompts to:
# - Select affected packages
# - Choose version bump type (major/minor/patch)
# - Write change description
```

### 2. Version Bump

When ready to release:

```bash
# Update versions based on changesets
pnpm changeset:version

# This updates package.json files and CHANGELOG.md
```

### 3. Publish

```bash
# Build all packages
pnpm build

# Publish to npm
pnpm changeset:publish

# Push changes and tags
git push --follow-tags
```

### 4. GitHub Release

Create a GitHub release from the tag with:
- Version number
- Release notes from CHANGELOG
- Highlights of major changes
- Migration guide (if breaking changes)

## Version Compatibility

### React Version Compatibility

| ObjectUI Version | React Version |
|-----------------|---------------|
| 0.1.x - 0.3.x   | 18.x - 19.x   |
| 1.0.x (planned) | 18.x - 19.x   |

### Tailwind Version Compatibility

| ObjectUI Version | Tailwind Version |
|-----------------|------------------|
| 0.1.x - 0.3.x   | 3.x - 4.x        |
| 1.0.x (planned) | 3.x - 4.x        |

### Node.js Version Compatibility

| ObjectUI Version | Node.js Version |
|-----------------|-----------------|
| 0.1.x - 0.3.x   | 18.x+           |
| 1.0.x (planned) | 18.x+           |

## Breaking Changes

### What Constitutes a Breaking Change?

- Removing or renaming public APIs
- Changing function signatures
- Removing component props
- Changing default behavior that affects existing code
- Updating minimum dependency versions

### Migration Guides

For releases with breaking changes, we provide:
- Detailed migration guide in [/docs/migration](/migration/)
- Before/after code examples
- Automated migration tools (when possible)
- Deprecation warnings in advance

## Deprecation Policy

### Deprecation Process

1. **Announcement** - Feature marked as deprecated in docs
2. **Warning Period** - At least one minor version
3. **Removal** - In next major version

### Example Timeline

```
v0.9.0: Feature X deprecated (warning added)
v0.10.0: Still available but deprecated
v1.0.0: Feature X removed
```

## Pre-releases

### Beta Releases

Beta versions are tagged and published to npm:

```bash
npm install @object-ui/react@beta
```

### Alpha Releases

For experimental features, alpha versions may be published:

```bash
npm install @object-ui/react@alpha
```

### Nightly Builds

Not currently available, but planned for future.

## Stability Guarantees

### Stable APIs

These packages/APIs are considered stable:
- `@object-ui/types` - Type definitions
- `@object-ui/core` - Core functionality
- `@object-ui/react` - React bindings
- `@object-ui/components` - Base components

### Experimental APIs

Features marked as "experimental" may change without notice:
- Documented with `@experimental` tag
- May have separate import paths
- No semver guarantees

## Release Notes

### Where to Find Release Notes

- [CHANGELOG.md](/CHANGELOG.md) - Detailed changes
- [GitHub Releases](https://github.com/objectstack-ai/objectui/releases) - Release highlights
- [Blog](https://blog.objectui.org) - Feature announcements
- [Twitter](https://twitter.com/objectui) - Quick updates

### Release Note Format

Each release includes:
- Version number and date
- Summary of changes
- Breaking changes (if any)
- Migration instructions (if needed)
- Notable improvements
- Bug fixes
- Contributors

## Upgrade Guide

### Patch Updates (Safe)

```bash
# Update to latest patch version
npm update @object-ui/react
```

### Minor Updates (Usually Safe)

```bash
# Update to specific minor version
npm install @object-ui/react@0.3.0
```

### Major Updates (Requires Care)

1. Read migration guide
2. Update dependencies
3. Run tests
4. Fix any breaking changes
5. Deploy with monitoring

## Contributing to Releases

### Adding a Changeset

When your PR introduces changes:

```bash
# Add changeset
pnpm changeset

# Answer prompts:
# Which packages changed? @object-ui/react
# What's the bump type? minor
# What changed? Added new feature X
```

### Writing Good Changelogs

**Good:**
```
Added support for dynamic forms with conditional fields
```

**Better:**
```
Added support for dynamic forms with conditional fields.
Forms can now show/hide fields based on other field values
using the new `visibleOn` property.
```

**Best:**
```
Added support for dynamic forms with conditional fields (#123)

Forms can now show/hide fields based on other field values
using the new `visibleOn` property. This enables complex
multi-step forms and dependent field scenarios.

Example:
{
  "visibleOn": "${data.userType === 'premium'}"
}

See docs for full details: /docs/concepts/expressions
```

## Version Support

### Long-Term Support (LTS)

Currently no LTS versions. Planned for post-1.0.

### Support Timeline

- **Current version**: Full support
- **Previous minor**: Security fixes only
- **Older versions**: No support

### Example

```
v0.3.x: Full support (current)
v0.2.x: Security fixes only
v0.1.x: No support
```

## Questions?

- 💬 [Discussions](https://github.com/objectstack-ai/objectui/discussions)
- 📧 [Email](mailto:hello@objectui.org)

---

Last updated: January 2026
