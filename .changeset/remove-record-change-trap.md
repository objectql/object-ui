---
"@object-ui/app-shell": patch
---

fix(app-shell): remove the never-firing `record-change` option from the flow trigger picker (#3427)

The Studio flow designer's start-node trigger picker offered "Record changed
(any)" (`record-change`), but the runtime routes it to the record-change trigger,
which maps it to no ObjectQL hook — so the flow binds yet **never fires**. Authoring
it produced a silently-dead flow. Removed the option (and dropped `record-change`
from the scope resolver's record/previous sets and the zh-CN labels). The common
"created or updated" case is covered by `record-after-write`; a companion
`@objectstack/lint` rule flags any hand-authored `record-change` at `os validate`
time.
