---
"@object-ui/plugin-gantt": patch
---

fix(plugin-gantt): align the task-list header with the row date columns

Every data row reserves a trailing w-6 (+4px) slot for the 「→」 open-details
button whenever `onTaskClick` is live, but the header row didn't — so the
开始/结束 header labels sat 28px to the right of the date values they caption.
The header now mirrors the slot under the same condition.
