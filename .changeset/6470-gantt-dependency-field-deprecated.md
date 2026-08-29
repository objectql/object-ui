---
'@object-ui/types': patch
'@object-ui/plugin-gantt': patch
---

`ObjectGanttSchema.dependencyField` is now marked `@deprecated` on both published
declaration faces, naming `dependenciesField` as the canonical spelling
(objectui#6470). Nothing is removed and nothing is rejected that was accepted
before.

**What the two spellings were.** `ObjectGanttSchema` declares both, and
`getGanttConfig`'s flat branch reads them with a `||`:
`dependenciesField: schema.dependenciesField || schema.dependencyField`.
`dependenciesField` is the spec's key (`@objectstack/spec`
`GanttConfigSchema.dependenciesField`); the singular `dependencyField` has NO
spec counterpart — zero occurrences across `packages/spec/src`, measured against
a live positive control on the plural. Until objectui#6051 declared the plural,
the singular was the ONLY dependencies spelling this interface carried, so for
the whole time the alias existed the published type taught the non-spec key and
hid the canonical one.

**What was missing was the ranking, not the behaviour.** The two were declared as
equals: nothing on either face said which one to author, so a reader — including
an AI writing metadata, which is the reader this project optimises for — had a
coin flip between a spec key and pre-spec vocabulary. The marker turns that coin
flip into a fact the type itself carries, and the zod mirror's description makes
it readable at runtime as well as in an editor.

This adopts the idiom already ruled for this exact shape rather than inventing a
second one: `KanbanConfig`'s pre-#2231 aliases (`groupField`, `cardFields`) carry
`/** @deprecated legacy alias for the spec's X */` plus
`.describe('Deprecated alias for X')`, and `dependencyField` now reads the same
way.

**⛔ Not a removal, deliberately.** Deleting the alias — or narrowing the
renderer's `||` — would break every author who wrote the singular and narrow the
accept set of a published surface. That is a maintainer decision on a future
enforce-or-remove card once the deprecation has sat a release, and it is
explicitly excluded here. Two pins hold the line in both directions:
`packages/types/src/__tests__/gantt-dependency-field-deprecated-alias.test.ts`
fails if the marker goes missing AND if the alias stops being declared or
accepted, and `packages/plugin-gantt/src/ObjectGantt.dependencyAlias.test.tsx`
fails if the `||` limb is dropped — the two spellings must keep resolving to the
same config, with the canonical one winning when both carry a value.

`packages/plugin-gantt/README.md`'s `ObjectGanttSchema` example authored the
singular; it was the only in-repo site that did, and it now authors the plural
with the alias named as legacy. No runtime code, fixture, example app or catalog
schema authored it.
