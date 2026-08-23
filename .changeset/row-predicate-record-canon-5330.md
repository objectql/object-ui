---
'@object-ui/core': minor
'@object-ui/react': minor
---

Row predicates declare a canon: `record.*`. The bare shorthand and `data.*` now
warn once, and are unchanged otherwise.

A row predicate (`visible` / `disabled` / `enabled` on an action renderer, a row
scope, a `record:alert`) has bound the row three ways since objectui#4075 —
`record.status`, bare `status`, and `data.status` — without any of them being
declared the contract. The maintainer ruled that question on 2026-08-20
(objectui#5330, option B), mirroring the objectstack#7917 option-② precedent for
the identical renderer-tolerance shape: **the canon is `record.*`**, and the
other two enter a deprecation window.

The canon states the **server's** accept set, which was this card's first
measurement and turns out to be strictly narrower than the renderer's. Measured
against `@objectstack/formula@17.1.0`, the engine the server evaluates with:

| spelling | server runtime | server authoring oracle |
|---|---|---|
| `record.status` | `{ ok: true, value: true }` | accepted |
| bare `status` | `Unknown variable: status` | refused |
| `data.status` | `Unknown variable: data` | **silently accepted** |

`buildScope({ record })` mounts exactly `['record']` — `data` is never bound and
the row's fields are never flattened to top level. The three-way binding is a
client tolerance with no server counterpart, which is why the warning belongs on
this side.

`data.*` is the dangerous one, and the reason the warning exists. `data` is in
`@objectstack/formula`'s `SCOPE_ROOTS`, so the server's bare-identifier oracle
waves it through — that list is a deliberately generous "never faults" lint
baseline, not the runtime accept set. A `data.*` row predicate therefore passes
every authoring gate the platform has and then binds nothing at runtime: not an
error, a constant `false`. A `visible` that is constantly false is a button that
silently never appears — the objectui#4075 fail-closed signature.

What ships:

- `@object-ui/core` exports `detectNonCanonicalRowSpelling`,
  `warnNonCanonicalRowSpelling`, `resetRowPredicateCanonWarnings` and
  `ROW_PREDICATE_CANONICAL_ROOT` from a new `evaluator/rowPredicateCanon.ts`,
  which carries the canon statement and the measurement.
- Both evaluation tiers report once, in dev: `evalRowPredicate` (core) and
  `useCondition` (react, for bags bound by `usePredicateRecordContext`).
- Detection reuses the server's own oracles (`collectCelRootIdentifiers`,
  `firstUndeclaredReference`) rather than a regex, so no second dialect
  judgement is invented client-side.

**No spelling is removed and no behaviour changes.** Every predicate that
resolved before resolves now — the ruling defers removal behind a stored-metadata
survey, and the warning is what makes that survey possible (ADR-0078: a
tolerance nothing ever reports can never be retired).

The deprecation is scoped to the **runtime record layer**. `data` remains the
canonical root one layer over, in a metadata-editing form (ADR-0089 D3
`CANONICAL_ROOT_BY_LAYER`), and the detector stands down there.
