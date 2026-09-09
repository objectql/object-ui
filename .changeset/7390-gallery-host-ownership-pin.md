---
---

Test-only: pins which host owns `ObjectGallery`'s rows (objectui#7390). Under
`ListView` the host fetches one page and hands the rows down as the `data` prop,
so the gallery issues no query of its own; an authored standalone
`object-gallery` node owns its query and has no paging chrome above it. No
published behaviour changes.
