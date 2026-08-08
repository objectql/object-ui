---
"@object-ui/app-shell": patch
"@object-ui/core": patch
---

Action params that inherit a field's options now keep the keys that field declared

A field-backed action param (`{ field: 'tier' }`) had its inherited option list
rebuilt entry by entry as `{ label, value }`, which silently dropped every other
key the field's options declared — most consequentially the per-option
`visibleWhen` predicate (ADR-0058). A select field whose options narrow by
predicate in an object form therefore offered the FULL list in an action dialog,
including the entries the predicate exists to hide, with no diagnostic on either
side; `color` / `icon` / `disabled` were lost the same way. Options authored
inline on the param were never affected — they always passed through verbatim,
which is the asymmetry this restores.

The resolver now preserves each inherited entry and only does its two real jobs:
expanding bare strings into label/value pairs and translating the label through
`fieldOptionLabel`. The option widgets already filter on `visibleWhen`, so a
role-gated option (`'admin' in current_user.positions`) inherited by a dialog
param now narrows the offered set and clears a seeded value the predicate hides.

`ActionParamDef.options` (`@object-ui/core`) and the resolver's `RawActionParam`
are widened to match: `ActionParamOption` names the two keys the param layer
reads and carries the rest of a field's option vocabulary through.
