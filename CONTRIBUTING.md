# Contributing to Object UI

Thank you for your interest in contributing to Object UI! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/object-ui.git`
3. Install dependencies: `pnpm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/core && pnpm build
```

### Linting

```bash
# Lint all packages
pnpm lint
```

## Writing Tests

All tests should be placed in `__tests__` directories within the source code. We use **Vitest** and **React Testing Library**.

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Commit Guidelines

We follow conventional commit messages:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring

Example: `feat: add new button variant`

## Pull Request Process

1. Ensure all tests pass: `pnpm test`
2. Ensure the build succeeds: `pnpm build`
3. Update documentation if needed
4. Create a pull request with a clear description of changes
5. Link any relevant issues

## Code Style

- Follow existing code style in the project
- Use TypeScript for type safety
- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

## Adding New Packages

If you need to add a new package to the monorepo:

1. Create a new directory under `packages/`
2. Add a `package.json` with proper workspace dependencies
3. Update the main README if the package is user-facing
4. Add tests for the new package

## Questions?

If you have questions, feel free to:
- Open an issue with the `question` label
- Start a discussion in GitHub Discussions
- Reach out to the maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
