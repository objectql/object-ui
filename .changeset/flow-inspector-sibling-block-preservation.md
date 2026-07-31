---
"@object-ui/app-shell": patch
---

fix(flow-designer): a published `configSchema` can no longer delete a node's sibling-block editors — objectstack#4045

`FlowNodeInspector` resolved its form as `serverFields ?? fieldsForNodeType(type)`,
so an engine-published `configSchema` **replaced the hand-written field group
wholesale**. But a `configSchema` describes `node.config` and nothing else
(ADR-0018), and `jsonSchemaToFlowFields` roots every field it emits at
`['config', key]` — so the replacement silently deleted every editor rooted
anywhere else.

18 fields sit in that blast radius: `connectorConfig.*` (3), `waitEventConfig.*`
(5), `boundaryConfig.*` (6) and the top-level `timeoutMs` (4). For `wait` and
`boundary_event` those blocks are the node's **entire** contract.

This already happened once. `connector_action`'s descriptor published a schema
declaring `connectorId` / `actionId` / `input` as CONFIG keys, so against a live
backend the generated form replaced the `connectorConfig` group — connector and
action pickers included — and an author configuring a connector node in Studio
wrote the trio to `node.config`, which the executor never reads. The node then
refused to dispatch with `connectorConfig.connectorId and .actionId are
required`. objectstack#4210 retired that schema on the server; this change is
what stops the next mis-rooted one from doing the same to `wait` or
`boundary_event`.

New `mergeServerFlowFields()` splits the resolution by root:

- **the server owns the config-rooted fields** — it is the authority on what the
  executor actually reads, so its set replaces the hand-written config fields
  rather than merging with them (a stale client key must not linger);
- **non-config fields are always preserved** from the hand-written group, in
  declared order;
- a server field duplicating a preserved sibling key is **dropped**, not rendered
  twice — two editors for one value, one of them writing where nothing reads, is
  the same bug wearing a different hat.

With no published schema the hand-written group is still used whole, unchanged.

Verified by mutation: reverting to the old replacement turns all three new
assertions red, one of which replays the `connector_action` incident directly.
