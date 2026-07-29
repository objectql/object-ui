---
"@object-ui/fields": minor
"@object-ui/i18n": minor
---

fix(fields): the sharing-criteria builder stops calling an empty criteria "All records" (objectstack#3896)

`FilterConditionField` renders `sys_sharing_rule.criteria_json`. With no
criteria it displayed **"All records"**, and `filterGroupToMongo` carried a
matching `// empty = match all` comment. That was describing a bug as a
feature: a sharing rule with no predicate was stored as `criteria_json: null`
and evaluated as `find(object, { filter: {} })` under the system context —
every record of the object, granted to the recipient. `SharingRuleSchema` had
always forbidden the shape ("never seeded as a permissive match-all",
ADR-0049); the REST and data-API entries just never checked.

objectstack#3896 closes those entries: the server now refuses to save a rule
whose criteria would match everything, and one already stored shares nothing.
This is the renderer catching up.

- **The empty read-only state now says the rule shares nothing**, in
  `destructive` styling — key renamed `fields.filterCondition.allRecords` →
  `fields.filterCondition.noCriteria`, retranslated across all ten locales.
  Nothing else read the old key.
- **A new `fields.filterCondition.criteriaRequired` hint** renders under the
  builder (and the JSON editor) while the criteria is empty. The server's
  rejection is precise but only arrives as a toast *after* Save; this says it
  while the admin is still looking at the empty builder.
- **`isMatchAllCriteria` is exported** — a client-side mirror of the server
  predicate covering `{}`, `[]`, and the vacuous combinators (`{ $and: [] }`,
  `{ $or: [{}] }`), conservative in the same direction. The server stays
  authoritative; this only decides whether to show the hint.

Unparsable JSON keeps its own `invalidJson` message and does **not** also
collect the empty-criteria hint.

Note for anyone wiring this end-to-end: the Criteria field is not marked
`required` in the object metadata, deliberately — `sys_sharing_rule.criteria_json`
is nullable in deployed tenants, so `required: true` would only produce a
destructive `NOT NULL` migration that those nulls block. The invariant lives in
the server's write guards; this change makes the UI stop contradicting it.
