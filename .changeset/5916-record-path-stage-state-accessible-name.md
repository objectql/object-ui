---
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

`record:path` now announces each stage's state, not just its label (WCAG 2.2 SC 1.4.1)

The lifecycle path distinguished travelled, upcoming and lost-terminal stages with
colour plus a `✓`/`✗` glyph, and both glyphs are `aria-hidden` decoration.
`aria-current="step"` marked the current stage and nothing else, so a screen-reader
user heard a run of identically-announced items — and a rejected stage announced
exactly like an ordinary stage the record had not reached yet.

Each stage now carries an accessible name composing its (already picklist-localized)
label with its state, from five new `detail.pathStage*` keys translated in all ten
locale packs. The glyphs stay decorative and the readout's `role="listitem"` /
`aria-current` semantics are unchanged.

The name is composed into `aria-label` rather than visually-hidden text because
`listitem` takes its name from the author only: text placed inside a stage computes
to an empty accessible name, so the visually-hidden shape would have looked right in
the markup and delivered nothing to the accessibility tree.
