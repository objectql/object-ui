---
'@object-ui/components': patch
---

The `span` deprecation notice is now reported once per page load, and only to the authoring surface it applies to.

`SpanRenderer` was two rulings behind `div`. It still `console.warn`ed on **every
render**, and it still fired at nodes the `kind:'html'` tier's own parser had
emitted — the two defects that were ruled on for `div` in objectui#3965 (PR
#3998, which explicitly named `span` as the follow-up) and objectui#4000 (PR
#4916, which built the provenance mechanism). This is that follow-up
(objectui#4917); it copies the shape now in `basic/div.tsx` rather than inventing
a second one.

- **Once per module load.** The notice is a property of the deprecated TYPE, not
  of each node, so repeating it per render only buries the page's real console
  errors. The deprecation still fires in dev builds, exactly once.
- **JSON-authored nodes only.** An author writing the plain inline tag in a
  `kind:'html'` page gets a node this deprecated renderer serves — and was told
  to migrate to `badge` / `text`, neither of which exists in that tier's
  vocabulary, with nothing they could write to make it stop. Provenance is
  established by the producer (the parser stamps what it emits, via
  `isHtmlTierNode`), not guessed from the node's shape here.
- **The notice now names its surface**, so whoever reads the console can tell
  which of their pages it is about. The migration guidance itself is unchanged:
  this narrows WHO is told, it does not water down WHAT they are told.

Order is load-bearing and pinned by tests: the html-tier exemption is checked
BEFORE the warn-once set is marked, so an html-tier node rendering first cannot
swallow the notice a JSON-authored node earns later on the same page.
