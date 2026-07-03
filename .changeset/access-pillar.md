---
"@object-ui/app-shell": patch
---

feat(studio): Access pillar — the fourth content pillar (permission matrix)

The pillar builder gains **Access** (builder-ui §7 / ADR-0084's fourth pillar):
left rail lists the environment's permission sets / profiles (search + inline
create), and the main zone embeds the existing Salesforce-style
`PermissionMatrixEditPage` unchanged — objects × CRUD/VAMA/lifecycle plus
per-object field-level R/W, with its own save and destructive-change guard.

Deliberate v1 semantics, said out loud in the banner: permissions are
platform-level authorization objects, not package content — the matrix saves
the ACTIVE item directly, so the shell's package draft/publish does not apply.
