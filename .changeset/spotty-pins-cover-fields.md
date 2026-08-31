---
---

`scripts/__tests__/plugin-published-stylesheet.test.ts` now runs its per-package
assertions over `@object-ui/fields` as well as the two plugin sheets. Test-only:
no published package's source changes, so this declares "no release" explicitly
rather than bumping anything.

Fields is the package whose stylesheet has actually been shipping to consumers
since objectui#4059 — the defect the test's own header cites as the reason the
shape exists — and it was the one supplement sheet the suite did not cover. Its
`dist/index.css` was guarded only by the four write-time assertions inside the
shared builder, which run during a build; CI runs this suite on an unbuilt
worktree, so nothing in the test run inspected it. It could not be a subject
before objectui#6405 re-pointed it at the shared
`createPluginStylesheetBuilder`, because it ran its own copy and exported no
module surface.

The `CARD_THEMED` entry for fields is derived from the sheet the build actually
emits — the surviving classes whose declarations resolve a `--color-*` token
from components' unpublished `@theme` block — rather than read back off fields'
own `MUST_SURVIVE`, which would have pinned nothing.
