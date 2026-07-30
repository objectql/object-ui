---
"@object-ui/plugin-view": patch
---

fix(view): the chart view gets a label and an icon in the view switcher — objectui#2916

`ViewSwitcher`'s two exhaustive `Record<ViewType, …>` maps — `DEFAULT_VIEW_LABELS`
and `DEFAULT_VIEW_ICONS` — were each missing the `chart` key. `chart` is a member
of `ViewType` and `plugin-charts` is a registered view, so a chart tab rendered
with no icon and with its raw type key `chart` as the label, while every sibling
view showed a glyph and a capitalized name.

Both maps now carry `chart`, using the same `BarChart3` glyph and `'Chart'` label
that `plugin-list`'s switcher, `app-shell`'s `ObjectView`/`CreateViewDialog`, and
the `console.objectView.viewTypeChart` translation already agree on — so the
switcher no longer disagrees with the rest of the UI. An explicit per-view
`label`/`icon` still overrides the default, unchanged.

Why the compiler did not catch it: `@object-ui/plugin-view` had no `type-check`
script, so `Record<ViewType, …>` — the exhaustiveness guard that exists precisely
to make a missing member a compile error — was never evaluated by CI. The package
now type-checks both its sources and its tests, and its `DEBT` entry in
`scripts/check-type-check-coverage.mjs` is deleted. Compiling the tests for the
first time also surfaced three unused destructured spy parameters, and the
package's one remaining reported error (a `dnd-kit` `SyntheticListenerMap`
mismatch in `ViewTabBar`) is fixed by typing the listener bag as `dnd-kit`'s own
exported `DraggableSyntheticListeners` rather than a hand-written structural fork.

Refs objectui#2911, objectui#2915.
