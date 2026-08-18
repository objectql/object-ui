---
---

Docs only: `AGENTS.md` §2 and `skills/objectui/rules/styling.md` now carve out
author-declared, data-driven colour from the flat inline-style ban — permitted only as CSS
custom properties consumed by static Tailwind utilities, so `dark:` stays a real variant.
Component-authored static colour, colour literals in class strings, and any inline style
that hard-codes a colour such that dark mode renders identically remain banned. No package
source changes, so this declares no package.
