---
'@object-ui/app-shell': minor
---

Keep a clickable path back when drilling from a record into a related child record (objectui "点击子表标题跳转后如何返回").

Clicking a related sub-table row opens the child record's detail page, but that page dropped all trace of where you came from: its breadcrumb only led to the child object's *list* (never the parent record), and the record body's built-in Back button is suppressed on the schema-rendered surface. From a related-list drill-in the only way back was the browser Back button.

- **New reserved `?from=` URL param carries the ancestor trail.** When you open a related record (both the synth `RelatedRecordActionsBridge.onView` path and the legacy `RecordDetailView` `onRowClick` path), the parent record is appended to a compact, refresh- and share-safe trail encoded in the URL. Nested drill-ins accumulate (`Account → Invoice → Invoice Line`); depth is capped at 8 and titles truncated so the URL can't grow unbounded, and a trailing self-reference is deduped. Codec (`encodeRecordTrail`/`decodeRecordTrail`/`appendRecordTrail`/`buildRecordTrailHref`) is total — a malformed value yields no ancestor crumbs rather than throwing.
- **The top-bar breadcrumb renders the trail as clickable segments.** A record route with a `?from=` trail now shows `Account → #parent → Invoice → #child`, each ancestor an `object-list → record` pair that links back, with mid-path crumbs preserving the ancestors above them.
- **The record body shows an inline "← back to parent" link** derived from the trail's nearest ancestor, so the immediate-parent affordance survives refresh and shared links (previously it relied on in-session history state that nothing populated for this flow).
