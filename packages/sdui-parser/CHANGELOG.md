# @object-ui/sdui-parser

## 17.6.0

### Minor Changes

- 279fb13: `ComponentInput.type` can declare a UNION, so a block stops warning about legal
  writes its own description recommends
  
  A registration's `type` was one coarse control kind, while a good number of spec
  keys accept more than one shape. A declaration therefore had to pick an arm, and
  the repo's own manifest gate then reported `type-mismatch` on the other arm's
  legal values. Four of the five measured cases were the loud shape: the input's
  `description` teaches the author to write an inline translation map
  (`{ en, "zh-CN", … }`) while the same input's `type: 'string'` made
  `sdui-parser`'s `checkType` warn about exactly that map — one platform authority
  contradicting itself on the write it had just recommended. Because these land at
  warning severity the page still compiled and rendered; the cost is that noise on
  correct authoring trains authors, AI authors included, to dismiss the
  `unknown-prop` and `type-mismatch` reports that are real.
  
  `type` now accepts an ARRAY of coarse kinds as well as a single one (maintainer
  ruling on objectui#3832, direction (a)), and a value passes the coarse check when
  ANY declared arm accepts it. Both declaration sites in `@object-ui/types` move
  together with the registry's own copy in `@object-ui/core`, and
  `ComponentInputSchema` enforces the same widening — a non-empty array of
  DISTINCT kinds, so an empty arm list or a repeated arm is refused at authoring
  time rather than normalized behind the author's back.
  
  Five declarations now spell their real contract, and the `type-mismatch` warning
  on each of these legal writes is gone:
  
  - `page:header.title`, `page:header.subtitle`, `page:card.title` —
    string **or** inline translation map (the spec's union, measured against
    `ComponentPropsMap` at the pinned rc.6; the renderers resolve both through
    `pickLocalized`);
  - `record:alert.title`, `record:alert.body` — the same two shapes, justified
    against the RENDERER since the pinned spec carries no `record:alert` props
    schema;
  - `element:text_input.defaultValue` — `string | number`, the spec's union,
    which had been narrowed to `'string'` with the number arm named only in prose.
  
  **Backward compatible, and measured as such.** The single-kind form stays valid
  and is still the canonical spelling for a one-arm key: it validates identically
  (the diagnostics for one arm, `invalid-enum` and its `error` severity included,
  are byte-identical), and `manifestFromConfigs` collapses a one-element array back
  to the bare string, so every entry already in a published `sdui.manifest.json`
  serializes unchanged and arrays appear only where a union was really declared.
  The JSX authoring surface follows in the same step — `generateDts` emits a
  TypeScript union for a union input, so the `.d.ts` an author type-checks against
  accepts exactly what the gate accepts.
  
  A union widens what is legal; it does not switch the check off. A value matching
  NO declared arm is still reported, a multi-arm mismatch reports at its strictest
  arm's severity (`error` when an `enum` arm is present, so an enum's closed list
  does not become dismissible by having a second arm added next to it), and arms
  are meant to match the contract rather than relax the gate:
  `element:text_input.defaultValue` deliberately gains no `object` arm because the
  spec rejects a map there, and `element:record_picker.emptyText` keeps its single
  `'string'` arm because that renderer drops the map form (objectui#4163) — an arm
  the renderer never honours would advertise a shape that cannot reach the screen.

### Patch Changes

- 40d3a33: `div` 的废弃提示按 provenance 收窄:只对 **JSON 作者面**的节点报,不再对 `kind:'html'` tier 自己解析出的节点开火。
  
  html tier 的页面是一段受限 JSX/Tailwind 文本,由引擎自己的解析器编译(只解析、不执行),标签名原样映射成节点 —— 作者在那一层写下的盒子标签,是该 tier 词表里的一等成员,**没有别的拼法可迁移**。提示照旧对他们开火,给的还是 JSON 作者面的替代建议:一条谁都无法执行的提示不是废弃,是噪声;它同时意味着这个类型永远退不掉,因为引擎自己的编译器一直在产出它。
  
  判据是**来源**,由生产者确立:解析器给它产出的每个节点打一个 symbol 标记(`Symbol.for` 注册键),渲染器读这个标记。symbol 对 `JSON.stringify` / `Object.keys` / DOM 全部不可见 —— 所以它既不会落进被持久化的文档,也就无法被一份(手写或 AI 生成的)JSON 元数据复制回来给自己买到豁免;通过花括号属性夹带进来的 JSON **不打标记**,那部分本来就是手写的,建议对它成立。
  
  迁移建议一字未改,JSON 作者面照旧每次模块加载报一次;提示文案现在写明它针对哪一个作者面。

## 17.5.0

## 17.4.0

## 17.3.0

## 17.2.0

### Minor Changes

- 4a51e77: Stop declaring 14 symbols across ten packages under names `@objectstack/spec`
  owns (objectui#3161, objectstack#4115 batch 7 — the long tail, one or two
  entries per package). All ten packages leave the ledger, which drops from 17
  collisions across 11 packages to 3 across 1.

  **Renamed exports** — in every case the spec exports the same name for a
  _different_ thing, so the old name was a mis-description rather than a dialect:

  | package                    | was                                | now                                                  | what the spec's same-named export is                                                                                                       |
  | :------------------------- | :--------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
  | `@object-ui/fields`        | `FieldWidgetProps`                 | `FieldWidgetComponentProps`                          | the DECLARED field-widget plugin props contract (a zod object; `field.type` is the `FieldType` enum, `readonly`/`required` carry defaults) |
  | `@object-ui/layout`        | `PageHeaderProps`                  | `PageHeaderComponentProps`                           | the authored `page:header` node — a zod schema of `title`, `subtitle`, an icon NAME, `breadcrumb`, `actions: string[]`                     |
  | `@object-ui/layout`        | `Page`                             | `PageNodeRenderer`                                   | the authored page metadata DOCUMENT (`name`, `label`, `type`, `regions`)                                                                   |
  | `@object-ui/plugin-detail` | `ObjectFieldLike`                  | `ObjectDefFieldLike`                                 | the i18n duck type `translateObject` walks (`help`/`description`, plus `[key: string]: any`)                                               |
  | `@object-ui/plugin-grid`   | `ColumnSummaryConfig`              | `ColumnSummarySetting`                               | the OBJECT form of `ListColumn.summary` **only** — the local one was the whole union, shorthand included                                   |
  | `@object-ui/plugin-grid`   | `isMultiValueField`                | `hasMultiValueShape`                                 | the spec's classifier, which requires a def with a `type`; the local one is called with `undefined`                                        |
  | `@object-ui/collaboration` | `RealtimeConfig`                   | `RealtimeSubscriptionConfig`                         | the app's realtime DECLARATION (`enabled`, `transport`, `subscriptions[]`)                                                                 |
  | `@object-ui/plugin-charts` | `ChartConfig`                      | `ChartContainerConfig`                               | the authored chart document (`type`, `xAxis`, `series`, `showLegend`, …)                                                                   |
  | `@object-ui/plugin-form`   | `FormSection` / `FormSectionProps` | `FormSectionContainer` / `FormSectionContainerProps` | the authored form-section metadata (`name`, `pane`, `visibleWhen`, `fields`)                                                               |
  | `@object-ui/providers`     | `Theme`                            | `ThemePreference`                                    | a whole theme DOCUMENT (`name`, `label`, `colors`, `typography`)                                                                           |
  | `@object-ui/runner`        | `App` (default export)             | `RunnerApp`                                          | the authored application metadata type **and** the `App.create()` builder                                                                  |
  | `@object-ui/sdui-parser`   | `ValidationResult`                 | `ManifestValidationResult`                           | plugin-manifest validation (`{ valid, errors?, warnings? }`), exported from both `kernel` and `contracts`                                  |

  `ManifestValidationResult` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationResult` in batch 4). `PageHeaderComponentProps` deliberately
  reuses the name `@object-ui/app-shell` already chose for its own header props in
  batch 3, so one concept does not acquire two dialect names one package apart.

  **Now derived from the spec instead of hand-written:**

  - `@object-ui/fields` — `isFileIdToken` is re-exported from
    `@objectstack/spec/data`. The local copy was character-for-character identical
    to the spec's function while its comment said it "mirrors" it, so every
    behaviour test passed and only reference identity could tell the two apart.
    The regex is a wire decision: widening it server-side while a copy here kept
    the old bound would make every new id read as "not a reference", and the
    widget would submit the legacy inline blob to a backend expecting a reference.
  - `@object-ui/plugin-detail` — `FeedFilterMode` is re-exported from
    `@objectstack/spec/data`, in a file that already imported the sibling
    `FeedItemType` from the spec.
  - `@object-ui/plugin-grid` — the eleven-member aggregation union is now the
    spec's `ColumnSummary` enum, so the total `Record<ColumnSummaryType, string>`
    label map turns a member the spec adds into a compile error instead of a
    blank footer cell. `ColumnSummarySetting` is `NonNullable<ListColumn['summary']>`,
    i.e. whatever forms the spec itself accepts. `hasMultiValueShape` delegates to
    the spec's `isMultiValueField` rather than re-deriving it from
    `MULTI_OPTION_TYPES` / `MULTI_CAPABLE_TYPES`.
  - `@object-ui/providers` — `ThemePreference` is the spec's `ThemeMode` union
    plus the one legacy `'system'` spelling this provider still honours for stored
    preferences, read off the schema's own `_zod` carrier so the package takes no
    zod dependency.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/fields` (it re-exports a runtime function) and `@object-ui/providers`
  (its public `.d.ts` now references the spec).

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- cc70b8f: A declared `objectName` must reach the data layer — the evidence the framework's spec↔registry check cannot gather (objectstack#4472).

  The framework diffs `sdui.manifest.json` against the spec's zod schemas and, while that
  check was named `check:react-conformance`, it was read — by its own file header — as
  confirming these components "ACTUALLY implement" the spec's props. It never could. Both
  sides of that diff are **declarations**, and this repo produces one of them:
  `manifestFromConfigs` copies `config.inputs` verbatim and cannot observe whether the
  renderer behind a block reads any of them. So a prop both sides declare and nothing
  consumes reads there as agreement — which is how objectstack#4413's four `record:*` blocks
  published an `objectName`/`recordId` no renderer read, rendered blank, and stayed green.

  Evidence about the render path has to be taken from the render path, so it lives here now.
  `apps/console/src/__tests__/public-block-binding-reach.test.tsx` mounts every public block
  that declares an `objectName` input through `SchemaRenderer` with nothing but that binding,
  under a provider whose `dataSource` is a Proxy recording every call, and asserts some call
  carried the object name. Deliberately narrow — "is this binding wired", not "is every
  declared input consumed", which is not decidable from outside without heuristics. Every
  non-reaching block carries a written reason in a ledger asserted to equal the observed set
  in **both** directions, so a block that starts binding forces its entry deleted and a block
  that stops binding fails; the suite was verified to go red both ways.

  First run: five of eight bound blocks reach the data layer, three do not.
  `record:related_list` legitimately declines to fetch without the parent record id from
  `RecordContext` (already documented in @objectstack/spec's objectstack#4413 ledger).
  `list-view` and `embeddable-form` do not, and that is a real defect of the same shape —
  neither registration bridges the schema-renderer context onto the component's `dataSource`
  prop the way `object-form` / `object-kanban` / `object-calendar` do, and `SchemaRenderer`
  never injects it, so on the registry/SDUI path both render an empty shell while declaring
  `objectName` **required**. Filed as objectui#3144 rather than fixed here: giving them a
  data source changes what they render everywhere they are mounted bare.

  `manifestFromConfigs` and `scripts/dump-public-manifest.mjs` now say in their own docs that
  what they emit is what a registration _declared_, never what a renderer reads.

## 17.1.0

### Minor Changes

- 32462dd: feat(sdui): guard the public contract against silent drift — coverage test + manifest lazy-stub assertion

  Follow-up to objectui#2953. That bug — every lazily-registered public block
  missing from the contract, and so from every `kind:'react'` page's scope —
  survived because nothing compared `PUBLIC_BLOCKS` against what an app actually
  registers. Type-check, lint, build and the whole suite stayed green while seven
  curated blocks were unusable. Two guards close that class.

  **Console ↔ contract coverage.** `apps/console/src/register-plugins.ts` extracts
  the plugin registration out of `main.tsx` so it can be imported without booting
  the app. A new `apps/console/src/__tests__/public-contract.test.ts` reads that
  real list and pins, as exact lists, which curated tags the console exposes (35),
  which are still unimplemented (`line_items`), and which reach the contract
  through a pending lazy stub. Exact lists rather than `toContain`, because the
  failure mode is a _shrinking_ contract. Reverting the #2953 fix drops coverage
  from 35 to 28 and fails all four assertions.

  **Manifests must be generated from loaded registrations.** New exported
  `assertFullyLoaded(configs)` in `@object-ui/sdui-parser`, plus `lazy?: boolean`
  on `RegistryConfigLike`. A lazy stub carries metadata but no `inputs`, so it
  would be written into `sdui.manifest.json` as a block that takes no props —
  making every prop an author passes it an `unknown-prop` diagnostic in the save
  gate. Both generators now assert instead: `gen-manifest.ts` throws, and
  `dev/manifest-dump.tsx` also imports the console's real registration list, so a
  plugin the console lazy-registers but the dump forgets to import eagerly is
  caught rather than silently emitted propless. `scripts/dump-public-manifest.mjs`
  surfaces that failure instead of timing out for 120s with no message.

  Also documents `object-chart` as a seventh block affected by objectui#2953 —
  the issue listed six.

## 17.0.0

## 16.1.0

## 16.0.0

## 15.0.0

## 14.1.0

## 14.0.0

## 13.2.0

## 13.1.0

## 13.0.0

## 12.1.0

## 12.0.0

## 11.5.0

## 11.4.0

## 11.3.0

## 11.2.0

### Minor Changes

- 9e7a986: ADR-0080: AI-authored UI pages. New `@object-ui/sdui-parser` compiles a constrained JSX/HTML+Tailwind source into the SchemaNode tree (parse, never execute) with whitelist sanitization, manifest validation, and `.d.ts` codegen for the JSX type surface. `PageRenderer` renders `kind:'jsx'` pages; `ComponentRegistry` gains `tier` + `getPublicConfigs()` (capability vs contract).
