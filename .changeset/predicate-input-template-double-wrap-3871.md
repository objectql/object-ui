---
'@object-ui/core': patch
---

fix(core): stop re-wrapping an already-`${…}` predicate, so action-face `visible` / `disabled` finally honour it (objectui#3871)

`toPredicateInput` — the one normalizer every action surface and the action
engine share — wrapped **every** string as `${string}`, assuming a bare
expression. But `${…}` is a spelling this repo documents for a predicate
(AGENTS.md §4) and one the normalizer's own output type lists as valid, so an
already-normalized value was wrapped a second time: `'${x}'` became `'${${x}}'`,
which cannot match the evaluator's single-template fast path and does not parse.
The author's expression then decided nothing, and which constant came back
depended on the caller's error policy:

- **fail-soft** legs (every `disabled` / `enabled` leg; `visible` on
  `action:icon`, `action:group` and the related-list toolbar) got the unparsed
  string back, so `Boolean(…)` was a constant `true`: `disabled: '${…}'` greyed
  the action out permanently, `visible: '${…}'` showed one the author had gated
  away, and `enabled: '${…}'` never disabled anything.
- **fail-closed** legs (`throwOnError: true` — `visible` on `action:button`,
  `action:bar`, `action:menu`, `DeclaredActionsBar`, and
  `ActionEngine.getActionsForLocation`) got a **throw**, which each site turns
  into "hidden": an action gated with a template predicate was invisible even
  while its gate held, and the fail-closed warning blamed the author's
  expression.

A string that already carries `${` is now returned untouched (the same guard
covers the envelope branch, where an unwrapped `source` reaches the identical
wrap), which makes the normalizer idempotent. Every affected surface goes from a
constant verdict to the predicate's real one — converging the action face with
`SchemaRenderer` and `page:header`, which read the raw value and have always
been right about this spelling (objectui#3314's shape). Bare expressions and
`{ dialect: 'cel' }` envelopes are untouched.

`ActionRunner`'s two execution gates already read the raw value and are
unchanged; the objectui#3871 tripwires they carried have been replaced by pins
of the now-converged behaviour.

Whether `${…}` should be *authorable* on an action predicate at all is a
separate, spec-side question (`@objectstack/spec`'s `PredicateInput` models a
bare string and a dialect envelope): if it is to be rejected, that belongs in
publish-time validation, not in a consumer that silently invents a verdict.
