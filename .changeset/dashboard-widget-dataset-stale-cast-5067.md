---
---

Internal only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared.

`DashboardRenderer.tsx`'s dataset-bound check (`const datasetBound = !!(widget as
any).dataset`) drops its `as any` (objectui#5067). The comment's stated reason —
"the bundled DashboardWidget type gains `dataset` only after objectui bumps
`@objectstack/spec`" — is stale: the repo already carries `@objectstack/spec@17.0.0`,
whose `DashboardWidget` declares `dataset`, and `packages/types/src/complex.ts`'s
`DashboardWidgetSchema` inherits it through its `extends Omit<Partial<SpecDashboardWidget>,
…>` (`dataset` is not in the `Omit` list). `widget.dataset` type-checks directly; the cast
was pure redundant widening, and a harmful one — after `as any`, `.dataset` reads as
`any`, so a future spec change to that key's shape would not go red here.

**No runtime behaviour changes.** `!!(widget as any).dataset` and `!!widget.dataset`
evaluate identically for every input; `as any` is a compile-time-only annotation. Proven
with a reverse check: temporarily typo'ing the property to `widget.datasetTypoXYZ` turns
`pnpm --filter @object-ui/plugin-dashboard type-check` red with `TS2339: Property
'datasetTypoXYZ' does not exist on type 'DashboardWidgetSchema'`, confirming the removed
cast was suppressing real type coverage rather than papering over a genuine gap.

The ADR-0021 point the original comment made — a dataset-bound widget renders through
the governed `queryDataset` path (`DatasetWidget`) instead of the inline object-aggregate
schema — is unchanged and kept; only the now-false justification for the cast is rewritten.
