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
   git remote add upstream https://github.com/objectql/objectui.git
   ```

## Development Setup

### Install Dependencies

```bash
# Install pnpm if you haven't
npm install -g pnpm

# Install project dependencies
pnpm install
```

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
# Run the playground (main development app)
pnpm playground

# Run the visual designer demo
pnpm designer

# Run the prototype example
pnpm prototype

# Run documentation site
pnpm docs:dev
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

See [Architecture Documentation](./docs/spec/architecture.md) for details.

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
- Aim for 80%+ code coverage
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

2. **Ensure tests pass**:
   ```bash
   pnpm test
   ```

3. **Ensure build succeeds**:
   ```bash
   pnpm build
   ```

4. **Update documentation** if needed

5. **Add tests** for new features

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

## Documentation

### Writing Documentation

We use VitePress for documentation. All docs are in `docs/`.

```bash
# Start docs dev server
pnpm docs:dev

# Build docs
pnpm docs:build
```

### Documentation Guidelines

- Use clear, concise language
- Provide code examples for all concepts
- Include both JSON schemas and React code
- Use TypeScript for code examples
- Add practical, real-world examples
- Link to related documentation

See [Documentation Guide](./docs/README.md) for details.

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
