---
'@object-ui/react': patch
---

SpecBridge lifts a legacy bare `exportOptions` array to the spec's object form, so a
spec-authored view's declared export formats reach the grid (objectui#4585).

A spec `ListView` may spell `exportOptions` either way, and `@objectstack/spec` lifts the
legacy bare format array to `{ formats: [...] }` when it parses one (objectstack#8010).
That lift never ran on the bridge path: the bridge's input is a TypeScript type, not a
parsed value — there is no `parse`/`safeParse` anywhere under `spec-bridge/` — so a host
forwarding raw stored metadata handed the array straight through, and the bridge copied it
onto the `object-grid` node verbatim. ObjectGrid reads the object form and only that, and
`.formats` on an array is `undefined`, so the renderer's `['csv', 'json']` default won.

A view declaring `['csv', 'xlsx']` therefore rendered an export menu offering CSV and
JSON: the declared xlsx never appeared, an undeclared json did, and nothing said so — the
export button still showed, because a non-empty array is truthy. The bridge now applies
the spec's own transform at the assignment site, so both spellings leave it as one shape.

Deliberately narrow: this mirrors the spec's lift and nothing else. The object form passes
through by reference, unread and unrewritten; a view with no `exportOptions` is untouched;
and a `'pdf'` stored before its retirement is carried rather than filtered, because the
spec refuses that value at parse with a migration prescription instead of silently
dropping it — such a format still dies downstream in ObjectGrid's format-agnostic menu
filter (objectui#4535). The fix is at the producer for the same reason: a tolerant
`Array.isArray` fallback in the renderer would make a second de-facto contract out of one
spec key.

One behavior follows from reading the lift literally: `exportOptions: []` now lifts to
`{ formats: [] }` and the export button is hidden, where before the unreadable `[]` was
merely truthy and produced a menu built entirely from the `['csv', 'json']` default. A
view that declares zero formats now offers zero.
