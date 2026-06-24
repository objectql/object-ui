---
"@object-ui/app-shell": patch
---

refactor(studio): derive the flow red-error highlight from the unified problem list (one validateFlowDraft pass)

Follow-up to #1972 (Problems panel + badges) and #1976 (clickable banner). The
flow preview still ran `validateFlowDraft` twice per render — once in
`buildFlowProblems` (badges / banner / panel) and again in a separate memo that
derived the red node/edge ring/stroke — with the cycle-highlight logic duplicated
between them.

`buildFlowProblems` is now the single validation pass: a new
`deriveInvalidElements(problems)` produces the red error set (errors only; a
cycle paints its whole loop via a per-problem `highlight` set while its badge +
reveal stay on the closing edge). The preview drops its second `validateFlowDraft`
call. The clickable banner (#1976), badges, and panel are unchanged — all four
surfaces now derive from one list, so they cannot drift.
