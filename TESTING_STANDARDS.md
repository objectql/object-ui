# Testing Standards and Guidelines

**Version:** 1.0  
**Date:** January 31, 2026  
**Section:** 3.6 - Testing Coverage Improvements

---

## Overview

This document establishes testing standards for the ObjectUI project to ensure high-quality, maintainable code with comprehensive test coverage.

## Coverage Requirements

All packages must meet the following minimum coverage thresholds:

- **Lines:** 80%
- **Functions:** 80%
- **Statements:** 80%
- **Branches:** 75%

These thresholds are enforced in `vitest.config.mts` and will fail CI builds if not met.

## Test File Organization

### Unit Tests
Location: `packages/*/src/**/*.test.{ts,tsx}`

Unit tests should:
- Test individual functions, classes, and components in isolation
- Mock external dependencies
- Focus on testing behavior, not implementation
- Use descriptive test names

**Example:**
```typescript
// packages/core/src/validation/validation-engine.test.ts
import { describe, it, expect } from 'vitest';
import { ValidationEngine } from './validation-engine';

describe('ValidationEngine', () => {
  it('should validate required fields', async () => {
    const engine = new ValidationEngine();
    const result = await engine.validate('', {
      field: 'email',
      rules: [{ type: 'required', message: 'Email is required' }],
    });
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Email is required');
  });
});
```

### Integration Tests
Location: `packages/*/src/**/*.integration.test.{ts,tsx}`

Integration tests should:
- Test interactions between multiple modules
- Test plugin system integration
- Test data flow through multiple layers
- Use minimal mocking

**Example:**
```typescript
// packages/core/src/registry/plugin-integration.test.ts
import { describe, it, expect } from 'vitest';
import { Registry } from './Registry';
import { PluginSystem } from './PluginSystem';
import { PluginScopeImpl } from './PluginScopeImpl';

describe('Plugin System Integration', () => {
  it('should isolate plugin scopes', async () => {
    const registry = new Registry();
    const pluginSystem = new PluginSystem();
    
    const plugin1 = {
      name: 'plugin-a',
      version: '1.0.0',
      register: (scope: PluginScope) => {
        scope.registerComponent('table', TableComponent);
      },
    };
    
    const plugin2 = {
      name: 'plugin-b',
      version: '1.0.0',
      register: (scope: PluginScope) => {
        scope.registerComponent('table', DifferentTableComponent);
      },
    };
    
    await pluginSystem.loadPlugin(plugin1, registry, true);
    await pluginSystem.loadPlugin(plugin2, registry, true);
    
    // Both plugins should have their own 'table' component
    expect(registry.get('plugin-a:table')).toBeDefined();
    expect(registry.get('plugin-b:table')).toBeDefined();
  });
});
```

### E2E Tests
Location: `examples/*/tests/**/*.spec.ts`

E2E tests should:
- Test complete user workflows
- Use Playwright (already installed)
- Test actual browser interactions
- Focus on critical user journeys

**Example:**
```typescript
// examples/crm-app/tests/create-contact.spec.ts
import { test, expect } from '@playwright/test';

test('should create a new contact', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.click('button:has-text("New Contact")');
  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john@example.com');
  await page.click('button:has-text("Save")');
  
  await expect(page.locator('text=John Doe')).toBeVisible();
});
```

## Visual Regression Testing

### Setup
Uses Chromatic for visual regression testing of Storybook components.

**Installation:**
```bash
pnpm add -D @storybook/test-runner chromatic
```

**Configuration:**
```json
// package.json
{
  "scripts": {
    "test:visual": "chromatic --project-token=${CHROMATIC_TOKEN}"
  }
}
```

### Best Practices
- Create stories for all UI components
- Include variants (states, themes, responsive)
- Document component usage in stories
- Review visual changes in PR reviews

## Test Utilities

### Common Test Helpers
Location: `packages/*/src/test-utils/`

Create reusable test utilities:
- Mock data generators
- Test component wrappers
- Custom matchers
- Setup/teardown helpers

**Example:**
```typescript
// packages/core/src/test-utils/mock-data.ts
export function createMockUser(overrides = {}) {
  return {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    ...overrides,
  };
}
```

## CI/CD Integration

### GitHub Actions
Tests run automatically on:
- Every push to any branch
- Every pull request
- Before merge to main

### Pre-commit Hooks
Recommended to set up pre-commit hooks:
```bash
pnpm add -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "pnpm test:affected"
```

## Test Writing Guidelines

### 1. Arrange-Act-Assert (AAA) Pattern
```typescript
it('should do something', () => {
  // Arrange: Set up test data and conditions
  const input = { value: 10 };
  
  // Act: Execute the code being tested
  const result = processInput(input);
  
  // Assert: Verify the results
  expect(result).toBe(20);
});
```

### 2. Descriptive Test Names
❌ Bad:
```typescript
it('test 1', () => { /* ... */ });
```

✅ Good:
```typescript
it('should validate email format when user submits form', () => { /* ... */ });
```

### 3. Test One Thing at a Time
Each test should verify a single behavior or scenario.

### 4. Avoid Test Interdependence
Tests should not depend on the execution order or state from other tests.

### 5. Use Meaningful Assertions
```typescript
// ❌ Too vague
expect(result).toBeTruthy();

// ✅ Specific
expect(result.status).toBe('success');
expect(result.data).toHaveLength(3);
```

### 6. Test Edge Cases
- Empty inputs
- Null/undefined values
- Boundary conditions
- Error conditions
- Async failures

### 7. Mock External Dependencies
```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

mockFetch.mockResolvedValue({
  json: async () => ({ data: 'mocked' }),
});
```

## Performance Testing

For performance-critical code, add performance benchmarks:

```typescript
import { describe, bench } from 'vitest';

describe('Performance', () => {
  bench('should render 1000 components in < 100ms', () => {
    const components = Array.from({ length: 1000 }, () => 
      render(<Component />)
    );
  }, { time: 100 });
});
```

## Debugging Tests

### Run Specific Tests
```bash
# Run single test file
pnpm test validation-engine.test.ts

# Run tests matching pattern
pnpm test --grep "ValidationEngine"

# Run in watch mode
pnpm test:watch
```

### UI Mode
```bash
pnpm test:ui
```

### Debug Mode
```bash
# Node inspector
node --inspect-brk ./node_modules/.bin/vitest

# VS Code debugger (add to launch.json)
{
  "type": "node",
  "request": "launch",
  "name": "Vitest",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test"],
  "console": "integratedTerminal"
}
```

## Maintenance

### Regular Test Audits
- Review test coverage reports monthly
- Identify untested code paths
- Remove obsolete tests
- Update tests when refactoring

### Documentation
- Keep this document updated
- Document complex test scenarios
- Add comments for non-obvious test logic

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Chromatic Documentation](https://www.chromatic.com/docs/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

## Checklist for New Features

When adding a new feature:

- [ ] Write unit tests for all new functions/classes
- [ ] Add integration tests for cross-module interactions
- [ ] Create E2E tests for user-facing features
- [ ] Update Storybook stories for UI components
- [ ] Ensure coverage thresholds are met
- [ ] Add test utilities for complex scenarios
- [ ] Document test approach in PR description
