---
"@object-ui/core": patch
"@object-ui/components": patch
"@object-ui/react": patch
---

An empty predicate is no longer a declared gate anywhere (objectui#3850, objectui#3862)

"Is a gate DECLARED on this key — is there a condition to reach a verdict on?" was
answered three times in this repo, with three different scopes, and the widest
answers sat on `disabled`, where the mistake is not benign:

- `hasDeclaredVisibilityGate` (the action face) asked `!= null && !== ''`, so every
  OBJECT counted — including `{ dialect: 'cel', source: '' }`. That envelope is not
  a hand-written curiosity: `@objectstack/spec`'s `ExpressionInputSchema` normalizes
  every authored predicate into one, so "the author left the predicate empty"
  compiles to exactly it. The verdict path normalized the same value back to
  `undefined`, and `evaluateCondition(undefined)` answers `true` — "no condition, so
  visible/enabled". On `visible` that `true` means SHOW, so the two mistakes
  cancelled; on `disabled` it means GREY, so they compounded: a button disabled
  forever that no author asked to disable (objectui#3850, the residue objectui#3842
  left behind).
- `SchemaRenderer` asked `disabled !== undefined` inline, one notch wider again, so
  `disabled: null` greyed out too — on the GENERIC rendering path, since that block
  runs for every node type, and not as an internal flag either: `_disabled` is
  forwarded to the component as a real `disabled` prop (objectui#3862).
- `ActionRunner`'s execution gates asked "does this normalize to something
  evaluable?" — the scope that turned out to be right (objectui#3848 / objectui#3872).

There is now ONE definition, `hasDeclaredPredicate`, exported from
`@object-ui/core` (`evaluator/declaredPredicate.ts`, beside the `toPredicateInput`
normalizer it is derived from): a gate is declared when normalization still leaves a
condition to evaluate. `''`, a whitespace-only string, an empty-`source` envelope
and any non-predicate value (`0`, `{}`) are NOT declared; `false` IS (a verdict is
not a missing gate — objectui#3812). `hasDeclaredVisibilityGate` keeps its name as a
re-export of it, so the five member-action renderer call sites, `DeclaredActionsBar`
and `record-quick-actions` are unchanged and inherit the scope;
`SchemaRenderer`'s `disabled` / `disabledOn` chain and `ActionRunner`'s two gates
read the same function. No consumer got a local "and also check for empty" test —
that fourth dialect is what objectui#3842 / objectui#3849 spent two PRs merging away.

Measured behaviour change, `action:button` and the generic path, before → after:

| value | `visible` | `disabled` | `enabled` | `SchemaRenderer` `disabled` prop |
|---|---|---|---|---|
| `''` | shown → shown | on → on | on → on | forwarded → absent |
| `null` | shown → shown | on → on | on → on | forwarded → absent |
| `{ dialect: 'cel', source: '' }` | shown → shown | GREY → on | on → on | forwarded → absent |
| `{ source: '' }` | shown → shown | GREY → on | on → on | forwarded → absent |
| `'   '` (whitespace) | HIDDEN → shown | on → on | GREY → on | forwarded → absent |
| `0` / `{}` (not predicates) | shown → shown | GREY → on | on → on | forwarded → absent |
| `true` / `false` / bare CEL / `${…}` / non-empty envelope | unchanged | unchanged | unchanged | unchanged |

Every row moves toward "there is no gate here", never away from it, and no value
that HAS a verdict changes it — the verdict is still read from the raw value, only
the gate in front of it narrowed. Two rows are behaviour changes rather than the
equivalence the ruling expected, and are pinned as such: the whitespace string moves
on `visible` / `enabled` (it used to normalize to `'${   }'`, which evaluates falsy,
so a predicate that says nothing HID the action from everyone), and non-predicate
junk stops greying controls out (fail-open, the posture `ActionRunner` already
committed to).

One blank spelling is knowingly still outside the scope: an envelope whose `source`
is blank but not EMPTY (`{ dialect: 'cel', source: '   ' }`) — the normalizer folds a
`source` of `''` and does not trim, so the string spelling of a blank predicate is
trimmed and the envelope spelling is not, and `disabled` still greys out for that one
value. The ruling enumerated three empty spellings; this is a fourth, measured and
filed as objectui#3960 rather than widened in here.

One chain is deliberately untouched: `SchemaRenderer`'s `visible` / `visibleWhen` /
`visibleOn` / `visibility` / `hidden` / `hiddenOn` legs keep `!== undefined`, because
narrowing them would change ALIAS PRECEDENCE, not just emptiness. The `hidden` legs
are not negated and therefore carry this same defect with the polarity that makes the
node vanish — measured, out of this ruling's scope, filed as objectui#3955.
