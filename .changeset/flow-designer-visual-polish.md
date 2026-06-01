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
  existing icon/accent/label tones. Added distinct tones for `loop` (sky),
  `screen`/`user_task` (pink) and `assignment` (purple) — previously they fell
  back to the generic slate "task" tone, so every node type now reads as a
  distinct color in the canvas.
- **Readable labels**: node width 188→240 and the per-node summary moved from a
  right-hand column onto a second line, so the label now gets the **full card
  width** (it was badly truncated — "Manager Re…", "Budget Ab…"). A native title
  tooltip surfaces the full text on the rare remaining truncation.
- **No overlap on add**: adding a connected node no longer pins it directly below
  its parent (which stacked every sibling on the same spot) — it's left to the
  layered auto-layout, which slots it beside its siblings.
- **Canvas surface**: the dot grid now tracks pan **and** zoom (it moves with
  the diagram instead of floating behind a static texture), plus a subtle inset
  vignette for depth.
- **Edges**: rounded line caps, slightly stronger default stroke, and
  pill-shaped (rounded-full, frosted) branch/condition labels.
- **Toolbar + add-node palette**: frosted, rounded controls with a primary
  hover affordance; the palette gains an "Add node" header and matching tinted
  icon chips per row.

Verified in-browser (Studio → flow → designer) in both light and dark themes.
