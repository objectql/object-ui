---
"@object-ui/app-shell": minor
---

feat(flow-designer): connector picker lists dispatchable connectors + marks declarative instances (ADR-0096)

The `connector_action` node's connector picker read `client.list('connector')` —
the declared `connectors:` metadata, which includes inert catalog descriptors and
**misses** plugin-registered connectors. It now reads the runtime registry
(`GET /api/v1/automation/connectors`), i.e. exactly the connectors a
`connector_action` can dispatch: plugin connectors and materialized declarative
instances (framework ADR-0096). Declarative instances are annotated `· declarative`
(from the descriptor's new `origin` field) so authors can tell a materialized
metadata connector apart from a plugin one. Degrades to empty on fetch failure;
the field stays free-text editable. Tolerates an older backend with no `origin`.
