---
'@object-ui/components': patch
---

The form's cascade clear now recognises object-form fields, so a narrowed option list no longer submits a stale value.

`field:select` and `select` name the SAME field kind: the object-form path
(`mapFieldTypeToFormType`) emits the prefixed widget id, hand-written SDUI
schemas the bare one. The form host's cascade-clear effect (objectui#2284)
compared the RAW type string against the bare-name set, so every option field
coming from an OBJECT schema fell out of the effect entirely. Its controlling
field could change, its option list narrow, and the no-longer-offered value was
never dropped — the form submitted exactly the stale "china + california" pair
the effect exists to prevent. Only genuinely cascading fields were affected
(those carrying a `dependsOn` or a per-option `visibleWhen`); a plain picklist
has nothing to recompute either way.

The comparison now normalizes the type before the lookup, which is what the
render path a few hundred lines below has done for `isOptionField` since
objectui#3231 — the two readers of "is this an option field?" no longer
disagree about what a `select` is. This half was the one missed then.

Stated because it is a behavior change and not an equivalent refactor: the
object-form path gains cascade clearing for the FIRST time. A form whose stored
value is genuinely excluded by its chosen parent will now clear that value where
it previously kept it. The narrowing is bounded by the rules already in place
for the bare-name path, both of which the object path now inherits unchanged: a
GATED list (a declared `dependsOn` parent still empty) is treated as unknown
rather than invalid and never deletes anything (objectui#4247), and a field with
no `dependsOn` and no per-option predicate is never recomputed at all.
