---
'@object-ui/app-shell': minor
---

Flow designer add-node palette follow-ups (#1943): localize the category section headings (Data / Logic / Human / Integration / Flow) to the active console language, and upgrade the "Recently used" list from browser-local storage to per-user cloud sync via `sys_user_preference` (new `FlowPaletteRecentsProvider` / `useFlowPaletteRecents`), with one-shot migration of the legacy localStorage key and a localStorage fallback when offline or outside a provider. Adds a Flow Designer guide to the docs.
