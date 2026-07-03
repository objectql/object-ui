---
"@object-ui/app-shell": patch
---

feat(home,studio): builder cover on Home + builder→app bridge

Two entries that wire the application builder into the platform journey the
Airtable way — Home is the cover, the app is the published front-end:

- **Home builder cover** (admins/builders only): two guided cards above "Your
  apps" — **Build an app** (start from scratch → `/studio`, pick/create a
  writable package) and **Start with a template** (→ marketplace). End users
  see their apps as before.
- **打开应用 bridge** in the `/studio` top bar: when the package ships an app,
  one click opens its published front-end (`/apps/<name>`) in a new tab —
  the builder edits the 设计界面, the app is what end users see (Airtable's
  Data ↔ published-Interfaces relationship, our draft→publish included).
