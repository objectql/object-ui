---
---

Comment-only correction in `@object-ui/plugin-list` (objectui#7222): the note above `ganttOwnsData` in `ListView.tsx` claimed the rows `data` prop "short-circuits the renderer's own fetch". It does not — no host prop reaches `ObjectGantt` at all, because the registered `object-gantt` renderer forwards nothing but `schema`. No published behaviour changes.
