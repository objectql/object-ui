---
'@object-ui/core': patch
---

Dev-mode `validateSchema` no longer reports every expression-valued `visible` / `disabled`
gate as an invalid schema (objectui#6505). `BASE_SCHEMA_RULES` declared both keys
`typeof value === 'boolean'`, so the exact authoring form the docs teach —
`{ "type": "button", "disabled": "${record.stage == 'closed'}" }` — printed
`disabled must be a boolean` and its host element got `data-obj-schema-invalid`, the cue
apps are told to hang a red outline off.

**The accept set widens to what the protocol already declares and the runtime already
accepts, not beyond it.** `AGENTS.md` §4 declares both keys as expressions, `SchemaRenderer`
evaluates them through `hasDeclaredPredicate` + `evaluateCondition`, `@objectstack/spec`
normalizes every authored predicate into a `{ dialect, source }` envelope, and the
objectui#3862 / objectui#3955 rulings are entirely about which expression spellings count
as declared. This table was the one place in the repo that disagreed, so this restores
declared = enforced rather than changing a contract.

**The rule still bites, and that half is pinned separately.** The two keys stay in
`BASE_SCHEMA_RULES`: a number, `null`, `{}`, an array, `''`, whitespace-only predicate text
and the empty / blank-`source` envelope (objectui#3960) are all still reported at their own
path with `INVALID_TYPE`. Every one of those was reported before this change too — the
accept set is a strict superset of the old one, so nothing that validated stops validating
and nothing refused becomes accepted. The message now names both halves of the accept set
instead of only the half that did not change.

The verdict is delegated to `hasDeclaredPredicate` (`evaluator/declaredPredicate.ts`), the
repo's single definition of "is a predicate gate declared on this value?"
(objectui#3850's ruling), rather than answered a second time in the validator — a
hand-rolled twin that agrees today and drifts tomorrow is the defect class this rule was
already an instance of. `packages/core/src/validation/__tests__/predicate-valued-gate-rules.test.ts`
pins the delegation behaviourally: the rule's verdict must equal
`boolean || hasDeclaredPredicate(value)` across every probe in the file.

The explicit boolean arm is kept even though `hasDeclaredPredicate` already subsumes it, so
the superset relationship is provable locally: a future narrowing on the declaredness side
cannot silently start reporting `disabled: false` — the most explicit gate an author can
write — as an invalid schema.

The zod `safeValidateSchema` surface (`@object-ui/types/zod`, objectui#6318) is a different
validator and is untouched.
