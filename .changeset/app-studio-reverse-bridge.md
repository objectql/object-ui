---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Add the app → Studio reverse bridge (ADR-0080): workspace admins see a "Design in Studio" entry in the app top bar that deep-links to the running app's owning package on the Studio design surface (`/studio/:packageId/data`). Hidden for non-admins and for apps with no owning package; package writability stays server-side (read-only packages open as browse-only).
