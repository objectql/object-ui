---
'@object-ui/app-shell': patch
---

Removed the dead `theme:` entry from `clientValidation.ts`'s `LOADERS` table, which
read `ThemeSchema` off `@objectstack/spec/ui` — a symbol the spec retired upstream
(objectstack#10485 / PR objectstack#10695, which deleted the whole `ui/theme.zod.ts`
module). `theme` was never a registered metadata type, so metadata-admin never asked
for it (objectui#5715).

This is dead-code hygiene, not a bug fix, and it changes nothing an author can
observe. Two measurements say why, and both cut against the more dramatic reading:

- The entry is not broken *today*. objectui's own `@objectstack/spec` pin (17.1.0)
  still publishes `ThemeSchema` as a working strict Zod schema — measured by
  importing the `ui` subpath and by ablation, where restoring the entry made
  `validateMetadataDraft('theme', ...)` actively reject a draft. The skew is with
  objectstack's `main`, not with what objectui installs, which is exactly why no
  gate here ever went red.
- It could never have crashed. `getSchemaForType` duck-checks the loader's result
  (`typeof schema.safeParse === 'function'`) and wraps the call in `try/catch`, so an
  `undefined` export degrades to a silent no-op validator, never a throw. After a
  future spec bump past the retirement that is the branch it would have taken.

The one thing that was genuinely off: `hasClientValidator` answers from key presence
alone, so it returned `true` for `theme` while the validator behind it would have
judged nothing. Per its own docblock that combination makes `ResourceEditPage` treat
live client issues as the error source and suppress the server's `_diagnostics` — a
stored item rendering as clean. Unreachable in practice, but it is the reason the
entry is worth removing rather than leaving inert.

The line is replaced by an absence note in the shape the file already uses for
`workflow` and `approval`, because re-adding this entry from the spec would
type-check and go green against the current pin. A metadata-admin theme editing
surface remains a separate capability decision.
