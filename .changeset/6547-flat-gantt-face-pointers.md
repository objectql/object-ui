---
'@object-ui/types': patch
---

`ObjectGanttSchema`'s flattened gantt face documents `colorField`, `parentField`,
`tooltipFields` and `quickFilters` in its own words, instead of pointing at a type that
says nothing about them (objectui#6547).

Those four members carried a bare `See {@link GanttConfig}.` pointer. `GanttConfig` is
`SpecGanttConfig & { … }`, and all four arrive from the **spec** half: the local half of
that intersection declares exactly ten top-level members (`timeSegments`, `lockField`,
`objectField`, `summaryExtent`, `defaultCollapsedDepth`, `borderColorField`,
`dependencyTypes`, `timeZone`, `exportFileName`, `interactions`) and none of these four is
among them. `SpecGanttConfig` is `z.input<typeof GanttConfigSchema>`, and the spec's
emitted `.d.ts` carries no per-member JSDoc — its 19 members are bare `z.ZodOptional`
entries under one type-level "Gantt Settings" docblock. So the pointer was not merely
unhelpful, it was misdirecting: a reader who followed it landed on a type documenting
nothing about the key and concluded the key was undocumented.

Verified on the built artifact rather than the source: all four bare pointers were present
in `dist/objectql.d.ts` before this change and none is after, so the defect was on the
published surface and the repair reaches it.

**Prose only — the published shape is unchanged, and that is the point.** The natural
repair, writing the prose onto `GanttConfig`, means re-declaring these members inside the
intersection; PR objectui#6546 measured that as a widened published surface on the built
`dist/index.d.ts` and it was rejected there. So the shape was measured, not asserted:
`ObjectGanttSchema`'s 45 members and their checker-resolved types are byte-identical
before and after, and the built face's 51 declaration lines diff clean with comments
stripped. Only comment bytes moved.

The seven **member-qualified** pointers (`See {@link GanttConfig.borderColorField}`,
`.lockField`, `.summaryExtent`, `.defaultCollapsedDepth`, `.timeSegments`,
`.interactions`, `.exportFileName`) name members of that ten-member local half, resolve to
real prose, and are deliberately left alone — the defect is the bare form, and a substring
search for `{@link GanttConfig` hits both.

The prose is taken from the renderer's live read sites in `plugin-gantt`, not invented:
`colorField`'s status/state/priority/severity fallback chain and the platform default
blue, `parentField`'s unknown-id-renders-as-root rule, `tooltipFields`' drop-empty-rows
behaviour (which is what lets a mixed-object tree list the union of every level's fields)
and its replacement of the default date · duration · progress tooltip line, and
`quickFilters`' schema-resolved option domains. No behaviour change, no runtime code.
