---
---

Test-only: `record:alert`'s own suite stubbed BOTH ends of the predicate pipeline —
an identity `toPredicateInput` that only recorded its argument, plus a `useCondition`
pinned to a constant — so the banner's `visible` verdict was unobservable from the one
file that covers this renderer (objectui#3941). The only assertable fact left was "the
renderer handed `props.visible` to something"; any normalization or evaluation defect
stayed green, which is where objectui#3871's defect (a `${…}`-spelled predicate
double-wrapped, unparseable, and — on this fail-soft surface — resolved to a constant
`true`, i.e. a conditionally-authored banner permanently visible) sat unseen.

The data-layer doubles (record context, the metadata fetch behind the CTA, the action
dispatch) stay; the predicate entry is now the shipped one (real `toPredicateInput` +
`useCondition`, with the real `PredicateScopeProvider` for the ambient-scope case), and
the verdict is pinned for every authorable shape in both polarities: `false` hides,
`true` shows, `''` is not a declared gate, and a bare expression / a `${…}` template /
a `{ dialect: 'cel' }` envelope each keep their own verdict when the record makes them
hold and when it makes them fail. Restores the regression detector for this surface;
no published behaviour changes.
