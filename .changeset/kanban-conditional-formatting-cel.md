---
"@object-ui/types": patch
"@object-ui/plugin-kanban": patch
---

Kanban `conditionalFormatting` now accepts CEL rules in its type + schema (#1584 follow-up).

Since #1584 moved kanban card styling onto the shared CEL evaluator, the runtime
already accepts the spec `{ condition, style }` rule shape — but the type and zod
schema still only allowed the native `{ field, operator, value }` shape, so a
CEL kanban rule failed validation for something that worked at runtime. The
`KanbanConditionalFormattingRule` type and `ObjectKanbanSchema` zod schema are
widened to a union of both shapes, matching list/grid `conditionalFormatting` and
the runtime. Back-compat: the native shape keeps validating unchanged.
