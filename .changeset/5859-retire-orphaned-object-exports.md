---
'@object-ui/types': minor
---

`ObjectTrigger` and `ObjectRelationship` are removed from `@object-ui/types` — two
hand-written interfaces orphaned by the `ObjectSchemaMetadata` derivation
(objectui#5859, triage adjudication 2026-08-24; the derivation itself was
objectui#5362).

**Breaking for anyone importing either name.** The two symbols are, verbatim:

- `ObjectTrigger` — the `{ name, when, on, condition?, action, config? }` trigger
  configuration
- `ObjectRelationship` — the `{ name, object, type, foreign_key?, cascade_delete? }`
  relationship configuration

Both existed solely to type members of the retired hand-written object-document mirror:
`triggers?: ObjectTrigger[]` and `relationships?: ObjectRelationship[]`. objectui#5362
replaced that mirror by deriving `ObjectSchemaMetadata` from `@objectstack/spec/data`'s
`ServiceObject`, and the spec's object document declares neither member — so the two
interfaces have had nothing to type since. objectui#5362 deliberately left them standing
because cutting published exports is a separate decision from the ruled derivation; this
is that decision.

Measured before removing, on `main`: zero references in this repo outside the declaration
and the `src/index.ts` re-export (`packages/`, `apps/`, `examples/`, `*.ts`/`*.tsx`,
`node_modules` and `dist` excluded), and zero in the sibling `objectstack` checkout, which
does import `@object-ui/types` in eleven files. Absence of a spec correspondence was
verified at type level against the installed `@objectstack/spec` 17.2.0 rather than
inherited from the card: neither `triggers` nor `relationships` is a key of
`ServiceObject`. `DataModelDesigner`'s `relationships` state is its own local model and
never referenced these types.

**That measurement cannot see npm.** In-repo zero is not consumer zero — an external
application importing either name from `@object-ui/types` will fail to compile after this
release, and nothing in this repository can detect that. Both names are spelled out above
so a host can search its own sources for them. If you were importing either, the shapes
were client-side vocabulary with no runtime behaviour and no spec backing: copy the
interface into your own code, or model the concept against `@objectstack/spec`, which owns
the object document.

Type-only change; nothing is emitted and no runtime behaviour moves. Ships `minor`, not
`major`, per the version-alignment convention in AGENTS.md — objectui's major tracks
`@objectstack`'s, and breaking changes of objectui's own carry `minor` with the semantics
stated in the body.
