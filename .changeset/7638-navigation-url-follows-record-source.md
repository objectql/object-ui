---
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-tree': patch
'@object-ui/react': patch
---

A record-page URL now names the object the clicked rows actually came from, in
`ObjectTree` and `ObjectCalendar` (objectui#7638).

`useNavigationOverlay` builds `/{objectName}/record/{id}` out of whatever it is handed,
and both components handed it the bare top-level `schema.objectName` while resolving
their own rows through the objectui#6939 record-source ladder (`data`, then
`staticData`, then `objectName`). objectui#6939 published `objectName` as that ladder's
THIRD RUNG and not as a parallel "page object" concept, so a block has exactly one
record source — and a row fetched through `data.object` whose click built
`/{schema.objectName}/record/{id}` named a record that the URL's own object does not
contain.

Two shapes change, both toward the object the rows came from:

- a block carrying **both** bindings navigated to the top-level key and now navigates to
  `data.object`;
- a **data-only** block had no name to build a URL from at all, so the hook took its
  `/{id}` leg — an unrouted path that paints a blank page — and now builds the routed
  record URL.

`ObjectCalendar` is where the divergence was plainest: on one click it resolved the
detail drawer through the ladder and the navigation URL through the top-level key. The
URL now reuses the very `schemaObjectName` that already keys the calendar's record query
and its `$expand` derivation, so query, drawer and URL agree by construction.

**Nothing else moves.** Both converted sites keep a site-local `?? schema.objectName`
tail for the off-contract `data: { provider: 'object' }` that carries no `object`
(`ViewDataSchema` declares it required) — the same tail `ObjectTree`'s `headerObjectName`
already carries, and the same conservatism objectui#7627 applied when it published the
shared reader. `useNavigationOverlay`'s own signature is unchanged: it still takes an
`objectName`, and only what callers hand it has changed.

The hook's `@example` stops prescribing `objectName: schema.objectName`. That prose is
why there were copies to convert at all — component authors copied the divergence out of
the documentation, correctly, as written — so it now points at
`resolveRecordSourceObjectName` and says explicitly that a caller with no data config
has nothing above rung three and should keep passing `schema.objectName`.

`ObjectKanban` is deliberately **not** converted: it has no data config, no
`getDataConfig`, and its `data` is a raw row array rather than a `ViewData` binding, so
`schema.objectName` already IS its record source and its board, drawer and URL already
agree.
