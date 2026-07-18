---
"@object-ui/app-shell": minor
---

feat(flow-designer): first-class panel for the time-relative trigger (#1874)

The flow designer's start-node inspector now offers a **Time-relative (date sweep)**
trigger option alongside record / schedule triggers. Picking it reveals typed
fields for the backend's `config.timeRelative` descriptor — Sweep object, Date
field, Within days (range mode), Offset days (T-minus mode), an Extra filter, and
Max records — instead of hand-writing the block in the Advanced JSON editor. The
per-record Entry condition is available too.

Adds a `numberList` config-field kind (a string-list editor that commits
`number[]`), so **Offset days** authors emit numbers rather than strings — keeping
the backend schema (`z.array(z.number())`) strict rather than coercing on the
consumer side. All fields live under the nested `config.timeRelative` block, which
the group fully owns, so it never double-renders in Advanced JSON.
