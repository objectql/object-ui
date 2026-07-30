---
"@object-ui/components": minor
"@object-ui/plugin-view": patch
---

fix(view,components): the spec→FilterBuilder operator table covers the whole view vocabulary, and the dead write direction is gone

`view-config-utils`' `SPEC_TO_BUILDER_OP` resolved **10 of the spec's 19
canonical `VIEW_FILTER_OPERATORS`**. The nine it missed —
`not_equals`, `starts_with`, `ends_with`, `greater_than`, `less_than`,
`greater_than_or_equal`, `less_than_or_equal`, `is_null`, `is_not_null` — all
appear in stored view metadata (they are canonical; `ViewFilterRuleSchema`
validates against exactly this list), and each reached the FilterBuilder as a
raw spelling its operator dropdown cannot select.

Same defect and same cause as #2974, one table over: spellings were enumerated
by hand. That table is now derived from the spec's own canonical list and
`VIEW_FILTER_OPERATOR_ALIASES`, matched case- and separator-insensitively, so
`not_in` / `notIn` / `'not in'` / `NOT_IN` are one entry rather than four
chances to miss one.

Four canonical operators have no FilterBuilder equivalent —
`starts_with`/`ends_with` (absent from its vocabulary) and `is_null`/
`is_not_null` (distinct from the `is_empty`/`is_not_empty` it does have). They
are recorded as explicit `null`s and asserted, and deliberately left unmapped:
folding them onto a near-equivalent would silently rewrite the author's
operator on the next save, whereas an unmapped operator surfaces as a condition
row the author must complete.

Also retired `BUILDER_TO_SPEC_OP` and `toSpecFilter` — the write direction,
dead since the legacy `buildViewConfigSchema` engine was replaced by the
studio's spec-driven inspector (no caller anywhere in the repo, and not part of
`@object-ui/plugin-view`'s public exports). It was objectui's last emitter of
`'not in'` with a space, plus `before`/`after`, as *filter-AST* operators —
spellings that reached the server outside `VALID_AST_OPERATORS` and were dropped
without an error (objectstack-ai/objectstack#3948).

`@object-ui/components` now exports `FILTER_BUILDER_OPERATORS` (and the
`FilterBuilderOperator` type), derived from the operators the FilterBuilder
actually renders, so tables mapping onto that vocabulary can assert against it
instead of restating it.

Refs objectstack-ai/objectui#2945, #2901.
