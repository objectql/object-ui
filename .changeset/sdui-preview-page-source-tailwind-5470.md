---
---

Publishes nothing — declared with an empty frontmatter rather than left undeclared.

The changed files are `apps/console`'s three ADR-0080 browser preview harnesses
(`src/sdui-*-preview.tsx`) plus a test. They are dev-server-only: `apps/console`'s
vite config declares no `build.rollupOptions.input`, so the build's only entry is
`index.html` (resolved config, measured: `input` unset) — the three
`sdui-*-preview.html` entries and the modules behind them never enter `dist/`.
`@object-ui/console`'s `files` omits `src`, and its `exports` map has exactly one
entry (`.` → `./plugin.js`, built from `tsconfig.plugin.json` including
`plugin.ts` alone, which imports nothing from `src/`). Nothing here reaches a
consumer.

Behind the change: page `source` is runtime metadata, and the console's Tailwind
is compiled at build time by scanning the console's own `src` with no safelist, so
a utility class authored in real page metadata produces no CSS and no error
(ADR-0065; ADR-0080's 2026-06-30 amendment). `sdui-tiers-preview.tsx` — the
harness making an explicit authoring claim — now styles with each tier's real
primitive (the html tier with `<flex>`'s structured props plus JSON `style`
objects, the react tier with inline `style` objects, colours as
`hsl(var(--token))`), so it demonstrates what authors are told to write and now
follows the theme in light and dark. The two renderer-plumbing harnesses keep
their Tailwind and declare the exception in their headers; a test pins both
halves against the shipped `page-source-className-tailwind` rule.
