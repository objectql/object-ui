---
"@object-ui/app-shell": minor
---

Inspectors read AND write the `{ dialect, source }` expression envelope (objectui#3218).

The Hook inspector's "Run only when (optional CEL)" box rendered **empty** for a
hook that had a guard. `HookSchema.condition` is `ExpressionInputSchema` — the
same `ZodPipe` as `FlowEdgeSchema.condition` — so parsing `condition: 'amount > 10'`
**rewrites it into** `{ dialect: 'cel', source: 'amount > 10' }`. The envelope is
what a persisted hook carries; the inspector read `typeof draft.condition ===
'string'` and fell through to `''`.

An empty box is not a cosmetic defect here. `ConditionBuilder.emit` compiles only
the rows currently on screen, so the author's next edit **replaced** a guard they
were never shown (clearing it committed `condition: undefined`). Opening the
panel is safe on its own — `onCommit` fires only on a real edit — but the empty
box is what induces that edit.

**Read.** Every one of these surfaces now goes through `conditionText`, the one
reader objectui#3216 settled on, via a shared `expressionSource` /
`writeExpressionSource` pair. No new `typeof c === 'string'` was written.

**Write.** `source` was the only key the commit path preserved — everything else
in the envelope was discarded, because the commit sent a bare string and the
spec's pipe hardcodes `dialect: 'cel'`. Editing one character of a
`dialect: 'cron'` or `dialect: 'template'` guard silently moved it to a different
evaluation engine, and dropped `ast` and ADR-0089 `meta` (`rationale` /
`generatedBy` — the keys AI-authored metadata fills and nobody restores by hand).
An edit now:

| key | behaviour |
|:--|:--|
| `dialect` | **preserved** |
| `meta` | **preserved** |
| `source` | replaced |
| `ast` | **discarded** — it was compiled from the OLD source, so keeping it would leave the engine evaluating the old guard while the UI shows the new one. `objectstack compile` refills it, and `ExpressionSchema`'s `source \|\| ast` refinement still holds. |

With no prior envelope to preserve, the commit stays the bare-string shorthand —
which the spec's pipe normalizes to exactly `{ dialect: 'cel', source }`, so
nothing is lost and plain-`string` predicate fields keep round-tripping as
strings.

Four surfaces were in this family, not one:

- **Hook inspector** — `condition` (the reported defect).
- **Action inspector** — `visible` and `disabled` (`boolean | ExpressionInput`),
  same empty-box read.
- **The generic SchemaForm condition widget** — every predicate-named field
  (`visible` / `hidden` / `disabled` / `condition` / `predicate` / `*When`) routes
  here, and it did `String(value)`: an envelope reached the editor as the literal
  text `[object Object]`.
- **Object validations panel** — the rule `condition`, plus a third narrow read
  in the type switcher that dropped a persisted guard on the floor and left the
  skeleton's never-firing `'false'` in its place. `ValidationRuleDraft.condition`
  is now `ExpressionInput` instead of `string`.

The flow-edge inspector's **write** is fixed the same way; objectui#3216 had
converged only its read.

Fixtures in the new tests are authored input fed through `HookSchema.parse` — no
envelope is hand-written — so they cannot drift from the spec.
