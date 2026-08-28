---
---

Comment-only fix: two `eslint-disable-next-line` directives were placed on the
wrong line and had never suppressed anything since they landed.

- `apps/console/src/pages/developer/PublicFormsPage.tsx` — the
  `react-hooks/exhaustive-deps` directive was an inline block comment inside the
  `useEffect(() => { load(); }, [])` statement, so its "next line" was a blank
  line, not the statement itself. Moved above the statement with the reason
  written out (mount-once by design; refresh is explicit via the Refresh
  button and post-mutation `await load()` calls).
- `packages/react/src/SchemaRenderer.tsx` — the
  `@typescript-eslint/no-explicit-any` directive's `--` reason wrapped onto a
  second comment line, so its "next line" was that continuation comment, not
  `type ForwardedProps = Record<string, any>;`. Collapsed to one line so the
  directive is immediately above its target.

No logic changes. Verified with `eslint --report-unused-disable-directives`:
both directives are now effective (the two warnings they were meant to
suppress are gone) and neither directive is reported unused.
