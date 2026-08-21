---
'@object-ui/types': patch
---

Corrects the `@deprecated` prescription on `UniquenessValidation` in
`packages/types/src/data-protocol.ts`, which pointed authors at spellings the platform
no longer accepts (objectui#4765).

Comment-only — no runtime behaviour changes. `patch` rather than an empty frontmatter
because the JSDoc sits on an **exported** declaration and therefore ships to consumers:
measured with the package's own build (`tsc`, and `tsconfig.base.json` deliberately sets
`removeComments: false`), `dist/data-protocol.d.ts` goes 40218 → 41781 bytes and the new
prose is present in the emitted `.d.ts`. What a consumer reads on hover changes, so it
is declared. The emitted `dist/data-protocol.js` is byte-identical (sha256
`a3de34c5…`, 207 bytes both ways) — that file is a types-only module whose entire JS
output is the license banner plus `export {}`, so a comment on an erased `interface`
reaches the declaration file and nothing else.

Two of the three spellings it prescribed were wrong, measured against the installed
`@objectstack/spec@17.0.0` (the report was written against `17.0.0-rc.6`):

- **`indexes[].partial`** was retired in spec 17.0.0 under ADR-0049. It is a tombstone
  (`z.never()`) that the parse rejects at any value, so "`partial` for a scoped
  constraint" named a key that cannot be declared. A predicated unique constraint is
  built at the database layer by a runtime migration issuing
  `CREATE UNIQUE INDEX … WHERE`; the prescription now says so.
- **`{ fields, unique: true }`** on `ObjectSchema.indexes` is the deprecated positional
  spelling of `unique: 'global'` under ADR-0120 — lint `unique/unscoped-declared-index`
  warns in 17.x and protocol 18 rejects it. The prescription now states the scope:
  `unique: 'global' | 'organization'`.

The measurement also refined the report, and the refinement is the reason the rewrite is
not a uniform find-and-replace. The third spelling — **field-level** `unique: true` — is
NOT deprecated. `unique` is scope vocabulary shared by two surfaces on which the same
bare `true` means different things: at index level it stays verbatim (`isGlobalUnique`
and `isOrganizationUnique` both return `false`), which is why it is the positional
spelling of `'global'` and is being retired; at field level it is the positional spelling
of `'organization'` and, in the spec's own words, "stays valid indefinitely … no trap".
Rewriting both occurrences the same way would have replaced one piece of false guidance
with another, so the comment now names the per-surface difference explicitly.

The interface's own deprecation is untouched and remains correct: `ValidationRuleSchema`
rejects `type: 'unique'` at the discriminator (accepted discriminants are `script`,
`state_machine`, `format`, `cross_field`, `json_schema`, `conditional`), so a rule in
this shape cannot reach the server.

The replacement closes with what would falsify it — `UniqueScopeSchema` and
`IndexSchema` in `@objectstack/spec` — so the next reader checks the schemas rather than
trusting the paragraph. This is the fourth piece of false guidance found in this
campaign (strictness ledger finding 18), and prose that cannot be checked is how the
first three survived.
