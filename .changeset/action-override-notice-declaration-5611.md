---
'@object-ui/core': minor
'@object-ui/app-shell': minor
---

`ActionDef` now declares `overrideNotice?: string`, and both param-collection
handlers narrow their `action?: any` parameter to `ActionDef` (objectui#5611).

`overrideNotice` was produced, read, and declared nowhere. `DeclaredActionsBar`
composes the dispatch as `any` and hands it to the runner through a
`dispatch as ActionDef` cast; `useConsoleActionRuntime`'s param-collection
handler took `action?: any`. The key crossed the entire producer/reader seam
without a single declaration — so `warnOnUnknownActionKeys` told the author, in
dev, that a key "no reader recognizes" was present, on every privileged-override
dispatch, about a key two files actually read. That warning now stops, which is
the user-visible half: this restores an invariant rather than adding a feature.

Nothing new is accepted at runtime. The key already reached the runner through
that cast; declaring it only makes the type layer say what already happens. It
is documented at the declaration as objectui dialect with no spec counterpart —
`@objectstack/spec`'s `ActionSchema` has no such field, and unlike `description`
it has no authorable twin in `@object-ui/types` either, because a host composes
it in code. objectui#5178's ruling that it must NOT be folded into `description`
is restated there: the reader resolves `description` through
`_actions.<name>.description` and prefers a bundle hit over the passed literal,
and `plugin-approvals` ships exactly such an entry for `approval_reject`, so a
safety notice routed through `description` would be silently replaced by
ordinary copy in every locale that has the bundle.

The declaration and its `ACTION_DEF_KEYS` entry move together because
`actionKeys.pin.test.ts` re-derives that list from the interface's AST — measured
here by ablating the inventory entry alone, which fails the pin by name
(`missing: ['overrideNotice']`).

With the key declared, narrowing `useConsoleActionRuntime.tsx:196` and
`RecordDetailView.tsx:500` is a one-token change to each annotation — `ActionDef`
was already imported by both files. This is what puts both handlers under the
compiler at all; every other read in them was already a declared field.
objectui#4282 attempted the same narrowing, hit three `TS2339`s on this key, and
backed out rather than casting at the use site. Ablating the declaration and
rebuilding restores exactly those three diagnostics.
