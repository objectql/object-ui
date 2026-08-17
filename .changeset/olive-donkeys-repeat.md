---
"@object-ui/plugin-grid": patch
---

The list row kebab now ANDs the RECORD-level write verdict, not just the object-level grant (objectui#4296). A user holding a broad object grant under `writeScope: 'own'` was offered Edit and Delete on every row they could read, including rows the server refuses with `403 "You do not have access to this record"` — while the record detail header, which has folded the record-grained verdict since objectstack#3821, correctly hid both on the same record for the same user. `ObjectGrid` now asks the same authority the detail header asks (`security/explain`), batched once per (object, operation) for the rows on screen using the `recordIds` form from objectstack#8326, and feeds the answer through the row menu's existing per-row visibility decision — so a denied row loses its entries entirely rather than growing a disabled one, and grows no empty overflow trigger.

Fails open on every uncertainty: a row with no verdict yet, an endpoint that is absent or failing, a row missing from the answer, or a row with no id keeps the object-level rendering this list had before. The server remains the authority; hiding a capability on missing data would be worse than the wasted click this removes. No public entry export changes.
