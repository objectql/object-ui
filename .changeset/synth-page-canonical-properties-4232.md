---
'@object-ui/plugin-detail': patch
---

fix(plugin-detail): synthesize page components in the spec's `properties` carrier so Studio page-create can persist

Creating a page in Studio never completed. The create path seeds a record
page's `regions` from `buildDefaultPageSchema(objectDef)` and PUTs the result,
and every node that synthesizer emitted carried its widget props at the TOP
level of the component — `{ type: 'page:header', recordChrome: true }`,
`{ type: 'page:tabs', items: [...] }`, and the same for `record:highlights`,
`record:path`, `record:details`, `record:related_list`, `record:history` and
`record:reference_rail`. ADR-0089 D3a closed `PageComponentSchema` with
`.strict()`, so those keys are not stripped, they are a parse error
(`Unrecognized key(s) on this view/page schema: 'recordChrome', 'actions'`).
The server refused the body and no page row was ever stored.

The props now go where the spec declares them — the node's `properties` bag,
which is where `ComponentPropsMap` defines `page:header.recordChrome` and
`page:tabs.items` in the first place. Nothing is dropped and nothing changes on
screen: a header still defaults to record chrome ON, an author's
`recordChrome: false` is still carried (and now actually persists), the tabs
keep their items, and `SchemaRenderer` hoists `properties` back onto the node
before dispatch, so every renderer receives exactly the props it did before.

One code path does the wrapping for every node the synthesizer builds, so there
is a single answer to "what may go in a page write". Slot overrides are
untouched — a node handed in by a caller is still placed verbatim.
