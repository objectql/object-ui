---
"@object-ui/app-shell": patch
---

fix(studio): approver Type is a real dropdown that drops the deprecated `role` spelling (framework #3133)

The flow designer's approver `Type` control silently rendered as free text:
`FlowObjectListField` had no `select` branch, so an objectList column of kind
`select` (which the approver type is, derived from the spec enum) fell through
to a plain `<Input>` and its computed options were never shown. Added the
missing branch — it renders a real dropdown from the column's `options`, and
keeps a **stored** value that is no longer offered (a deprecated enum member)
visible-but-flagged so editing a legacy row can't silently blank it.

With the dropdown live, it honors framework's new `xEnumDeprecated` schema
annotation (ADR-0090 D3): the deprecated `role` approver type is dropped from
the options while `org_membership_level` is offered, so Studio no longer walks
authors into the trap of picking `role` (which resolves against the better-auth
membership tier and silently matches nobody).

Also: the `org-membership-level` reference picker is a fixed three-value enum
(owner/admin/member) instead of the dead `client.list('role')` — the `role`
metadata type was removed by ADR-0090 D3, so that call returned nothing and the
Value box degraded to free text.
