---
'@object-ui/react': patch
---

Dev builds now shout when an unevaluated `${…}` expression reaches the DOM.

A value only reaches the user if `SchemaRenderer` EVALUATES it and the renderer
READS IT BACK, and those two sets do not fully overlap. Where they miss, the
failure was silent. Measured on a real render with `dataSource: { n: 99 }`:
`{ type: 'ui:statistic', value: '${data.n}' }` puts the literal text `${data.n}`
on screen, because the evaluation memo covers `content`, the `properties` /
`props` bags and the predicate keys and passes every other top-level key through
untouched. An author — increasingly, an AI authoring metadata — got no signal at
all: a literal `${data.n}` in front of a user reads like a data problem rather
than a contract violation.

`SchemaRenderer` now reports such a value once per node via `console.error`,
naming the node type and id, the key the raw source survived on (spelled the way
it was authored — `properties.value`, not the hoisted top-level copy), the
expression source verbatim, and the channels that do work today. It also catches
the second, harder shape: an expression that WAS evaluated but THREW, which
`ExpressionEvaluator` returns as its source text — indistinguishable on screen
from a key that was never evaluated.

Diagnostic only. No evaluation behaviour changes, no DOM attribute is added, and
the whole module is behind the module-load `NODE_ENV` constant a bundler folds
away, so production pays nothing.

Two boundaries are deliberate. The scan is exactly as deep as evaluation is —
shallow — because a nested `aria: { label: '${…}' }` keeps its raw source today
by decision (objectui#4799 pinned that shallowness on both bags), and a deeper
scan would report a shape the engine has not yet decided to change. And schema
METADATA is never reported: `visible` / `visibleWhen` / `hidden` / `disabled` /
… hold raw predicate source by design, and the diagnostic reads the set of
values that actually leaves for the DOM, after those keys have been stripped.

Part of objectui#4795 (Direction 3, per the maintainer's 2026-08-17 ruling).
Widening the set of evaluated text keys is Direction 1 and stays deferred behind
its named restart condition; this change deliberately does not pre-empt it.
