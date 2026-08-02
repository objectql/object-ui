---
"@object-ui/layout": major
---

Remove `PageNodeRenderer`, the dead page-node renderer (objectui#3223, ADR-0049
enforce-or-remove).

**Removed:** the `PageNodeRenderer` export and its `./Page` module. It was
registered under no component key and imported by nothing — a whole-repo grep
found zero call sites — so it reached consumers only through
`export * from './Page'` in the package barrel. `registerLayout()` was already
saying so in a note that told the next reader *not* to register it. Its props
were also `{ schema: PageNodeSchema; … } & any`, and an intersection with `any`
absorbs the whole type, so the signature asserted nothing beyond "there is a
schema".

**Migration:** there is nothing to re-point in a working app — an unregistered
renderer had no call site to migrate. If you imported the symbol directly:

```diff
-import { PageNodeRenderer } from '@object-ui/layout';
+import { PageRenderer } from '@object-ui/components';
```

`PageRenderer` in `@object-ui/components` is, and remains, the renderer for the
`page` component key. It is the one that supports page types
(record/home/app/utility), named regions and `PageVariablesProvider` — the
deleted one rendered a header plus children and nothing else. Schema-driven
consumers are unaffected: a `{ type: 'page' }` node has always resolved through
the registry to `PageRenderer`, never to this export.

Also note: this supersedes the `Page` → `PageNodeRenderer` rename shipped for
this package in the batch 7 symbol burn-down — the renamed symbol is gone rather
than renamed again. `PageHeaderProps` → `PageHeaderComponentProps` from that same
batch is unaffected.
