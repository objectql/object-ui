---
"@object-ui/core": minor
"@object-ui/react": patch
"@object-ui/components": patch
---

feat: scoped style-object rendering (ADR-0065)

A metadata node may carry `responsiveStyles` (per-breakpoint CSS-property maps);
`SchemaRenderer` compiles it to **id-scoped CSS** injected as a `<style>` tag and
appends a scope class to the node. Build-independent (arbitrary values + design
tokens pass through verbatim — no Tailwind JIT), collision-free (per-node scope,
unlayered so it beats base utilities), responsive-correct (model breakpoint maps
→ generated `@media`, never `md:` variant classes). Adds `compileScopedStyles`/
`scopeClassFor`/`hasResponsiveStyles` to `@object-ui/core` and an SDUI design-token
palette (`--space-*`, `--surface`, `--brand`, …) to the theme. Mirrors Builder.io.
