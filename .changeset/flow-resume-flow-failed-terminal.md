---
'@object-ui/app-shell': patch
---

A flow-run failure that arrives as `400 FLOW_FAILED` — and any `404` on the flow route — is now classified as terminal rather than retryable.

`interpretFlowResponse` tested `!res.ok` first and returned `retryable: true` for
everything it caught, so every non-2xx was treated as a transport failure. That
flag is what `FlowRunner` reads to decide whether to keep the wizard dialog open:
a transport failure did not consume the suspension, so retrying the same run is
meaningful, while a flow failure is terminal because the engine consumes the
suspension before running downstream nodes (resume-once) and a retry can only
reach "No suspended run".

Two classes were landing on the wrong side of that line:

- **`400` + `FLOW_FAILED`** — the flow ran and failed. objectstack#8684 moves this
  exact event off `200 {data:{success:false}}` onto a real status code, inheriting
  the objectstack#3962 ruling that business failures must not ride HTTP 200 inside
  a double envelope. Landing this read **first** is the maintainer's explicit
  sequencing (ruling of 2026-08-15, sub-decision 3): had the backend flipped
  first, a terminal node failure would have kept the wizard open offering a retry
  guaranteed to fail. Forward-compatible — nothing sends that body yet, so the arm
  is dormant until it does. Only this code qualifies; the route's other 400s
  (`INVALID_SIGNAL`, `INVALID_SCREEN_INPUT`) are refused before the signal reaches
  the engine's variable map, so the suspension survives and a corrected resubmit
  stays meaningful.
- **`404`** — no such suspended run, or no such flow. This half is **not** dormant:
  the route already answers `404 No such suspended run` today, and each one had
  been keeping the wizard open for a retry that could only 404 again. Keyed on the
  status alone, since a proxy or unmounted-route 404 carries no envelope to read a
  code from.

The flow's authorable `errorMessage` is preferred again on the failing path. The
error envelope carries no `data`, so it is read from `error.details` — the
envelope's own declared carrier for structured extras, and the only slot that
survives to the wire once `splitSemanticCode` promotes `details.code`. Absent, the
message degrades to the envelope's own `error.message`, never to silence.
