---
"@object-ui/components": minor
---

`element:record_picker` publishes `sort`, `limit` and `emptyText` as authoring
inputs (objectui#4167).

All three were already READ by the renderer and declared by the contract — the
renderer has passed `sort` into `$orderby` and `limit` into `$top` since the
block existed, and `emptyText` decides the no-rows message — but none of them
appeared in `inputs`, so every layer that reads a manifest said they did not
exist. `packages/components/src/renderers/layout/page.tsx` builds the JSX-page
compiler's prop whitelist from `getKnownTypes()` plus these `inputs`, so writing
any of the three on a JSX page drew an `unknown-prop` warning from
`sdui-parser/src/validate.ts` on a key the renderer then went on to honour.

That is objectui#3407's shape — honoured, undiscoverable — and this is the same
repair objectui#3808 made for `record:details.hideFields` and objectui#3830 made
for `element:record_picker.filter`. `@objectstack/spec` 17.0.0-rc.6 is what made
it actionable: objectstack#5775 declared the three upstream, and the reverse
direction of the console's registry parity gate went red demanding them the
moment the pin moved — a red the previous exemption had predicted in writing and
called "correct and wanted".

Each description documents the renderer's real behaviour rather than restating
the schema, because that is the half an author cannot read off the contract:

- **`sort`** and **`limit`** are both overridden OUTRIGHT by a node-level
  `dataSource` binding (`dataSource.sort ?? sort`), not merged with it — so a
  node that carries a `dataSource` silently ignores them.
- **`limit`** defaults to 50 in the renderer, not in the schema, and a record
  outside the limit cannot be picked at all with nothing in the control to say
  more exist.
- **`emptyText`** is published as `string` against a contract of
  `string | Record< string, string >`: rc.6 widened it to `I18nLabel`, and this
  renderer passes the value straight into a text node with no locale resolution,
  so only the plain-string form renders today. The description says so rather
  than advertising a shape the renderer drops — the narrowed-type treatment
  objectui#3832 describes, with the render-site gap tracked in objectui#4163.

The console's `registry-inputs-spec-parity` suite also drops all twelve of its
off-spec exemptions, which rc.6 obsoleted at once (objectstack#6776 declared
`page:header.recordChrome` / `showStar` / `showCopyId`, `page:accordion.variant`
and `page:tabs.tabStyle`; objectstack#5775 declared the `element:record_picker`
trio and `children` on the four page containers). The forward direction of that
gate now runs with no cover of any kind.
