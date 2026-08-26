---
'@object-ui/app-shell': patch
'@object-ui/react': patch
---

Drop the undeclared object-level `titleField` from the object page's five
remaining view-config seams, and from the record-search memo key

`ObjectView` resolves a title field for seven view kinds. Two of them —
calendar and gantt — already read `viewDef.<kind>?.titleField || 'name'`. The
other five (timeline, kanban, map, gallery, tree) carried a three-rung chain
with `objectDef.titleField` in the middle, so one file answered the same
question two different ways. This converges the five on the shape the two
siblings already had; it is a convergence, not a removal.

The middle rung could never fire for legal metadata. `@objectstack/spec`'s
object schema is a `strictObject`, so
`ObjectSchema.safeParse({ …, titleField: 'x' })` is rejected with
`unrecognized_keys` — the same issue code a nonsense key gets — while
`nameField`, `displayNameField` and `titleFormat` all parse (measured against
`@objectstack/spec@17.2.0`, the dist this repo installs). objectui#6531
established that measurement and dropped the twin read inside
`getRecordDisplayName`. Reading a key no producer can ship is the
consumer-side alias AGENTS.md Commandment #0.1 bans.

Behaviour for every legal config is unchanged, and both directions are pinned:
a view that declares its own `titleField` still wins on every kind, a view that
declares none still floors at `'name'`, and an object carrying the
contract-rejected key is now honoured by no kind. Re-pointing the middle rung
at the declared `nameField` was considered and rejected: it would have added a
rung calendar and gantt do not have — increasing the divergence — and, unlike
this change, it would have altered behaviour for legal configs.

`useRecordSearch`'s candidate signature — the memo key that decides when the
cross-object fanout re-runs — appended `o?.titleField ?? ''` to every entry.
Because no legal object definition can carry the key, that half was permanently
`''`: a constant suffix in a cache signature, and the last thing in the repo
that read as evidence some producer supplies it. The signature is now the object
name alone, which is the only field of an object definition the effect actually
consumes. Change detection is unaffected — a changed candidate name still
re-runs the fanout, and a new array with identical content still does not.
