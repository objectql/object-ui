---
'@object-ui/app-shell': minor
---

feat(studio): Capabilities section in the object Settings panel (framework#2707/#2727)

The `enable.*` record-surface switches went fully live in the framework, but
only source-mode authors could set them. The Data-pillar object Settings
panel now exposes them to builders — **live flags only**, each with a
one-line contract description:

- Opt-in (spec default off): `trackHistory` (History tab),
  `files` (Attachments panel + server-side attachment gate).
- Opt-out (spec default on): `feeds` (discussion panel + comment 403 gate),
  `activities` (record timeline mirror), `clone` (clone endpoint 403).

Checkboxes show the flag's EFFECTIVE runtime value; toggling writes an
explicit boolean into the `enable` block preserving sibling keys. Dead
flags (`searchable`/`trash`/`mru`) are deliberately not rendered — Studio
only offers switches the runtime enforces.
