---
'@object-ui/components': minor
---

`page:header` resolves its `actions` as declared ACTION IDS (objectui#6252,
implementing the objectstack#11592 ruling — maintainer, 2026-08-25, on
recommendation B).

`@objectstack/spec`'s `PageHeaderProps.actions` is
`z.array(z.string()).describe('Action IDs to show in header')` and has been for
as long as the key has existed. The canonical renderer read that array as
`ActionDef` objects and resolved nothing, so a header authored the way the
published contract declares rendered **zero buttons** — satisfying the schema
deleted the header. Two sibling surfaces already read it as ids
(`record:quick_actions`, and `layout:page-header` by delegating to it), so one
authoring key meant two different things depending on which renderer drew the
header.

Each id is now resolved against the object's own `actions` metadata through the
same `useMetadataItem` entry `record:quick_actions` uses. Resolution happens at
the top of the actions pipeline, so the existing chain — `record_header` /
`record_more` placement, the `requiredPermissions` capability gate, `visible` /
`hidden`, `order`, and the inline/overflow split — runs unchanged over
uniformly-shaped defs: an id-authored header and an object-authored one converge
before a single filter runs.

- Inline `ActionDef` objects keep rendering, per element, so a half-migrated
  `['convert', { … }]` array resolves the id and passes the object through. This
  is renderer tolerance for the migration and stays undeclared — the contract is
  ids.
- An id that resolves to no action renders nothing and warns **once**, naming
  the object's declared action names. A mistyped id is no longer indistinguishable
  from a correctly hidden one.
- Nothing is written back onto the authored node, so an id-authored page carries
  no `ActionDef` — and no `body.source` handler body — into what it serializes.
