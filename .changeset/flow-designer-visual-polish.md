---
'@object-ui/app-shell': minor
---

Polish the Studio flow-designer canvas visuals

A refinement pass over the metadata-admin flow designer (`FlowCanvas` +
`flow-canvas-parts`) — purely presentational, no behavioral or API changes,
theme-aware (light/dark), and still dependency-free.

- **Node cards**: the flat 3px left-accent stripe is replaced by a tinted,
  color-coded **icon chip** (the card's primary category cue), with a bolder
  label, refined uppercase type caption, layered hover elevation
  (`-translate-y-0.5` + soft shadow), and clearer selected / run-state rings.
  Per-category `chip` tone tokens (soft bg + inset ring) added alongside the
  existing icon/accent/label tones.
- **Canvas surface**: the dot grid now tracks pan **and** zoom (it moves with
  the diagram instead of floating behind a static texture), plus a subtle inset
  vignette for depth.
- **Edges**: rounded line caps, slightly stronger default stroke, and
  pill-shaped (rounded-full, frosted) branch/condition labels.
- **Toolbar + add-node palette**: frosted, rounded controls with a primary
  hover affordance; the palette gains an "Add node" header and matching tinted
  icon chips per row.

Verified in-browser (Studio → flow → designer) in both light and dark themes.
