---
---

Test-only: pin that `record:alert`'s CTA honours an action's `resultDialog` through the
surrounding provider's shared `ActionRunner`, and that with no provider the CTA falls back
to a local, unwired runner that discards the value and warns. No published behaviour changes.
