---
"@object-ui/plugin-form": patch
---

Create forms now open with the object schema's declared `defaultValue`s

A field declared `required: true, defaultValue: 'draft'` opened the console's
create dialog with an empty select and a required marker: the user had to pick a
value the system already knew, with every neighbouring option — some with side
effects — one click away. `defaultValue` + `required` produced the worst create
experience of any modelling choice, strictly worse than declaring no default.

The server was never the problem. Omitting the field from a create request
stores the declared default, because `ObjectQL.applyFieldDefaults` resolves it on
insert. The gap was container-side: `ObjectForm` seeded its opening values from
the object schema, and the five other object-form containers did not — their
create branch set the form data to `initialData || initialValues || {}` and never
looked at the schema. The console's create dialog is the global `<ModalForm>`,
one of those five. Modal, Drawer, Tabbed, Split and Wizard now seed through one
shared module (`schemaDefaults`), so a create form opens preselected and
submittable.

Three boundaries came with it, each pinned in both directions:

- **Create only.** An edit form shows a persisted row as the server holds it.
  `ObjectForm`'s pass had been running in every mode, so a column the record
  leaves unset showed the default — arming a silent write of a value the user
  never chose on the next save of any other field. It is now gated on the same
  "no persisted record" test the data-fetch effect uses.
- **Static defaults only.** A `defaultValue` may be an instruction the server
  resolves per insert — the `NOW()` / `current_user` runtime tokens
  (`DEFAULT_VALUE_TOKENS`) or a CEL Expression envelope. `ObjectForm` had been
  seeding those verbatim, which put the literal text `NOW()` into a datetime
  input and then submitted it as the field's value, suppressing the very
  resolution the declaration asked for (`applyFieldDefaults` only fills fields
  that arrive empty). Those are now left empty for the server.
- **Callers still win.** `initialData` / `initialValues` outrank a schema
  default — a lookup prefill or a duplicate-record seed is the more specific
  instruction.

Only the field-level `defaultValue` is honoured, not a select option's
`default: true`, even though `@objectstack/spec`'s `SelectOptionSchema` declares
that key: the insert path resolves `defaultValue` and nothing else, so seeding
from option-level `default` would preselect values the server would never have
applied — a UI-only second default contract.
