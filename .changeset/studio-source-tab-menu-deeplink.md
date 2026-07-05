---
'@object-ui/app-shell': minor
---

Studio Interfaces: move the source-page code editor into a "Source" inspector tab, silence its bogus TypeScript errors, and deep-link menu selection.

For `kind:'html'`/`kind:'react'` pages (a `source` string, not a block tree), the code editor now lives in a dedicated **Source** tab in the right-hand properties panel while the canvas shows only the live preview; edits flow through the shared draft so the preview stays in sync. The `SourcePageEditor` gains a `mode` prop (`split` | `editor` | `preview`) to render the halves independently, and a `beforeMount` hook disables the Monaco TypeScript worker's semantic/syntax validation (and configures JSX) so JSX-flavoured HTML — intrinsic tags like `<flex>`, no `import React`, `style={{…}}` object literals — no longer floods the gutter with meaningless red squiggles (the live preview and server-side validation remain the source of truth). Selecting a menu now records the open surface as `?surface=<type>:<name>`, so the design target is shareable and survives a reload instead of snapping back to the first nav leaf.
