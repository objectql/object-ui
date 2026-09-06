---
'object-ui': patch
---

Drop the unused `import React from 'react'` the VS Code extension's **Export to React**
command wrote into every file it generated (objectui#7862).

The generated file's only JSX is a single SchemaRenderer element, so under the automatic
JSX runtime — `"jsx": "react-jsx"`, what a new Vite or Next project is configured with —
the `React` identifier was never read. Measured on this branch against the built
`dist/index.d.ts` of `@object-ui/react` and `@object-ui/components`, TypeScript 6.0.3:
the emitted file compiled clean under `react-jsx` + `strict` (exit 0), and under the same
config plus `noUnusedLocals: true` it failed with
`TS6133: 'React' is declared but its value is never read` — so a consumer with that
option on could not compile the file the command had just handed them.

The preamble now says in a comment that it assumes the automatic runtime and that the
import goes back only on the classic `"jsx": "react"` transform, which is the one
configuration this costs: measured, that file reports one diagnostic about `React` being
out of scope. Nothing in the extension emits or promises a `jsx` setting — the string
does not occur anywhere in the package — and the published docs page for the command
already showed the output without the import.

A new pin, `src/__tests__/export-to-react-compiles.test.ts`, now extracts the template's
PRODUCT and compiles it under `noUnusedLocals`, rather than matching substrings in the
generator. The sibling objectui#7837 pin was green for the whole life of this line
because it never named it; a compile closes the class instead of one member of it. Its
positive control runs on every invocation: re-adding the import must report TS6133, so
the harness cannot go quietly, permanently green.

No public surface moved: no export added, no signature changed.
