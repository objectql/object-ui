---
'@object-ui/components': minor
---

Stop scanning this package's own TEST files into the published stylesheet
(objectui#8446).

**The bloat was the mild half — this was a false-green generator.** Tailwind v4
scans source *text*, not an import graph, and `src/index.css` declared
`@source '../src/**/*.{ts,tsx}'` with no exclusion. All 243 test files under
`src/**/__tests__/` were therefore sources for the published `dist/index.css`,
so a class-shaped token written as a test's *expected value* compiled a real
utility into the shipped bundle — meaning a test could create the production
utility it was asserting on. Measured on #8435: `.\32 xl\:grid-cols-6` was
present in the sheet with the *unfixed* renderer on disk, sourced entirely from
assertion strings. Anyone reading "the class is in the stylesheet" as evidence
the renderer worked would have been reading their own test back.

Two `@source not` lines are added, matching the spelling already used by
`fields`, `plugin-grid` and `plugin-kanban`.

**Published bundle change — eight rules are removed**, measured by compiling
`src/index.css` through this package's own postcss + `@tailwindcss/postcss`
pipeline before and after, from the directory `pnpm build` runs in:

    .flex-grow  .flex-nowrap  .h-[125px]  .isolate
    .paused     .shrink       .text-green-500  .w-[250px]

Nothing is added. Every one of the eight was named **only** by a test file:
`.h-[125px]` / `.w-[250px]` are `<Skeleton>` fixture sizes in
`snapshot-critical.test.tsx`, and `.flex-grow` came from a *prose sentence in a
JSDoc comment* that mentions the CSS property `flex-grow: 50`. No non-test
source in the package names any of them.

**Who could notice.** A consumer running their own Tailwind build (as every
example app here does) generates utilities from their own markup and is
unaffected. Authoring these classes in runtime page metadata was already
unsupported — the 2026-06-30 amendment to ADR-0080 under ADR-0065 states that a
utility class in page source "produces CSS only if that exact class happens to
already appear in objectui's own source", and `os validate` warns
`page-source-className-tailwind`. That incidental "happens to appear" is exactly
what is being removed. The narrow case that *can* regress is an app which
imports only the prebuilt `@object-ui/components/style.css`, runs no Tailwind of
its own, and hand-writes one of the eight in its own JSX; `.isolate`,
`.shrink`, `.flex-nowrap` and `.text-green-500` are plausible there. Scored
`minor` for that reason, not `patch`. `.flex-grow` and `.shrink` additionally
have surviving canonical spellings — `.grow` and `.shrink-0` remain in the
sheet, and this repo already migrated `flex-grow-N` → `grow-N` deliberately.
