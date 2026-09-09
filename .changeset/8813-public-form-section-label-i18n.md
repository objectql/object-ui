---
'@object-ui/console': patch
---

Public form `/f/:slug` now translates its section headings and field labels
(objectui#8813, seam 2 of objectui#8408).

A visitor arriving in `zh-CN` was greeted by the strings the author typed while
building the form — "Your application" — even when the app bundle carried
`objects.<object>._sections.<section>.label`. The renderer never looked.

The blocker was structural rather than a missing call: `buildSections` copied
the authored `sec.label` onto its renderable row and **dropped `sec.name`**, and
`RenderableSection` had no `name` member at all. The convention key is
`{ns}.objects.{objectName}._sections.{sectionName}.label`, so with the section's
stable name gone the key could not be CONSTRUCTED at the render site, whatever
the render site did. Carrying `sec.name` is therefore the precondition; the two
lookups are what it enables.

- `RenderableSection` carries the section's `name`, and `buildSections` copies
  it. A group-REFERENCED section (`{ group: 'parties' }`) arrives already
  resolved and carries the group's key as its name, so it translates on the same
  convention.
- The section heading resolves through
  `useSafeFieldLabel().sectionLabel(objectName, sec.name, sec.label)` — the same
  resolver `ObjectForm`, `ModalForm` and the record detail page use, so the two
  form renderers cannot drift apart on what the key IS.
- The field label resolves through `fieldLabel(objectName, name, label)`. On this
  route the served label is usually already localized by the server payload; the
  client lookup is the overlay an app bundle can put on top of it, not a
  replacement for it.

The authored string remains the fallback everywhere: a section the bundle says
nothing about keeps its heading, and a section authored without a `name` has no
key and keeps its heading too. Nothing starts rendering a heading that did not
render before — the fix translates headings that already appear, it does not
widen which sections have one.

The page's own `<h1>` is deliberately unchanged and keeps the form's authored
`title`. `useObjectLabel` resolves a view label as
`objects.{object}._views.{view}.label`, and this route has no view name in hand:
the public payload carries a publish `slug`, which is authored and edited
separately from the view's name. Routing the heading there would be a no-op at
best and would replace the author's own title with an unresolvable fallback at
worst.
