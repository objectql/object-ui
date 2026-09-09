---
'@object-ui/app-shell': patch
---

Stop dropping a flat view overlay's top-level `columns` (objectui#8411).

`ViewMetadataSchema` spells one persisted `view` body three ways and recognises the
standalone **ViewItem record** by its nested `config`; a **flattened runtime overlay**
has no `config` and IS its own body. `MetadataProvider.mergeViewsIntoObjects` routed on
`viewKind && object` — true for both spellings — and then read `view.config`
unconditionally, falling back to `{}`. So an overlay's entry collapsed to
`{ name, label, isDefault }` and every top-level `columns` / `type` / `data` the author
wrote was discarded.

The failure was silent in the worst way. Binding an object to its views is by `object` +
`viewKind` and has nothing to do with the body, so the **tab still rendered** — the
screen looked correct while the author's column list had never been read, and nothing
reported it. Measured, not inferred: the three readings (tab renders; columns dropped;
nested-`config` control renders its columns) were run on this repo's `main` before any
line changed.

The fix asks the spec's own discriminant where the body lives, in one named place, and
gives the overlay the explicit path it was owed: a nested `config` is unwrapped as
before, and a body without one is used as-is. Nothing about the acceptance set moves —
the overlay was already a legitimate persisted shape, `@objectstack/spec` needed no
change, and the routing predicate is unchanged, so no tab appears or disappears.

This closes a drift rather than opening a dialect: the sibling read paths already asked
it this way (`listViews` in `@object-ui/data-objectstack` unwraps a nested `config` and
returns a flat row verbatim; metadata-admin's `viewDisplayType` reads `config.type`
first and top-level `type` second).
