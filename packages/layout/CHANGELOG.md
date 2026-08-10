# @object-ui/layout

## 17.4.0

### Patch Changes

- 6bd6a4d: `registerLayout()` 的 `inputs` 声明面与渲染器实现对齐 —— 校验器不再对正确写法报假诊断

  `inputs` 是**作者面**:`sdui-parser/src/validate.ts` 拿一个节点的顶层属性逐个比对
  `comp.inputs`,不在其中的报 `unknown-prop`,类型不符的报 `type-mismatch`;设计器面板、
  `sdui.manifest.json`、生成的 JSX 类型也都由它派生。所以声明面写错的代价不是"文档不全",
  而是**校验器对着能正常渲染的 schema 说谎**(objectui#3972,与 objectui#3900 同族、换到属性面)。

  两处修正,都是按渲染器**实际读点**审计出来的:

  - **`page-header` 补声明 `icon` 与 `actions`。** 两个键三面齐全:渲染器真读
    (`PageHeader.tsx:117` 取参 `:224-226` 渲染 icon;`:119` 取参 `:192-196` 把 actions
    委派给 `record:quick_actions`)、`@objectstack/spec/ui` 的 `PageHeaderProps` 声明、
    `ManifestInputType` 表达得了(`string` / `array`)。`content/docs/layout/page-header.mdx`
    的 Component Props 段落也把两者写成公开契约,而该文档页**唯一**的 live demo
    (`layout-page-header/pageheader-with-actions`)就写着 `"icon": "users"` —— 于是仓内
    自己的文档示例每次过 manifest 门都收到一条 `unknown-prop: page-header has no prop "icon"`。
    `actions` 的类型与 canonical 的 `page:header` 逐字一致(`type: 'array'`),一个概念一个键
    一种类型。
  - **`navigation-renderer` 的 `items` 由 `type: 'object'` 改为 `'array'`。**
    `NavigationRendererProps.items` 是 `NavigationItem[]`(`NavigationRenderer.tsx:108`),
    而 `checkType` 对 `'object'` 判 `typeof value === 'object' && !Array.isArray(value)`、
    对 `'array'` 判 `Array.isArray`(`validate.ts:124-129`)—— 两者互斥。所以旧声明对这个
    渲染器**唯一能渲染的形状**报 `type-mismatch ... expected an object`,而对真会让它崩的
    对象形状一言不发。这不是 objectui#3832 的表达力问题:`ManifestInputType` 本来就有
    `'array'`,只是声明写错了一个表达得了的类型。

  **刻意不声明**的键同样被钉住,因为"照抄 spec 的 shape"是这条修复最容易滑进去的反向缺陷:
  `breadcrumb`(spec 有、这个渲染器零读点 —— 声明它就是 objectui#3829 的缺陷方向)、
  `showBack` / `action` / `description`(渲染器读、spec 无此键 —— 声明任一个就是在开第二套
  方言,正是 objectui#3226 收窄要防的事)、`aria`(每个 block 都因同一理由省略的可访问性逃逸口)。

  渲染输出逐字节不变:渲染路径从不读 `inputs`。变化只在校验/设计器/清单这一侧,且两个方向
  都钉了 —— 正确写法放行的同时,`description` 这类刻意不声明的键仍报 `unknown-prop`、
  `items` 写成对象仍报 `type-mismatch`(诊断没有被弄哑)。

- 876e3f7: `@object-ui/layout` no longer tells bundlers it has no side effects while registering components at load time (objectui#3899)

  The published manifest declared `"sideEffects": false` — a promise that no module
  in the package does anything on evaluation, so any module whose exports go unused
  may be dropped whole. But `src/index.ts` ends with a bare
  `try { registerLayout(); } catch {}`, and that call is the only thing that puts
  `page-header`, `page:card`, `app-shell`, `responsive-grid`,
  `navigation-renderer` and `app-schema-renderer` into the `ComponentRegistry`.

  Both statements cannot be true, and a bundler that believes the manifest is
  right to delete the registration. Measured with the repo's own bundler by
  building `import '@object-ui/layout';` — the side-effect-only import, i.e. the
  documented "import it to register" pattern:

  - `sideEffects: false` — the bundle is **0 bytes**. Zero registrations, exit
    code 0, no warning.
  - after this change — the bundle keeps all six `ComponentRegistry.register`
    calls.

  A dropped registration does not fail where it happened. It surfaces later as a
  red `Unknown component type` panel (OBJUI-001) on a fully green build, with
  nothing in the build log to connect the two. Nobody had been bitten yet only
  because every consumer today ALSO imports a named export, which forces the module
  to be evaluated regardless — coincidence, not design. objectui#3787 met the
  hazard and routed around it by calling `registerLayout()` explicitly.

  `sideEffects` is now the narrowest honest answer: an array naming the modules
  that actually register, rather than `true`, which would be honest but would hand
  the whole package to every bundler as unshakeable.

  ```json
  "sideEffects": ["./dist/index.js", "./dist/index.umd.cjs", "./src/index.ts"]
  ```

  All three are load-bearing, and the set is derived from the manifest rather than
  guessed:

  - `./dist/index.js` and `./dist/index.umd.cjs` are every JS file the manifest's
    own entry fields point at (`module` / `main` / `exports` import+require). The
    library build inlines everything into those two files, so there is no third
    chunk to name.
  - `./src/index.ts` is not published (`files` ships `dist` only) but is bundled
    for real: `apps/console` and `examples/console-starter` both alias the
    specifier straight at `packages/layout/src`, and a bundler reads this same
    manifest for those files. With only the published paths declared, the console's
    alias shape still produced a 0-byte bundle.

  What deliberately did NOT change: the load-time `registerLayout()` itself.
  Replacing it with an explicit registration API is the opposite direction — it
  eliminates the side effect instead of declaring it, and it is breaking for any
  consumer relying on automatic registration. objectui#3899 leaves that call to the
  maintainer, and the two steps do not conflict: once the manifest tells the truth,
  the migration to explicit registration can happen whenever it is wanted.

  A new pin (`packages/layout/src/__tests__/side-effects-manifest.test.ts`) runs a
  real bundler build per entry form and asserts the registrations survive a
  side-effect-only import, with a `sideEffects: false` control per form asserting
  they are dropped — so the pin cannot pass because the bundler stopped shaking
  anything. The required set is derived from the manifest's own entry fields, so a
  renamed build output or a new `exports` subpath fails as a missing declaration
  instead of drifting silently.

- f3b2874: `navigation-renderer` 的 `items` 声明为 `required: true` —— 校验器不再放过必崩的节点

  `items` 在组件侧是**非可选**的 `NavigationItem[]`(`NavigationRendererProps.items`,无 `?`),
  渲染器也不给默认值,而注册声明一直没写 `required`。`sdui-parser` 只在 `input.required` 为真时
  报 `missing-required-prop`(`validate.ts:55-64`),于是 `{ "type": "navigation-renderer" }`
  这个节点**校验零诊断、渲染直接抛**:第一处无守卫的读点是 `pinnedItems` memo 里的
  `collectPinnedItems(filteredItems)`(`NavigationRenderer.tsx:1242` → `:1410` 的
  `for (const item of items)`),实测 `TypeError: items is not iterable`。
  (`resolveActiveNavItem` memo 挡得住 —— 它的 `visit` 首行是 `if (!nodes) return`;
  `:1247` 的 `filteredItems.slice()` 同样会抛,但根本走不到。)

  这是 objectui#3972(键的**存在**与**类型**三面对齐)的第四面:**可选性**。#3972 与
  objectui#3900 都是删除假诊断,这一条相反——它是**收紧**。

  **blast radius:** 今天省略 `items` 写 `navigation-renderer` 的 schema,会新增一条
  **error** 级 `missing-required-prop`。受影响面是仓外按 `inputs` / `packages/layout/README.md`
  做 schema 驱动的消费者(仓内没有任何 JSON 元数据把它当 schema 节点写,React 调用侧的必填由
  TS 兜住;`examples/schema-catalog` 的 `not-a-container` 对照节点补了 `items: []`,使它只剩
  那一处故意植入的缺陷)。而这条诊断新拦下的形状,**恰好等于渲染必然崩溃的形状** —— 让作者
  (尤其是 AI 作者)在发布期就听到运行期注定要发生的失败,正是 `missing-required-prop` 存在
  的理由。若某个消费者确实想要"缺 items 就渲染空导航",那是给组件加 `= []` 默认值的另一条路
  (objectui#3987 里记了,与本改动不互斥),而不是让校验器继续沉默。

  `basePath` **保持可选**并被钉成对照:渲染器真的给了它默认值(`basePath = ''`)。`required`
  是逐个属性从组件读出的事实,不是一刀切——否则这道门会开始拒绝完全能渲染的 schema,作者就会
  学着无视 `missing-required-prop`,正如 #3972 里他们被教着无视 `type-mismatch`。

- 82f8dff: `page-header` 注册补 `isContainer: true` —— 校验器不再对文档承诺的 children 写法报 `not-a-container`

  `PageHeader` 一直**有意**把 `schema.children` 渲染进右侧动作槽(`PageHeader.tsx:182`,
  `record:quick_actions` 嵌在 `page:header.children` 下就是靠它),
  `content/docs/layout/page-header.mdx` 把该槽的优先级(`action` → React `children` →
  `actions` → schema children)写成公开契约,该文档页唯一的 live demo
  (`layout-page-header/pageheader-with-actions`)正是这个形状且实测正常渲染。但
  `packages/layout/src/index.ts` 的注册漏了 `isContainer: true`。

  漏这个 flag 从来没有挡住任何渲染 —— 渲染路径根本不读它(`SchemaRenderer` 把
  `children` 从 React props 里剥掉当元数据,而始终把整个节点作为 `schema` 传下去,
  `PageHeader` 自己再把 `schema.children` 放回槽里)。它的消费者在别处:`sdui-parser`
  的 `not-a-container` 诊断、Studio 调色板元数据、react-page 标签表。所以真正的后果是
  **校验器在说谎**:作者照文档写出能正常渲染的 schema,却拿到一条
  "`page-header` does not accept children" 的 warning;信了这条 warning 去掉 children,
  右槽就空掉。而会说谎的 warning 比缺一条 warning 更贵 —— 它训练作者(尤其 AI 作者)
  连真实的 `not-a-container`(那些确实不收子节点的组件)一起无视。

  这不是在 spec 之外新开作者面:`children` 是 objectui JSON 协议里**每个节点**的基础属性
  (`sdui-parser/src/validate.ts` 的 `BASE_PROPS` 把它和 `type`/`id`/`className` 并列),
  不是 `PageHeaderProps` 的键。所以这个 flag 回答的是协议层面的"该节点是否接受子节点列表",
  而对这个组件,答案一直是"是"。维护者 2026-08-09 就 objectui#3900 的 A/B 分叉裁定 A 案,
  理由同上。

  行为面变化极窄:注册元数据一个布尔位。渲染输出逐字节不变(渲染路径不读该 flag);
  `sdui-parser` 对带 children 的 `page-header` 少报一条 warning;设计器把它当容器对待
  (即它本来的样子)。canonical 的 `page:header`(`@object-ui/components`)不在此列且刻意不动
  —— 那个渲染器完全不读 `schema.children`,所以它没有 `isContainer` 是正确的。

  两个方向都已钉住:文档 demo 走应用真实构建的 manifest 后不再产生 `not-a-container`,
  而一个真正不收子节点的组件(`navigation-renderer`)带 children 时诊断照旧触发 ——
  后者是前者的对照,保证这条修复不是把诊断弄哑了。

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [ecae400]
- Updated dependencies [4bc6c23]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [7ed3360]
- Updated dependencies [0fa5e4d]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [e24d767]
- Updated dependencies [aca561a]
- Updated dependencies [48132f7]
- Updated dependencies [0ef9dfd]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [97b63d7]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Minor Changes

- 608669e: `AppSchemaRenderer` now derives area visibility from the items inside the
  area, closing the visible-but-empty regression the spec 17.0.0 area-key
  retirement left behind (objectui#3311, option C of the recorded ruling).

  Spec 17.0.0 retired the authorable area-level `visible` /
  `requiredPermissions` (`AREA_VISIBLE_RETIRED` /
  `AREA_REQUIRED_PERMISSIONS_RETIRED`) — an area is a layout grouping, not an
  access boundary — and objectui followed in #3315 by deleting the area
  switcher's filter. Correct on the contract, but it changed the navigation
  surface: an area whose items are **all** gated away used to disappear from
  the switcher and instead rendered as a selectable, empty area.

  ## What changed

  - **Area visibility is now derived, not authored.** An area appears in the
    switcher iff at least one of its navigation items survives the exact
    item-level guards `NavigationRenderer` applies: the `visible` expression,
    `requiredPermissions`, the `requiresObject` / `requiresService` runtime
    capability gates, and — for `action` items — the presence of an `onAction`
    dispatcher (framework#4509: without one they are not rendered, so they
    cannot carry an area either). Separators never count; a `group` counts only
    through its children.
  - **The active area is elected among visible areas only.** A fully gated
    first area is no longer auto-activated, and when a gating change hides the
    currently active area the shell re-elects the first visible one. A gating
    change that merely _reveals_ an area never yanks the user away from where
    they are.
  - **An area with no items at all derives the same way**: no visible item →
    hidden. (Boundary recorded in objectui#3311.)
  - New export `hasVisibleNavigationItems(items, options)` from
    `@object-ui/layout` — the predicate behind the derivation, usable by other
    shells that render their own area switchers.

  No authorable key is involved anywhere: the platform's `.strict()` area
  object still rejects the retired keys, and the derivation — computed from the
  same guards that decide what renders — cannot disagree with the rendered
  navigation, so there is nothing for a metadata author to get wrong.

- d22ae31: Track `@objectstack/spec` 17.0.0-rc.2 (objectui#3235, #3208, #3287, #3264).

  The pin moves from `^17.0.0-rc.1` to `^17.0.0-rc.2` across the workspace, and
  the sibling `@objectstack/*` packages (`client` / `core` / `formula` / `lint`)
  move with it — they pin `@objectstack/spec` **exactly**, so leaving them behind
  kept a second copy of the spec in the tree and would have had `@objectstack/lint`
  validating against rc.1 schemas that still accept keys rc.2 retires.

  Breaking semantics, in FROM → TO form:

  - **`app.homePageId` is retired — an app's landing page is now its first
    navigation item.** An app that pinned a landing page with `homePageId` will
    open on the first reachable navigation entry (by `order`) instead; the root
    landing still follows `isDefault`. To restore a specific landing page, reorder
    `navigation` so the intended entry comes first. Stored metadata is migrated by
    `os migrate meta --from 16`. The key is a hard error now, not a stripped one:
    the spec ships a tombstone that names the migration.
    Upstream retired it because of its SHAPE, not its usage — it was an ID
    cross-reference with no referential integrity, so a `homePageId` that pointed
    at nothing silently fell back to the first navigation item anyway
    (objectstack#4667, premise corrected in #4709). If the capability returns, it
    returns as a flag on the navigation item itself, which cannot dangle.
  - **`@object-ui/types`' `HttpMethod` now resolves to the spec's
    `HttpMethodType`.** Shape is verbatim identical — the same 5-value UI subset —
    and `@object-ui/types` still exports it as `HttpMethod`, so no consumer
    changes. The spec renamed its `./ui` export because `HttpMethod` named two
    different types depending on the import path (`./shared` / `./api` carry a
    7-value enum including `HEAD` / `OPTIONS`); objectui deliberately keeps the
    5-value one (objectstack#4691).
  - **`AppContextSelector.includeAll` / `placement` are gone.** Neither ever did
    anything in this renderer: context selectors are mandatory-scope, so no "All"
    row was ever rendered, and `placement: 'topbar'` put nothing in the topbar.
    Both carried schema defaults, which is why the liveness lint structurally
    could not flag them — removal was the only channel that reaches an author
    (framework#4509).
  - **`NavigationArea.visible` / `order` / `requiredPermissions` are gone.** An
    area is a layout grouping, not an access boundary. Gating moved down to the
    navigation ITEM, where `visible` and `requiredPermissions` are unchanged and
    still enforced. `AppSchemaRenderer`'s area switcher no longer hides an area, so
    an area whose items are all gated away renders as visible-but-empty rather
    than disappearing.
  - **`@object-ui/core` no longer exports `NotificationProtocol`**
    (`resolveNotificationConfig`, `specNotificationToToast`, `mapSeverityToVariant`,
    `mapPosition`, `ToastNotification`). It bridged `@objectstack/spec/ui`'s
    `Notification` / `NotificationConfig`, which objectstack#4610 deleted with no
    successor. Use `resolveNotificationConfig` from `@object-ui/react`
    (`NotificationContext`), which owns the live `NotificationSystemConfig` and is
    what every notification surface already read. Note that the spec's _other_
    `Notification` — `@objectstack/spec/api` — is the REST inbox row, a different
    contract, and is deliberately NOT aliased in as a replacement.
  - **The `email_template` client-side validator now uses
    `EmailTemplateDefinitionSchema`.** It was pointing at the removed
    `EmailTemplateSchema`, so authored templates were being checked against the
    wrong contract: the live one is keyed `name` + `locale` (not `id`) and splits
    the body into `bodyHtml` / `bodyText` (not `body` + `bodyType`)
    (objectstack#4616 / #4807).

  Fixes that are not breaking, but were only found because rc.2 stopped being
  lenient — each had been passing vacuously:

  - **`view` drafts are actually validated now.** The client validator named the
    aggregated container schema while this admin authors first-class `ViewItem`s,
    and the container used to strip `viewKind` / `config` in silence — so no view
    draft ever had one of its own keys checked. It now validates each shape
    against its own schema (objectui#3312).
  - **The console's worked examples were wrong**, and being stripped rather than
    refused: `view.list.object` (the container root already declares it),
    `job.concurrency` / `job.timeoutMs` (no such keys; the spelling is `timeout`,
    already in ms), `email_template.from` / `.to` (a template is not a send —
    the sender override is `fromOverride`, an object), and
    `datasource.capabilities` / `.healthCheck` (objectstack#4583 removed the
    former; the latter was never a datasource key). These are the drafts an
    author — or a model generating metadata — copies.
  - Action key inventory re-derived: `ActionSchema` gained the package-lock
    envelope (`_lock*` / `_package*` / `_provenance`), so a packaged action no
    longer reports them as unknown keys.
  - The schema-diff panel labels the new `default_mismatch` finding.
  - Test fixtures pinning the retired `managedBy: 'system'` bucket now use
    `engine-owned`. Protocol 17 split that value (objectstack#3355), so it
    resolved to the default-writable fallback and a batch of "stays locked"
    assertions had quietly stopped asserting anything.

### Patch Changes

- d2363e7: The legacy `page-header` alias stops advertising `description` as an authorable
  key (objectui#3226).

  FROM: `registerLayout()` declared `inputs: [title, description]`. TO:
  `inputs: [title, subtitle]` — the key `@objectstack/spec/ui`'s `PageHeaderProps`
  declares, and the one the canonical `page:header` renderer in
  `@object-ui/components` already declares.

  `inputs` is a DECLARATION surface, not documentation: the designer builds its
  property palette from it, and the framework's `check:react-declaration-parity`
  diffs it against the spec schemas. Declaring `description` therefore did not
  merely tolerate a legacy spelling — it published a second dialect for the one
  concept the protocol calls `subtitle`, and told authors (an AI author most
  readily, since the registry is what it reads to learn the shape) that the
  non-spec key was legal. Metadata that took the offer renders a subtitle under
  `page-header` and silently loses it under `page:header`: same JSON, two results,
  which is the outcome a single contract exists to prevent.

  No runtime behaviour changes. `PageHeader` still reads `subtitle ?? description`,
  deliberately: this alias exists for out-of-repo consumer schemas, so "no in-repo
  author writes `description`" (verified — zero hits) is not evidence that nobody
  does, and dropping the read today would delete an external page's second line
  while its title kept rendering, the least reportable failure mode there is. That
  read is retired together with an ADR-0087 D2 conversion entry
  (`page-header-subtitle-alias`, `description` → `subtitle` rewritten at load
  time), which lives in the framework repo and is tracked separately. Narrowing the
  declaration did not need to wait on it and breaks no consumer; leaving the
  declaration wrong in the meantime keeps minting the metadata the conversion would
  then have to absorb.

  New tests pin both halves so neither can drift back: the registration may not
  declare `description`, must declare `subtitle`, and — checked against the spec's
  own shape rather than a hand-written allowlist — may declare nothing
  `@objectstack/spec` does not; while the runtime fallback is pinned as a sequencing
  guard, to be deleted in the same change that lands the conversion entry.

- Updated dependencies [18cd432]
- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [34595eb]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [9e9e9a9]
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
- Updated dependencies [23018cc]
- Updated dependencies [53811d1]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [5dd0127]
- Updated dependencies [06632e9]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [f833d3a]
- Updated dependencies [2a9513d]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/react@17.3.0

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

- 07de7be: Navigation `action` items actually run now (framework#4509).

  A `type: 'action'` nav item rendered, gated like any other item, and did
  **nothing** when clicked. `NavigationRenderer` dispatches such a click to an
  `onAction` prop it expects the host shell to supply — it deliberately never
  reads `item.actionDef` itself — and no shipped sidebar supplied that prop. So
  `actionDef.actionName` reached no dispatcher: an author could put an action in
  the menu, watch it render with its icon and label, and never find out that
  clicking it was a no-op. The framework's liveness ledger recorded this as the
  single gap in the AppSchema navigation surface.

  **New `useNavActionDispatch`** (`@object-ui/app-shell`) resolves the nav item's
  `actionName` against `action` metadata at click time — the same source
  `DeclaredActionsBar` reads for a record toolbar — and dispatches the resolved
  definition through `useAction()`. `UnifiedSidebar` now passes it. No new
  provider is involved: the sidebar already renders inside `ConsoleShell`'s
  `GlobalActionRuntimeProvider`, so nav actions get the fully-wired console runner
  including the confirm, param-collection, result and navigate dialogs. A declared
  `params` array becomes the runner's param-dialog input, and the nav item's own
  `actionDef.params` is passed as the value bag, so a menu entry can pre-fill the
  action it launches.

  Nav actions are inherently **global**: `ActionNavItemSchema` is strict with
  exactly `{ actionName, params? }` and carries no `objectName`, so resolution is
  by name alone and no record context rides along.

  **Behaviour change:** a shell that passes no `onAction` no longer renders
  `action` items at all, instead of rendering them dead. This mirrors the existing
  capability guards — an item the host cannot serve is hidden — and it makes the
  omission diagnosable: a missing prop now shows up as "my action item is gone",
  which leads to the prop, rather than "clicking does nothing", which for three
  releases led nowhere. Every failure at dispatch time (an unnamed item, an
  unresolvable action, a throwing action) warns and toasts instead of returning
  silently.

- 6d868e1: Remove `PageNodeRenderer`, the dead page-node renderer (objectui#3223, ADR-0049
  enforce-or-remove).

  **Removed:** the `PageNodeRenderer` export and its `./Page` module. It was
  registered under no component key and imported by nothing — a whole-repo grep
  found zero call sites — so it reached consumers only through
  `export * from './Page'` in the package barrel. `registerLayout()` was already
  saying so in a note that told the next reader _not_ to register it. Its props
  were also `{ schema: PageNodeSchema; … } & any`, and an intersection with `any`
  absorbs the whole type, so the signature asserted nothing beyond "there is a
  schema".

  **Migration:** there is nothing to re-point in a working app — an unregistered
  renderer had no call site to migrate. If you imported the symbol directly:

  ```diff
  -import { PageNodeRenderer } from '@object-ui/layout';
  +import { PageRenderer } from '@object-ui/components';
  ```

  `PageRenderer` in `@object-ui/components` is, and remains, the renderer for the
  `page` component key. It is the one that supports page types
  (record/home/app/utility), named regions and `PageVariablesProvider` — the
  deleted one rendered a header plus children and nothing else. Schema-driven
  consumers are unaffected: a `{ type: 'page' }` node has always resolved through
  the registry to `PageRenderer`, never to this export.

  Also note: this supersedes the `Page` → `PageNodeRenderer` rename shipped for
  this package in the batch 7 symbol burn-down — the renamed symbol is gone rather
  than renamed again. `PageHeaderProps` → `PageHeaderComponentProps` from that same
  batch is unaffected.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [d9668a7]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/react@17.2.0

## 17.1.0

### Patch Changes

- b5b97e2: fix(types,layout): nav item type `component` joins `NavigationItemType` and its zod enum — objectui#2918

  The renderers have carried a full `type: 'component'` implementation (Phase 3b:
  `componentRef` colon-split to `/component/<ns>/<name>`, `params` serialised as
  querystring, `metadata:*` special-cases) — but the vocabulary never gained the
  member, and `@objectstack/spec` has had `ComponentNavItem` all along. The zod
  enum was the part that bit: `NavigationItemTypeSchema` rejected
  `type: 'component'` at validation time, so authors could not declare one and
  the renderer half was unreachable — dead on arrival rather than dead code.

  - `NavigationItemType` and `NavigationItemTypeSchema` gain `'component'`;
    `NavigationItem` gains the fields the renderer consumes, `componentRef` and
    `params` (also used by `type: 'page'`), mirroring spec's `ComponentNavItem` —
    declared in zod too, so parse no longer strips them.
  - The `(item as any).componentRef` / `params` casts in `NavigationRenderer`
    and `AppSchemaRenderer` become typed access.
  - `NavigationDesigner`'s exhaustive type-meta map gains a `component` badge
    (new `appDesigner.navTypeComponent` key in all 10 locales).
  - `@object-ui/layout` gains `type-check` (src + tests) with the #2915 `paths`
    override; its DEBT entry in `check-type-check-coverage.mjs` is deleted.

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [95b7214]
- Updated dependencies [7d9734d]
- Updated dependencies [6ae818e]
- Updated dependencies [9eb932b]
- Updated dependencies [746dd00]
- Updated dependencies [aebfa4f]
- Updated dependencies [38ca8be]
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [c769d3d]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [9a04d25]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [07de839]
- Updated dependencies [2a40b5e]
- Updated dependencies [df613fa]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [eb4b740]
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [379728f]
- Updated dependencies [7f23cd0]
- Updated dependencies [0ded602]
- Updated dependencies [24e0e0a]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [80edbd4]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/components@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0

## 17.0.0

### Patch Changes

- Updated dependencies [7b21891]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [7b35e4b]
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [c7cff19]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [9b53d72]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [c6cfdf1]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0

## 16.1.0

### Patch Changes

- ebe6494: chore(lint): clear the baseline lint errors in nine more packages (objectui#2713 Wave 2)

  Second wave of the #2713 lint-gate restoration (after #2730). These nine package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations. Cleared every **error** (no behavior change; warnings out
  of scope):

  - **`react-hooks/rules-of-hooks`** (`i18n`, `plugin-grid`, `plugin-view`,
    `plugin-list`) — translation helpers (`useSafeFieldLabel`,
    `useRowActionTranslation`, `useViewLabel`, `useViewTabLabel`, `useMoreLabel`)
    wrapped a provider-safe hook (`useObjectTranslation`/`useObjectLabel`, which
    never throw) in try/catch; removed the wrapper (the same fix #2709 applied in
    fields). `plugin-kanban` `ObjectKanban` moved its `if (error)` early return
    below the `useCallback` so hooks run unconditionally. `collaboration`
    `__unsafe_usePresenceContext` keeps its deliberate danger-prefix name via a
    justified scoped disable.
  - **`react-hooks/static-components`** (`layout`, `plugin-list`, `plugin-report`)
    — dynamic-icon / registry lookups (`resolveIcon`, `useRegistryComponent`) are
    stable component references, not components created during render → scoped
    disable with justification. `plugin-charts` `TreemapCell` was a _genuine_
    inline component and is hoisted to module scope (it is purely props-driven).
  - **`no-irregular-whitespace`** (`plugin-grid` `ImportWizard`) — the literal
    U+FEFF BOM prepended to exported CSV/text blobs (so Excel detects UTF-8) is
    now written as the `﻿` escape: byte-identical at runtime, no literal
    irregular-whitespace character in source.
  - **`no-useless-assignment`** (`plugin-grid` `BulkActionDialog`) — dropped a
    dead `= null` initializer that the exhaustive `switch` (incl. `default`)
    overwrites before it is read.
  - **`no-unsafe-function-type`** (`plugin-view` `ViewTabBar`) — the dnd-kit
    render-prop `listeners` map is typed `Record<string, (...args: any[]) => void>`
    instead of bare `Function`.
  - **`no-require-imports`** (`plugin-kanban`, `plugin-view` tests) — hoisted
    `vi.mock` factories use an `async` factory with `await import('react')`.

- Updated dependencies [1c8935a]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [2e7d7f0]
- Updated dependencies [ef14f69]
- Updated dependencies [94d4876]
- Updated dependencies [69fa5d1]
- Updated dependencies [549c67d]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [f0f10f5]
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

### Minor Changes

- 06e92ac: feat(console-ai): ChatDock — right-docked AI rail behind a default-off flag (ADR-0057 P3a)

  Stands up the ADR-0057 P3 docked rail as an ADDITIVE, DEFAULT-OFF shell: until an
  operator sets `features.chatDock`, nothing changes and the FAB stays the
  canonical entry.

  - `@object-ui/layout`: `AppShell` gains an optional `rightRail` prop, rendered as
    a flex sibling of the main content so the rail REFLOWS the content beside it
    (VS Code / Cursor idiom), not overlaying it. Absent → unchanged single-pane.
  - `@object-ui/app-shell`: new `ChatDock` — a collapsible, resizable right rail
    that reuses the shared `ChatPane` engine over the P1 `(user, app, product=ask)`
    conversation (the same ambient thread the FAB/`/ai` shows; it's a VIEW, not a
    new conversation). Default COLLAPSED (a fixed edge launcher → zero layout cost
    until invoked); ⌘/Ctrl+Shift+I toggles it. Gated on `useAiSurfaceEnabled` AND
    the flag, so OSS / no-seat runtimes render nothing.
  - `runtime-config`: `chatDock?` rollout flag, parsed default-OFF (opt-in only).

  Live-verified with the flag forced on: the launcher expands to a rail rendering
  the ask chat, the dashboard content reflows narrower beside it, and collapse
  restores the launcher. Unit-tested: width clamp, the composer-safe shortcut
  matcher (⌘⇧I, no collision with the ⌘⇧O/S page shortcuts), and the flag's
  default-off/opt-in parse. FAB retirement (P3b) and `/ai`-as-maximized-dock +
  Studio reflow (P3c) follow.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/react@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/components@11.1.0
- @object-ui/react@11.1.0
- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0

## 7.0.0

### Patch Changes

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1

## 5.2.0

### Minor Changes

- e7b6eae: `NavigationRenderer` now resolves a group's initial open state with two
  platform-aware defaults:
  1. **`expanded` field honored.** `@objectstack/spec` `AppNavigation`
     uses `expanded: true | false` on group items; objectui historically
     only read `defaultOpen`. App authors who wrote `expanded: false`
     would see no effect because the renderer silently fell back to the
     "open unless `defaultOpen === false`" rule. Both field names now
     resolve to the same explicit override.
  2. **Auto-collapse long groups.** When the author has set neither
     `expanded` nor `defaultOpen`, groups with **8 or more direct
     children** default to collapsed. Long sidebar sections (e.g. 10+
     reports) doubled the sidebar height and pushed siblings below the
     fold — Slack, Linear, and Notion all default-collapse oversized
     sections for the same reason. Short groups (typical 3–6 items) still
     open by default.
  3. **Active-route override.** Both heuristics are bypassed when the
     current route lives inside the group, so users never lose visual
     orientation to a hidden active item.

### Patch Changes

- b703480: feat(layout): smoother sidebar transitions

  `SidebarNav` now animates the previously-instant state changes:

  - Active-state colour swap on `SidebarMenuButton` /
    `SidebarMenuSubButton` is wrapped in `transition-colors duration-150`
    so navigating between rows glides rather than snaps.
  - `CollapsibleContent` (group children) fades + slides in / out when
    the parent group is expanded/collapsed (chevron already rotated;
    the children now match).

  All animations are gated on `motion-safe:` so users with
  `prefers-reduced-motion` see the original instant UI.

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/components@5.0.2
- @object-ui/react@5.0.2
- @object-ui/types@5.0.2
- @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1

## 5.0.0

### Patch Changes

- 95b6b21: feat(page:header): record-aware chip + dedupe registrations (Phase D)

  The `page:header` schema renderer is the visual anchor of every custom
  record detail page (lead, opportunity, future account/contact/case).
  Before this change it had two problems that bled into every custom
  page across the product:

  1. **Quadruple registration**: `@object-ui/layout` registered both
     `page-header` and `page:header`, and `@object-ui/components`
     independently registered `page:header` (and `page:section`).
     Whichever package loaded last won the unqualified `page:header`
     lookup — visually unstable.
  2. **Bare `<h1>`** with no record affordances (no icon, ★ favourite,
     copy-id, edit, ⋯ menu) — every custom page shipped a thinner header
     than the default detail view it was meant to supersede.

  This commit:

  - Removes the `@object-ui/layout` `page:header` registration. The
    layout package keeps the legacy kebab-cased `page-header` alias only.
    The canonical renderer now lives in `@object-ui/components` and is
    always the one resolved.
  - Upgrades `PageHeaderRenderer` to render a `<RecordTitleChip>` when
    wrapped in a `RecordContext`. The chip mirrors the default detail
    header: title (resolved from `data.name` / `data.title` /
    `data.display_name`, or an interpolated `schema.title`), a favourite
    star, the object label, and a copy-record-id button. Authors opt out
    via `recordChrome: false` or hide individual affordances with
    `showStar: false` / `showCopyId: false`.
  - Extracts the chip into a new shared `RecordTitleChip` component in
    `@object-ui/components/custom`. It carries an inline zh-CN/zh-TW
    dictionary for star/copy tooltips so it stays i18n-correct without
    pulling in a translation dependency.
  - Fixes `interpolate()` so a `{account}`-style token that resolves to
    a related-record object renders as empty instead of
    `"[object Object]"`. Authors who want a field of the related record
    should use a deeper path (`{account.name}`).

  Verified at 1440×900 on `lead_detail` and `opportunity_detail`:
  both pages now show the same chip with star + copy-id and the
  opportunity highlights strip looks coherent with the chip above it.

- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bb2ea48]
- Updated dependencies [b14fe09]
- Updated dependencies [a7bef6e]
- Updated dependencies [74962b0]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
  - @object-ui/components@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- d714e85: Lookup display-name resolution now falls back through a Salesforce-style chain
  when an `$expand`'d reference object lacks a top-level `name`/`label`/
  `display_name`/`title` field:

  1. Standard display fields (existing behaviour)
  2. `salutation first_name last_name` composite — handles person records that
     only carry first/last name parts
  3. `email` — last-resort identifier, beats the opaque id

  Applies to `LookupCellRenderer`, `PageHeader.subtitle` interpolation,
  `DetailView` page-mode `titleFormat`, and the shared `formatRecordTitle`
  utility. Concretely: a Contact reference with `first_name: Bob`, `last_name:
Lin` and no `name` field now renders as `Bob Lin` everywhere — instead of
  the email or [object Object] fallback.

- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Minor Changes

- 67dabe1: feat(page-header): first-class `actions` property on page:header

  PageHeader now accepts an `actions: ActionDef[]` (or string[]) property
  and renders the toolbar inline in the header's right-aligned action slot.
  Removes the need for authors to declare a sibling `record:quick_actions`
  node and the `-mt-12` visual offset hack to pair the toolbar with the
  title. The hack still applies for legacy schemas using the sibling form
  (via location:'record_header'); the new in-header rendering opts out via
  an `inline: true` flag automatically set by PageHeader.

### Patch Changes

- 63eb66d: fix(detail): expand lookup fields so subtitle + lookup cells show display names

  The record-page fetch in `RecordDetailView` (the page-mode path) now
  requests `$expand` for every lookup/master_detail field on the object,
  mirroring the behaviour the legacy `DetailView` already had. Combined
  with two small downstream fixes — `PageHeader` subtitle interpolation
  now extracts `name/label` from expanded reference objects instead of
  rendering `[object Object]`, and `LookupCellRenderer` now short-circuits
  to `pickRecordDisplayName` when the value is already a nested record —
  all `record:*` renderers and the page header subtitle (`Owned by
{account}`) now display the related record's name rather than the raw
  foreign-key id.

- ef0e30d: feat(page-header): back-to-list arrow on record pages

  `page:header` now renders a ← back arrow at the left when a record
  context with an id is present. Clicking it strips the trailing
  `/record/{id}` segment from the URL so users return to the object list,
  falling back to `history.back()` for deep-linked entry. The legacy app
  pages without a record context are unaffected.

- 2bd45af: feat(shell): main becomes the scroll container; record tabs are sticky

  - `AppShell`'s SidebarProvider wrapper is now constrained to viewport
    height (`h-svh overflow-hidden`) instead of expanding with content via
    the default `min-h-svh`. This makes the inner `<main>` (which is
    `overflow-auto`) the actual scroll container instead of the window.
  - `RecordDetailView` page-mode container drops the redundant
    `h-full overflow-auto` (avoids nested scrollers; main owns scroll now).
  - `page:tabs` (horizontal) gets `sticky top-0 z-20` with a translucent
    backdrop so the tab strip stays visible while users scroll through
    long record pages — the Salesforce Lightning behaviour our schemas
    were already implying.

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- 6b683c8: fix(detail): clean up record page rendering

  - Drop `ai:chat_window` from the protocol-component placeholder list. The
    floating chat overlay (plugin-chatbot) is the canonical AI entry point;
    inline page schemas that still reference `ai:chat_window` now surface
    as an explicit "Unknown component type" so the misconfiguration is
    fixed at the source instead of silently leaking a placeholder card.
  - `page:header` now resolves `{field.path}` tokens in `title` / `description`
    against the current record context (matching the behaviour of the
    alternative `containers.tsx` renderer). Without this, schemas like
    `title: "{first_name} {last_name}"` rendered the literal template.
  - `containers.tsx` `PageHeaderRenderer`: also read from `schema.properties.*`
    as a fallback so both inlined and raw-bag schema shapes are supported.

- 0d8eb98: feat(detail): Salesforce-style record header + section field grid

  - `page:header` now renders an icon chip (resolves Lucide names via
    `LazyIcon`) plus subtitle, so detail pages can show
    "Name / Company" without an extra component.
  - `record:details` normalises string field entries (`fields: ['email']`)
    into the `{name, label?}` shape expected by `DetailSection`, and maps
    section `label` → `title`. Schemas authored against `@objectstack/spec`
    now produce a real grouped field grid instead of an empty card.

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6

## 4.0.5

### Patch Changes

- 1dc6061: fix(build): inline dynamic imports in library outputs

  Library `vite build --lib` outputs were emitting separate code-split chunks
  (`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
  `React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
  multi-file dists, the library's per-chunk rolldown-runtime collided with the
  consumer's own runtime, causing "TypeError: i is not a function" at runtime
  when lazy components tried to register themselves (e.g. TextField in
  `@object-ui/fields` after 4.0.4).

  Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
  configs forces a single `dist/index.js` per package, which lets consumer
  bundlers handle the library as an opaque ESM module without identifier
  mismatches across chunks.

  Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
  plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
  plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
  plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
  plugin-report, plugin-timeline, plugin-view, plugin-workflow.

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:

  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/core@3.0.0
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0

## 0.1.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
