---
'@object-ui/app-shell': patch
---

DraftChangesPanel addresses `/meta` item routes in the singular

The pending-changes panel is data-driven: it takes each draft's `type` straight
from the `/api/v1/meta/_drafts` feed's stored rows, so a row stored under a
pre-#7894 plural spelling made the Console request `/api/v1/meta/objects` and
`/api/v1/meta/objects/ticket`. The `/meta` type segment is singular — always
(objectstack#9180) — so the stored spelling is now folded to its canonical
singular once, at the boundary where the feed becomes panel entries, and both
item routes, the grouping and the type heading read that one value.

The fold mirrors `@objectstack/spec/shared`'s `META_URL_TO_SINGULAR` /
`canonicalMetaUrlType` (the `/meta`-specific contract, not the manifest map),
with a parity test pinning the mirror against the real export key for key; the
table is mirrored rather than imported because the import measures +60.1 KB
gzipped on the console's eager graph, which lazy loading cannot move. It is a
mapping, never a suffix rule: `capabilities` folds to `capability`.

Emit-side only. Plural residue already stored on the server is untouched — no
write path, no migration, and nothing about what the server accepts changes.
