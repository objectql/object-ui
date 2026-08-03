---
"@object-ui/data-objectstack": minor
"@object-ui/plugin-chatbot": minor
"@object-ui/plugin-list": minor
---

Stop declaring 12 `@object-ui/data-objectstack` / `@object-ui/plugin-chatbot` /
`@object-ui/plugin-list` symbols under names `@objectstack/spec` owns
(objectui#3160, objectstack#4115 batch 6). All three packages leave the ledger.

**Breaking for importers of `@object-ui/data-objectstack`** — four exported
names changed, because the spec exports the same name for a *different* thing:

| was | now | what the spec's same-named export actually is |
|:--|:--|:--|
| `CacheStats` | `MetadataCacheStats` | the platform `ICacheService` counters (`keyCount`, `memoryUsage`) |
| `MetadataSaveOptions` | `MetadataClientSaveOptions` | options for writing a metadata item to a **file** (`format`, `path`, `indent`, `atomic`) |
| `SecurityPolicy` | `SecurityManagerPolicy` | the package supply-chain policy (`autoScan`, licences, code signing, sandbox) |
| `ValidationError` | `DataApiValidationError` | a plain `{ field, message, code? }` entry in a validation report |

Each pair is disjoint or nearly so — `MetadataSaveOptions` and `SecurityPolicy`
share not one key with the spec type whose name they wore — so none of them was
a dialect to reconcile; they were four unrelated concepts squatting on spec
names. `DataApiValidationError` follows the `<what was validated>Validation<Error|Result>`
convention registered on objectstack#4115 (`@object-ui/core` took
`SchemaNodeValidationError` in batch 4). Its **runtime** `name` deliberately
stays `'ValidationError'`: `normaliseClientError` and `@object-ui/react`'s
error-message helper both sniff `err.name`, so that string is a wire contract,
not a symbol.

**Breaking for importers of `@object-ui/plugin-chatbot`** — `PendingActionRow`
and `PendingActionStatus` are now re-exported from `@objectstack/spec/contracts`
instead of hand-transcribed, which narrows them. The copies had drifted three
ways, and each drift had **disabled a compile-time check** rather than merely
differed from one:

- `status: PendingActionStatus | string` — a union with `string` absorbs the
  literals, so that annotation carried no information at all;
- `[key: string]: unknown` — the objectstack#4075 mechanism: an index signature
  makes every structural comparison against the spec answer "identical", however
  far the copy has drifted;
- `created_at` / `updated_at`, which the service contract does not carry and no
  consumer in this repo reads.

**Breaking for importers of `@object-ui/plugin-list`** — `ViewTab` is derived from the spec's `ViewTabSchema`
— from its **input** side, because `pinned` / `isDefault` / `visible` carry
`.default()`s and this component is handed authored metadata, not parsed output.
That removes a renderer-side tolerance the copy carried: `visible` accepted
`string | boolean` and the tab bar compared it against the literal `'false'`, a
spelling no producer emits. `label` also stops being required (the spec makes it
optional; `name` is the identifier) and `filter` stops being `any`.

`ListView` and `UserFilters` keep their names as declared dialects: both are the
React **renderers** of the spec types whose names they share, and each takes that
spec type as a prop (`ListViewProps.schema`, `UserFiltersProps.config`) rather
than restating its shape. `Tool` and `MessageContent` in `plugin-chatbot` are
vendored Vercel AI Elements / Shadcn primitives — upstream's component API, not
objectui's authored surface — so the guard now skips that directory the same way
it already skips `components/src/ui/`, with a test that fails if any file there
stops carrying its vendor banner.

Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
tracks `@objectstack`, so breaking changes of our own ship as minor with the
semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.
