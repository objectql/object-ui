---
'@object-ui/app-shell': patch
'@object-ui/auth': patch
'@object-ui/components': patch
'@object-ui/core': patch
'@object-ui/data-objectstack': patch
'@object-ui/fields': patch
'@object-ui/layout': patch
'@object-ui/plugin-chatbot': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-timeline': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-view': patch
'@object-ui/providers': patch
'@object-ui/react': patch
'@object-ui/types': patch
---

chore(deps): raise the `@objectstack/*` dependency floor from `^17.0.0-rc.6` to `^17.0.0` (GA)

`@objectstack/spec@17.0.0` is now the `latest` dist-tag; the former `rc` tag stops at
`17.0.0-rc.6`. This raises the published dependency range on every package that declares an
`@objectstack/*` dependency, so a consumer installing these packages resolves the GA spec
rather than a release candidate.

`@objectstack/client`, `@objectstack/formula` and `@objectstack/lint` are raised in the same
step because each **exact-pins** its own `@objectstack/spec` (`"@objectstack/spec": "17.0.0"`
in GA, `"17.0.0-rc.6"` at rc.6). Raising `spec` alone would have left those exact pins
dragging a second, nested `@objectstack/spec@17.0.0-rc.6` into the tree alongside the
workspace's `17.0.0` — two copies of the schema package rather than the single GA resolution
this change exists to produce.

No runtime behaviour in this repository changes here: this commit is dependency ranges and
the lockfile only.
