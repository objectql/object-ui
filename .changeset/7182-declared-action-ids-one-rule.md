---
'@object-ui/types': minor
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
---

Mixed id/object action arrays are refused; use all ids or all objects
(objectui#7182, maintainer ruling 2026-09-02, option C).

An `actions` array on `page:header` or `record:quick_actions` (and the bar's
spec-declared `actionNames`) is either **all action ids** or **all inline
`ActionDef` objects**. A mixed `['convert', { … }]` array is now refused on both
surfaces: none of its authored actions is rendered, and the console names the
offending index (`… refused at index 1 — element 1 is an inline action object
but element 0 is an action id …`). Before this change the two renderers
disagreed on exactly that input — `page:header` normalised per element and drew
both halves, `record:quick_actions` switched on the whole array and rendered
nothing for the id — so one authored array meant two things depending on which
surface drew it, and the mixed form is precisely what a half-migrated page under
the objectstack#11592 ids ruling produces.

**Breaking, deliberately, and narrowing.** `@objectstack/spec` has always
declared `PageHeaderProps.actions` as `z.array(z.string())` — the spec already
refuses an object element at validation, naming its index — and
`RecordQuickActionsProps` declares `actionNames` (ids) only. What narrows is
the renderers' undeclared tolerance: an all-object array still passes through
(transition tolerance for the migration, retired on its own card once the last
inline array is converted), a mixed one no longer does. **Migration:** convert
each array whole — every element an id naming an action declared on the
object — never one element at a time.

New on `@object-ui/types`, beside `actionRendersAt`: the pure
`resolveDeclaredActionIds(elements, registeredActions)` (and its shape half,
`classifyDeclaredActions`), with the `DeclaredActionsShape` /
`DeclaredActionsResolution` / `DeclaredActionsRefusal` result types. Both
renderers call it; the whole-array switch in `record-quick-actions.tsx` and the
per-element normalisation in `containers.tsx` are gone. The rule is closed: a
string is an id, a non-null non-array object is an inline definition, and any
other element (`null`, a number, a nested array) is refused at its index too.
An all-id array resolves by `name` in authored order, first registration
winning on a duplicate name; ids that name nothing are reported back with their
index for the caller to warn about once its lookup has settled.
