---
"@object-ui/app-shell": patch
---

Datasource preview stops reporting read replicas

`DatasourcePreview` rendered a "2 read replicas" pill from
`datasource.readReplicas`. That key is retired in `@objectstack/spec` 17
(objectstack#4468): nothing in the platform ever opened a replica connection —
no driver reads the key and no query path splits reads from writes — so the
pill confirmed a configuration that did not exist.

It is worth being precise about what the pill did wrong, because a preview
panel echoing the draft back is normally harmless. This one did not echo, it
concluded: an author who configured replicas, saved, and saw the pill light up
got the platform telling them it had understood. It was the only surface in
either repo that acknowledged the key at all, which made it the whole of the
evidence that the feature worked. `packages/spec/liveness/README.md` has the
standing rule — an authoring or preview renderer is never a runtime consumer —
and a 2026-06 sweep that classified 13 properties on preview-renderer evidence
alone was later found wrong on 10 of them.

Read-replica routing does not exist yet; it is tracked as a feature request
rather than reflected in the UI as though it shipped.
