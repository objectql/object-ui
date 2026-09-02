---
'@object-ui/types': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-dashboard': patch
---

Two widget prop types anchor their `schema` to exported schema types that extend
`BaseSchema`, instead of hand-rolled inline literals with no `BaseSchema` in
their ancestry (objectui#6576, maintainer ruling 2026-08-31 option A; folds
objectui#6914).

- `@object-ui/types` exports `ObjectGallerySchema` (`type: 'object-gallery'`)
  and `ObjectDataTableSchema` (`type: 'object-data-table'`), each `extends
  BaseSchema`, beside the other `Object*Schema` declarations, with zod mirrors
  of the same names under `@object-ui/types/zod`. `ObjectDataTableSchema`
  declares the two keys the widget was reading behind casts — `drillDown`
  (`DrillDownConfig`) and `onRowClick` — which no declaration carried before.
- `@object-ui/plugin-list`: the published `ObjectGalleryProps.schema` is
  `ObjectGallerySchema`. Its accept set WIDENS — every `BaseSchema` member is
  writable (`visibleWhen`, a real base member, was a compile error on the
  literal) — and NARROWS in one place: `type` is now required and pinned to
  `'object-gallery'`. `data` stays `Record<string, unknown>[]`.
- `@object-ui/plugin-dashboard`: `ObjectDataTableProps.schema` (not exported
  from the plugin index) is `ObjectDataTableSchema`. The literal's own
  `[key: string]: any` is gone, so a wrong-typed base member (`visible: 42`) and
  a wrong-shaped `drillDown` are refused, and `type` is pinned to
  `'object-data-table'` instead of bare `string`.

Unchanged on both, stated plainly: an UNKNOWN key still compiles, because
`BaseSchema`'s index signature is inherited (objectui#5155, open). No runtime
behaviour changes; the widgets render exactly as before.
