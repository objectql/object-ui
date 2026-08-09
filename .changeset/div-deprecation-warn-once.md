---
"@object-ui/components": patch
---

The `div` deprecation notice is now reported once per module load, not once per render (objectui#3965)

`DivRenderer` called `console.warn` on every render. That is invisible on a page
with one `div` and destructive on a page with many: the docs schema-catalog index
renders 400+ example thumbnails and emitted ~190 byte-identical notices, burying
the page's real console errors underneath — the two nested-button errors fixed in
objectui#3903 / PR #3964 had to be fished out of that flood, and it cost a
browser-verification run its signal twice.

The deprecation itself is unchanged: dev builds still report it, the message and
its migration guidance are byte-identical, and production builds are still
silent. Only the repetition is gone. The guard is a module-level `Set` keyed by
type, and the production early-return happens *before* the set is marked, so a
production render cannot suppress a later dev-build notice.
