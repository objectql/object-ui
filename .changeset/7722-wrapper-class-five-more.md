---
'@object-ui/types': minor
---

Declare `wrapperClass` on `SwitchSchema`, `TextareaSchema`, `DatePickerSchema`,
`SelectSchema` and `ListSchema`, on both faces (objectui#7722 — the read-driven
residue outside objectui#6938's batch, one key over five more types).

Each of `renderers/form/switch.tsx`, `textarea.tsx`, `date-picker.tsx`,
`select.tsx` and `renderers/data-display/list.tsx` reads `schema.wrapperClass`
onto its wrapper element, and neither the TypeScript interface (`form.ts`,
`data-display.ts`) nor the zod mirror (`zod/form.zod.ts`,
`zod/data-display.zod.ts`) declared the key. The reads compiled through
`BaseSchema`'s index signature (objectui#5155) and the values parsed through
`.passthrough()`, admitted unexamined. The same key, on the same class of read,
is declared on `CheckboxSchema` (objectui#6938), `FileUploadSchema` and
`FilterBuilderSchema` (objectui#6150); these five were left out only because
their doc pages never listed it.

**minor, not patch — the published face gains five members.** objectui#6938 and
objectui#7295 graded a one- or two-key residue `patch` because "the accept set
only widens toward what already renders"; that reasoning still describes the
VALUE dimension here, but this change is the batch shape of objectui#6150
(`minor`), and it is dispatched under the contract-review tier precisely because
it widens the PUBLISHED surface: five schemas each gain a member of the shipped
`.d.ts` and of the mirror's `.shape` that an editor completes, an annotation
checks and a validator enforces. Two verdicts move, in opposite directions:

- **Nothing well-typed stops validating or compiling.** Key membership was never
  narrow: `[key: string]: any` admitted the key on the TS face and
  `.passthrough()` admitted it on the zod face, so every document that carried a
  string `wrapperClass` parsed green before and parses green now, with the value
  surviving the parse exactly as before.
- **A non-string `wrapperClass` is now REFUSED at the key** on these five mirrors
  (`{ type: 'switch', wrapperClass: 42 }` parsed green before; it is refused now,
  at `wrapperClass`). That is enforcement of the declared type, not a new
  capability, but it is a behaviour change for a document that carried a
  wrong-typed value under one of these five names — a value the renderer would
  have interpolated into the class string as text.

Keys outside the five are untouched: an undeclared key of any type is still
admitted unexamined on all five mirrors, pinned per mirror with a control key
the renderer does not read. `InputSchema.wrapperClass`, declared on the TS face
only, is a recorded row of the parity ledger (`UnmirroredDeclared`) and stays
there; the new sweep pin carries it as a self-expiring exemption.
