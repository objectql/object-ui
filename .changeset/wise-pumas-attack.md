---
'@object-ui/app-shell': patch
---

metadata-admin: diagnose a path on the right-hand side of `==` / `!=` in a visibility predicate

The predicate evaluator resolves paths only on the LEFT of `==` / `!=`. The right-hand side goes
through `parseLiteral`, which hands back anything it does not recognise as a literal verbatim — so
`data.a == data.b` compares the value of `data.a` against the seven-character string `"data.b"` and
is false however equal the two sides are, with nothing in the console. objectstack#6936's
unresolved-path warning cannot see this: it hangs on `resolveValue`, which the right side never
enters.

A dev-mode `console.warn` now fires when that tail returns something path-shaped (a dot-separated
identifier chain — the same grammar the left side accepts), naming the text, the predicate carrying
it, and the boundary. **No semantics change**: `data.a == data.b` still evaluates false, and the
before/after verdicts are pinned identical. The semantic fix belongs to publish-time predicate
validation (objectstack#7010) and to the real CEL runtime this file stands in for (ROADMAP M9), with
which this diagnostic retires.
