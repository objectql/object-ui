---
"@object-ui/app-shell": minor
---

ADR-0090 D6 — "why can this user access?" panel in the Studio Access pillar
(framework#2696).

New `AccessExplainPanel` (right-side sheet, opened from the Access pillar
header next to the permission matrix): pick a user (defaults to the calling
principal), an object and an operation, and it calls the new backend
`POST /api/v1/security/explain`, rendering the `ExplainDecision` trace — the
allowed/denied verdict banner, the resolved principal chain (positions →
permission sets with their `via` attribution), all nine evaluation-pipeline
layers (required capabilities, object CRUD, FLS, OWD baseline, depth, sharing,
VAMA bypass, RLS) with per-verdict badges, and the composed row filter for
reads. A 403 from the manage_users / delegated-admin-scope gate (D12) renders
as a friendly localized message. Copy ships in EN + ZH via the metadata-admin
string tables.
