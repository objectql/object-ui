---
'@object-ui/plugin-detail': minor
---

`detail-section`'s `headerColor` input is now the closed six-token vocabulary it
has been contractually since objectui#6594, instead of a free-form `string`.

**Breaking for authors, deliberately** (objectui's own breaking changes ship as
`minor` — AGENTS.md 版本号策略). The registration declared
`{ name: 'headerColor', type: 'string' }`, unchanged since before the vocabulary
was ruled, while `DetailViewSection.headerColor` and its `@object-ui/types/zod`
mirror are a six-member `z.enum` — `muted`, `muted/50`, `accent`, `primary/10`,
`secondary/10`, `destructive/10` — matching `@objectstack/spec`'s strict
`record:details` section schema (maintainer ruling A, 2026-08-26,
objectstack#12126). The two ends disagreed about what an author may write: the
registration said "any string", the validator said "one of six".

`inputs` is not documentation. `detail-section` is outside `PUBLIC_BLOCKS`, so
it never reaches `sdui.manifest.json` — but `PageRenderer` builds the JSX-page
compiler's manifest from `getKnownTypes()` plus these same `inputs`, and
`sdui-parser`'s `validateTree` judges an authored page against it. Before this
change a value outside the six drew no diagnostic there at all; it now draws an
`invalid-enum` **error** naming the prop and listing the legal tokens, so the
refusal arrives while the page is being written rather than at parse time — or,
for a value that happened to render under some host app's Tailwind build, never.

Two things that did NOT change, and are pinned as such:

- **The renderer's verbatim `bg-*` pass-through is untouched.** `headerColorClass`
  still hands a complete `bg-*` class through unmodified. It stays an
  **undeclared** affordance: ruling A refused to declare it, because whether such
  a class renders depends on the host app's Tailwind build. That is why the input
  declares exactly ONE arm — a `'string'` arm beside the enum would clear every
  value again and declare the pass-through by accident.
- **`@object-ui/types` is unchanged.** It was already correct; the published enum
  is derived from `headerColorVocabulary` rather than hand-copied, so the
  one-to-one pin objectui#6594 established carries this surface too.

Authors writing one of the six are unaffected. An author writing anything else
was already being refused by the validator and is now told so at authoring time.
