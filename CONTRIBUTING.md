# Contributing to Object UI

Thank you for your interest in contributing to Object UI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Architecture Overview](#architecture-overview)
- [Writing Tests](#writing-tests)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Adding Components](#adding-components)
- [Questions & Support](#questions--support)

## Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **pnpm** (recommended package manager)
- **Git** for version control
- Basic knowledge of React, TypeScript, and Tailwind CSS

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/objectui.git
   cd objectui
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/objectstack-ai/objectui.git
   ```

## Development Setup

### Install Dependencies

```bash
# Install pnpm if you haven't
npm install -g pnpm

# Install project dependencies
pnpm install
```

### Configure Git Merge Driver for pnpm-lock.yaml

To prevent merge conflicts in `pnpm-lock.yaml`, configure the custom merge driver:

```bash
# Set the merge driver name
git config merge.pnpm-merge.name "pnpm-lock.yaml merge driver"

# Set the merge driver command
git config merge.pnpm-merge.driver "pnpm install"
```

This configuration allows Git to automatically resolve conflicts in `pnpm-lock.yaml` by regenerating the lockfile using `pnpm install` instead of attempting a manual merge.

### Create a Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create a feature branch
git checkout -b feature/your-feature-name
```

## Development Workflow

### Running Development Servers

```bash
# Run the console app — the main dev playground (app shell + the full plugin set,
# including the visual designer, which mounts here rather than in a demo of its own)
pnpm dev

# Run an example app (console-starter and byo-backend-console are the two that ship
# a dev server; hello-world has none, and schema-catalog is a data package)
pnpm --filter @object-ui/example-console-starter dev

# Run the documentation site
pnpm site:dev
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/core && pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI (interactive)
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
cd packages/react && pnpm lint
```

## Architecture Overview

Object UI follows a modular monorepo architecture:

```
packages/
├── types/          # TypeScript type definitions (Zero dependencies)
├── core/           # Core logic, validation, registry (Zero React)
├── react/          # React bindings and SchemaRenderer
├── components/     # UI components (Tailwind + Shadcn)
├── designer/       # Visual schema editor
├── plugin-charts/  # Chart components plugin
└── plugin-editor/  # Rich text editor plugin
```

### Key Principles

1. **Protocol Agnostic**: Core never depends on specific backends
2. **Tailwind Native**: All styling via Tailwind utility classes
3. **Type Safety**: Strict TypeScript everywhere
4. **Tree Shakable**: Modular imports, no monolithic bundles
5. **Zero React in Core**: Core package has no React dependencies

See the [Architecture Overview](./content/docs/guide/architecture.md) guide for details.

## Writing Tests

### Test Structure

All tests should be placed in `__tests__` directories within the source code. We use **Vitest** and **React Testing Library**.

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
  
  it('should handle user interaction', async () => {
    const { user } = render(<MyComponent />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Clicked')).toBeInTheDocument()
  })
})
```

### Testing Best Practices

- Write tests for all new features
- Test user interactions, not implementation details
- Use meaningful test descriptions
- Maintain or improve code coverage (current thresholds: 63% lines, 43% functions, 40% branches, 62% statements)
- Aim to gradually increase coverage toward the long-term goal of 80%+ across all metrics
- Test edge cases and error states

## Code Style

### TypeScript Guidelines

```typescript
// ✅ Good: Explicit types, clear naming
interface UserData {
  id: string
  name: string
  email: string
}

function getUserById(id: string): UserData | null {
  // implementation
}

// ❌ Bad: Implicit any, unclear naming
function get(x) {
  // implementation
}
```

### React Component Guidelines

```tsx
// ✅ Good: TypeScript, named exports, clear props
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' ? 'bg-blue-500' : 'bg-gray-500'
      )}
    >
      {label}
    </button>
  )
}

// ❌ Bad: No types, default export, inline styles
export default function Button(props) {
  return <button style={{ color: 'blue' }}>{props.label}</button>
}
```

### Styling Guidelines

- **Always use Tailwind**: Never use inline styles or CSS modules
- **Use `cn()` utility**: For conditional classes
- **Extract repeated classes**: Create reusable class combinations
- **Follow Shadcn patterns**: Match the style of existing components

```tsx
// ✅ Good
<div className={cn(
  'flex items-center gap-2 p-4',
  isActive && 'bg-blue-50',
  className
)}>
  {children}
</div>

// ❌ Bad
<div style={{ display: 'flex', padding: '16px' }}>
  {children}
</div>
```

### General Guidelines

- Use meaningful variable and function names
- Keep functions small and focused (< 50 lines)
- Add JSDoc comments for public APIs
- Avoid deep nesting (max 3 levels)
- Use early returns to reduce complexity

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Commit Types

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks (deps, config)
- `refactor:` - Code refactoring (no behavior change)
- `perf:` - Performance improvements
- `style:` - Code style changes (formatting)

### Examples

```bash
feat: add date picker component
fix: resolve schema validation error
docs: update installation guide
test: add tests for SchemaRenderer
chore: update dependencies
refactor: simplify expression evaluator
```

### Commit Message Format

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

## Pull Request Process

### Before Submitting

1. **Update from upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a changeset** (for package changes):
   ```bash
   pnpm changeset
   ```
   
   This will prompt you to:
   - Select which packages have changed
   - Choose the version bump type (major, minor, patch)
   - Write a summary of the changes
   
   Learn more about changesets in the [Versioning and Releases](#versioning-and-releases) section.

3. **Ensure tests pass**:
   ```bash
   pnpm test
   ```

4. **Ensure build succeeds**:
   ```bash
   pnpm build
   ```

5. **Update documentation** if needed

6. **Add tests** for new features

### Creating the PR

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to GitHub and create a Pull Request

3. Fill in the PR template:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes
   - Breaking changes (if any)

### PR Guidelines

- Keep PRs focused (one feature/fix per PR)
- Write clear, descriptive PR titles
- Include before/after screenshots for UI changes
- Respond to review comments promptly
- Keep commits clean and meaningful

### Automated Workflows

Our repository includes several automated GitHub workflows that will run when you create a PR:

#### CI Pipeline
- **Linting**: Checks code style and quality
- **Type Checking**: Validates TypeScript types
- **Tests**: Runs unit and integration tests
- **Build**: Ensures all packages build successfully
- **Matrix Testing**: Tests on Node.js 18.x and 20.x
- **Coverage Thresholds**: Enforces minimum test coverage (see below)

##### Test Coverage Requirements
The project enforces minimum test coverage thresholds to maintain code quality:
- **Lines**: 63% (target: gradually increase to 80%)
- **Functions**: 43% (target: gradually increase to 80%)
- **Branches**: 40% (target: gradually increase to 75%)
- **Statements**: 62% (target: gradually increase to 80%)

These thresholds are intentionally set just below current coverage levels to prevent CI failures from minor fluctuations while we improve test coverage. New code should aim for higher coverage than these minimums.

#### Security Scans
- **CodeQL**: Scans for security vulnerabilities in code
- **Dependency Scanning**: Checks for known vulnerabilities in dependencies

#### PR Automation
- **Auto-labeling**: Automatically labels PRs based on changed files
- **Bundle Size**: Reports bundle size changes in PR comments
- **PR Checks**: Validates PR requirements and posts status

#### What to Expect
1. All checks must pass before merging
2. Failed checks will show detailed error messages
3. Some workflows (like auto-labeling) run automatically
4. Review the check results and fix any issues

#### Tips for Passing Checks
- Run `pnpm lint` before committing
- Run `pnpm test` to catch test failures early
- Run `pnpm build` to ensure successful builds
- Keep dependencies up to date
- Follow TypeScript strict mode requirements

## Documentation

### Writing Documentation

We use fumadocs for documentation. The published pages live in `content/docs/**` — that root is declared once, in `apps/site/source.config.ts` (`dir: '../../content/docs'`) — and a file's path below it becomes its route under `/docs`. New and updated documentation pages go there.

The repository root also has a `docs/` directory, and it is **not** part of the site: it holds internal engineering material (ADRs, audits, architecture notes) that the fumadocs collection never reads, so none of it is rendered or reachable at a `/docs/...` route. A page filed there never reaches the site.

```bash
# Start the documentation site dev server
pnpm site:dev

# Build the documentation site
pnpm site:build
```

### Documentation Guidelines

- Use clear, concise language
- Provide code examples for all concepts
- Include both JSON schemas and React code
- Use TypeScript for code examples
- Add practical, real-world examples
- Link to related documentation

### Documentation Link Conventions

**IMPORTANT**: When adding internal links in documentation, follow these conventions to avoid 404 errors:

#### ✅ Correct Link Patterns

```markdown
<!-- Correct - internal documentation links MUST include /docs/ prefix -->
[Quick Start](/docs/guide/quick-start)
[Components](/docs/components)
[API Reference](/docs/api/schema-reference)
[App Schema](/docs/core/app-schema)
[Architecture](/docs/guide/architecture)
```

#### ❌ Incorrect Link Patterns

```markdown
<!-- Wrong - missing /docs/ prefix -->
[Quick Start](/guide/quick-start)          <!-- ❌ Should be /docs/guide/quick-start -->
[Components](/components)                  <!-- ❌ Should be /docs/components -->

<!-- Wrong - top-level section that does not exist under content/docs/ -->
[API Reference](/reference/api/core)       <!-- ❌ No /reference/ section - use /docs/api/schema-reference -->
[Architecture](/architecture/component)    <!-- ❌ No /architecture/ section - use /docs/guide/architecture -->
[Spec](/spec/app)                          <!-- ❌ No /spec/ section - use /docs/core/app-schema -->
```

The example links in the two fenced blocks above are invisible to the link gate — `check-doc-links.mjs` blanks fenced code and inline code spans before it scans (it has to: markdown link syntax quoted inside code is not a link), so whenever you edit these examples, verify each route by hand against the pages actually present in `content/docs/`.

#### Why?

Fumadocs is configured with `baseUrl: '/docs'`, which means all documentation pages are served under the `/docs` route in Next.js. Internal links must include the `/docs/` prefix to match the actual URL structure where the pages are accessible.

#### Validating Links

Two separate checks with two different jobs — knowing which is which saves a wasted debugging round:

- **Internal links are the PR gate.** `scripts/check-doc-links.mjs`, run by `.github/workflows/docs-links.yml` on every pull request to `main` / `develop` (and on pushes to them). It resolves each `/docs/...` route and each relative path against the files in the checkout — reading the tree and nothing else, no network — so it is deterministic, and a failure blocks the merge. The workflow deliberately carries no `paths` filter, so a docs-only PR is checked too. Run the same script locally before you push:

  ```bash
  pnpm docs:check-links
  ```

- **External URLs are swept out of band, and gate nothing.** lychee, run by `.github/workflows/check-links.yml`, makes real network requests and is wired to a weekly cron plus manual `workflow_dispatch` only — never to `pull_request`. That is a deliberate tradeoff (#3213): one third-party 502, rate-limit or anti-scraping response would otherwise turn an unrelated PR red with nothing its author could do about it. The job does fail its own scheduled run on a broken external link; it just never fails yours.

Which files each check reads is declared in the tools themselves — the `SCAN_ROOTS` table at the top of `scripts/check-doc-links.mjs`, and the `args` list in `check-links.yml`. Both surfaces get extended over time, so read them there instead of trusting a list copied into prose.

## Versioning and Releases

We use [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

### Understanding Changesets

Changesets is a tool that helps us:
- **Track changes**: Each PR includes a changeset file describing what changed
- **Automate versioning**: Automatically determine version bumps based on changesets
- **Generate changelogs**: Create comprehensive changelogs from changeset descriptions
- **Coordinate releases**: Release multiple packages together in our monorepo

### When to Create a Changeset

Create a changeset when your PR makes changes to any package in `packages/`:

- ✅ **DO create a changeset for**:
  - New features
  - Bug fixes
  - Breaking changes
  - Performance improvements
  - API changes

- ❌ **DON'T create a changeset for**:
  - Documentation updates only
  - Changes to examples or apps
  - Internal refactoring with no user-facing changes
  - Test updates without code changes

### How to Create a Changeset

1. **Run the changeset command**:
   ```bash
   pnpm changeset
   ```

2. **Select packages**: Use arrow keys and spacebar to select which packages changed
   ```
   🦋  Which packages would you like to include?
   ◯ @object-ui/core
   ◉ @object-ui/react
   ◯ @object-ui/components
   ```

3. **Choose version bump type**:
   - **Major** (x.0.0): Breaking changes
   - **Minor** (0.x.0): New features (backwards compatible)
   - **Patch** (0.0.x): Bug fixes and minor updates

4. **Write a summary**: Describe what changed
   ```
   Summary: Add support for custom validation rules in forms
   ```

5. **Commit the changeset file**:
   ```bash
   git add .changeset/*.md
   git commit -m "chore: add changeset"
   ```

### Changeset Message Guidelines

Write clear, user-facing descriptions:

```markdown
✅ Good:
- Add support for custom date formats in DatePicker
- Fix validation error in nested form fields
- Improve performance of large data grids by 50%

❌ Bad:
- Updated code
- Fixed bug
- Changes to validation
```

### Release Process

The release process is automated:

1. **Create PR with changes** → Include a changeset file
2. **PR is merged** → Changeset bot creates/updates a "Version Packages" PR
3. **Version PR is merged** → Packages are automatically published to npm

You don't need to manually:
- Update version numbers
- Update CHANGELOGs
- Create Git tags
- Publish to npm

Everything is handled by the changeset automation!

### Example Workflow

```bash
# 1. Create a feature branch
git checkout -b feat/add-date-picker

# 2. Make your changes
# ... edit files ...

# 3. Create a changeset
pnpm changeset
# Select @object-ui/components
# Choose "minor" (new feature)
# Summary: "Add DatePicker component with calendar popup"

# 4. Commit everything
git add .
git commit -m "feat: add DatePicker component"

# 5. Push and create PR
git push origin feat/add-date-picker
```

## Adding Components

### Creating a New Component

1. **Define the schema** in `packages/types/`:
   ```typescript
   export interface MyComponentSchema extends BaseSchema {
     type: 'my-component'
     title: string
     content: string
   }
   ```

2. **Implement the component** in `packages/components/`:
   ```tsx
   export function MyComponent(props: { schema: MyComponentSchema }) {
     return (
       <div className={cn('p-4', props.schema.className)}>
         <h3>{props.schema.title}</h3>
         <p>{props.schema.content}</p>
       </div>
     )
   }
   ```

3. **Register the component**:
   ```typescript
   registry.register('my-component', MyComponent)
   ```

4. **Add tests**:
   ```typescript
   describe('MyComponent', () => {
     it('should render title and content', () => {
       const schema = {
         type: 'my-component',
         title: 'Test',
         content: 'Content'
       }
       render(<SchemaRenderer schema={schema} />)
       expect(screen.getByText('Test')).toBeInTheDocument()
     })
   })
   ```

5. **Add documentation** in `docs/components/my-component.md`

## Questions & Support

### Where to Ask Questions

- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Email** - hello@objectui.org

### How to Report Bugs

1. Check if the bug is already reported
2. Create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Code examples (minimal reproduction)
   - Environment details (OS, Node version, etc.)

### Feature Requests

1. Check if it's already requested
2. Open a discussion to gather feedback
3. If approved, create an issue with detailed spec

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Object UI! 🎉
