---
---

Docs-only: ten rows across eight `content/docs` pages still listed one of
objectui#6124's 22 RETIRED `on*` handler keys as a callable prop, after PR
#7339 turned those keys into `?: never` tombstones with named refusal arms on
the zod mirror. Seven pages have the rows removed;
`components/basic/button-group.mdx` keeps its `ButtonGroupButton.onClick` row
spelled `never` with the node-type pointer, because
`button-group-doc-surface-6347.test.ts` asserts set equality between that block
and the mirror's `.shape` and a refusal arm is still a key of that shape. A new
test-only pin
(`packages/types/src/__tests__/component-docs-retired-handler-keys-7340.test.ts`)
measures the retired population off `packages/types/src` and holds every doc row
whose `(interface, key)` pair resolves to a tombstone to the `never` spelling,
with six runtime-slot rows as the blanket-sweep control (objectui#7340). No
published package behaviour changes.
