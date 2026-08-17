---
'@object-ui/plugin-gantt': patch
---

plugin-gantt README: the `onTaskUpdate` drag example no longer writes blank dates on a progress drag.

`GanttViewProps.onTaskUpdate`'s second parameter is
`Partial< Pick< GanttTask, 'title' | 'start' | 'end' | 'progress' > >`
(`src/GanttView.tsx:345`), so the destructured `start` / `end` are
`Date | undefined`. The README's "Drag-and-drop rescheduling" example destructured
them and passed both straight to `save(...)`, under a comment asserting they are
always real `Date` objects. Both layers of that assertion were wrong.

The runtime half is the one that mattered. `onTaskUpdate` is the single exit for
every edit path, and the progress grip commits changes with **no** dates at all —
`commitTaskUpdates([{ task, changes: { progress: cur.value } }])`
(`src/GanttView.tsx:1335`), forwarded verbatim by `onTaskUpdate(task, changes)`
(`:1091`). A host that copied the example therefore called
`save(task.id, { start: undefined, end: undefined })` on every progress drag,
blanking the record's start and end dates. Drag is documented as opt-in via
`onTaskUpdate` alone and progress drag needs no extra switch, so the path was
reachable by default rather than a corner configuration.

The example now guards with `if (!start || !end) return;` and its comment states
the real shape — that only the keys an edit touched are present, and that the
progress grip sends just `{ progress }`. Documentation only; no renderer behavior
changed.
