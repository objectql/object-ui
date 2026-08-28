---
'@object-ui/types': minor
'@object-ui/core': minor
'@object-ui/components': minor
---

The register-meta key `defaultChildren` is retired (objectui#5051).

It was declared in four places, produced in eleven, and read in **none**. The designer's
drop path builds a new node from its twin key only — `PageDesigner.tsx`,
`props: paletteItem?.defaultProps ?? {}` — with no `children:` line, so a palette item
that declared `defaultChildren` dropped an **empty** node and the declared children never
materialised. Nothing rendered the wrong thing; an entire declaration surface was simply
inert, which is the declared-but-unenforced shape ADR-0049 targets. Per the maintainer
ruling of 2026-08-19, the key is removed rather than wired up; if designer
default-children UX is ever product-wanted it returns as its own designed card.

**If you author plugins against the published register-meta table, drop the key.** It is
gone from `skills/objectui/guides/plugin-development.md`, which had been teaching it. A
meta that still declares it stays *valid*: `ComponentMetaSchema` is a plain `z.object`,
and measured on zod 4.4.3 that STRIPS unknown keys rather than rejecting them — so the
key is silently dropped from the parse output instead of failing validation. TypeScript
authors get the loud signal instead: all three `ComponentMeta` declarations
(`@object-ui/types` `base.ts` and `plugin-scope.ts`, `@object-ui/core` `Registry.ts`) no
longer offer it, so re-declaring it is now a compile error.

**No runtime behaviour changes in either direction.** No code path read the key before
this change, and the eleven producers that set it (`sidebar.tsx` x10, `span.tsx`) were
feeding a reader that did not exist. Dropping a `span` or any of the ten sidebar types
into the designer produces exactly the node it produced yesterday.

Two suites keep it retired, one per package: `packages/types` pins the zod twin (the key
is absent from the parse output, with a surviving sibling asserted present through the
same parse as the control) plus the two TS twins with `@ts-expect-error`, and
`packages/core` pins the registration surface the eleven producers were written against.
Both are compile-time-enforced through each package's chained `tsconfig.test.json`.
