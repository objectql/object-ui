---
"@object-ui/plugin-form": patch
---

A required field whose `defaultValue` is a runtime token is submittable from a create form

`@objectstack/spec` lets a field's `defaultValue` be a runtime *instruction*
rather than a value — the `DEFAULT_VALUE_TOKENS` family (`'NOW()'`,
`'current_user'`) or a CEL Expression envelope. The server resolves those per
insert, in `ObjectQL.applyFieldDefaults`, for any field that arrives absent or
null, which is why a create form must leave them empty: seeding the literal text
`NOW()` into a datetime input and submitting it suppresses the very resolution
the declaration asked for.

Correct for an optional field. Combined with `required: true` it deadlocked:

```ts
remind_at: Field.datetime({ required: true, defaultValue: 'NOW()' }),
```

the control opened empty, the client-side required rule refused the submit, and
there was nothing sensible for the user to type — the declaration had already
said what the value is, and omitting the field is exactly what makes the server
supply it. Same shape as the `required` + static-default case, one layer down.

In **create** mode a runtime `defaultValue` now suppresses the client-side
`required` rule, and the field is omitted from the payload. The producer
guarantees the value at insert, so the field is not "missing" — it is
server-owned. `required: true` alongside a runtime default is coherent authoring
(storage-level required, producer-guaranteed), not an authoring error.

Both halves matter. Suppressing the rule alone would have been half an answer: a
rendered control registers with the form whether or not anything seeded it, so
an untouched runtime-default field still reached the payload as `undefined` — or
as `''` once anything focused it. `undefined` is invisible to a
`JSON.stringify` inspection while remaining a KEY a data source may translate
into an explicit column write, and `''` is neither absent nor null, so it stores
a blank and defeats the declaration outright.

Three boundaries came with it, each pinned in both directions:

- **Create only.** An edit form shows a persisted row, where the token was
  resolved at insert; blanking a required column there is a real removal and is
  still refused.
- **Runtime defaults only.** A static literal default *is* seeded into the
  control, so if the user clears it they have removed a value that was really
  there — `required` still fires.
- **The rule, not the field.** A value the user does type is submitted normally
  and outranks the declared default. Only the "must not be empty" check is
  suppressed.

Seeding and this rule read ONE predicate (`isRuntimeDefault`), so a form can
never seed a field it also refuses to submit. The suppression also drops the
required marker and `aria-required` for that field in create mode, since both
are driven by the same boolean — the honest reading, as the user really is not
required to provide the value. Surfacing what the server *will* supply, as a
non-authoritative preview, is a separate follow-up.

Not extended to `requiredWhen` (the conditional-required CEL rule), which is
resolved downstream in the form renderer against the live record.
