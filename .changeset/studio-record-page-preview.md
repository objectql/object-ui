---
"@object-ui/app-shell": minor
---

feat(studio): preview record pages against a real sample record

The Studio page editor's Preview tab rendered a `type: 'record'` page's
`record:*` blocks (details / highlights / path / alert / quick_actions) as the
"bind a record to preview" placeholder — the metadata editor has no record
route, so the author designed blind.

The preview now fetches a handful of real records of the bound object (with
lookup / master_detail fields `$expand`ed so they show display names, not raw
foreign-key IDs), auto-binds the first one, and wraps the canvas in a
`<RecordContextProvider>` — mirroring the runtime `RecordDetailView`. A
"Preview record" dropdown lets the author switch records, so `visible` CEL
expressions (e.g. `record.status == 'in_review'`) and per-record field values
re-render live.
