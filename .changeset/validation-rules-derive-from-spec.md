---
"@object-ui/types": minor
"@object-ui/core": minor
---

feat(types,core): the `*Validation` rule types derive from spec 17, and the engine agrees with the server — objectstack#4115

The five spec-named rule variants in `data-protocol.ts` were hand-written
interfaces, each labelled `(ObjectStack Spec v2.0.1)` while the installed spec
was `17.0.0-rc.0`. Nothing bound them to the spec, so fifteen majors of drift
accumulated with `tsc` silent throughout and the comment still vouching for it.
They are now `z.input` derivations of `ScriptValidationSchema` /
`StateMachineValidationSchema` / `CrossFieldValidationSchema` /
`ConditionalValidationSchema` / `FormatValidationSchema`, and canonicity is
carried by that binding plus a parity gate rather than by a comment (#3017).

`z.input`, not `z.infer`, because objectui consumes **authored** metadata as it
arrives over `/meta` — before the spec applies its defaults and canonicalizes
expressions. That is the shape actually in the JSON.

**Breaking, in the shape of the rule types** (minor per this repo's version
policy — see AGENTS.md §9):

| | was | is |
|---|---|---|
| `ConditionalValidation` | `condition` + `rules[]` | `when` + `then` / `otherwise` |
| `FormatValidation` | `pattern` + `flags`, 8 named formats | `regex`, the 4 formats the server implements |
| `Script`/`CrossField` `condition` | `string` | `string \| { dialect, source }` |
| `StateMachineValidation` | — | gains `initialStates` (objectstack#3165) |
| `BaseValidation` | no `priority`, `events` included `'delete'` | gains `priority`; `'delete'` retired (objectstack#3184) |

`UniquenessValidation` / `AsyncValidation` / `RangeValidation` are now
`@deprecated`. They have no spec counterpart — the spec removed the first two
deliberately (uniqueness → a unique index, since SELECT-then-INSERT is racy;
async → the form layer) — and the spec's `ValidationRuleSchema` rejects all
three, so no rule in those shapes can ride in `ObjectSchema.validations`.

**`ObjectValidationEngine` now agrees with `objectql`'s rule-validator.** It is a
client PRE-CHECK of rules the server enforces, so every disagreement cost the
user something real. Fixed:

- **Polarity was inverted.** The server violates a rule when the predicate is
  TRUE; the engine violated it when the predicate was FALSE. Every
  spec-authored `script` / `cross_field` rule produced the opposite verdict.
- **Envelope conditions were a silent no-op.** `{ dialect, source }` reached
  `expression.trim()`, threw, was caught, and read as "passes".
- **`conditional` was a silent no-op**, reading `rule.condition` / `rule.rules`
  where the spec says `when` / `then`; `otherwise` was never evaluated at all.
- **`format` produced FALSE REJECTIONS** — it read `rule.pattern`, and
  `undefined.test(...)` threw into a catch that reported a violation, blocking
  writes the server accepts.
- **An absent `active` disabled the rule** and an absent `events` threw; both
  arrive absent from `/meta` because the spec defaults them at parse time.
- `priority` now orders execution; `initialStates` is enforced on insert;
  `format`/`state_machine` only fire when the write touches the field; a broken
  predicate or an uncompilable `regex` fails OPEN with a warning; and a rule type
  the engine cannot evaluate (the spec's `json_schema`) warns instead of
  reporting the record as valid.

The default `SimpleExpressionEvaluator` is not CEL and never was; it now binds
both the spec's `record.x` scope and objectui's historical bare `x`, and
documents that richer predicates need a CEL-backed evaluator. `validateRecord`'s
`event` parameter no longer accepts `'delete'`.

Gates: `packages/types/src/__tests__/validation-rule-spec-parity.test.ts` (key
sets, wire shapes, the pinned `then`/`otherwise` divergence with an inverted pin
that fails when objectstack#4171 is fixed upstream) and the rewritten engine
suite. objectstack#4115's ledger drops 120 → 115.
