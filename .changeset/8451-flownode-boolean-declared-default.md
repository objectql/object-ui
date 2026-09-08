---
'@object-ui/app-shell': patch
---

Flow-node inspector: a boolean config control now shows the declared default when
the node omits the key (objectui#8451, objectui#6830 arm A "show, do not write").

Before this, the boolean control drew `value === true`, which flattened an ABSENT
key and a stored `false` onto the same unchecked box even though the runtime treats
them oppositely on a key the spec defaults to `true`. On an approval node that omits
`escalation.notifySubmitter`, the inspector showed "Notify submitter" unticked while
the executor notified the submitter — a rendered false statement about what the flow
will do, not a missing hint.

The control now reads the value in effect: the stored boolean, or — when nothing is
stored — the `defaultValue` the descriptor declares, in the same `'true'`/`'false'`
spelling `isFieldVisible` already resolves an unset `showWhen` controller against.
Both writers of the property feed it: the hand-written descriptor table and the
engine-published `configSchema` that `json-schema-to-fields` converts.

**Nothing is written.** A node that never had the key still ships without it; the
first author edit commits an explicit boolean exactly as before. Ticking a box that
shows a declared `true` writes `false`, which is the author's answer and outranks
the declaration on every later render.

`patch`, not `minor`: no prop, option or metadata key is added, and no authored
document changes meaning. What changes is that one control stops contradicting the
runtime for metadata that already parses.

Scope is the boolean control only. The select control is unchanged — rendering an
effective default there needs `InspectorSelectField`'s unreachable `placeholder`
prop fixed first (objectui#8450).
