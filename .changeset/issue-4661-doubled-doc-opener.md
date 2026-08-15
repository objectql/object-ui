---
---

Comment-only cleanup in `@object-ui/plugin-form`: the doc comment above `foldFormButtons`
in `ObjectForm.tsx` opened with two `/**` lines in a row, so the stray second opener was
rendered as the first line of the JSDoc body. Removed the redundant opener.

Declares no release: `foldFormButtons` is module-private, so it appears in no published
type declaration, and comments are stripped from the emitted JavaScript — the built output
is unchanged and no published behaviour differs.
