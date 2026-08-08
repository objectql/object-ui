---
"@object-ui/fields": minor
"@object-ui/plugin-form": minor
---

fix(fields,plugin-form): stop the inline child grid from collapsing `datetime`/`time` columns onto the `date` control

`deriveMasterDetail`'s `fieldTypeToColumnType` mapped `date`, `datetime` and `time` onto the single `date` grid column type, and `GridField` renders that as `<input type="date">`. The consequence was not cosmetic: that control emits a bare `YYYY-MM-DD` on change, so a user who merely re-picked the **day** of a `datetime` cell silently wrote the record's time component out of existence — a `14:30` became midnight with no warning and no undo.

`GridColumn['type']` now carries `'datetime'` and `'time'` alongside `'date'`, and each renders its own control with its own read/write adapter:

- `datetime` → `<input type="datetime-local">`, read through `toDateTimeInputValue` and written back through `fromDateTimeInputValue`, so the stored shape stays ISO-8601 and read and write share one basis (the contract `DateTimeField` already follows, objectui#3127).
- `time` → `<input type="time">`, round-tripping the stored zone-less `HH:mm[:ss]` verbatim.
- `date` → unchanged.

The read-only surfaces are fixed with it. `displayText()` and the read-only table both fell through to `String(value)` and printed the raw stored ISO on screen (`2026-06-17T00:00:00.000Z`); each temporal type now formats as itself — a day for `date`, day + local time for `datetime`, the wall clock for `time`. That could not be fixed before the type collapse was undone, because with one column type the renderer had no way to know which of the two to show.

Authors writing explicit grid `columns` can now declare `type: 'datetime'` / `type: 'time'`; previously those spellings were not part of the exported union.
