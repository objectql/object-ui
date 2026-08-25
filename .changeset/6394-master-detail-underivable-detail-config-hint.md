---
'@object-ui/plugin-form': patch
---

`MasterDetailForm` shows a config hint naming `relationshipField` for a detail collection
whose child schema **loaded fine but could not be derived from**, instead of a permanent
`Loading columns…` (objectui#6394).

This is the third and last arm of the same resolver to be closed. `deriveDetail` throws
when no lookup/`master_detail` field on the child object references the parent — a
configuration error whose remedy is a key the author writes. The `catch` returned the
entry unresolved, so it fell through to `!d.columns?.length ? <p>Loading columns…</p>`,
and that message never ended: the derive is not retried, so those columns could never
arrive. Same unbounded-wait-shown-as-a-spinner family as objectui#5940 / objectui#6188 /
objectui#6194 / objectui#6360 / objectui#6372.

The entry now carries `status: 'underivable'`, and the renderer gives it a branch of its
own that names both ends of the relationship it could not find and the key to set:

> Could not work out how `po_line` links to `purchase_order`: no lookup or master_detail
> field on it references the parent. Set `relationshipField` on this collection to the
> field that holds the parent record.

⛔ Deliberately **not** objectui#6372's refusal placeholder, which states the schema could
not be loaded — false for a schema that loaded fine. The two failures keep separate copy
because they have different remedies: one is "check the object exists and reload", this one
is "set this key". The thrown error is still logged with its stack (objectui#6372), since
the placeholder shows the author the key rather than the raw message.

Behaviour is unchanged for the other two arms and for a detail that is genuinely still
fetching — that one keeps `Loading columns…`, where the message is true.
