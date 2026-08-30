---
---

Dev-only + test-only change; no published behaviour changes.

The `object` preview sample (`apps/console/src/preview-samples.ts`) now spells its
lookup target `reference` instead of the by-name-refused `reference_to`, and the
`KNOWN_STALE` ledger entry in `preview-samples-spec-valid.test.ts` records both
defects that actually remain. Neither file reaches a published entry point:
`preview-samples.ts` is imported only by `preview-gallery.tsx`, which is served
from the standalone `preview-gallery.html` Vite entry — not a `rollupOptions.input`
of the production build, so it is absent from the `dist` that `@object-ui/console`
publishes.
