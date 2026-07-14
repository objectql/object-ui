---
"@object-ui/app-shell": patch
---

polish(console-ai): ease the dock's canvas auto-maximize, and give Studio its own chat width (ADR-0057 UX follow-ups, #2477)

- **#4** The rail now eases to its new width (200ms) when the Live Canvas opens
  (auto-maximize) or closes (tuck), instead of snapping. The transition is
  suppressed during a manual resize drag so the width still tracks the pointer
  1:1.
- **#6** The Studio dock persists its width under its own key, separate from the
  console dock. A wide console chat no longer squeezes the Studio design canvas
  (and vice-versa) — each surface remembers the width that suits it.
