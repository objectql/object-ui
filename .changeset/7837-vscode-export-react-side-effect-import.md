---
'object-ui': patch
---

Fix the phantom import the VS Code extension's **Export to React** command wrote into
every file it generated (objectui#7837).

`generateReactComponent()` emitted a preamble that imported `registerDefaultRenderers`
from `@object-ui/components` and then called it. That symbol is on **no export** of
that package: its built `dist/index.d.ts` carries exactly one `register*` name,
`registerPlaceholders`, and `registerDefaultRenderers` appears **0 times** in either
`dist/index.d.ts` or `dist/index.js`. So every file the command produced failed to
compile with `TS2305` naming a symbol the user never typed.

`@object-ui/components` registers its renderers as an **import side effect** —
`sideEffects: true` in its manifest, `import './renderers'` in its barrel under the
comment `Register all ObjectUI renderers (side-effects)`, and **114 `register(` call
sites** at module scope in the built `dist/index.js`. There is no registration function
to call, so the generated preamble now imports the package for the side effect and says
why. Same spelling the root README landed for objectui#7417.

`packages/vscode-extension/DESIGN.md`, which documented the identical two lines, is
corrected in the same commit so the design record does not freeze the defect.

No public surface moved: no export added, no signature changed.
