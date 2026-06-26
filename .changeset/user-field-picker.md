---
'@object-ui/fields': minor
---

feat(fields): wire the `user` field picker to a real `sys_user` search

The `user`/`owner` field widgets previously rendered a placeholder ("User
selection component requires integration with user management system") and the
form-type map fell through to `field:text`, so a `user` field rendered as a
plain text input.

`UserField` now **delegates to the shared `LookupField`** with the reference
fixed to `sys_user` — reusing the existing debounced candidate search, the
record-picker dialog, and id resolution — so selecting a person works the same
way as any lookup, with zero bespoke data plumbing. `mapFieldTypeToFormType`
now maps `user`/`owner` to `field:user`/`field:owner`, satisfying the existing
`field-type-coverage` regression guard (which already listed both but had no
mapping wired — the widget map and cell renderers were registered, the form-type
map was the missing link). Table-cell display continues to use `UserCellRenderer`
(avatars/initials).

Pairs with the framework `user` field type (a lookup specialized to `sys_user`).
