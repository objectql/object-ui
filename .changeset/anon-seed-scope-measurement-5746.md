---
---

Test-only: adds the objectui#5746 enumeration harness that measures whether
`MetadataProvider`'s seed key is ever written under the `@anon` principal scope,
and whether a different principal can read such an entry. No published behaviour
changes — the harness records measurements, it does not alter the provider.
