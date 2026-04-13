---
name: objectui-testing
description: Write and run tests for Object UI components, plugins, schemas, and pages. Use this skill when the user asks to test ObjectUI components, write unit tests with Vitest, create Storybook stories, write Playwright E2E tests, test schema rendering, test expression evaluation, test component registration, test data binding, debug test failures, or set up test infrastructure. Also applies when the user mentions test coverage, snapshot testing, visual regression, or asks "how do I test this component/plugin/page".
---

# ObjectUI Testing

Use this skill to write tests across all layers of the Object UI framework: unit tests (Vitest + React Testing Library), component stories (Storybook), and end-to-end tests (Playwright).

## Test infrastructure overview

| Layer | Tool | Config | What it tests |
|-------|------|--------|---------------|
| Unit / Integration | Vitest + happy-dom | `vitest.config.mts` | Logic, hooks, components, schemas |
| Component isolation | Storybook + React Vite | `.storybook/main.ts` | Visual states, interactions |
| End-to-end | Playwright | `playwright.config.ts` | Full app flows, routing, rendering |

### Running tests

```bash
pnpm test              # All unit tests
pnpm test:watch        # Watch mode
pnpm test:ui           # Vitest browser UI
pnpm test:coverage     # With coverage report
pnpm test:e2e          # Playwright E2E tests
pnpm storybook         # Launch Storybook dev server
```

### Coverage thresholds

Configured in `vitest.config.mts`:
- Lines: 62% | Functions: 54% | Branches: 50% | Statements: 61%

## Vitest configuration

Two test suites in `vitest.workspace.ts`:

1. **Unit tests** (`node` environment): `packages/core`, `packages/types`, `packages/cli`, `packages/data-objectstack`
2. **UI tests** (`happy-dom` environment): All other packages, apps, examples

### Setup file (`vitest.setup.tsx`)

The setup file registers components globally before tests run:
```typescript
import '@object-ui/components';     // Shadcn primitives
import '@object-ui/fields';         // Field widgets
import '@object-ui/plugin-dashboard'; // Dashboard plugin
import '@object-ui/plugin-grid';     // Grid plugin
```

This ensures `ComponentRegistry` has renderers available during tests. If your plugin test needs additional registrations, import them in `beforeAll`.

## Unit test patterns

### Pattern 1: Hook testing

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBreakpoint } from '../useBreakpoint';

describe('useBreakpoint', () => {
  it('returns breakpoint state', () => {
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.breakpoint).toBeDefined();
  });

  it('responds to window resize', () => {
    const { result } = renderHook(() => useBreakpoint());
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 480, writable: true });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.isMobile).toBe(true);
  });
});
```

### Pattern 2: Component registration testing

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('plugin-kanban registration', () => {
  beforeAll(async () => {
    await import('../index');
  });

  it('registers kanban component', () => {
    expect(ComponentRegistry.has('kanban')).toBe(true);
  });

  it('has correct metadata', () => {
    const config = ComponentRegistry.getConfig('kanban');
    expect(config?.meta?.label).toBe('Kanban Board');
    expect(config?.meta?.category).toBe('plugin');
    expect(config?.meta?.inputs).toContainEqual(
      expect.objectContaining({ name: 'columns', required: true })
    );
  });
});
```

### Pattern 3: Schema validation testing

```typescript
import { describe, it, expect } from 'vitest';
import { validateSchema, isValidSchema, formatValidationErrors } from '@object-ui/core';

describe('schema validation', () => {
  it('accepts minimal valid schema', () => {
    expect(isValidSchema({ type: 'text' })).toBe(true);
  });

  it('rejects schema without type', () => {
    const result = validateSchema({} as any);
    expect(result.valid).toBe(false);
    expect(formatValidationErrors(result.errors)).toContain('type');
  });

  it('validates nested children', () => {
    const schema = {
      type: 'card',
      children: [
        { type: 'text', content: 'Hello' },
        { type: 'button', props: { label: 'Click' } },
      ],
    };
    expect(isValidSchema(schema)).toBe(true);
  });
});
```

### Pattern 4: Expression evaluation testing

```typescript
import { describe, it, expect } from 'vitest';
import { ExpressionEvaluator } from '@object-ui/core';

describe('ExpressionEvaluator', () => {
  const evaluator = new ExpressionEvaluator();
  const context = {
    data: { name: 'Alice', count: 42, items: [1, 2, 3] },
    user: { role: 'admin' },
  };

  it('evaluates template expressions', () => {
    expect(evaluator.evaluate('Hello ${data.name}', context)).toBe('Hello Alice');
  });

  it('preserves type for single expressions', () => {
    expect(evaluator.evaluate('${data.count}', context)).toBe(42);
  });

  it('evaluates boolean conditions', () => {
    expect(evaluator.evaluateExpression('user.role === "admin"', context)).toBe(true);
  });

  it('handles missing variables safely', () => {
    expect(evaluator.evaluate('${data.missing}', context)).toBeUndefined();
    expect(evaluator.evaluate('${data.missing || "fallback"}', context)).toBe('fallback');
  });
});
```

### Pattern 5: Component rendering with SchemaRenderer

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

describe('SchemaRenderer', () => {
  const dataSource = {
    users: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
    userRole: 'admin',
  };

  it('renders component from schema', () => {
    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <SchemaRenderer schema={{ type: 'text', content: 'Hello World' }} />
      </SchemaRendererProvider>
    );
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('hides component when hidden expression is true', () => {
    render(
      <SchemaRendererProvider dataSource={dataSource}>
        <SchemaRenderer
          schema={{
            type: 'text',
            content: 'Secret',
            hidden: '${userRole !== "admin"}',
          }}
        />
      </SchemaRendererProvider>
    );
    // admin should see it
    expect(screen.getByText('Secret')).toBeDefined();
  });
});
```

### Pattern 6: Auth provider testing

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@object-ui/auth';

function AuthConsumer() {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (isAuthenticated) return <div>Hello {user?.name}</div>;
  return <div>Not authenticated</div>;
}

describe('AuthProvider', () => {
  it('shows loading then authenticated state', async () => {
    const mockClient = {
      getSession: vi.fn().mockResolvedValue({
        data: { user: { id: '1', name: 'Alice' }, session: { token: 'abc' } },
      }),
    };

    render(
      <AuthProvider authClient={mockClient as any}>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Hello Alice')).toBeDefined();
    });
  });
});
```

### Pattern 7: DataSource adapter testing

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

describe('ObjectStackAdapter', () => {
  let adapter: ObjectStackAdapter;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      find: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      create: vi.fn().mockResolvedValue({ id: '1', name: 'New' }),
    };
    adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000' });
    (adapter as any).client = mockClient;
  });

  it('delegates find to client', async () => {
    await adapter.find('contacts', { filter: { active: true } });
    expect(mockClient.find).toHaveBeenCalledWith('contacts', expect.objectContaining({
      filter: { active: true },
    }));
  });
});
```

## Storybook patterns

### Story file location

Place `.stories.tsx` files next to the component they test:
```
packages/plugin-my-widget/src/
├── MyWidget.tsx
├── MyWidget.stories.tsx    # ← here
└── MyWidget.test.tsx
```

### Basic story

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { MyWidget } from './MyWidget';

const meta = {
  title: 'Plugins/MyWidget',
  component: MyWidget,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof MyWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { title: 'Demo', items: [] },
};

export const WithData: Story = {
  args: {
    title: 'Products',
    items: [
      { id: 1, name: 'Widget A', price: 29.99 },
      { id: 2, name: 'Widget B', price: 49.99 },
    ],
  },
};
```

### Schema-driven story (with SchemaRendererProvider)

```typescript
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { createStorybookDataSource } from '@storybook-config/datasource';

const dataSource = createStorybookDataSource();

const meta = {
  title: 'Plugins/ObjectGrid',
  component: SchemaRenderer,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <SchemaRendererProvider dataSource={dataSource}>
        <Story />
      </SchemaRendererProvider>
    ),
  ],
} satisfies Meta<any>;
```

### Field widget story

```typescript
import { useState } from 'react';

function FieldWrapper({ Component, field, initialValue, readonly = false }) {
  const [value, setValue] = useState(initialValue);
  return (
    <Component
      value={value}
      onChange={setValue}
      field={{ name: 'demo', label: 'Demo Field', type: 'text', ...field }}
      readonly={readonly}
    />
  );
}

export const Default: Story = {
  render: () => (
    <FieldWrapper Component={ColorField} field={{ type: 'color' }} initialValue="#3b82f6" />
  ),
};
```

## Playwright E2E patterns

### Smoke test

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4173'; // vite preview

test('page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(BASE_URL);
  await page.waitForFunction(
    () => (document.getElementById('root')?.children.length ?? 0) > 0,
    { timeout: 30_000 },
  );

  expect(errors).toHaveLength(0);
});
```

### Content verification

```typescript
test('renders main content', async ({ page }) => {
  await page.goto(`${BASE_URL}/console`);
  await page.waitForSelector('[data-testid="app-shell"]');
  
  // Verify navigation renders
  await expect(page.locator('nav')).toBeVisible();
  
  // Verify page title
  await expect(page).toHaveTitle(/ObjectUI/);
});
```

### Bundle validation

```typescript
test('all assets load without 404', async ({ page }) => {
  const failedRequests: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  expect(failedRequests).toHaveLength(0);
});
```

## Test file naming conventions

| Pattern | Use for |
|---------|---------|
| `*.test.ts` | Pure logic tests (evaluators, validators, adapters) |
| `*.test.tsx` | Component/hook tests needing React rendering |
| `*.spec.ts` | Playwright E2E tests (in `e2e/` directory) |
| `*.stories.tsx` | Storybook stories (excluded from tsconfig `dist`) |

## Mocking strategies

### MSW for API mocking in stories and integration tests

```typescript
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('/api/v1/contacts', () => {
    return HttpResponse.json({
      records: [{ id: 1, name: 'Alice' }],
      total: 1,
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Vitest mocks for unit tests

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('@object-ui/core', async () => {
  const actual = await vi.importActual('@object-ui/core');
  return {
    ...actual,
    ComponentRegistry: {
      get: vi.fn().mockReturnValue(MockComponent),
      has: vi.fn().mockReturnValue(true),
    },
  };
});
```

## Common testing mistakes

- Not importing plugin packages in test setup — `ComponentRegistry` is empty, SchemaRenderer produces fallback components.
- Using `jsdom` instead of `happy-dom` for UI tests — slower and more memory-hungry.
- Testing implementation details (internal state) rather than user-visible behavior.
- Forgetting `act()` wrapper when testing hooks that trigger state updates.
- Not awaiting async operations in auth/data tests — assertions run before state settles.
