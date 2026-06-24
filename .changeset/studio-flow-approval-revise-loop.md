---
"@object-ui/app-shell": patch
---

feat(studio): author the approval revise loop in the flow designer (ADR-0044)

The ADR-0044 send-back-for-revision loop — an approval node's `revise` out-edge to a wait point, closed by a declared `type: 'back'` edge re-entering the approval (round N+1) — was previously reachable only by hand-editing flow JSON. The flow designer now authors it visually:

- **Revise branch** — an approval out-edge offers `approve` / `reject` / `revise` via a new Approval-branch picker in the edge inspector; `maxRevisions` surfaces on the approval node's property form (from the engine's published configSchema when online, with a hardcoded fallback offline).
- **Back-edge authoring** — a new Connection-type select marks an edge as `back` (also `fault` / `conditional`). A back-edge renders distinctly on the canvas as a dashed amber return arc and is excluded from the layered auto-layout (exactly as the engine excludes it from DAG validation), so the loop reads top-to-bottom instead of dragging its target node below the wait point.
- **Client-side DAG validation** — the simulator's preflight now flags an UNmarked cycle as an error (the graph minus declared back-edges must be a DAG, mirroring `registerFlow`), while a declared revise loop passes and a self-loop is caught.
- **One-click "add revision loop"** — an amber affordance on an approval node drops the signal `wait` node + the `revise` edge + the declared `back` edge in a single gesture, reproducing the canonical `showcase_budget_approval` shape.

Refs framework#1770. Follows the flow-builder work in #1927 and #1930.
