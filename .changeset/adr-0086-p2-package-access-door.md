---
"@object-ui/app-shell": minor
---

feat(studio): package Access door is draft/published, not live (ADR-0086 P2 · D6/D7)

The package **Access** pillar edited permission sets **live** — it wrote the
active record directly, unlike the Data and Interfaces pillars which stage a
draft and publish with the rest of the package. That contradicted ADR-0086 D6
("a package's own access is metadata → draft/publish") and left the two doors
sharing one live write path.

Now the **package door** (`/studio/:packageId/access`) writes **drafts**:

- The permission editor's Save (`PermissionMatrixEditPage`, package scope) and
  the "new set" creator both call `client.save(..., { mode: 'draft', packageId })`
  — the framework stamps the draft with the package, and the top-bar **Publish**
  promotes it atomically (materialized into `sys_permission_set` by the framework
  side, ADR-0086 P2 块1). The **environment-admin** door (no `packageId`) is
  unchanged: it stays **live** (config), per D7.
- Reads are draft-aware: the editor loads any pending draft over the published
  baseline, and the pillar rail merges published ∪ draft sets — so a set created
  or edited as a draft stays visible before publish (matching Data/Interfaces).
  Saving bumps the surface's pending-changes counter; a publish reloads the
  published baseline.
- The pillar banner no longer claims "saved = live" (it said Publish didn't apply
  here) — it now states edits save as package drafts and go live on Publish.
