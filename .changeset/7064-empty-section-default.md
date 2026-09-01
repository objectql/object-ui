---
'@object-ui/plugin-detail': minor
---

**Behaviour change.** `record:details` no longer forces `hideEmpty` on the
sections it synthesizes, so a sparse record keeps its section skeleton instead
of collapsing. Applications relying on the old auto-hide of *unauthored*
sections will now see headings, field labels and empty-value placeholders where
rows used to vanish. This is the loud-over-silent direction, ruled by the
maintainer on 2026-08-31: an empty detail body is a platform concern, and a
metadata application should not have to author its way out of one.

`RecordDetailsRenderer` mapped every authored section with
`hideEmpty: s.hideEmpty ?? true`. `DetailSection` already states the correct
rule in its own heuristic — *"If a section is entirely empty (e.g., loading
state, brand-new record), do NOT auto-hide — the labels themselves are useful
as a structural skeleton"* — and the forced default overrode exactly the case
that sentence reserves. On a hand-created record whole sections disappeared and
the body collapsed to a couple of rows; seeded demo data hid it. Every
application then had to hand-write `hideEmpty: false` per section to stop
looking broken, which is per-app tax for a platform defect. The renderer now
passes the authored value through untouched and lets the heuristic own the
default.

What changes, precisely:

- an **all-empty** section renders its heading, every field label and one
  empty-value placeholder per field (it used to render nothing at all);
- a **small** partly-empty section — below `DetailSection`'s auto-hide
  threshold of 4 fields / 25% empty (3 / 20% on mobile) — now shows its empty
  rows;
- a **large** mostly-empty section with at least one filled row still
  auto-hides, with the "Show N empty fields" toggle unchanged: the
  label-graveyard guard is intact and this is not a return to dense-by-default;
- empty rows are now visible while inline-editing a section, so an unwritten
  field can be filled in place.

What does **not** change: an authored `hideEmpty` keeps its exact former
meaning. `hideEmpty: true` remains the explicit opt-in to hiding, and
`hideEmpty: false` remains what it always was — "not `true`", not an override
of the auto-hide heuristic (measured, and pinned as pre-existing).

Reference-app hit inside this repo: the Studio metadata-admin page preview
(`PagePreview`) binds a real sample record, so a `record:details` block over a
sparse sample now previews the skeleton rather than a collapsed body. No
application metadata needs editing — that is the point of the change.
