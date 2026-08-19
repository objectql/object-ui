---
'@object-ui/console': patch
---

API Console's endpoint catalog reads the canonical `storage` service slot
first, falling back to the deprecated `file-storage` slot while the
framework's v17 alias lives (objectui#5286, framework#9683).

`useApiDiscovery`'s `SERVICE_ENDPOINT_CATALOG` looks its service names up
directly in `/discovery`'s `services` map, and that lookup is deliberately
fail-closed (ADR-0076 D12) — a miss hides the whole endpoint group rather
than erroring. The framework's #9683 ruling made `storage` the canonical
`CoreServiceName` slot and kept `file-storage` mirrored, byte-equal,
alongside it for `@objectstack/spec`'s v17 lifetime. Before this change the
console only ever read the deprecated key; it now reads the canonical key
first, so the Storage group correctly reflects the framework's own naming,
and still renders unchanged against a backend that has not deployed the
#9683 mirror row yet.
