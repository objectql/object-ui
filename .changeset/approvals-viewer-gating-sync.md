---
"@object-ui/console": patch
---

fix(approvals-inbox): align participant gating with the server-computed `viewer` block

Consume framework#3310's per-viewer capability: `ApprovalRequestRow` gains an
optional `viewer: { can_act, is_submitter }`, and the approvals inbox's
participant checks (the reply box + the "why disabled" hint) prefer it over the
client-side identity heuristic when present. This keeps the hint from ever
contradicting the declared decision buttons — whose `visible` CEL now gates on
`record.viewer.*` — and correctly recognizes position/team-addressed approvers
that the client heuristic couldn't resolve. The heuristic remains as a fallback
for a backend that predates `viewer`.
