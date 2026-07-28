---
"@object-ui/app-shell": patch
---

fix(flow-designer): read approver value sources off the schema instead of mirroring them (framework#3508 follow-up)

The approver Value picker decided *where its candidates live* from a local
table, `KIND_TO_RECORD_LOOKUP`, hand-mirrored from the spec's
`APPROVER_VALUE_BINDINGS`. That mirror is what made framework#3508 possible:
`xRef.map` names a picker KIND (`'team'`) and nothing more, so this package had
to pick a data source itself — and picked the metadata REGISTRY
(`GET /api/v1/meta/:type`), which lists no `sys_user` / `sys_team` /
`sys_business_unit` / `sys_position` ROWS. Candidates were always empty and the
control degraded to a raw-id text box.

The spec now publishes the data contract as `xRef.sources` (one entry per
approver type: `{ source: 'data', object, valueField }`, the closed enum
inline, or a non-picker marker). `json-schema-to-fields` carries it through —
validating each entry, dropping any that could not drive a picker — and
`recordLookupFor()` prefers it over the local table. A new approver type can no
longer leave a stale mirror behind here.

What did NOT move: presentation. Which field to display, whether to open the
people picker, what subtitle to show under a row stay this package's calls, so
the spec ships the data contract and not the look. The local table remains as
the fallback for a server that predates the annotation, and a `data` source for
a kind with no presentation entry still renders a lookup labelled by its
committed column — better than degrading a resolvable reference to free text.

Also corrects the approver `type` options comment in `flow-node-config.ts`: that
list is the OFFLINE fallback (`FlowNodeInspector` renders
`serverFields ?? fieldsForNodeType(...)`, so a real backend's published
configSchema wins). Its "indirect bindings lead, `user` last" ordering therefore
never reached the live picker, which followed the spec enum with `user` first —
the opposite of the intent. The ordering now lives in the spec's `ApproverType`
enum, and the comment says which list is authoritative.
