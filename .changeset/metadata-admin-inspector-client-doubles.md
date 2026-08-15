---
---

Test-only change: stub `useMetadataClient` in the app-shell metadata-admin
inspector suites so `useObjectFields`/`useObjectOptions` no longer escape to
the real network under happy-dom (ECONNREFUSED noise, no behaviour change).
