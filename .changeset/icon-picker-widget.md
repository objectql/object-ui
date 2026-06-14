---
"@object-ui/app-shell": minor
---

Add an `icon` form widget — a searchable Lucide icon picker for metadata-admin.

Metadata `icon` fields (page/app/object) were a raw text input where authors had to know and type an exact Lucide name. The new `widget: 'icon'` renders a combobox: the trigger shows a live preview of the current icon, and opening it reveals a search box plus a grid of matching icons (preview + name). Selecting writes the kebab-case name string. Out-of-catalog values (e.g. icons from another library, or typos to fix later) survive — they render on the trigger and stay reachable as a "keep" option so re-opening never silently drops them. Registered as `'icon'` in the metadata-admin `WIDGETS` map; pair with `widget: 'icon'` in the spec `*.form.ts`.
