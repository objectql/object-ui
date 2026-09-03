---
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/app-shell': patch
---

FLS-gate the `$expand` projection at the five remaining build sites (objectui#7230).

objectui#7215 / PR #7229 gated `$expand` at the two projection sites in its scope
(`ObjectGrid`, `ListView`). The helper is reached from more places than that. This
closes the five that were left: `ObjectCalendar`, `ObjectGantt`, `RecordDetailView`,
`DetailView`, and `ObjectDataTable` (which builds its own whitelist in
`computeLookupExpand` rather than calling `buildExpandFields`).

**Three of them pass no column list at all**, which makes them the sharp ones:
`buildExpandFields` reads an absent column list as "no column restriction" and falls
back to **every declared relation on the object**, denied ones included. So a standalone
calendar, a gantt, and every record page in the console asked the server to resolve the
object's full relation set by default rather than by configuration.

**`DetailView` was input-gated, and that is the defect rather than the fix.** Its column
list is already FLS-filtered field by field, which is exactly the route PR #7229 measured
as unsound: an emptied column list reads as "no column restriction", so a detail view
whose authored fields are all denied had its `$expand` **widened** from the relations it
asked for to every relation the object declares. The principal who may read least was
asking for the most.

**Reproduced before it was fixed**, as a failing test per site.

**Grading, measured rather than assumed.** Against ObjectStack's own server this is
defence-in-depth, exactly as objectui#6898 and #7215 are: `plugin-security`'s
`FieldMasker.maskRecord` deletes every unreadable key from each returned row and
objectql's expand path writes the resolved record back under that same key, so one
statement removes the expanded object and the bare id alike; the expansion sub-read is
itself gated (`__expandRead` takes the referenced object's full CRUD + RLS + FLS
treatment). It is load-bearing for any backend that does not strip, and the
client-request side is real regardless.

**Nothing a permitted view did stops working.** The gate judges each helper's OUTPUT,
which contains only the object's declared reference-bearing fields, so the "`checkField`
answers false for an undeclared key" trap cannot be reached and derived / host-joined
columns are untouched. An unanswered permission policy filters nothing. Neither
`buildExpandFields` nor `computeLookupExpand` is changed.
