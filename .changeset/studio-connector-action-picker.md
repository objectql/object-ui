---
"@object-ui/app-shell": minor
---

feat(studio): pick a connector action from the chosen connector (no more hand-typed action ids)

In a flow's **Connector Action** node, the `actionId` field was a free-text box
(`sendMessage · send` placeholder) — a typo silently produced a node that fails
at run time. It was left as text because a connector's actions have "no flat
catalog"; but each connector already advertises its actions in the runtime
descriptors (`GET /api/v1/automation/connectors` → `{ name, actions:[{key,label}] }`).

`actionId` is now a **picker of the chosen connector's actions**, resolved from
the sibling `connectorId` (mirroring how `object-field` lists the fields of its
resolved object). New reference kind `connector-action` + `connectorSource` on
`FlowReferenceSpec`; `useConnectorActionOptions` fetches the descriptors and
`resolveConnectorName` reads the connector from the node's `connectorConfig`. Like
every reference in the designer it stays an **editable combobox** — with no
connector chosen (or none installed) it degrades to free text with a hint
("Choose a Connector above to list its actions" / "Actions of <connector>.").

Closes the last critical hand-typed-identifier gap in flow-node config (the
object / field / flow / role / connector / template references were already
pickers). Unit-tested (`resolveConnectorName`, `connectorActionsToOptions`).
