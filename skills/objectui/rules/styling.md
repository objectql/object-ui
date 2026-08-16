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

For ObjectUI components to render correctly, a third-party project imports the
stylesheets the packages **publish**. There is no `tailwind.config.js` step: ObjectUI is
Tailwind 4, configured in CSS.

**✅ CORRECT:**
```css
/* src/index.css */
@import "tailwindcss";
@import "@object-ui/components/style.css";
@import "@object-ui/fields/style.css";
```

Each `style.css` is a real package export, mapped to that package's `dist/index.css` and
compiled at build time from the package's own sources.

`@object-ui/components/style.css` is the base of the pair. It carries every utility its
components use **and** the `@theme` block those utilities are built on, so the whole
Shadcn palette (`bg-background`, `bg-primary`, `border-input`, `ring-ring`) plus the
`:root` / `.dark` token defaults arrive with that one import. You do **not** restate
those tokens in a `@theme` block of your own.

The order is load-bearing. `@object-ui/fields/style.css` is a supplement: it is compiled
against the components theme and then has every rule that sheet already ships subtracted
from it, so it holds only what the field widgets add — the tag colour map, the signature
canvas cursor, and 17 themed utilities such as `hover:bg-accent/30` that no consumer-side
configuration can generate. Import it first, or alone, and those rules resolve against
tokens that are not there yet. `@object-ui/fields` is a separate dependency, not a
transitive one — install it, or leave that second line out.

**❌ FORBIDDEN — pointing Tailwind at the installed packages:**

Do not scan the ObjectUI packages inside `node_modules`, with neither a v4 `@source` line
nor a v3 `content` entry. It regenerates the shape-only utilities (`inline-flex`,
`rounded-md`, `h-9`) the two sheets already contain, and it cannot produce the themed ones
at all: the `@theme` block they come from lives in package source, which is not published
(the tarballs carry `dist` only). Your own Tailwind entry goes on generating the classes
*your* source uses, exactly as before.

Inside the ObjectUI workspace the picture is different, and `@source` is right there: the
packages are linked to their sources, so an app scans `packages/*/src` and declares the
theme itself. `apps/console/src/index.css` is the maintained reference for that case.

To recolour, override the token **values** rather than the utilities. They are Shadcn HSL
channel triples, not finished colours:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
}
```

See `content/docs/guide/theming.md` for the full token list and the `ThemeProvider` route.

**Without these imports, ObjectUI components will render but look completely unstyled.**
