---
'@object-ui/types': minor
'@object-ui/cli': minor
---

Discriminate `AnyComponentSchema` on `type` (objectui#8498).

The union was flat, so a refusal carried EVERY arm's issue list, and Zod's
`$ZodError` initializer stringifies that whole tree into `.message` eagerly — in the
constructor, not behind a getter. The cost was paid whether or not anyone read the
message, and it compounded per level of nesting: measured on zod 4.4.3, a root
refusal cost 14,624 chars, growing until `RangeError: Invalid string length`, thrown
out of `safeValidateSchema` — documented as validating "without throwing errors".
Discriminated, the same document costs 164. `ObjectQLComponentSchema` and
`CRUDComponentSchema` follow for the same reason: zod refuses a plain `z.union` as a
discriminated member.

**No document changes verdict.** The 13 arms declare 107 `type` literals with zero
collisions, so the arm a literal selects was already the only arm that could accept
it; across 440 example documents, flat and discriminated agree on every one.

**What moves is diagnostics.** A refused document whose `type` selects an arm now
reports that arm's issues as top-level issues at absolute paths, rather than one
`invalid_union` at the root with them nested inside; a `type` no arm claims is
reported at `type` rather than at the root. `objectui validate` prints the same
2026-09-02 ruling output — the selected arm alone, or a note plus a capped candidate
list — read off the new issue shape.
