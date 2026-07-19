---
"@object-ui/app-shell": minor
---

feat(studio): select and edit nested container nodes through the schema-driven flow inspector (#2670)

Phase 2 (#2680) expanded a container's regions (`loop.body` /
`parallel.branches[]` / `try_catch.try`/`catch`) inline on the flow designer
canvas, but the nested nodes were read-only — changing one still meant editing
the container's Advanced JSON by hand. A nested node is now a first-class
selection: click it on the expanded canvas and it opens in the SAME
schema-driven inspector as a top-level node, with a `container › region › node`
breadcrumb. Edits (label / type / description / typed config fields / Advanced
JSON) write straight back into `config.<region>.nodes[i]` — the write rebuilds
the container with explicit spreads so the `config.branches` array stays an
array and each region's own `edges` / a branch's `name` are preserved.

Scope resolves correctly for the region's outer context (ADR-0031): a loop
body node sees the loop's `iteratorVariable` in its data picker even though the
container's own outputs are otherwise out of scope at its id.

This phase is edit-only by design. A nested node keeps its id read-only (rename
it in the container's Advanced JSON), has no delete, and — for a nested
decision — drops the virtual Target column, since a region sub-graph's internal
routing is not managed by the inspector yet (nested region-edge editing,
structural add/remove, and drag are follow-ups). A stale nested deep link
(the draft moved on) resolves to a harmless empty-state rather than writing to
the wrong node.

Also fixes an expression/template validation split now that the engine
publishes a loop `configSchema`: a string property can carry an `xExpression:
'expression' | 'template'` marker so the designer renders bare-CEL vs
`interpolate()` `{var}` semantics (mono editor, data-picker brace mode, and
whether the CEL brace-trap applies) instead of guessing from the field name. A
loop / map `collection` (`{leadList}`) is a template, so it no longer
false-positives as a malformed condition inline or on the canvas badge.
