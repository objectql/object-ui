---
"@object-ui/core": patch
"@object-ui/app-shell": patch
---

Action params support a `visible` CEL predicate — the param dialog omits a param
when it evaluates false, against the same scope as action `visible` (features /
user / app / data). Fixes the create-user form offering a **Phone Number** field
the default backend rejects ("Phone numbers require the phoneNumber auth plugin"):
paired with the framework gating that param on `features.phoneNumber`, the form
now follows the plugin — no phone field unless the opt-in phoneNumber auth plugin
is loaded. `filterVisibleParams` is exported + unit-tested (feature-off hides,
feature-on shows, malformed predicate fails open).
