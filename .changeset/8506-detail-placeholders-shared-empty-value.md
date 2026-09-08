---
'@object-ui/plugin-detail': patch
'@object-ui/components': patch
---

fix(plugin-detail): the record page's two hand-rolled empty placeholders become the shared `EmptyValue`

`DetailSection` (the details body grid) and `HeaderHighlight` (the ADR-0085
highlights strip) each spelled their own `<span>—</span>` for a missing value and
resolved their own accessible name from `detail.noValue`. Both now render
`@object-ui/components`' `EmptyValue`, which resolves exactly that key with the
same `"No value"` English fallback through a provider-safe hook — so the
accessible name is byte-identical in every locale, and the placeholder gains the
shared `data-slot="empty-value"`, `no-underline` and `select-none` treatment.

Two deliberate visual changes, decided per site:

- Both retire their own `text-muted-foreground/60 text-sm` treatment and take the
  shared `text-muted-foreground/50`. That was not a neutral difference: a
  type-aware cell renderer already draws the same shared component at `/50` in
  the very next row or chip (an unparseable `datetime` is the reachable case), so
  one section could show two dashes in two greys.
- `DetailSection` keeps its `title` hover affordance, and keeps it working: the
  shared component is `pointer-events-none`, on which a `title` never renders a
  tooltip, so that one site restores `pointer-events-auto`. `HeaderHighlight` has
  no `title` and takes the shared non-interactive default unchanged.

`EmptyValue`'s docblock also stops calling its `glyph` default an "en-dash"; it
is and always was U+2014, an em-dash. Comment only — no behaviour change in
`@object-ui/components`.
