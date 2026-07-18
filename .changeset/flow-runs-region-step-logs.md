---
"@object-ui/app-shell": minor
---

feat(studio): nest per-iteration / per-region step logs in the flow Runs panel (#1505)

The run-observability `FlowRunsPanel` (Studio → flow preview → Runs) rendered a
run's step log as a flat list, so a `loop` container showed as a single step and
its body steps — one set per iteration — appeared as an undifferentiated repeat
of the same node ids, with `parallel` branches and `try`/`catch` handlers
likewise flattened. The automation engine already tags each structured-region
body step with its container (`parentNodeId`) plus an `iteration` / `regionKind`
(ADR-0031, framework #1505); the panel ignored those fields.

`FlowRunsPanel` now reconstructs the execution tree from the flat, pre-order step
log (`buildStepTree`) and nests body steps under their container node, grouped by
a per-iteration / per-branch / handler header (`Iteration 2`, `Branch 1`, `Try`,
`Catch`). The reconstruction is robust to repeated node ids (a loop body node
runs once per iteration) and to regions nested inside regions, and degrades
safely — a body step whose container was dropped by durable-history truncation
still surfaces at the top level rather than vanishing.
