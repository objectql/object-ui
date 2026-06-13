---
"@object-ui/console": patch
---

feat(ADR-0046): lightweight chrome for the docs routes.

The `/docs` portal and `/docs/:name` viewer are app-independent top-level
routes, so they rendered as bare full-bleed pages with no header and no way
back. Add a minimal sticky `DocShell` header — a "Documentation" home link
(→ `/docs`) plus a breadcrumb of the current doc — shared by the portal and the
viewer. Keeps ADR-0046's "no nav taxonomy in v1" intent (no app sidebar) while
giving readers orientation and a way out. The portal's redundant in-body title
is dropped in favour of the header.
