---
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
---

`@object-ui/plugin-grid` and `@object-ui/plugin-kanban` now publish a stylesheet —
`"./style.css"`, mapped to `dist/index.css` and compiled at build time from the package's
own sources (objectui#4929, maintainer ruling 2026-08-17, Direction 1).

**What was broken.** Only `@object-ui/components` and `@object-ui/fields` shipped CSS, and
each scans its own `src` only, so a class used exclusively by a plugin could not appear in
either sheet BY CONSTRUCTION. A published-state Vite app that installed one of these two
plugins and followed the quick-start rendered the grid or the board with **25 themed
utilities that had no source anywhere in the world** — `bg-muted/10`, `bg-card/60`,
`text-muted-foreground/60`, `ring-primary/40` and friends, ordinary appearance classes —
plus ~103 plain ones. Re-measured on the merged tree: the 21 the card listed all still hold,
and four more (`[&>h3]:text-foreground/80`, `border-l-primary/40`, `border-primary/30`,
`hover:text-primary`) that its literal-grep method could not see.

The plain utilities a consumer could in principle regenerate by pointing `@source` at the
package's `dist`. The themed ones they cannot, at all: they resolve `@theme` tokens declared
in `packages/components/src/index.css`, which that package does not publish. A build inside
this monorepo is their only possible producer — which is why the fix is a stylesheet we
ship, not documentation teaching consumers to hand-declare the theme and scan
`node_modules` (the advice objectui#4858 had just retired from the guides).

**The shape**, inherited from `@object-ui/fields` (objectui#4059): each package gains
`src/index.css` that `@reference`s the components entry — theme tokens, the class-based
`dark` variant and the animate plugin become available for resolution while emitting
nothing — plus `scripts/build-css.mjs`, which subtracts every rule components' published
sheet already ships. So these are **supplements, imported after** the components sheet, and
they are 16.30 kB and 11.41 kB rather than another ~170 kB each:

```css
@import 'tailwindcss';
@import '@object-ui/components/style.css';
@import '@object-ui/fields/style.css';
@import '@object-ui/plugin-grid/style.css';
@import '@object-ui/plugin-kanban/style.css';
```

Add a line only for the plugins you install; no other `@object-ui/plugin-*` package
publishes a stylesheet yet. The build step is shared
(`scripts/build-plugin-stylesheet.mjs`) so it is the pattern the next one inherits rather
than a file to copy, and it refuses to write a sheet that fails any of four assertions — no
rule may vanish, the subtraction must have removed something, the class count may not pass
a leak ceiling, and named themed utilities only this build can produce must still be
present.

Nothing is removed and no existing import changes: a consumer who does not import the new
sheets is exactly where they were, and the guides' "do not scan `node_modules`" advice
stays correct — it is now correct for plugins too.
