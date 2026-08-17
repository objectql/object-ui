---
'@object-ui/components': patch
'@object-ui/fields': patch
'@object-ui/plugin-list': patch
'@object-ui/app-shell': patch
---

The list filter builder no longer offers `Is set` / `Is not set`, which its query dialects cannot express.

**User-visible before/after.** The operator dropdown in the list toolbar's
filter popover — and in the Studio view/tab/page filter inspectors, the dataset
inspector and the generic `filter` config field — loses two rows: **"Is set"**
and **"Is not set"**. The sharing-rule criteria builder (`FilterConditionField`)
keeps both, unchanged. `Is null` / `Is not null` and `Is empty` / `Is not empty`
are untouched everywhere and remain the way to filter on a missing value from
the list.

Nothing that worked stops working. Every save path behind those two rows was
already broken, in three different ways depending on the surface:

- **Live grid** — `ListView.mapOperator` had no row for either id, so its
  `default:` arm returned the id verbatim and the query went out as
  `['name', 'exists', 'x']`. `exists` is not a member of the spec's
  `VALID_AST_OPERATORS`, so `isFilterAST()` rejects the shape: an unfiltered
  read or a 400, never the filter the user asked for.
- **Save as view** — `foldFilterGroupToSpecRules` normalizes through the spec's
  `normalizeFilterOperator`, which does not know the pair, and
  `ViewFilterRuleSchema`'s enum then refuses the rule.
- **Dataset inspector** — `groupToCondition` has no row either and drops the
  condition silently, so the filter simply never applied.

**Why withheld rather than mapped.** Measured on `@objectstack/spec`
17.0.0-rc.6: neither `VIEW_FILTER_OPERATORS` nor `VALID_AST_OPERATORS` contains
an existence operator, under any spelling — both sets have zero members matching
`/exist/`. Only the MongoDB-style `FieldOperatorsSchema` criteria carries
`$exists`, and that is precisely the dialect `FilterConditionField` writes, so
the pair moves behind the existing `OPT_IN_OPERATORS` gate and that widget opts
in. Collapsing them onto `isNotNull` / `isNull` was rejected: the builder
already draws those as their own rows, the round trip is lossy (a saved
`exists` reads back as `isNotNull`), and the spec's own note records `$exists` =
has-value as still unsettled across drivers — `driver-memory`'s live mingo path
and `driver-mongodb` read key-presence.

**The class is now closed by an assertion, not by discipline.** objectui's three
existing operator-parity guards all sweep spec vocabulary → objectui; none asked
whether an id the dropdown draws is an id the consumer can persist, which is the
direction that broke. `plugin-list`'s new
`list-offered-operator-expressible-parity.test.ts` forces the set the list
toolbar offers to **equal** the set its two dialects can express, in both
directions — so an unexpressible operator cannot be offered, and an operator
that becomes expressible upstream cannot stay needlessly withheld.
