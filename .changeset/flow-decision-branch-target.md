---
"@object-ui/app-shell": minor
---

feat(flow-designer): pick the target node per branch in the Decision Branches editor (#1942)

The decision node's Branches editor gains a **Target** column — a node picker
scoped to the flow's own nodes — so a business user can author the whole
decision (conditions *and* destinations) in one table, mirroring Salesforce
Flow Decision Outcomes. Completes #1930 (the per-edge Branch picker) from the
node side.

- The column is **virtual**: its value is derived from the decision's outgoing
  edges (the routing source of truth) and never persisted on
  `config.conditions`, so it round-trips with the `FlowEdgeInspector` Branch
  picker and canvas rewiring for free.
- Picking a target creates the branch's out-edge if missing, or updates /
  retargets the existing one in place, carrying the branch's condition, label,
  and default flag. Clearing a target detaches (removes) that branch's edge —
  never the node it pointed at. Custom per-edge guards, fault/back edges, and
  surplus canvas wiring are never touched.
- A branch list committed with no targets anywhere (e.g. an engine-published
  configSchema form without the column) keeps the legacy #1927 by-order edge
  mirror, byte-for-byte.
- New pure module `flow-decision-edges.ts` with unit tests for the
  branch→edge reconciliation.
