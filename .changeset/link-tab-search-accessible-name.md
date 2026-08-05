---
'@object-ui/plugin-detail': patch
---

Give `InlineCreateRelated`'s "Link Existing" search box a real accessible name (objectui#3381 — the neighbouring defect found while implementing #3341/PR #3380, and left out of that PR's scope fence as a different class).

The box carried a `placeholder` and nothing else: no `<label>`, no `aria-label`, no `aria-labelledby`. Its accessible name therefore fell through to the placeholder, which is the last resort in HTML-AAM and fails in two ways — the name a browser derives from it is the one thing that disappears the moment the user types, and the fallback is not implemented uniformly (`dom-accessibility-api` has no placeholder step at all, so under test the control computed to the empty string while a browser would have said "Search Contact…").

The fix is a visually hidden `<label htmlFor>` pointing at a `React.useId`-namespaced input id — the same shape #3341 left on the create tab, rather than an `aria-label`, so the accessible name stays a real label element instead of a detached string that can drift from the visible copy. The label text and the placeholder are now derived from one expression (the placeholder only adds the ellipsis), and the id uses a hyphenated `link-search` segment so it cannot collide with a create-tab field literally named `search`. The decorative magnifier is explicitly `aria-hidden` — lucide already defaults childless icons to that, but spelling it out keeps the intent local and independent of the icon library's defaults.

No props, spec or rendered-copy change: the placeholder string is byte-identical to before.
