---
---

Test-only change: pins the target-required degrade set (`{lookup, master_detail}`) equal
across `@object-ui/app-shell`'s `paramToField` and `@object-ui/plugin-grid`'s
`bulkParamToField`, which were two independent statements of one rule with nothing
mechanical holding them together. No published behaviour changes, no new exported symbol,
and neither set's membership was touched — the pin derives each package's effective set
through its own adapter and asserts the contents equal.
