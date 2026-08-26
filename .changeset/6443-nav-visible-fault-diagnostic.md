---
'@object-ui/app-shell': patch
---

A nav / area / field `visible` predicate that FAULTS now says so, in both builds, once per
distinct predicate source (objectui#6443). Observability only — no verdict moves.

`ExpressionProvider.evaluateVisibility` is the gate behind a navigation item's `visible`,
an area's derived visibility, and the field list `RecordFormPage` renders. It is fail-open:
a predicate that cannot be evaluated returns `true`, so a menu entry whose role gate has
stopped working renders **for everyone — including the role it was written to exclude** and
looks exactly like an entry the author meant to show.

That fault was swallowed one layer down. `evaluateCondition` is fail-soft: it answers an
unevaluable predicate with `true` from its own `catch` and does not throw, so this site's
`try/catch` never saw a predicate fault at all. Measured per dialect at this site before the
fix — the bare-string dialect, the one a live gate was measured breaking on, printed
**nothing at all**:

| dialect | console at this site, before | after |
|---|---|---|
| bare string | nothing | one named line |
| `{ dialect: 'cel' }` envelope | one generic line | one named line (the generic one is *replaced*, not added to) |
| `${…}` template | one generic line **per evaluation** | one named line, deduped |

The fix wires `EvaluationOptions.onFault` (the seam objectui#6038 landed) to
`reportUnresolvableVisibilityPredicate`, exported from `@object-ui/react` — the same
reporter, message, severity, dedupe `Set` and rate limit the node gate and `page:tabs`
already use, so one authored predicate is entitled to one line rather than one line per
package. It costs no extra engine call: the evaluator hands back the reason at the point it
already knows the predicate faulted, with no `throwOnError` double evaluation.

A nav item is not a schema node, so the reporter's `type` slot — which, with the gate key
and the predicate source, is the dedupe key — is the constant `app-shell:visible`. The rate
limit is therefore **one line per distinct authored predicate source**, not one per menu
entry: a broken role gate copy-pasted across eight entries is one authoring mistake, in one
string, fixed in one edit.

**Fail-open is unchanged.** The item still renders for everyone on a fault. Flipping that to
fail-closed is a permission-boundary change, not a diagnostic, and is not this change's to
make; the change makes the silence stop and nothing else.
