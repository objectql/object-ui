---
---

Tests only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` is touched; the only file changed is
`packages/plugin-calendar/src/object-calendar-renderer.propsContract.test.tsx`.

Stops `object-calendar-renderer.propsContract.test.tsx` from making four real outbound
connections to `127.0.0.1:3000` while it stays green.

`happy-dom`'s default document origin is `http://localhost:3000/`, so a relative-URL
`fetch` that nothing intercepts resolves against that origin and leaves the process for
real. The escaping request is `@object-ui/plugin-detail`'s record-level explain probe
(`useRecordEditable`, `POST /api/v1/security/explain`): the file's one DEFAULT-navigation
`onEventClick` case opens `ObjectCalendar`'s overlay drawer, which renders
`RecordDetailDrawer` → `DetailView`, which gates its Edit/Delete CTAs on a per-record
write verdict. With no `apiFetch` on the `SchemaRendererProvider` this file wraps every
case in, the hook's `apiFetch ?? fetch` fallback reaches the bare global `fetch` — and the
hook fails open on the resulting connection failure, so the escape was invisible to every
existing assertion.

Same defect class as objectui#3339 (`plugin-detail`, closed by PR #4105), objectui#5225
(`plugin-report`) and objectui#5280 (`plugin-dashboard` `DatasetWidget`) — a new consumer
of an already-diagnosed hook, not a new root cause. Fixed the way #4105 settled it:
`installExplainDouble()` answers the probe from a recording double instead of the
network, installed for every case in the file (not only the one that reaches it, since
the probe is `DetailView`'s own wiring and invisible from this file's schema authoring).
`visible: true` reproduces the pre-fix fail-open behaviour exactly, so no existing
assertion changes meaning.

A new pinned test — the file's counter-probe — opens the DEFAULT-navigation drawer and
asserts the double is actually reached, twice (`update` and `delete`), with the expected
URL and request body. Confirmed load-bearing by reverse verification: with the double
temporarily disabled, the same case brings back all four `ECONNREFUSED` and fails that
new assertion (`explainCalls` stays empty instead of reaching length 2).
