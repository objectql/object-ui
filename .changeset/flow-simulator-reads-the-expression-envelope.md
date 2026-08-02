---
"@object-ui/app-shell": minor
---

Flow simulator evaluates an edge guard stored as `{ dialect, source }` (objectui#3216).

A decision's out-edge whose guard is the ADR-0089 expression envelope — say
`{ dialect: 'cel', source: 'amount > 10' }` — was reported on the debug timeline
as `Branch has no condition.` and skipped. With `amount = 20` the simulation fell
through to the default branch (or dead-ended with "No branch matched"), while the
engine takes that branch at run time. A designer-time debugger that shows a
different route than the runtime is worse than no debugger, and it is the one
thing the simulator's own contract forbids: *never silently simulate semantics
that differ from the runtime*.

The envelope is not an exotic spelling. `ExpressionInputSchema` in
`@objectstack/spec` is a `ZodPipe`: parsing `condition: 'amount > 10'` **rewrites
it into** `{ dialect: 'cel', source: 'amount > 10' }`, and `FlowEdgeSchema.condition`
is that schema. So the shape the simulator could not read is the shape the
platform itself produces for every authored guard.

Two readers in `previews/simulator/` each hand-rolled `typeof c === 'string' ? c :
undefined`, while every other consumer in this repo already accepted both
spellings — `conditionText` (canvas labels, `FlowEdgeInspector`, the Branches↔edges
reconciliation) and `validateExpressionClient` (the Problems panel). Both now go
through `conditionText`, so "how an edge guard is read" has exactly one answer.
Its JSDoc says so, because a fifth hand-rolled copy brings this class of bug
straight back.

Two behaviours change, both toward the runtime:

- **Decision routing** — a branch guarded by an envelope is now evaluated, and
  selected when true. The timeline shows the CEL source it ran instead of
  "no condition". An envelope carrying only a compiled `ast` and no `source`
  (spec phase M9.2) still reports "no condition": there is nothing to evaluate,
  and the simulator says so rather than faking a result.
- **Preflight diagnostics** — `validateFlowDraft` warns that a decision has no
  default branch when *every* out-edge is guarded. A decision whose guards were
  envelopes was silently exempt from that warning; it is exactly as able to
  dead-end, so the warning now appears in the Problems panel and the canvas
  banner for those flows too.

**Type change:** `SimEdge.condition` is now the spec's `ExpressionInput`,
**imported** rather than restated — the last copy of the restatement objectui#3202
removed from `FlowDesignerEdge`. `string | { source?: string }` was wrong in both
directions at once: too wide, since it describes a `dialect`-less envelope the
server rejects; too narrow, since excess-property checking then refused the
canonical envelope written as a literal (`'dialect' does not exist in type
'{ source?: string }'`) — the one shape a persisted flow actually carries was the
one shape you could not write down. Compile-time assertions pin it in
`tsconfig.typetests.json`, the project CI actually type-checks.
