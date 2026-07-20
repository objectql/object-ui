---
"@object-ui/cli": patch
"@object-ui/data-objectstack": patch
"@object-ui/plugin-calendar": patch
"@object-ui/plugin-designer": patch
"@object-ui/plugin-map": patch
"@object-ui/plugin-markdown": patch
"@object-ui/plugin-timeline": patch
"@object-ui/react": patch
---

chore(lint): clear the mechanical baseline lint errors so these packages' lint gates protect them again

Extends the fields/core cleanup from #2709 (objectui#2713). These eight package
lints were red at baseline on `main`, so their per-package `lint` gate could not
catch new violations of the same class. Cleared every **error** (no behavior
change; warnings are out of scope):

- **`no-useless-catch`** (`data-objectstack`) — unwrapped five try/catch blocks
  whose `catch` only re-threw; errors still propagate identically.
- **`preserve-caught-error`** (`cli`, `data-objectstack`, `react`) — the caught
  error's message is inlined into the thrown `Error`; a scoped disable with a
  justifying comment carries each one, because these packages target ES2020
  whose lib types the 1-arg `Error` constructor only (so `{ cause }` won't
  compile) — same reasoning as the core case in #2709.
- **`prefer-const`** (`plugin-calendar`, `plugin-map`) — `let`→`const` for
  never-reassigned bindings.
- **`no-empty-object-type`** (`plugin-designer`) — empty extend-only interfaces
  → equivalent `type` aliases.
- **`no-useless-assignment`** (`react`) — dropped a dead initializer that both
  branches overwrite before it is read.
- **`no-require-imports`** (`plugin-calendar`, `plugin-timeline` tests) —
  hoisted `vi.mock` factories now use an `async` factory with
  `await import('react')` instead of `require('react')`.
- **stale `eslint-disable` directive** (`plugin-markdown`) — removed a
  `react/no-danger` disable whose plugin is not loaded in the flat config (an
  unknown-rule reference that ESLint v10 reports as an error); the rationale is
  kept as a plain comment.
