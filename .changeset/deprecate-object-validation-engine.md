---
"@object-ui/core": patch
---

chore(core): deprecate `ObjectValidationEngine` — rule enforcement stays single-implementation on the server (#3110)

`ObjectValidationEngine` / `defaultObjectValidationEngine` / `validateRecord` are
now `@deprecated`. **Nothing is removed and no behaviour changes** — existing
callers keep working exactly as they did after #3103.

**Why.** Object-level validation rules are *enforcement*, and enforcement is
single-implementation on the server (`objectql`'s rule-validator). objectui
already draws that line for the predicates it *does* evaluate client-side:
`evaluator/fieldRules.ts` handles the presentation predicates (`visibleWhen` /
`readonlyWhen` / `requiredWhen`) by delegating to the canonical
`ExpressionEngine`, "rather than re-implementing a parallel evaluator"
(ADR-0036). This engine was that parallel evaluator, on the enforcement side.

#3103 converged its semantics onto the server rule-for-rule, with eight
mutation-tested gates — and still left a known divergence: the server carries
ADR-0113's legacy-violation exemption (reject only when the merged state violates
*and* this write makes it worse), which this engine does not implement. Editing
an unrelated field on a legacy row would be blocked here and accepted there. One
careful pass still left a gap, which is the argument: mirroring cross-repo
behaviour is structurally unreliable, not unreliable-this-time.

**What to use instead.** Let the write fail and render the server's rejection —
it is already structured (`field` / `code` / `message`, plus a label since
objectstack#3957). For pre-submit feedback, the answer is a validate-only
(dry-run) write on the server: identical UX, zero parity risk, and it covers the
two rule kinds a client can never check — `unique` (needs the database) and
`json_schema` (ajv lives server-side).

**The decision is a mechanism, not a comment.** What #3103 removed was a doc
comment claiming spec canonicity that had been false for fifteen majors;
shipping its successor as another comment would repeat the mistake one level up.
`validation-engine-stays-unwired.test.ts` scans `packages/*/src` and fails if a
production module starts referencing the engine, naming the file and the issue to
reverse first. Barrels still re-export it — publishing a deprecated API is not
wiring — and host applications are free to keep importing it.

The five spec-derived rule TYPES in `@object-ui/types` are unaffected: they are
the anchor for objectstack#4115's ledger and are independent of whether objectui
ships an engine.
