---
title: "Installation"
---

Object UI is designed to be dropped into an existing React + Tailwind project.

## Prerequisites

- **React 18+**
- **Tailwind CSS 3+**
- **Node.js 18+**

## 1. Install Packages

We recommend using `pnpm` for best performance with our monorepo structure, but npm/yarn work too.

```bash
pnpm add @object-ui/react @object-ui/components @object-ui/core @object-ui/types react-icons
```
*   `@object-ui/types`: Pure TS types (Protocol).
*   `@object-ui/react`: Hooks and Context providers.
*   `@object-ui/components`: Ready-made Shadcn components.

## 2. Configure Tailwind

This is the **most critical step**. Since Object UI components are shipped as uncompiled JS/TS with Tailwind classes, you must tell Tailwind to scan `node_modules`.

Update your `tailwind.config.js` (or `.ts`):

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // ⚠️ CRITICAL: Scan Object UI packages for styles
    "./node_modules/@object-ui/**/*.{js,ts,jsx,tsx}" // <--- Add this line
  ],
  theme: {
    extend: {
      // If you want to customize Object UI colors, override them here
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... map other shadcn variables
      }
    },
  },
  plugins: [
    require("tailwindcss-animate"), // Required for animations
    require("@tailwindcss/typography"), // Required for rich text
  ],
}
```

## 3. Add Base Styles

Ensure your global CSS file imports Tailwind directives. Object UI relies on standard CSS variables for theming.

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
 
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... add standard shadcn variables if missing ... */
  }
}
```
