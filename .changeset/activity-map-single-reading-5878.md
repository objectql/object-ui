---
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
---

The console record page and the `record:activity` block read ONE `sys_activity`
type table, so a scheduled meeting no longer appears on one and vanishes on the
other.

`RecordDetailView`'s `sys_activity` merge carried a hand-written copy of the
table that `record:activity` exports as `ACTIVITY_TYPE_TO_FEED_TYPE`. Neither
file imported the other and nothing compared them, so the two could drift
silently — and they had. objectui#5840 added `scheduled` -> `event` to the
exported table, because a shipped producer (HotCRM's `schedule_meeting`) writes
that value and the row was being dropped before any filter ran. The copy here
was left untouched, so the same row rendered on a hand-authored record page and
was dropped on the console record page: same record, same row, two answers.

`RecordDetailView` now imports the exported table, and the copy is gone. The
table is re-exported from `@object-ui/plugin-detail`'s entry point, which is
what makes a single reading possible at all — it was previously reachable only
from inside the plugin. No module enters the eager closure: the module holding
it was already pulled in by the renderer beside it.

Adding an activity type is now one edit, in one place, that both surfaces see.
A re-fork is caught rather than merely discouraged: the new pins spy on the
shared object and inject a member into it at runtime, so a private copy holding
today's members exactly — the failure this change removes — fails, where a
value comparison would pass on the defect.

Only the table converges. The row-to-`FeedItem` construction around it is still
written twice, so an unmapped activity type is still dropped silently on the
console surface where the block warns once; that mirror is filed separately.
