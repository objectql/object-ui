---
"@object-ui/core": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-view": minor
"@object-ui/app-shell": minor
"@object-ui/types": patch
---

fix(views): ListView reads the spec-canonical `filter`, so a view's base filter reaches every visualization (#2890 scope A step 4)

Third rename in the ListView vocabulary migration: **`filters` → `filter`**. Unlike
the first two this closes a live bug, because the fork was asymmetric.

`ListView` was the **only** surface in the repo reading `filters`. Every child
view — `ObjectGrid`, `ObjectGallery`, `ObjectKanban`, `ObjectCalendar`,
`ObjectGantt`, `ObjectMap`, `ObjectTree`, `ObjectChart` — reads `filter`, and
`ListView` handed them `filters`. Wherever a child fetches its own rows instead
of receiving `ListView`'s, the view's base filter was silently dropped:

- **a `chart` list view aggregated the whole object.** The chart branch built an
  `object-chart` node with `filters:`; `ObjectChart` reads `schema.filter` and
  never read `filters`, so a chart view with a base filter charted unfiltered
  totals.
- the same applied to any of the other view components rendered standalone from
  a list-view-shaped config.

Conversely, a **spec-authored** list view — one carrying `filter`, which is what
the spec says and what `runtime-metadata-persistence` and "Save as view" already
persist — rendered **unfiltered** in `ListView`, because nothing read that key.

The fold is a key rename only. Both keys carry an ObjectQL FilterNode array
everywhere in objectui; every consumer passes the value straight to `$filter`.
(The spec types `filter` as `ViewFilterRule[]` — `{field, operator, value}`
objects — so objectui's field is typed from the spec but used as something else.
That mismatch is real and left alone here: converting formats inside a
vocabulary fold would change what reaches the data source.)

Also collapses a duplicated computation in `app-shell`'s `ObjectView`, which
computed the same effective filter **twice** — once as `filter` for the child
views, once as `filters` for `ListView` — with the two copies subtly different
(only one fell back to `listSchema.filter`; only the other ran token
substitution over the URL filters). There is now one computation, keeping both
behaviors.

`filters` stays declared on `ListViewSchema` and in the drift guard's sanctioned
set — stored views carry it and it is still valid input — but it is input-only.
