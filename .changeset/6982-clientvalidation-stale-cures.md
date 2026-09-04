---
---

Retire the unreachable flow node-type shim in the metadata admin's client
validator, and re-pin the `sharing_rule` edit-door boundary on the reason that
is still true.

No published behaviour changes. The removed shim was measured unreachable on the
resolved `@objectstack/spec` 17.2.0 — `FlowNodeSchema.type` is an open non-empty
string, so the closed-enum mismatch it suppressed can no longer be produced, and
the one issue that path still yields (`too_small` on the empty string) is one the
shim already kept. The `sharing_rule` opt-out's membership is unchanged; only its
stated reason and its pins moved.
