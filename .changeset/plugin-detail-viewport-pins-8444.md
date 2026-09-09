---
---

Test-only change (objectui#8444): fifteen `packages/plugin-detail` test files now
state the viewport they assert against instead of inheriting happy-dom's ambient
1024. No published behaviour changes — nothing under `src/` outside `__tests__/`
was touched, and no assertion was altered.
