---
title: Troubleshooting
description: Solutions to common issues when building with ObjectUI.
---

# Troubleshooting

This guide covers the most common issues you may encounter when working with ObjectUI, along with their solutions.

## 1. "Component type X not found"

**Symptom:** The `SchemaRenderer` renders nothing or shows a fallback, and the console logs `component type "kanban-ui" not found in registry`.

**Cause:** The plugin that provides the component type has not been imported, so it never registered itself with the `ComponentRegistry`.

**Fix:**

```typescript
// Import the plugin package — registration happens on import
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-grid';
```

If you are using a custom component, register it explicitly:

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { MyCustomWidget } from './MyCustomWidget';

ComponentRegistry.register('my-widget', MyCustomWidget, {
  namespace: 'custom',
  label: 'My Widget',
  category: 'plugin',
});
```

Verify what is registered by running:

```bash
npx objectui doctor
```

## 2. Build Errors with Tailwind CSS

**Symptom:** Tailwind utility classes are not applied. Components render without styling.

**Cause:** The `content` paths in your Tailwind config do not include ObjectUI package files.

**Fix:** Update your `tailwind.config.ts` (or `postcss.config.mjs`) to scan ObjectUI packages inside `node_modules`:

```typescript
// tailwind.config.ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,ts,tsx}',
    './node_modules/@object-ui/fields/**/*.{js,ts,tsx}',
    './node_modules/@object-ui/layout/**/*.{js,ts,tsx}',
    './node_modules/@object-ui/plugin-*/**/*.{js,ts,tsx}',
  ],
  // ...
};
```

Also ensure `postcss.config.mjs` is present at the project root (see `postcss.config.mjs` in the monorepo root for reference).

## 3. Missing Peer Dependencies

**Symptom:** Build or runtime errors about missing modules like `react`, `react-dom`, or `react-hook-form`.

**Cause:** ObjectUI packages declare React 18+ as a **peer dependency**. Your host project must provide them.

**Fix:**

```bash
# Run the built-in doctor command to detect missing dependencies
npx objectui doctor

# Or install manually
pnpm add react react-dom react-hook-form
```

The `objectui doctor` command checks:
- Peer dependency versions
- Package compatibility
- Registry health
- Missing plugins referenced in schemas

## 4. Expression Evaluation Errors

**Symptom:** Expressions like `${data.user.name}` render as literal strings or throw runtime errors.

**Cause:** Malformed expression syntax, missing context variables, or unclosed brackets.

**Fix:**

| Problem | Bad | Good |
|---------|-----|------|
| Missing `$` prefix | `{data.name}` | `${data.name}` |
| Unclosed bracket | `${data.name` | `${data.name}` |
| Wrong context var | `${row.name}` | `${data.name}` |
| Nested quotes | `${"hello"}` | `${'hello'}` or `${data.greeting}` |

Available context variables:
- `data.*` — Current data scope
- `user.*` — Authenticated user
- `params.*` — URL/query parameters

Debug expressions by enabling debug mode in `SchemaRendererContext`:

```tsx
<SchemaRenderer schema={schema} debug={true} />
```

This logs each expression evaluation to the browser console.

## 5. Schema Validation Errors

**Symptom:** Schema renders incorrectly or `ValidationEngine` throws errors about invalid schema structure.

**Fix:** Validate your schema before passing it to the renderer:

```bash
# CLI validation (checks against @objectstack/spec)
npx objectui validate ./path/to/schema.json
```

Common schema issues:
- Missing required `type` field on components
- Invalid action type (must be one of: `script`, `url`, `api`, `modal`, `flow`)
- Referencing a field type that doesn't exist (e.g., `rich-text` without importing `plugin-editor`)

The validation engine lives in `packages/core/src/validation/` and uses Zod schemas from `@object-ui/types`.

## 6. TypeScript Errors with Schema Types

**Symptom:** TypeScript cannot find types like `ComponentSchema`, `ActionSchema`, or `FieldWidgetProps`.

**Cause:** `@object-ui/types` is not installed, or the version is mismatched.

**Fix:**

```bash
pnpm add @object-ui/types
```

Then import types from the correct entry points:

```typescript
// Base types
import type { ComponentSchema } from '@object-ui/types';

// Category-specific types
import type { FormSchema } from '@object-ui/types/form';
import type { LayoutSchema } from '@object-ui/types/layout';
import type { DataDisplaySchema } from '@object-ui/types/data-display';

// Zod validation schemas
import { componentSchema } from '@object-ui/types/zod';
```

The `@object-ui/types` package exports multiple entry points (`base`, `layout`, `form`, `data-display`, `feedback`, `overlay`, `navigation`, `complex`, `data`, `zod`). Check `packages/types/package.json` for the full list.

## 7. Dark Mode Flickering

**Symptom:** Page flashes white before switching to dark mode on initial load.

**Cause:** The `ThemeProvider` (`packages/react/src/context/ThemeContext`) is mounted too late, or the theme preference is read asynchronously after first paint.

**Fix:**

1. Place the `ThemeProvider` as high as possible in your component tree — ideally wrapping your entire app:

```tsx
import { ThemeProvider } from '@object-ui/react';

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <YourApp />
    </ThemeProvider>
  );
}
```

2. Add a blocking script in your HTML `<head>` to set the `class` attribute before React hydrates:

```html
<script>
  const theme = localStorage.getItem('object-ui-theme') || 'system';
  if (theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
</script>
```

## 8. i18n Missing Translations

**Symptom:** UI shows raw translation keys like `common.save` instead of localized text.

**Cause:** Locale files are missing or the `I18nProvider` is not configured.

**Fix:**

1. Ensure the `I18nProvider` from `packages/i18n/` wraps your app:

```tsx
import { I18nProvider } from '@object-ui/i18n';

<I18nProvider locale="en" messages={messages}>
  <App />
</I18nProvider>
```

2. Check that locale files follow the expected structure. Each locale file should export a flat or nested object of key-value pairs.

3. Verify the locale code matches exactly (e.g., `en`, `fr`, `de` — not `en-US` unless your locale files use that format).

## 9. Performance Issues with Large Datasets

**Symptom:** Grid, table, or list views become slow with 1,000+ rows.

**Cause:** All rows are being rendered in the DOM at once.

**Fix:**

- **Use `plugin-aggrid`**: The AG Grid plugin (`packages/plugin-aggrid/`) supports virtual scrolling out of the box for large datasets.
- **Use `plugin-grid`**: The built-in grid (`packages/plugin-grid/`) also supports virtualization when configured.
- **Paginate server-side**: Configure your data source adapter (`packages/core/src/adapters/`) to fetch data in pages rather than loading everything at once.

For custom views, use the `usePerformance` hook from `@object-ui/react` to monitor render times:

```typescript
import { usePerformance } from '@object-ui/react';

const { startMeasure, endMeasure } = usePerformance('MyWidget');
```

## 10. Plugin Conflicts

**Symptom:** Two plugins register the same component type and one silently overrides the other.

**Cause:** Plugins registered without namespaces collide on the same type key.

**Fix:** Always use namespaced registrations:

```typescript
ComponentRegistry.register('grid', MyGridComponent, {
  namespace: 'my-plugin',  // ← prevents collision
  label: 'Custom Grid',
  category: 'plugin',
});
```

The `PluginSystem` (`packages/core/src/registry/PluginSystem.ts`) uses `PluginScopeImpl` to auto-prefix registrations with the plugin name. If you register manually, always provide a `namespace`.

To debug conflicts:

```bash
npx objectui doctor
```

This reports duplicate registrations and namespace collisions.

## Getting Help

If none of the above resolves your issue:

1. Search [existing issues](https://github.com/objectstack-ai/objectui/issues)
2. Run `npx objectui doctor` and include the output in your report
3. Open an issue with your schema JSON, error message, and ObjectUI package versions
