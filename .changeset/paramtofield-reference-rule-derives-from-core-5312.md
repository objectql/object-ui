---
'@object-ui/app-shell': patch
---

`ActionParamDialog`'s "this param carries a reference target" rule now derives from the shared reference-field family instead of the last private copy of it.

`packages/app-shell/src/utils/paramToField.ts` restated the rule inline as
`LOOKUP_WIDGET_TYPES.has(type) || type === 'user'` — the fourth and last
hand-maintained answer to one question ("does this widget resolve a foreign key,
so hand it `reference_to` / `display_field` / the rest of the picker config").
The other three converged on `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES` in
objectui#4770 / #4790 / #4815; this face is now the fourth.

No reachable behaviour change. The shared set is one member wider (`tree`), and
that member can never be a widget key on this surface: it is absent from
`fields`' widget map and `mapFieldTypeToFormType` sends it to `field:lookup`, so
every key the rule tests arrives as `lookup`. Both halves are pinned, so
registering a real `tree` widget surfaces the change instead of shipping it
silently.

The module's second rule — which widget keys degrade to a text input for want of
a declared `referenceTo` — is a different set over overlapping types (`user`
defaults its target to `sys_user` and must never degrade) and was deliberately
left un-merged, matching the same split the plugin-grid twin keeps.

Also retires a comment that claimed the disjunction "moves in lockstep with
plugin-grid's `bulkParamToField` twin — the two param faces are never split".
Measured on the tip before this change, that was false in both senses: the twin
had read core's Set since objectui#4815 while this line read a private literal,
so the two shared nothing and no gate could report a split; and the two member
sets already differed, by `tree`. Lockstep now holds mechanically — the pin is
on object identity (a spy on core's `has`), so a member-identical private copy
fails where a value check would pass.
