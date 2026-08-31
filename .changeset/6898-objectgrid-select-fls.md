---
'@object-ui/plugin-grid': patch
---

ObjectGrid: field-level security on the server `$select` projection
(objectui#6898) — the FETCH half of the gap objectui#6799 closed on the RENDER
half.

`getSelectFields()` built the projection from the authored `columns` / `fields`
with no FLS gate, so after objectui#6799 hid the column the field name was still
being ASKED for. `perms.checkField(object, field, 'read')` now gates the
projection, on both authored arms and on the predicate-operand harvest.

Measured, because the grade depended on it: ObjectStack's own server enforces
FLS on the RECORD, not on the projection — `plugin-security`'s read middleware
deletes an unreadable key from every returned row, and its `predicate-guard`
says in terms that the projection is deliberately unguarded because the masker
strips the value anyway (pinned over real HTTP by objectstack's
`showcase-fls-read-mask-strip.dogfood.test.ts`, where `?select=name,<denied>`
answers 200 with the key absent). So against ObjectStack this is
defence-in-depth; it becomes load-bearing for any backend that does not strip.

Two limits are deliberate and pinned:

- Only keys the object DECLARES are judged. `checkField` answers `false` for a
  field no policy mentions, so judging an undeclared key would strip a host's
  derived or joined column out of its own query.
- `id` survives even a policy that denies it, structurally — `ensureId` composes
  after the gate — so row navigation cannot break. Readable predicate operands
  are untouched, so objectui#3501 does not regress.

The fetch effect now also depends on `perms.isLoaded`: `/me/permissions`
resolves asynchronously, so without it nothing would rebuild the projection
after the policy answered and the gate would never run on the only fetch most
grids make.
