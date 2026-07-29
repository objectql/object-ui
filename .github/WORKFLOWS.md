# GitHub Workflows Documentation

This document describes the automated workflows configured for the Object UI repository.

## Overview

Our GitHub Actions workflows automate testing, security scanning, dependency management, and deployment processes. All workflows are located in `.github/workflows/`.

## Workflows

### 1. CI (Continuous Integration)

**File**: `ci.yml`  
**Triggers**: Push to `main`/`develop`, Pull Requests

This is the main CI pipeline that ensures code quality.

**Jobs**:
- **Test**: Runs tests on Node.js 22.x
  - Executes unit and integration tests
  - Generates coverage reports
  - Uploads coverage to Codecov
  
- **Lint**: Checks code style and quality
  - Runs ESLint on all packages
  - Ensures code follows project standards
  
- **Build**: Validates that all packages build successfully
  - Builds all packages in the monorepo
  - Verifies build artifacts are created

**Optimizations**:
- Uses pnpm store caching for faster dependency installation
- Runs jobs in parallel when possible

### 2. CodeQL Security Scan

**File**: `codeql.yml`  
**Triggers**: Push to `main`/`develop`, Pull Requests, Weekly schedule (Mondays)

Analyzes code for security vulnerabilities using GitHub's CodeQL engine.

**Features**:
- Scans JavaScript/TypeScript code
- Uses security-extended and security-and-quality query packs
- Runs automatically on schedule to catch new vulnerabilities
- Results visible in Security tab

### 3. PR Checks

**File**: `pr-checks.yml`  
**Triggers**: Pull Request opened/synchronized/reopened

Validates pull requests and provides feedback.

**Actions**:
- Runs type checking (via build)
- Executes tests
- Runs linter (continues on error)
- Posts success comment when all checks pass

### 4. Auto Label PRs

**File**: `labeler.yml`  
**Configuration**: `labeler.yml`  
**Triggers**: Pull Request opened/synchronized/reopened

Automatically labels PRs based on changed files.

**Labels Applied**:
- Package-specific labels (e.g., `package: core`, `package: react`)
- Plugin labels (e.g., `plugin: charts`)
- Category labels (e.g., `documentation`, `tests`, `configuration`)
- Scope labels (e.g., `examples`, `apps`, `ci/cd`)

### 5. Bundle Size Check

**File**: `size-check.yml`  
**Triggers**: Pull Requests (when package files change)

Reports bundle size changes in PR comments.

**Features**:
- Calculates size of built packages
- Reports both raw and gzipped sizes
- Shows size warnings for large packages
- Posts results as PR comment

**Size Limits**:
- Core packages: < 50KB gzipped
- Component packages: < 100KB gzipped
- Plugin packages: < 150KB gzipped

### 6. Deploy Documentation

**File**: `deploy-docs.yml`  
**Triggers**: Push to `main` (docs changes), Manual workflow dispatch

Builds and deploys documentation to GitHub Pages.

**Steps**:
1. Builds VitePress documentation
2. Uploads artifact to GitHub Pages
3. Deploys to production

**Access**: Documentation available at https://www.objectui.org

### 7. Release

**File**: `release.yml`  
**Triggers**: Push of version tags (e.g., `v1.0.0`)

Creates GitHub releases and publishes packages.

**Process**:
1. Runs tests to ensure quality
2. Builds all packages
3. Creates GitHub release with changelog
4. (Optional) Publishes to npm registry

**Note**: npm publishing is currently disabled. Uncomment the publish step when ready.

### 8. Changeset Release (Automated)

**File**: `changeset-release.yml`  
**Triggers**: Push to `main` branch

Automated version management and package publishing using Changesets.

**What It Does**:
1. Detects changesets in merged PRs
2. Creates/updates a "Version Packages" PR that:
   - Bumps package versions based on changesets
   - Updates CHANGELOG.md files
   - Removes consumed changeset files
3. When the Version PR is merged:
   - Publishes updated packages to npm
   - Creates GitHub releases with tags

**How It Works**:

```mermaid
graph LR
    A[PR with changeset merged] --> B[Workflow runs]
    B --> C{Changesets exist?}
    C -->|Yes| D[Create/Update Version PR]
    C -->|No| E[Skip]
    D --> F[Version PR merged]
    F --> G[Publish to npm]
    G --> H[Create GitHub Release]
```

**Developer Workflow**:
1. Create PR with code changes
2. Run `pnpm changeset` to create a changeset file
3. Commit changeset file with your PR
4. When PR is merged, automation takes over
5. Review and merge the automated "Version Packages" PR
6. Packages are published automatically

**Benefits**:
- No manual version number editing
- Automatic changelog generation
- Coordinated releases across packages
- Clear versioning based on semantic versioning
- Prevents accidental version conflicts

**Required Setup**:
- `NPM_TOKEN` secret must be configured in repository settings
- Changesets should be included in all PRs with package changes

**Note**: See [CONTRIBUTING.md](../CONTRIBUTING.md#versioning-and-releases) for details on creating changesets.

### 9. Changeset Check

**File**: `changeset-check.yml`  
**Triggers**: Pull Requests (opened, synchronized, labeled)

Ensures PRs that modify packages include a changeset.

**What It Does**:
- Checks if PR modifies any files in `packages/`
- Verifies a changeset file exists (`.changeset/*.md`)
- Fails the check if changeset is missing
- Can be skipped with `skip-changeset` or `dependencies` label

**When to Skip**:
- Documentation-only changes
- Changes to examples or apps
- Test-only updates
- Automated dependency updates (Dependabot)

**How to Pass**:
1. Run `pnpm changeset` locally
2. Follow the prompts to create a changeset
3. Commit the generated `.changeset/*.md` file
4. OR add `skip-changeset` label if not needed

This workflow helps maintain consistent versioning and comprehensive changelogs.

### 10. Stale Issues & PRs

**File**: `stale.yml`  
**Triggers**: Daily schedule, Manual workflow dispatch

Manages stale issues and pull requests.

**Configuration**:
- Issues: Marked stale after 60 days, closed after 7 more days
- PRs: Marked stale after 45 days, closed after 14 more days
- Exempt labels: `pinned`, `security`, `critical`, `bug`, `enhancement`
- Can be reopened if activity resumes

### 11. Dependabot Auto-merge

**File**: `dependabot-auto-merge.yml`  
**Configuration**: `dependabot.yml`  
**Triggers**: Dependabot pull requests

Automatically manages dependency updates.

**Behavior**:
- **Patch/Minor updates**: Auto-approved and auto-merged
- **Major updates**: Commented for manual review
- Only merges after CI checks pass

**Dependabot Configuration**:
- Weekly npm dependency updates (Mondays)
- Weekly GitHub Actions updates
- Groups related dependencies
- Limits to 10 open PRs

### 12. Auto Changelog

**File**: `changelog.yml`  
**Triggers**: Release published, Manual workflow dispatch

Generates and updates CHANGELOG.md from git history.

**Note**: Requires `cliff.toml` configuration file for customization.

## Security Features

### CodeQL Analysis
- Continuous security monitoring
- Detects common vulnerabilities:
  - SQL injection
  - XSS vulnerabilities
  - Path traversal
  - Command injection
  - Sensitive data exposure

### Dependabot
- Automated dependency updates
- Security vulnerability alerts
- Grouped updates by category
- Auto-merge for safe updates

### Permissions
All workflows follow the principle of least privilege:
- Read-only access by default
- Write permissions only when needed
- Explicit permission declarations

## Issue & PR Templates

### Issue Templates
- **Bug Report**: Structured bug reporting with environment details
- **Feature Request**: Feature proposals with use cases
- **Config**: Links to Discord, documentation, and discussions

### Pull Request Template
- Comprehensive checklist
- Change type classification
- Testing requirements
- Breaking change documentation
- Migration guide section

## Workflow Badges

Add these badges to show workflow status:

```markdown
[![CI](https://github.com/objectstack-ai/objectui/workflows/CI/badge.svg)](https://github.com/objectstack-ai/objectui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/objectstack-ai/objectui/workflows/CodeQL%20Security%20Scan/badge.svg)](https://github.com/objectstack-ai/objectui/actions/workflows/codeql.yml)
```

## Best Practices

### For Contributors
1. **Run checks locally first**: Use `pnpm lint`, `pnpm test`, `pnpm build`
2. **Keep PRs focused**: One feature or fix per PR
3. **Watch workflow results**: Fix failures promptly
4. **Update documentation**: For user-facing changes

### For Maintainers
1. **Review auto-merge settings**: Verify Dependabot merges are safe
2. **Monitor security alerts**: Act on CodeQL findings
3. **Manage stale items**: Review before auto-closure
4. **Keep workflows updated**: Regular dependency updates for actions

## Troubleshooting

### Common Issues

**Problem**: CI fails with "pnpm: command not found"
- **Solution**: Ensure `pnpm/action-setup@v4` is configured correctly

**Problem**: Tests timeout
- **Solution**: Increase timeout in workflow or optimize tests

**Problem**: Bundle size check fails
- **Solution**: Review size report, optimize imports, use code splitting

**Problem**: CodeQL analysis fails
- **Solution**: Check for syntax errors, review CodeQL logs

### Getting Help

- Check [GitHub Actions documentation](https://docs.github.com/en/actions)
- Review workflow logs in Actions tab
- Ask in Discord community
- Create an issue for workflow problems

## Maintenance

### Regular Tasks
- [ ] Review and update GitHub Actions versions monthly
- [ ] Monitor CodeQL findings weekly
- [ ] Review Dependabot PRs weekly
- [ ] Update workflow documentation for changes
- [ ] Review stale item closure weekly

### Updating Workflows
1. Test changes in a fork first
2. Use workflow dispatch for manual testing
3. Update documentation
4. Monitor first few runs after changes

## Automatic Lockfile Merge Resolution

### Overview

The repository is configured to automatically resolve merge conflicts in `pnpm-lock.yaml` using a custom Git merge driver. This prevents manual intervention when lockfile conflicts occur during branch merges or automated workflows.

### How It Works

**Repository Configuration** (`.gitattributes`):
```
pnpm-lock.yaml merge=pnpm-merge
```

This tells Git to use the `pnpm-merge` driver when merging `pnpm-lock.yaml` files.

**Workflow Configuration** (Applied in CI workflows):
```yaml
- name: Configure Git merge driver for pnpm-lock.yaml
  run: |
    # Configure custom merge driver for pnpm-lock.yaml
    # This allows Git to automatically resolve lockfile conflicts by regenerating it
    git config merge.pnpm-merge.name "pnpm-lock.yaml merge driver"
    git config merge.pnpm-merge.driver "pnpm install --no-frozen-lockfile"
```

### When It's Used

This configuration is active in the following workflows:
- **Changeset Release** (`changeset-release.yml`): Handles lockfile updates during version bumping
- **Auto Changelog** (`changelog.yml`): Prevents conflicts during automated changelog updates

### Adding to New Workflows

If you create a workflow that performs git merge operations or might encounter lockfile conflicts, add the configuration step **after checkout** and **before any merge operation**:

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4
    with:
      fetch-depth: 0

  - name: Configure Git merge driver for pnpm-lock.yaml
    run: |
      git config merge.pnpm-merge.name "pnpm-lock.yaml merge driver"
      git config merge.pnpm-merge.driver "pnpm install --no-frozen-lockfile"

  # ... rest of your workflow steps including merge operations
```

### Benefits

- **Fully Automated**: No manual intervention needed for lockfile conflicts
- **Clean Repository**: Configuration is temporary (CI-only), doesn't modify repository files
- **Reliable**: Uses pnpm's built-in dependency resolution to regenerate lockfiles
- **Consistent**: Ensures lockfiles are always in sync with package.json changes

### Local Development

For local development, contributors can configure the same merge driver by following the instructions in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Future Enhancements

Potential workflow additions:
- [ ] Visual regression testing
- [ ] Performance benchmarking
- [ ] Automated canary releases
- [ ] Integration tests with examples
- [ ] Automated component documentation generation
- [ ] npm package publishing automation

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)
