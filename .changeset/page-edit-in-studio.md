---
"@object-ui/app-shell": patch
---

Add an admin-only "Edit in studio" affordance to the runtime PageView. Custom pages are authored in the metadata studio (canvas + inspector), not at runtime — so instead of embedding the heavyweight page canvas, PageView now shows a lightweight top-right button (admins only) that deep-links to the page's studio editor (`/apps/:app/metadata/page/:name`). This gives view/report/dashboard/page a consistent runtime admin edit entry point.
