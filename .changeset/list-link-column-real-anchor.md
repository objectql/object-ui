---
'@object-ui/plugin-grid': patch
'@object-ui/app-shell': patch
---

fix(plugin-grid): the list link column renders a real anchor when the host publishes record URLs

The list's `link: true` column (and the auto-linked primary field) rendered as
a `span role="link"` with no `href`, navigating only through a click handler.
So the surface users actually open records from had none of a link's native
affordances — no middle-click / ⌘-click open-in-new-tab, no "copy link
address", no hover status-bar URL — and `role="link"` without an href is a
weaker contract for assistive tech than a real anchor. It was also the odd one
out: the previous release gave record-detail and related-list lookup VALUES
real anchors, leaving the list column as the weakest of the three surfaces.

`LinkCell` now renders a real `<a href>` with the same click split: a plain
left click is prevented and handed to the existing in-app navigation, so drawer
/ modal / page behavior is completely unchanged, while modifier and
middle-clicks are left to the browser.

The URL is not assembled in the grid. The object list page publishes its own
record-URL builder through `RelatedRecordActionsContext.recordHref` — the same
seam the lookup links use, and the same expression its "open in new window"
action already navigated with, so the anchor and that action cannot address
different records. A host that publishes no URL renders exactly what it
rendered before: the Studio designer, embedded renderers and standalone grids
are untouched.

Neither package's published `dist/index.d.ts` changes (measured both ways —
byte-identical), so this is a patch on both: the list host's new helpers are
module-level exports behind a barrel that re-exports only `ObjectView`.
