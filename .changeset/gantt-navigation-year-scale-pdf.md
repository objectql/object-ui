---
"@object-ui/plugin-gantt": minor
---

feat(gantt): year scale, navigation, saved layout, and PDF export (follow-up to #1672)

- **Year scale** — new `year` granularity (one column per year, with a "20XXs"
  decade group band above); ResourceWorkload follows the same column width/label.
- **Navigation** — toolbar gains *This week* / *This month* jump buttons (beside
  the existing *Today*), scrolling the timeline to the current week/month start.
- **Saved layout** — `persistLayoutKey` / `onLayoutChange` plus a "Save layout"
  button snapshot the current granularity + zoom + collapsed task columns to
  `localStorage` (`gantt-layout:<object>:<view>`) and restore on next load (an
  explicit `viewMode` prop still wins). `ObjectGantt` derives the key from the
  data object by default; `persistLayout: false` opts out.
- **PDF export** — rasterizes the whole chart SVG to JPEG embedded in a
  zero-dependency single-page PDF (DCTDecode), alongside PNG export
  (`buildExportSvg` shared by both).
