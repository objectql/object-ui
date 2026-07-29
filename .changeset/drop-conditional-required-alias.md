---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/components": minor
"@object-ui/plugin-form": minor
"@object-ui/app-shell": minor
---

refactor(fields): `requiredWhen` is the only required-predicate slot — drop the retired `conditionalRequired` alias

`@objectstack/spec` 17 (objectstack#3855) **retired** `Field.conditionalRequired`,
the long-deprecated alias of `requiredWhen`. ObjectUI carried a back-compat read
for it in seven places; all of them are removed.

The removal is safe because the spec did not merely *stop emitting* the key — it
made authoring it **fail loudly**. `retiredKey()` declares the key as
`z.never()`, so:

- `z.input` types it as `never` — writing it is a `tsc` error at the authoring site;
- the parse **rejects** it (verified against `17.0.0-rc.0`), at both `FieldSchema`
  and `ObjectSchema`, with the prescription as the message:

  > `conditionalRequired` was removed in @objectstack/spec 17 (#3855) — use
  > `requiredWhen`. Rename the key; the value (a CEL predicate) is unchanged.
  > Run `os migrate meta --from 16` to rewrite it automatically.

So spec-parsed metadata cannot carry the key — an object declaring it fails to
load rather than loading with the rule silently dropped. Keeping a renderer-side
`requiredWhen ?? conditionalRequired` would have re-created exactly the second
de-facto contract the tombstone exists to prevent: the key would have kept
working in the UI while being rejected everywhere else, hiding the producer's bug
(AGENTS.md #0.1). "Backend-agnostic" (#1) does not argue for keeping it either —
`conditionalRequired` is an ObjectStack-spec-ism, so the only producers that ever
emit it are ObjectStack producers on ≤16, and the spec ships them a converter.

Removed from:

| package | site |
| :--- | :--- |
| `@object-ui/types` | the `conditionalRequired?:` member on `FormField` |
| `@object-ui/core` | the `??` fallback + rules-param member in `resolveFieldRuleState` |
| `@object-ui/components` | three pass-throughs in the form renderer |
| `@object-ui/plugin-form` | `ObjectForm`, `ModalForm`, `sectionFields`, `deriveMasterDetail` (×2) |
| `@object-ui/app-shell` | the field inspector's legacy read/auto-migrate, and the key's entry in `clientValidation`'s CEL lint list |

**Studio authors lose nothing.** The object designer's draft validation parses
against the spec's own `ObjectSchema`, so a draft carrying the key now surfaces
the tombstone's rename prescription under the same `fields.<name>.conditionalRequired`
path the CEL lint used to report — a better message than the inspector's silent
auto-migration, and one the server agrees with. That behavior is pinned by a test.

**Migrating:** rename the key to `requiredWhen` (the CEL value is unchanged), or
run `os migrate meta --from 16`.
