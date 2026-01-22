# Scripts Directory

This directory contains utility scripts for maintaining the ObjectUI project.

## Available Scripts

### validate-docs-links.mjs

**Purpose**: Validates all internal links in the documentation to prevent 404 errors.

**Usage**:
```bash
# Run validation
npm run validate:links

# Or directly
node scripts/validate-docs-links.mjs
```

**What it checks**:
- ✅ Links point to existing files and routes
- ✅ Links do NOT incorrectly include `/docs/` prefix
- ✅ Provides suggestions for fixing common issues

**Exit codes**:
- `0` - All links are valid
- `1` - Broken links found

**CI/CD Integration**: This script runs automatically on PRs that modify documentation files via the `.github/workflows/validate-docs-links.yml` workflow.

## Link Conventions

When adding internal links in documentation, follow these patterns:

### ✅ Correct

```markdown
[Quick Start](/guide/quick-start)
[Components](/components)
[API Reference](/reference/api/core)
[Protocol](/reference/protocol/overview)
[Architecture](/architecture/component)
```

### ❌ Incorrect

```markdown
[Quick Start](/docs/guide/quick-start)  <!-- ❌ Don't include /docs/ prefix -->
[API](/api/core)                        <!-- ❌ Should be /reference/api/core -->
[Spec](/spec/component)                 <!-- ❌ Should be /architecture/component -->
```

## Why These Conventions?

Fumadocs is configured with `baseUrl: '/docs'`, which automatically prepends `/docs` to all internal links at runtime. If you include `/docs/` in your markdown links, the final URL will be `/docs/docs/...` (double prefix), causing 404 errors.

## See Also

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Full documentation guidelines
- [Documentation Link Conventions](../CONTRIBUTING.md#documentation-link-conventions)
