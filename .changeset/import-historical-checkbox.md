---
"@object-ui/plugin-grid": patch
"@object-ui/types": patch
---

feat(plugin-grid): "Import as historical data" option in the Import Wizard (framework #3479)

Adds a checkbox to the Import Wizard's options panel that sends `treatAsHistorical`
on the import request. When on, the server skips the object's `state_machine` rule so
mid-lifecycle rows — a batch of already-`closed` tickets, `closed_won` deals — aren't
rejected by `initialStates`. Off by default: a normal import still walks the FSM, so
the exemption is always an explicit opt-in.

Pairs with the framework side (objectstack #3483). `ImportRequestOptions.treatAsHistorical`
is added to `@object-ui/types`, and `assembleImportRequest` threads it through both the
inline and named-mapping request shapes (sent only when on).
