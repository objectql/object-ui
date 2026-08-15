---
'@object-ui/core': minor
'@object-ui/app-shell': minor
---

Action param `visible`: one dialect answer, and a fault that is fail-open and LOUD

`ActionParamDialog`'s `filterVisibleParams` was the last predicate face never
converted to the canonical entry. It evaluated each param's `visible` on a bare
`ExpressionEvaluator` inside `try { … } catch { return true }`, and that produced
two defects at once (objectui#4640, measured on `main`):

- **Silence.** Three of the four fault shapes emitted nothing at all — an
  unparseable source, an unbound identifier and a faulting legacy predicate all
  resolved without a word, so a broken `visible` was indistinguishable from an
  absent one. The standing 2026-08-06 ruling on objectui#4051 /
  objectstack#5149 names silence as the one option that is not available.
- **The fail DIRECTION was decided by the predicate's dialect, not by the
  surface.** A bare string ran the legacy JS evaluator (lenient → falsy → param
  silently DROPPED); a `{ dialect, source }` envelope ran CEL (fault → param
  silently KEPT). One `visible` key, two opposite outcomes, chosen by whether
  the authored text happened to contain `${…}` / `===` — the objectui#3314
  shape. Both halves hurt: a dropped param means the dialog never collects a
  value the server requires and the action fails at submit with nothing pointing
  at the predicate; a kept one offers a field the backend rejects.

`filterVisibleParams` now routes through `evalRowPredicate`. A param whose
`visible` cannot be evaluated is **shown**, and reported once, with the action
and the param named and the predicate quoted. Fail-open is the ruled direction
for this surface: an extra offered field is rejected by the server with a
message, while a silently hidden required param is undiagnosable. (Row surfaces
keep failing closed — there the harm runs the other way.) Boolean and blank
predicates are answered before the evaluator, so `visible: false` hides the
param and an empty predicate is not reported as broken.

**Behaviour change worth knowing before you upgrade.** On the canonical CEL
engine an ABSENT key is a runtime fault, not a falsy read. A param gated on
`features.phoneNumber == true` in a deployment whose scope carries no
`phoneNumber` key at all now takes the fail-open branch: the param is SHOWN,
with a warning naming it, where it used to be hidden. The conservative outcome
is still available, in the spelling that is portable to the server's own engine:

```
has(features.phoneNumber) && features.phoneNumber == true
```

Deployments that DECLARE the flag (`features: { phoneNumber: false }`) are
unaffected — that is a genuine verdict on both engines, and it did not move.

`@object-ui/core` gains the two evaluator changes this needed:

- `evalRowPredicate` accepts **`rowless`** — "this surface has no row of its
  own", so nothing is bound over the host scope and a `record` / `data` the
  scope carries survives instead of being shadowed by an empty row. Row surfaces
  are untouched: without the option the row is still the subject (objectui#3796).
- A faulting **`{ dialect, source }` envelope now reports its own source**.
  It used to print the literal `"(expression)"`, and because the warn-once key
  is (label, predicate), the first faulting envelope under a label silenced
  every other one. The envelope is what `@objectstack/spec` normalizes every
  authored predicate into, so this was the likeliest shape in served metadata
  and the least diagnosable one.
