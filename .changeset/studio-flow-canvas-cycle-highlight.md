---
"@object-ui/app-shell": patch
---

feat(studio): surface flow validation errors inline on the canvas

The flow designer's structural validation (an un-declared cycle, missing entry node, duplicate ids, dangling edges, …) was only visible in the Debug panel. It now surfaces **inline on the canvas**: an un-declared cycle paints its offending edges + nodes red — using the same `validateFlowDraft` the simulator preflight runs — and an error banner lists the messages, so the author sees a broken graph without opening Debug. Each edge that closes the cycle carries a tooltip pointing at the fix ("mark the edge that closes the loop as a back-edge"). A declared revise loop (ADR-0044 back-edge) is excluded from cycle detection and stays un-flagged.

Follows #1954 (revise-loop authoring) and #1955 (simulating approval decisions).
