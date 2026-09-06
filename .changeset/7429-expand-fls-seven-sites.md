---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-view': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-timeline': patch
'@object-ui/app-shell': patch
---

FLS-gate the `$expand` projection at the seven remaining `buildExpandFields`
call sites (objectui#7429).

objectui#7215 / PR #7229 gated the two projection sites in its scope
(`ObjectGrid`, `ListView`). objectui#7230 / PR #7428 gated four more
(`ObjectCalendar`, `ObjectGantt`, `RecordDetailView`, `DetailView`). This
closes the seven that were left: `ObjectKanban`, `ObjectTree`, `ObjectView`
(the non-grid record-fetch effect), `ObjectMap`, `ObjectGallery`,
`ObjectTimeline`, and the metadata-admin `PagePreview`'s record-binding fetch.

**All seven pass no column list at all**, which makes every one of them the
sharp shape: `buildExpandFields` reads an absent column list as "no column
restriction" and falls back to **every declared relation on the object**,
denied ones included. So each of these components asked the server to resolve
the object's full relation set by default, not by configuration — the
ordinary shape of each surface, not a corner of it.

**`PagePreview` is the one site where the judged principal is not the page's
eventual audience.** It calls the browser's own `fetch` with
`credentials: 'include'` rather than `DataSource.find`, so it runs under
whichever session is loading the Studio preview. Gating on that same session's
`usePermissions()` is still the correct principal: it is exactly the request
the browser is about to make, on its own credentials, regardless of who later
opens the published page.

**Reproduced before it was fixed**, as a failing test per site (and, for the
two sites — `ObjectView`, `PagePreview` — where the gate was implemented
before its test was run red, a reverse-verification: the gate was reverted,
all four denial-and-set pins on each went red, and the two deferral/positive
control pins stayed green, before the gate was restored).

**Grading, measured rather than assumed** — the same reading objectui#6898,
#7215 and #7230 recorded: against ObjectStack's own server this is
defence-in-depth, not a live disclosure. `plugin-security`'s
`FieldMasker.maskRecord` deletes every unreadable key from each returned row
and objectql's expand path writes the resolved record back under that same
key, so one statement removes the expanded object and the bare id alike; the
expansion sub-read is itself gated (the referenced object's full CRUD + RLS +
FLS treatment, objectstack#7626). It is load-bearing for any backend that does
not strip, and the client-request side is real regardless.

**Nothing a permitted view did stops working.** The gate judges each site's
`buildExpandFields` OUTPUT, which contains only the object's declared
reference-bearing fields, so the "`checkField` answers false for an
undeclared key" trap cannot be reached. An unanswered permission policy
filters nothing. `buildExpandFields` itself is unchanged.

`@object-ui/permissions` is added to `dependencies` for `plugin-kanban`,
`plugin-tree`, `plugin-map`, `plugin-timeline`, and `plugin-view` — the fifth
one objectui#7429's own dependency count missed (it named four); `plugin-list`
and `app-shell` already had it.
