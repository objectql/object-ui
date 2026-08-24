---
---

Docs only, publishes nothing: two `content/docs/fields` snippets referenced
identifiers the snippet program cannot resolve, so both pages were held out of
objectui#5867's batch 3 (objectui#6126). Neither is fixed by making the compiler
happy — each was narrowed to what ObjectUI actually owns.

`auto-number`'s Sequence Management block called `db.transaction` on a `db`
declared nowhere in the workspace and exported by nothing (TS2304, plus TS7006
on the `tx` that fell out of it). Declaring an ambient `db` would have had the
renderer's documentation mint a backend contract it does not own, so the block
is now the metadata the backend actually reads — a literal annotated with the
exported `AutoNumberFieldMetadata`, carrying `format` and `starting_number` —
and the transactional sketch is prose: one counter per object-and-field pair,
incremented in the same transaction that inserts the record. The page now also
says the thing it never said, which is that ObjectUI never allocates a value at
all and renders a placeholder until the saved record comes back.

`object`'s Backend Validation block opened `import Ajv from 'ajv'`, and `ajv` is
declared by no `package.json` in this repository and resolves from nowhere
(TS2307). Adding it as a dependency to satisfy a checker was refused, so the
block keeps the ObjectUI half — an `ObjectFieldMetadata` literal whose `schema`
is the JSON Schema a server validates against — and the Ajv call sequence, which
was Ajv's documentation rather than ObjectUI's, is a prose sentence naming it as
one option among any JSON Schema validator. The section now states the fact a
reader most needs: `ObjectField` checks JSON syntax only and never enforces
`schema`, so structural validation is the server's.

Both pages join the compile population with the batch's own classifier: the four
`plaintext`-fenced blocks whose first line starts with `import` or `interface`
are now `ts`. The gate's blocks-to-compile count rises from 206 to 210 — exactly
those four — with diagnostics at 0, no new `FRAGMENT_MARKER` declarations, and
the covered/ungated and declared-fragment sets unmoved.
