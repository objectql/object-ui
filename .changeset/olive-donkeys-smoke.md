---
---

Docs-only: correct the stale docstring on the Studio Data-pillar grid-columns pin
(`StudioDesignSurface.gridColumns.test.tsx`). Since cloud#1652 added the
`publishedFieldNames` filter to `gridColumns`, the second case exercises
identity-churn liveness rather than a real column change, and its prose said the
opposite. Comment and test title only — no assertion, no source, no published
behaviour changes. objectui#6729.
