---
"@object-ui/core": minor
---

`ValueDataSource`'s text operators answer the case question the wire answers: `contains` is case-SENSITIVE, `icontains` is its ASCII-folding twin (objectui#7379)

The in-memory matcher lower-cased BOTH sides of `contains`, `not_contains`, `starts_with`, `ends_with` and — since the `icontains` arm was stacked onto the `contains` one — `icontains` too. So `contains` executed `icontains`, the two spellings named a single predicate, and a `provider: 'value'` list filtered with `contains` returned strictly more rows than the same filter run against a real driver. Nothing errored; the list was just longer, and both answers looked plausible.

`$contains` is contractually case-sensitive (objectstack#4706 Q2 = A) and `$icontains` is the case-insensitive member, folding **ASCII only** (Q1 = A, because three of the five backends are SQLite underneath and its `lower()` folds ASCII only). All five drivers — `driver-sql`, `driver-sqlite-wasm`, `driver-turso`, `driver-mongodb`, `driver-memory` — plus objectql's `having` matcher import `FILTER_TEXT_CASES` from `@objectstack/spec/data` and answer its case rows. This adapter was the last face that did not.

What changed:

- `contains`, `not_contains`, `starts_with`, `ends_with` compare exactly. There is no `i` twin for the last three — `VALID_AST_OPERATORS` has `icontains` and nothing else with an `i` prefix — so case-sensitive is the only reading available to them, and it is the one `not_contains` needs so that no row can fail an operator *and* its negation.
- `icontains` now uses the spec's own `asciiCaseInsensitiveContains`, so `CAFÉ` no longer matches `café`. `String.prototype.toLowerCase()`, which this arm used, is the full Unicode fold — a promise the SQL family cannot keep.
- The `$`-dialect matcher follows: `$contains` compares exactly, and `$icontains` gains an arm. It had none, and an unrecognised `$` operator in that switch adds no constraint at all, so a `$icontains` filter used to select every row.

**Behaviour change.** Metadata that relied on the lenient matching gets fewer rows and no error. A filter that means "match regardless of case" should be authored as `icontains` (AST/view dialect) or `$icontains` (`$` dialect); both now execute, and both fold ASCII case on either side.
