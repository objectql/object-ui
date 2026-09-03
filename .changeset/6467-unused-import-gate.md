---
---

No published behaviour changes. Promotes the unused-import subclass of
`@typescript-eslint/no-unused-vars` to `error` (objectui#4806 R2, #6467) and
removes the 108 unused imports across 21 packages that the promotion finds.
Every edit is the deletion of an import binding that nothing referenced —
no runtime code, no exported API and no type surface moves, and the removals
are the upstream rule's own fixer output rather than hand edits.
