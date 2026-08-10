---
"@object-ui/cli": patch
---

`objectui doctor` now diagnoses Tailwind 4 instead of Tailwind 3

The Tailwind section of `objectui doctor` was written against v3 and got every
question backwards on a v4 project — which is every project this repo ships.

**It counted a missing `tailwind.config.js` as an issue.** In v4 that file is not
part of the setup: the engine reads CSS-first configuration (`@import
'tailwindcss'`, `@theme`, `@source`) and only loads a JS config when a stylesheet
opts in with `@config`. So the command reported a problem that did not exist and
pushed the reader toward creating a file Tailwind would never read. Measured on
`examples/console-starter`, a correct v4 app: before, `Found 1 issue(s)` —
`⚠️ tailwind.config.js not found`; after, `Everything looks good! ✨`. The repo's
own root reproduced it identically.

**It then graded that file on its `content` array**, the v3 key `@source`
replaced. The two `tailwind.config.*` files still tracked here are exactly that
trap: `apps/console` and `examples/byo-backend-console` both declare a `content`
array, no stylesheet in the repo contains `@config`, so both files are inert —
and the old check answered `✓ Tailwind content paths configured` for them. A
false green on a dead file. `apps/console` before: `Everything looks good! ✨`;
after: one finding saying the config is inert and what to do about it.

**It never checked `@tailwindcss/postcss`**, the one dependency a v4 build cannot
start without — v4 moved the PostCSS plugin out of `tailwindcss` into that
package, and naming the old `tailwindcss` key in a PostCSS config resolves to a
shim whose only job is to throw. That is the failure form objectui#3852 measured
on the generated app, and doctor printed `✓ Tailwind CSS installed` straight
through it.

The checks are now the v4 contract, matching what `objectui init` scaffolds:
`@tailwindcss/postcss` declared or installed, a PostCSS config naming it rather
than the v3 `tailwindcss` key, and a CSS entry running `@import 'tailwindcss'`
(with `@source` acknowledged when present). The declared `tailwindcss` major is
read too, so a v3 range is named as migration debt instead of passing as
`✓ installed`.

Two deliberate silences, because objectui#3891 is about doctor asserting things
it cannot see. A **missing** `tailwind.config.*` produces no finding of any level
— only a *present* one does, and only when nothing opts into it via `@config`.
And when no recognised CSS entry exists at all (a monorepo root, a bespoke
layout), the CSS verdicts are skipped rather than guessed.

A v3-tolerant dual path — branching on the declared major and running two sets of
checks — was considered and deliberately not built: it widens the product surface
past this repo's v4-only posture. v3 spellings are diagnosed as migration debt,
not supported as a second mode.

Internally `runDiagnostics(cwd)` now returns structured findings carrying a
stable `id`, and `doctor()` only renders and counts them. That split is what
makes the matrix testable against real fixture directories instead of scraped
console output; the tests pin verdicts by `id`, so wording can improve without
the coverage evaporating.
