---
'@object-ui/components': minor
---

`ui:breadcrumb` now reads the two declared keys it never referenced — `separator` and
`maxItems` (objectui#6646).

`BreadcrumbSchema` has declared both since it shipped (`packages/types/src/navigation.ts`,
mirrored in `zod/navigation.zod.ts`), and `separator` is additionally advertised to authors
on the component's own documentation page. The renderer contained zero occurrences of
either name: it always emitted the bare `BreadcrumbSeparator` and it never collapsed. That
made `separator` the sharper of the two — an author who read the page, wrote
`"separator": "/"` and saw a chevron got feedback **identical** to having misspelled the
key, with nothing to tell the two apart.

**Scored `minor`, not `patch`, on the separator default.** The sibling repair (PR #6644,
the same renderer's `icon` key) was a `patch` because it only started drawing something
where nothing had been drawn. This one also changes what an **unauthored** breadcrumb
renders: `separator` carries `@default '/'` in the declaration while the renderer fell
through to shadcn's `ChevronRight`, so declared default and actual render disagreed, and
honouring only the authored value would have left the docs lying about the unauthored one.
The render is aligned to the declaration (`schema.separator ?? '/'`) rather than the
declaration being rewritten to match the render — rewriting a published `@default` is a
contract change, which ADR-0049 routes to a maintainer, and this card's dispatched arm is
"implement the declaration". Every existing `ui:breadcrumb` therefore separates with `/`
instead of a chevron unless it authors otherwise. `''` is honoured as authored (no visible
separator), not promoted to the default — hence `??` and not `||`.

`maxItems` bounds how many crumbs are **rendered**. When the trail is longer, the first
crumb and the last `maxItems - 1` survive with shadcn's `BreadcrumbEllipsis` between them,
so the current page — the crumb a trail exists to name — is never the one dropped; at
`maxItems: 1` there is no room for both ends and the current page is what stays. A value
that cannot mean a count (absent, non-finite, below `1`) is declined rather than coerced,
because silently inventing a truncated trail is worse than ignoring the key.

Two catalog fixtures author the keys (`custom-separator`, `collapsed-trail`) and the docs
page gained a section for each, plus the `maxItems` row its interface block never carried.

`packages/types` is untouched: both keys were already declared, and the only thing missing
was a renderer that read them.
