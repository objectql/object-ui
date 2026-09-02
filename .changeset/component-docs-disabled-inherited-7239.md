---
---

Docs-only: 13 `content/docs/components/**` pages spelled an inherited
`disabled?: boolean` in their illustrative interfaces, which went stale when
objectui#7087 removed the 18 narrowings and left the member inherited from
`BaseSchema` as `boolean | string`. The pages now spell the shipped union
(objectui#7239), and a new test-only pin
(`packages/types/src/__tests__/component-docs-disabled-inherited-7239.test.ts`)
holds all 14 inherited rows to it while keeping the 8 independent item/option
rows at plain `boolean`. No published package behaviour changes.
