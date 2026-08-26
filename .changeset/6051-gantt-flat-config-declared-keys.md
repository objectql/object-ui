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

**28 keys join the declared surface, each additive and each with a live read
site.** 24 flattened `GanttConfig` members — `colorField`, `borderColorField`,
`dependenciesField`, `parentField`, `typeField`, `lockField`, `objectField`,
`summaryExtent`, `defaultCollapsedDepth`, `tooltipFields`, `baselineStartField`,
`baselineEndField`, `groupByField`, `resourceView`, `assigneeField`,
`effortField`, `capacity`, `quickFilters`, `autoZoomToFilter`, `timeSegments`,
`interactions`, `exportFileName`, `timeZone`, `dependencyTypes` — plus `gantt`
(the block face itself) and the three query keys the fetch path reads,
`staticData`, `filter` and `sort`. Nothing is declared that the renderer does not
consume.

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
mirror gain the same 28 keys at the same requiredness (all optional), the
spec-modelled ones taken from `GanttConfigSchema.shape` by reference, so the
`zod-mirror-parity` ratchet stays at zero drift for this pair and no `KnownDrift`
or `UnmirroredDeclared` entry is added. The mirror builds the flat face and the
`gantt` block from one field map, so they are one schema expressed twice.

Accept-set change, stated plainly. All 28 keys are additive as KEYS — every one
is optional, and nothing previously legal loses its slot. What changes is that a
**declared** key is now type-validated, so `capacity: 'one'` and
`summaryExtent: 'parent'` are refused where they used to parse green. An
**undeclared** key is still accepted — `BaseSchema` is `.passthrough()`, so this
bought no rejection of misspellings.

One key's VALUES get stricter and it is worth naming: `gantt` had no mirror entry
at all, so a block rode through `.passthrough()` unvalidated; it is now parsed as
`GanttConfig`, which derives from the spec's `GanttConfigSchema` and REQUIRES
`startDateField`, `endDateField` and `titleField`. That is not a new contract —
`getGanttConfig`'s block branch already fed the block to
`GanttConfigSchema.safeParse` and logged `[ObjectGantt] Invalid gantt
configuration` on failure. The declared face now equals the face the renderer was
already checking.
`packages/types/src/__tests__/gantt-flat-config-declared-keys.test.ts` pins both
halves so neither can be misread.

Which face WINS is unchanged and was not decided here: the flat branch is checked
first and returns early, so a node carrying both spellings still renders the flat
one. (`plugin-map` had the opposite precedence ruled on in objectui#5018; no
equivalent ruling exists for gantt.)
