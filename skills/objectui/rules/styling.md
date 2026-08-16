# Styling Rules

> **Critical:** ObjectUI uses Tailwind CSS exclusively. No inline styles, CSS modules, or styled-components.

## Rule: Use Tailwind Utility Classes Only

**✅ CORRECT:**
```json
{
  "type": "card",
  "className": "col-span-12 lg:col-span-4 p-6"
}
```

**❌ FORBIDDEN:**
```typescript
// Never do this in ObjectUI
<Card style={{ padding: '24px', color: 'red' }} />
```

## Rule: Use `cn()` for Class Merging

When combining classes programmatically, always use the `cn()` utility:

```typescript
import { cn } from '@object-ui/components';

function MyComponent({ className, ...props }) {
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {/* content */}
    </div>
  );
}
```

**Why:** `cn()` uses `tailwind-merge` + `clsx` to properly handle class conflicts (e.g., `p-4` vs `p-6`).

## Rule: Use Semantic Color Tokens

**✅ CORRECT:**
```typescript
className="bg-primary text-primary-foreground"
className="bg-secondary text-secondary-foreground"
className="bg-muted text-muted-foreground"
className="bg-destructive text-destructive-foreground"
className="border-border"
```

**❌ FORBIDDEN:**
```typescript
className="bg-blue-500 text-white"  // ❌ Hard-coded color
className="bg-[#3b82f6]"             // ❌ Arbitrary value
```

**Why:** Semantic tokens support theming and dark mode automatically.

## Rule: Use Component Variants (CVA)

For component variations, use `class-variance-authority`:

```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md', // base
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## Rule: Expose `className` on the Schema Node

**Every component must accept `className` on its schema node** to allow JSON-level style overrides. Like every other key, it is read off the node itself — not out of a `props` envelope, which the renderers never read:

```json
{
  "type": "card",
  "className": "bg-red-500",  // ✅ User can override styles
  "title": "Alert"
}
```

## Rule: Responsive Classes

Use Tailwind's responsive prefixes in schemas:

```json
{
  "type": "grid",
  "className": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
}
```

## Rule: Dark Mode with Semantic Tokens

**❌ DO NOT** manually add `dark:` variants:

```typescript
// ❌ Wrong
className="bg-white dark:bg-gray-900"
```

**✅ CORRECT:**
```typescript
// ✅ Semantic tokens handle dark mode automatically
className="bg-background text-foreground"
```

## Rule: No Manual Z-Index

**❌ DO NOT** manually set `z-index` on overlay components:

```typescript
// ❌ Wrong
<Dialog className="z-[9999]" />
```

**✅ CORRECT:**
```typescript
// ✅ Dialog, Sheet, Popover, etc. handle their own stacking context
<Dialog />
```

## Rule: Spacing with `gap-*` not `space-*`

**✅ CORRECT:**
```typescript
className="flex flex-col gap-4"
className="grid grid-cols-3 gap-6"
```

**❌ FORBIDDEN:**
```typescript
className="space-y-4"  // ❌ Deprecated
className="space-x-6"  // ❌ Use gap instead
```

## Rule: Use `size-*` for Equal Dimensions

**✅ CORRECT:**
```typescript
className="size-10"  // width and height both 40px
```

**❌ FORBIDDEN:**
```typescript
className="w-10 h-10"  // ❌ Redundant
```

## Rule: Use `truncate` Shorthand

**✅ CORRECT:**
```typescript
className="truncate"
```

**❌ FORBIDDEN:**
```typescript
className="overflow-hidden text-ellipsis whitespace-nowrap"
```

## Rule: Tailwind 4 CSS Variables Setup

For ObjectUI components to render correctly, third-party projects must include this CSS setup:

```css
@import "tailwindcss";

/* Scan ObjectUI packages so Tailwind generates their utility classes */
@source "../../node_modules/@object-ui/components/src/**/*.tsx";
@source "../../node_modules/@object-ui/fields/src/**/*.tsx";
@source "../../node_modules/@object-ui/layout/src/**/*.tsx";
@source "../../node_modules/@object-ui/react/src/**/*.tsx";

/* Map Shadcn CSS variables to Tailwind 4 color tokens */
@theme {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* Light mode CSS variables (Shadcn defaults) */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --radius: 0.625rem;
}
```

**Without this setup, ObjectUI components will render but look completely unstyled.**
