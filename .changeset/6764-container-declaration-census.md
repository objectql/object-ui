---
'@object-ui/components': patch
---

The seven semantic sectioning tags and `aspect-ratio` declare the containment
they render (objectui#6764).

`renderers/layout/semantic.tsx` registers `aside`, `main`, `header`, `nav`,
`footer`, `section` and `article`, and `renderers/layout/aspect-ratio.tsx`
registers one more; all eight call
`renderChildren(schema.children || schema.body)` and none declared
`isContainer`. Nothing on the render path reads that flag, so children always
rendered — what the omission did was make `validateTree` warn `not-a-container`
on a child list it then rendered, on the tier built to accept AI-authored pages.
A warning that lies trains authors to discount the true ones.

Same reasoning as objectui#3900 (`page-header`) and objectui#6740 (`flex`):
`children` is a base property of every node in the JSON protocol, not a
per-component authoring key, so the flag widens no spec surface.

Scoped by measurement, not by sweep. The census behind this change rendered
every registered key through the real `SchemaRenderer` and put it through
`validateTree`: of 131 bare authoring tags, 58 render `schema.children`, 5
declared the flag, and 53 did not. These 8 are the subset where the second
consumer is provably unaffected — `renderers/layout/react-page.tsx` drops
containers from the `kind:'react'` JSX scope, but it reads `getPublicConfigs()`
and none of the 8 is in the curated public contract. The remaining 45 are
reported on the card rather than swept in, `button` among them precisely because
it IS public.
