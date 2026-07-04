---
"@object-ui/app-shell": minor
---

feat(studio): automation enable/disable switch + live status in the Automations rail

The Automations pillar showed only an icon + label per flow, and no way to turn a
flow on or off — so an author couldn't tell whether an automation was live, or
stop one without deleting it (the header even said "Off by default · review before
enabling", but nothing reflected or controlled it). UX eval #6.

- **Live status dot** on every flow in the rail — a green "On" / gray "Off",
  fetched from the engine's `GET /api/v1/automation/_status` (persisted `status`
  is intent; this is what's actually enabled + bound to its trigger). Refetched
  after a publish; degrades silently on an older backend. A flow the engine
  doesn't know yet (never published) shows no dot — the amber "unpublished draft"
  chip already covers that.
- **Enable/Disable switch** in the flow header. It flips the flow's deployment
  `status` (active ↔ obsolete) and saves the draft immediately; the change goes
  live when the package is published (so "review before enabling" is preserved).
  Pairs with framework's engine-side gate (`obsolete`/`invalid` → not bound).

New `engine.studio.auto.*` i18n keys (en + zh). Unit-tested (`FlowStatusDot`:
enabled→On, disabled→Off, no-state→nothing, bound-vs-unbound tooltip). Verified in
a live browser: the rail shows a green "On" against every showcase flow and the
header switch reads "Enabled".
