---
'@object-ui/cli': patch
---

Fix `objectui init` scaffolding an app that renders neither components nor styles.

The generated `src/App.tsx` imported only `SchemaRenderer` from `@object-ui/react`, which does not depend on `@object-ui/components` — and registration is a side effect of importing that package. The component registry was therefore empty in every scaffolded project, and each node of all three templates (`simple`, `form`, `dashboard`) rendered "Unknown component type". The manifest already declared `@object-ui/components`; it was declared and never imported. The generated `src/App.tsx` now performs the side-effect import.

The generated `src/index.css` was a bare `@import 'tailwindcss';` and never loaded the library's published stylesheet, so the theme utilities the templates lean on had no tokens behind them. It now also does `@import '@object-ui/components/style.css';`, matching what the quick-start guide teaches hand-rolled consumers.

`objectui init` is unchanged in every other respect: the same eleven files, byte for byte, apart from these two lines.
