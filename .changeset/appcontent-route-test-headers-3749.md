---
---

Comment-only change, no behaviour and no authoring-surface change (objectui#3749).

Three docblock passages in the zero-app console routing tests enumerated
`sys-datasources` / `sys-objects` in the present tense as the producers of
`…/component/metadata/resource?type=datasource` and `…/system/metadata/object`.
Both entries were re-pointed at the metadata-admin engine's canonical
`…/metadata/:type` routes — `sys-datasources` by objectui#3660,
`sys-objects` (and the home QuickActions "Manage Objects" card) by
objectui#3739 — so the narration described a producer surface that no longer
exists, while the assertions underneath it stayed correct and green.

Rewritten as "history + current state" per objectui#3666: what was true at
objectui#3610, then what is true now, with the current-state half stating
positively what the two spellings are today (arrivals for bookmarks, external
links and the host's own alias route) rather than denying where they used to
point. The two `it` titles move off the producer names onto what they actually
measure — each alias still resolving out of the zero-app branch in exactly one
hop, named by its rewriter (`shell alias` / `host alias`).

No package is declared because nothing published changed: `AppContent.tsx` is a
JSX-comment edit with both `LegacyMetadataRedirect` route declarations and every
other line of code untouched, and the two test files keep their assertions and
case count byte for byte (43 passed before, 43 passed after). The reason this is
worth a commit at all is that the same comment family has gone stale once before
at a measured cost — objectui#3661 / #3669, where a transcription that had
drifted left two cases silently measuring a redirect chain production had
stopped emitting.
