---
'@object-ui/types': minor
'@object-ui/plugin-gantt': minor
---

`ObjectGanttSchema` declares the flattened `GanttConfig` face `ObjectGantt`
actually reads (objectui#6051). `getGanttConfig` has two branches: when
`startDateField` and `endDateField` are both present at the TOP level it builds
its config from top-level keys and returns early; otherwise it reads the `gantt`
block. Everything the first branch reads was undeclared — and unlike
objectui#5903's ten, none of it was hidden behind a cast. `BaseSchema` carries
`[key: string]: any` (objectui#5155's structural ceiling) and the helper's
parameter was `ObjectGridSchema | any`, so `schema.colorField` type-checked as
`any` with no syntax anywhere to grep for. That is also why the census here is an
AST enumeration and not a compile-and-observe: an index signature absorbs every
literal name, so annotating the parameter compiles clean while enforcing nothing.

**27 keys join the declared surface, each additive and each with a live read
site.** 24 flattened `GanttConfig` members — `colorField`, `borderColorField`,
`dependenciesField`, `parentField`, `typeField`, `lockField`, `objectField`,
`summaryExtent`, `defaultCollapsedDepth`, `tooltipFields`, `baselineStartField`,
`baselineEndField`, `groupByField`, `resourceView`, `assigneeField`,
`effortField`, `capacity`, `quickFilters`, `autoZoomToFilter`, `timeSegments`,
`interactions`, `exportFileName`, `timeZone`, `dependencyTypes` — plus the three
query keys the fetch path reads, `staticData`, `filter` and `sort`. Nothing is
declared that the renderer does not consume.

**`GanttConfig` itself gains nine members and is a published type**, exported by
name from `packages/types/src/index.ts`: `lockField`, `objectField`,
`summaryExtent`, `defaultCollapsedDepth`, `borderColorField`, `dependencyTypes`,
`timeZone`, `exportFileName`, `interactions`. The entry file's diff is empty only
because the export list already named the type — the widening happened at the
declaration.

**The 28th measured key, `gantt` (the block face), is deliberately NOT declared**
— see the closing section.

The 24 are DERIVED from `GanttConfig` rather than restated, so the flat spelling
cannot fork from the block spelling, and the invariant is pinned in the type
system: every key of `GanttConfig` must be declared at the node's top level.
Making that derivation possible moved nine members — `lockField`, `objectField`,
`summaryExtent`, `defaultCollapsedDepth`, `borderColorField`, `dependencyTypes`,
`timeZone`, `exportFileName`, `interactions` — out of `plugin-gantt`'s
package-private `GanttConfigEx` and into `@object-ui/types`' `GanttConfig`. They
are a MOVE, not new vocabulary: the `gantt` block already honoured all nine, and
a type private to the plugin could be referenced by neither authoring face.

Both halves move together, as in objectui#5903: the TS declaration and its zod
mirror gain the same 27 keys at the same requiredness (all optional), the
spec-modelled ones taken from `GanttConfigSchema.shape` by reference, so the
`zod-mirror-parity` ratchet stays at zero drift for this pair and no `KnownDrift`
or `UnmirroredDeclared` entry is added. The mirror builds the flat face and the
`gantt` block from one field map, so they are one schema expressed twice.

Accept-set change, stated plainly. All 27 keys are additive — every one is
optional, and nothing previously legal loses its slot. What changes is that a
**declared** key is now type-validated, so `capacity: 'one'` and
`summaryExtent: 'parent'` are refused where they used to parse green. An
**undeclared** key is still accepted — `BaseSchema` is `.passthrough()`, so this
bought no rejection of misspellings. There is no narrowing anywhere in this
change.

**`gantt` is severed on purpose (objectui#6475), not overlooked.** It is the 28th
key of the measured residue and a genuine read — `getGanttConfig`'s second branch
honours it in full — but it is the one key whose declaration would NOT have been
additive. It has no mirror entry today, so a block rides through `.passthrough()`
unvalidated; declaring it as `GanttConfig` means it gets parsed against the spec's
`GanttConfigSchema`, which REQUIRES `startDateField`, `endDateField` and
`titleField`, and `ObjectGanttSchema` reaches the CLI's `validate` / `check`
through `AnyComponentSchema`. A published CLI's refusal behaviour is decided on
its own card, where reviewers can see what they are approving; objectui#6475
carries the full measurement, including the case FOR enforcing it (the renderer
already feeds that block to `GanttConfigSchema.safeParse` and warns, so enforcing
restores declared = enforced rather than inventing a contract). Today's behaviour
is pinned in the test file so the omission is a measured state, not a silent gap.
`packages/types/src/__tests__/gantt-flat-config-declared-keys.test.ts` pins both
halves so neither can be misread.

Which face WINS is unchanged and was not decided here: the flat branch is checked
first and returns early, so a node carrying both spellings still renders the flat
one. (`plugin-map` had the opposite precedence ruled on in objectui#5018; no
equivalent ruling exists for gantt.)
