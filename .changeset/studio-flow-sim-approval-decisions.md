---
"@object-ui/app-shell": patch
---

feat(studio): simulate approval decisions in the flow debugger

The designer-time flow simulator treated an `approval` node as a pass-through that fanned out to every out-edge at once — so an ADR-0044 revise loop couldn't be debugged: it walked approve / reject / revise simultaneously and hit the step ceiling on the back-edge.

The simulator now models an approval as a durable pause (like `wait` / `screen`): it suspends at the node, and the Debug panel offers the node's out-edge labels (`approve` / `reject` / `revise`) as decision buttons. Resuming routes down ONLY the chosen branch — mirroring how the engine resumes a suspended approval by branch label — so a full revise loop is now walkable in the debugger: revise → wait → resubmit (back-edge) → round 2 → approve. An unmatched decision falls back to fanning out (mirroring the engine's label-fallback), logged so the author notices.

Follows #1954 (ADR-0044 revise-loop authoring).
