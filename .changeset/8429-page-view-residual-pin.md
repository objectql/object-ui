---
---

Pin the `page` list-view residual objectui#8429 registers: `page` is
simultaneously a type `@objectstack/spec`'s `ListViewSchema` accepts, a member
of both published `@object-ui/types` faces, and absent from the set `ListView`
draws — so a spec-valid `type: 'page'` view normalises to `viewType: 'grid'`.
The pin states that contradiction mechanically and changes no behaviour; it
reddens if either open disposition (growing a page renderer, or narrowing
`ViewType`) is ever taken. Test only; no package is released by this change.
