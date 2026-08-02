---
"@object-ui/core": minor
"@object-ui/app-shell": patch
"@object-ui/plugin-form": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-list": patch
---

Stop declaring 13 `@object-ui/core` symbols under names `@objectstack/spec` owns
(objectui#3158, objectstack#4115 batch 4).

**Breaking for importers of `@object-ui/core`** — seven exported names changed,
because the spec exports the same name for a *different* thing:

| was | now | what the spec's same-named export actually is |
|:--|:--|:--|
| `ChartSeries` | `ChartSeriesBinding` | the authored dataset-binding descriptor (a measure `name`, no `data`) |
| `ActionHandler` | `ActionRunnerHandler` | the SERVER-side objectql handler, `(ctx) => unknown` |
| `PluginDefinition` | `RegistryPluginDefinition` | the platform PACKAGE manifest (`id`/`slug`/`staticPath`/install hooks) |
| `ValidationError` | `SchemaNodeValidationError` | plugin-manifest validation, keyed by `field`, no severity |
| `ValidationResult` | `SchemaNodeValidationResult` | ditto, with both arrays optional |
| `defineView` | `defineSystemView` | the VIEW-DOCUMENT factory: parses a `ViewSchema`, returns a validated `View` |
| `resolveCrudAffordances` | `resolveEffectiveCrudAffordances` | the object-level affordance matrix, with no notion of server API operations |

The other six keep their names and are now **imported from the spec** instead of
re-declared: `StyleMap`, `ResponsiveStyles` (ADR-0065), `RowHeight`,
`CONTEXT_TOKENS`, `CrudAffordances`, `RowCrudPredicates`.

**The copies were live misdescriptions, not just duplicates.** Three said so in
their own comments:

- `CONTEXT_TOKENS` carried a note that the duplication was "temporary until the
  next coordinated release… because the installed `@objectstack/spec` predates
  that export". The installed spec (17.0.0-rc.0) exports it, and the copy was
  byte-identical — so it passed every value comparison and every behavioural
  test for the whole interval in which its stated reason was false.
- `RowHeight` advertised itself as "the spec's `RowHeightSchema` vocabulary"
  while being a hand-written union. It happened to be correct; nothing would
  have caught the day it stopped being.
- `managedBy.ts` described itself as a "UI-side mirror of the framework's
  `resolveCrudAffordances()`" and carried its own `DEFAULTS` table — a
  line-for-line copy of the spec's `CRUD_AFFORDANCE_DEFAULTS`, plus a copy of
  its override parser.

`resolveEffectiveCrudAffordances` now **delegates** the bucket/`userActions` half
to the spec's `resolveCrudAffordances()`, so the bucket table has exactly one
definition on the platform. What stays objectui's is the part the spec has no
notion of: intersecting that matrix with the server-resolved effective API
operation set (#3391), so the UI never offers a button the server would 405 —
and the name now says that instead of claiming to be the spec's function.

Deriving `RowCrudPredicates` also **tightens** it: the local copy typed
`visibleWhen`/`disabledWhen` as `unknown`, where the spec types them as
`Expression | ExpressionInput`. That was imprecision, not a deliberate dialect.
