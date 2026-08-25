---
---

Test-only: `registry-inputs-spec-parity.test.ts` gains a THIRD direction — every coarse
arm a block declares on a key must be one `@objectstack/spec` accepts there (objectui#4971).

objectui#3832 gave `ComponentInput.type` the array form so a union key can declare its real
arms, and in doing so created a second way to disagree with the contract. The two are not
symmetric: declaring FEWER arms than the spec accepts produces NOISE (the manifest gate warns
on a legal write — audible), while declaring an arm the spec REJECTS is SILENT — `checkType`
clears a value the contract refuses, the manifest and the generated `.d.ts` publish it as
legal, and `declared = enforced` inverts with nothing to announce it. Measured on #3832's own
branch: a fake `'object'` arm on `element:text_input.defaultValue` reddened that block's
per-block test, while a fake `'number'` arm on `page:card.title` left all 856 tests green —
the property held by per-block discipline, not by a gate. It is one-directional for that
reason.

An arm names a value's KIND, never its domain (`ComponentInput.type`, maintainer ruling
2026-08-17), so the gate refutes an arm only when the contract refuses the KIND — read off the
parse ISSUES rather than a boolean, scoped to the key so a required sibling cannot speak for
it, and recursing through a union's branches. A refusal of the VALUE leaves the arm standing,
which is what keeps a correct `'string'` arm on a spec-enum key from reading as invented; the
same rule still refutes a `'number'` arm there, and both halves are pinned by name. An `enum`
arm is judged exactly instead — every declared member must be a value the spec accepts.

Two red-on-arrival findings, reported rather than declared away: `element:number.filter`
(objectui#6206) and `object-grid.data` (objectui#6207), both carried as reasoned, issue-backed
exemptions that a stale-exemption test deletes the moment either side moves.
