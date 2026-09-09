---
"@object-ui/plugin-kanban": patch
---

fix(plugin-kanban): make swimlanes below the fold reachable

A swimlane board's lane region was `overflow-hidden` while being shrunk to the
board's bounded height, so any lane past the first screenful could not be
reached by any gesture — the region had no scroll affordance and the document
did not scroll either (measured in Chromium at 1600x1000: region `scrollHeight`
2104 against `clientHeight` 1000, two of three lanes lost).

The region now owns a vertical scroll (`overflow-y: auto`) and the column-header
row sticks to the top of it, so the column titles stay visible over their own
columns while you scroll through the lanes. The board stays height-bounded and
self-contained; nothing about its horizontal axis changes.
