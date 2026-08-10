---
---

Test-only change, no behaviour and no authoring-surface change (objectui#3641).

Two filter-operator parity tests had lost their discriminating power to upstream
vocabulary growth. Both rested on the same pivot — is this operator a member of
`VALID_AST_OPERATORS`? — and that set is derived upstream from `AST_OPERATOR_MAP`
(`new Set(Object.keys(...))`). It grew until it spelled all 19 canonical
`VIEW_FILTER_OPERATORS` verbatim, `before` and `after` among them, which are the
exact pair whose missing bridge entries caused the silent full-table read these
tests were written for (objectstack#3948). Measured on the workspace's resolved
`@objectstack/spec@17.0.0-rc.5`: 19 view operators, 51 AST operators, 0 view
operators absent from the AST set.

With that overlap complete, both guards were satisfiable by doing nothing:

- `packages/plugin-list` — `mapOperator` degraded to the identity function kept
  every assertion in the file green, because each view spelling is itself
  AST-valid.
- `packages/data-objectstack` — the coverage sweep mirrored production's
  `?? op` tail, so a missing row fell back to the raw view spelling, which is now
  always AST-valid. Emptying `FILTER_OPERATOR_ALIASES` entirely left it green —
  precisely what that file's own header warns is "not a validation failure, it is
  an unfiltered query".

Re-anchored on pivots that vocabulary growth cannot cancel. plugin-list now pins
`mapOperator`'s **output** per canonical view operator against an explicit
19-row table read off the switch in `ListView.tsx` (not captured from its output,
which would fossilise a bug), with a totality ratchet failing in both directions
when the pinned rows and the spec vocabulary stop lining up — so a spec addition
lands red instead of as quiet slack, and so does a retirement (#3628 / #3601, the
mirror image). data-objectstack asserts the mapping row **exists**, with no
fallback. The membership and `isFilterAST()` sweeps are kept as a secondary
check: they still name why a wrong target matters, they are just no longer what
gives the files their teeth. The stale header claim that "8 of the 19 canonical
view operators are absent from the AST set" is replaced with what the guarantee
now rests on, stated without any count of the overlap — a hand-written number
beside a vocabulary that moves is what rotted here in the first place.

No production code changed: `mapOperator` and `FILTER_OPERATOR_ALIASES` are byte
for byte as they were on `main`.
