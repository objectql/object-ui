---
'@object-ui/app-shell': patch
---

A view personalization overlay now stores **only the patch** — a column drag no
longer freezes the source view's filter into it (objectui#5233).

`ObjectView`'s `persistViewPatch` wrote `{ ...baseViewDef, ...patch }`, so an
overlay written by a mere sort/density/column change copied the view's *current
effective* `filter` — along with its `columns`, `label`, `type`, `isDefault` —
into the stored row. The display merge is `{ ...source, ...override }`, so that
copy then outranked the source view forever: an admin edited the view's filter
and every user who had once resized a column silently kept the old filter, with
nothing anywhere reporting it.

The write now goes through the exported seam `buildPersistedViewBody`. For a
**system view's overlay** the body is the patch plus `viewKind` when the active
tab carries one — identity, not content, and the same line the read side already
draws (`VIEW_OVERLAY_IDENTITY_KEYS`); `object`, `name` and the overlay marker are
stamped by the adapter. A **saved view's own row** is deliberately still written
whole: for it the body *is* the view, there is no source underneath it for a
copied key to shadow, and the write is a whole-document PUT — narrowing it would
delete the user's view rather than narrow it.

This is the write half of the maintainer's 2026-08-12 ruling (objectstack#7494).
It was blocked until `columnState` was admitted to the view-metadata surface as
an explicitly runtime-only overlay key (objectstack#9933, released in
`@objectstack/spec` 17.1.0) — before that a `columnState`-only patch was refused
`422 INVALID_METADATA`, and the fat copy was the only thing supplying a
recognized key. The read half (`narrowPersonalizationOverlay`) shipped earlier
and stays: rows written before this land are still tolerated on read, and because
the write replaces the whole document, the next toolbar toggle also strips such a
row at rest. No migration.
