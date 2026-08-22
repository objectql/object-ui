---
'@object-ui/types': patch
---

`DashboardComponentSchema.dateRange.defaultRange` is now bound to
`DateRangeDefaultRange` from `@objectstack/spec/ui` instead of restating it as a
hand-written 14-member union (objectui#4984).

The union was byte-faithful to the spec — all 14 members, same order — so nothing
a user hits changes today. What was missing is the tie that keeps it faithful:
`resolveDashboardFilterDefs` takes `Pick<DashboardComponentSchema, 'globalFilters' |
'dateRange'>`, so this union is what typechecks every TS-constructed dashboard, and
a preset the spec ADDS would have been a legal document that objectui's own types
said could not exist — the "narrower than the contract it implements" shape whose
consequence in objectui#4163 was that the bad reads were invisible to `tsc`.

No gate reported it: `check:spec-symbols` rule 1 matches by NAME and an inline union
on an interface member has no symbol to collide with, while rule 2's claim heuristic
was waved through by the `SpecGlobalFilter` reference a few lines above. Binding makes
the file's existing "Aligned with @objectstack/spec" comment structural rather than
prose.

The emitted `.d.ts` collapses the inline union to the imported alias; the published
type surface is unchanged — measured with the TypeScript checker over the emitted
declarations (679 reachable exports from `dist/index.d.ts`, 22 from `dist/complex.d.ts`,
and `defaultRange` resolving to the same 14 string-literal members before and after).
