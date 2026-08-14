# @object-ui/core

## 17.5.0

### Minor Changes

- ee66e2e: Close `ActionDef` — delete the `[key: string]: any` index signature and converge `visible` / `disabled` on the spec's unified shape.

  `ActionDef` accepted any key of any type, so a typo (`targt`) and a retired spec
  key (`execute`) both type-checked and the runner then silently bound no handler
  — the objectstack#2169 "Mark Done does nothing" shape. Step 1
  (objectstack#4075) made that audible with a dev-mode warning; step 2 promoted
  the 18 spec-owned keys to real fields. This is **step 3**, executing the
  maintainer's 2026-08-06 ruling now that its upstream half shipped in
  `@objectstack/spec` 17.0.0-rc.6 (objectstack#5970).

  - **`visible` and `disabled` now have ONE shape, derived from the spec** —
    `boolean | string(CEL) | { dialect, source }`. The ruling was "统一形状,spec
    采纳": boolean is the degenerate literal verdict, the string is CEL shorthand,
    the envelope is the full form. `visible` loses its hand-written `| boolean`
    (the spec adopted that arm, so restating it locally would be a second
    contract), and `disabled` gains the envelope arm it never had — it was
    `string | boolean`, which is why the envelope the spec emits could only be
    read through a cast.
  - **The index signature is gone.** `tsc` now rejects an unknown or retired key
    at any site that authors an action literal in code.
  - **Five keys the deletion surfaced, promoted to real fields.** `to`,
    `external`, `newTab`, `replace` — the `navigation` alias's own spelling, ruled
    legitimate by step 1 and listed in `NAVIGATION_ALIAS_KEYS` ever since, but
    declared only as data; and `description`, which every action renderer forwards
    (`check:action-forward-parity` requires it) and the param-collection dialog
    reads for its subtitle (objectui#4192). These were the only two `TS2353`s the
    deletion produced across the whole workspace.
  - **`ActionContext` keeps its index signature**, deliberately. It is a runtime
    data bag whose keys are genuinely open; `ActionDef` is a declared metadata
    contract. That asymmetry is the point, and it is now pinned in both
    directions.

  **Breaking edge, deliberate — same class as step 2's, one step further.** An
  `ActionDef` literal carrying a key this interface does not declare is now a
  compile error where it previously compiled and did nothing at runtime. That
  includes the retired `execute` (rename it to `target`; `os migrate meta --from
16` rewrites it) and plain typos. Values that were only ever absorbed silently
  are the ones that stop compiling, so the failure moves to where it can be fixed
  rather than appearing as a button that does nothing.

  **What did NOT retire with the index signature**, contrary to step 1's
  expectation: the dev-mode `warnOnUnknownActionKeys` shim and `executeScript`'s
  `execute` rename prescription both stay. `tsc` only ever sees actions authored
  as TypeScript, while stored `sys_metadata` rows are rehydrated UNPARSED
  (objectstack#3903) — which is the population `execute: 'markDone'` actually
  lives in. The two mechanisms cover disjoint populations; retiring the runtime
  half would have re-opened the gap it was written for.

- 3fc2971: A null-keyed group renders as an explicit bucket instead of silently vanishing from a chart (objectui#4466)

  `buildChartSeries`' single-dimension branch passed rows through verbatim, so a row whose category VALUE is `null` reached recharts with a null category and drew no mark. The visible outcome was not an empty chart but a quietly wrong one: rows `[{user_id: null, event_count: 51}, {user_id: 'Dev Admin', event_count: 2}]` drew exactly ONE bar — the dominant group, 51 of 53 events, dropped while the y-axis scale still accommodated it, so the chart understated its own data and the axis proved the data had been there. With every group null it drew axes, gridlines and an axis title with zero marks and no empty state, which is the shipped first-boot state of the built-in System Overview board's "Events by User" (every seeded `sys_audit_log` row is written with `user_id = NULL`).

  The mapping lives in the shared series layer, so dashboard widgets and standalone `ObjectChart` get one answer rather than a per-chart patch in the recharts wrapper. It resolves the two-answers disagreement the card names as well: an empty result set keeps the designed empty state, a non-empty result always draws bars — the null bucket included.

  `@object-ui/core` gains `NULL_CATEGORY_LABEL` and `ChartSeriesOptions`; `buildChartSeries` and `findChartSeriesRow` each take an optional trailing `options`. Both additive — every existing call site compiles and behaves identically, and a result with no null category is still returned by array identity. The two helpers are a pair on purpose: the caller matches a clicked segment against rows that still carry the raw `null`, so `findChartSeriesRow` reads the bucket label back to that row and the newly-visible bar keeps its drill-through instead of resolving to `-1`.

  The label goes through the i18n channel (`chart.nullCategory`, en `(None)` / zh `(未指定)`, all ten packs), passed down by the renderer: `@object-ui/core` is React-free and cannot read the locale bundle, so it takes the resolved string the same way `dimensionOptionTranslator` takes a resolver. Its English constant is the floor for a provider-less host, not the mechanism.

  `hasNoCategoryKey` (framework#4033) is untouched and now documented against this: a row that does not carry the category key AT ALL is a different defect — a dimension grouped by but never projected — and keeps its explanatory placeholder. The bucket deliberately never ADDS the key to such a row, which is what keeps that guard's signal alive. Key absent → the placeholder; key present with a null value → the bucket.

- dde7283: `chatbot` and `chatbot-enhanced` now pass only whitelisted DOM props to their host element (objectui#4431)

  Both registrations destructured `schema` and `className` and forwarded everything else. `SchemaRenderer` hands a registered component the authored node's own keys, the contents of its `props` container, the ARIA it resolved and the host's trailing props — so all of it became attributes on the chat root `div`, because React passes unknown lowercase attributes through in silence and stringifies object values. Measured through the real SDUI path with a data-source adapter attached: **14 non-DOM attributes on each widget**, including `datasource="[object Object]"` (the injected adapter, which only appears on a deployment that really loads data) and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

  Both are now consume-or-whitelist: configuration is read off `schema` as before, the evaluated `disabled` verdict is consumed by name, and only `toDomProps`' output reaches the element. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the pin asserts the delivered set exactly, not just the absent one. `chatbot-floating` is untouched: its content mounts through a portal and its root never spread.

  `@object-ui/core` gains the shared executor this migration needs (`utils/dom-props.ts`): `toDomProps` for the SDUI widget contract, plus `pickDomProps` — the mechanism — for a package whose own contract declares a different key set. That is the objectui#4409 dependency direction: plugin packages declare `@object-ui/core` and must not grow a dependency on `@object-ui/fields` to reach a whitelist.

  `@object-ui/fields` keeps its own key list and its compile-time bindings, and now executes them through core's mechanism. Its behaviour is unchanged and its exported `DomProps<P>` is the same structural type. The two lists differ for measured reasons and no longer can drift silently: `name` and `disabled` are legal only on form controls, which is what every field widget renders and what `FieldWidgetComponentProps` declares, while `role` is resolved by `SchemaRenderer` for every SDUI node and is not part of the field contract. A new assertion binds every shared key in both directions, with `role` named as the single deliberate exception.

- f279deb: fix(core): bare-string filter options — docs/examples stop teaching it, the runtime lift warns (objectui#4356)

  `globalFilters[].options` had two de-facto contracts. `@objectstack/spec`'s `GlobalFilterSchema` accepts only `{ value, label }` pairs, while `normalizeFilterOptions` also lifted a bare-string shorthand (`options: ['EMEA', 'APAC']`) — so a dashboard authored that way rendered correctly in objectui and was refused the moment it reached the platform's validation. That is the "one strict contract beats N dialects" divergence AGENTS.md #0.1 names, with the renderer's tolerance hiding the producer's bug instead of surfacing it.

  Maintainer ruling of 2026-08-12 on objectstack#7917, verbatim 「7917 ②」: **the spec stays strict; the runtime lift retires behind a deprecation window sized by a stored-dashboard survey.** This is Phases 0 and 1 of that window, shipped together. Phase 2 (removing the lift) is scheduled on objectstack#7917 and is deliberately not here.

  **Phase 1 — the lift now says so out loud.** `normalizeFilterOptions` still lifts a bare string, unchanged and mechanically lossless (`'EMEA'` becomes `{ value: 'EMEA', label: 'EMEA' }`), because stored dashboards carry the shorthand and dropping it silently would turn a rendering filter into an empty one. It now also logs a deprecation warning naming the offending filter, quoting the offending values, and printing the canonical replacement. The warning fires **once per offending filter per session** — `resolveDashboardFilterDefs` runs on every dashboard render, and a warning that floods the console is a warning that gets muted — and it is dev-mode only, matching the `warnOnDeprecatedObjectParams` convention in `actions/actionKeys.ts`. It does not fire for canonical object options, and a mixed array names only its bare members, since partial migrations happen. A silent lift can never be retired, because nothing would ever show that the last shorthand document is gone (ADR-0078).

  **Phase 0 — objectui stopped teaching the form.** The stored-dashboard survey on objectstack#7917 found the shorthand's source: objectui's own docs and its schema-catalog corpus — which the catalog's `package.json` declares an AI RAG/few-shot retrieval source — still authored it, so the stored population was still growing. All seven non-test occurrences are corrected to the pair form: `content/docs/guide/dashboard-filters.md` (a code block **and** a prose passage that presented the shorthand as an equal alternative), `content/docs/plugins/plugin-dashboard.mdx`, `packages/plugin-dashboard/README.md`, and the three `examples/schema-catalog` `filtered-dashboard*.json` entries. Warning authors while the docs still taught the form would have been a contradiction users report as a bug.

  **Guardrail.** The schema catalog previously asserted only that its entries were structurally well-formed and rendered without throwing — which is exactly how a spec-invalid example got in. Every `globalFilters[]` entry in every `plugin-dashboard` catalog example is now parsed with the real `@objectstack/spec` `GlobalFilterSchema`, with a non-vacuity control so a broken sweep cannot read as green.

  New export: `resetDashboardFilterWarnings()`, the warn-once memo reset, matching `resetActionKeyWarnings`. Graded `minor` for that additive export — measured, the emitted `.d.ts` gains exactly one declaration and narrows nothing.

- eb7f586: Dashboard dataset measures follow the display locale (objectui#4566).

  `formatMeasure` and `formatDimensionValue` in `@object-ui/core` formatted every
  value with a bare `undefined` locale tag at all three of their `Intl` sites.
  `undefined` is not "the user's locale", it is the MACHINE's — neither of the
  repo's two locale channels. A German session read a dashboard KPI as `1,234.5`
  next to a grid cell rendering the same number as `1.234,5`, and inverted
  separators read as a different number, not as an unstyled one.

  Both functions take the display locale as a new OPTIONAL LAST parameter, and
  `DatasetWidget` threads `useDisplayLocale()` into every site it formats through:
  the KPI, the grouped table's measure and dimension cells, and the cross-tab's
  header labels and cells.

  **English output does not move**, and that is the discriminator against the
  sibling fix. These sites already went through `Intl` with default grouping, so
  the only thing that changes is WHOSE locale is used:

  |                   | before      | after                 |
  | ----------------- | ----------- | --------------------- |
  | en, 1234.5 `0.0`  | `1,234.5`   | `1,234.5` (unchanged) |
  | de, 1234.5 `0.0`  | `1,234.5`   | `1.234,5`             |
  | de, 1234.5 EUR    | `€1,234.50` | `1.234,50 €`          |
  | de, 0.6083 `0.0%` | `60.8%`     | `60,8%`               |

  Contrast objectui#4553, where `formatPercent` had never grouped at all and
  moving en `1235%` → `1,235%` WAS the fix.

  Omitting the new argument reproduces the previous output byte for byte, so
  callers that do not thread a locale yet are unaffected.

  Two behaviours are deliberately preserved rather than "improved" alongside the
  locale fix, both measured:

  - **Integers stay verbatim.** The integer branch renders no separator and no
    decimal mark, so a locale has nothing to change there — and routing it through
    `Intl` WOULD change it (a locale with its own numbering system re-digits it,
    and `1e21` expands to 22 digits).
  - **The percent sign stays a literal suffix.** `Intl`'s `style: 'percent'`
    re-scales by 100, and that round trip loses precision at the top of the range
    (en `100,000,000,000,000,000,000,000%` becomes
    `99,999,999,999,999,990,000,000%`). The consequence — a German list cell
    writing `1.234,5 %` with a no-break space where a dashboard measure writes
    `1.234,5%` — is filed separately rather than smuggled in behind a locale fix.

  `@object-ui/core` is `minor` because two of its ENTRY exports gained an optional
  parameter (measured in the built `.d.ts`). `@object-ui/plugin-dashboard` is
  `patch`: its published declarations are unchanged — `buildPivot`'s new optional
  parameter is internal, as that function is not on the package's `exports`
  surface.

- e901131: `DatasetResultField` is now `@objectstack/spec`'s `AnalyticsResult.fields[]` element itself, not a hand-written restatement of it

  `packages/core/src/utils/dataset-format.ts` declared its own six-key interface for the analytics result column, under a doc comment describing the server's contract. The key set happened to match the spec today, so nothing was broken — but it was the last surviving member of the derive-don't-restate family (#3613 / #3753 on the parameter side, #3752 on the adapter return side), and it was the member with no compile-time tripwire: three surfaces (`plugin-dashboard`'s `DatasetWidget`, `plugin-report`'s `DatasetReportRenderer`, app-shell's `DatasetPreview`) consume this name AS the real column type, so the next spec column key would simply never appear here and no build would complain. It is now `AnalyticsResult['fields'][number]`, so it cannot lag the contract again.

  **Consumer-visible type tightening (the reason this is a minor, not a patch).** The restatement had relaxed `type` to optional; the contract requires it. Anything that assigned a column literal without `type` — or a bare `{ name, label?, format? }` — to `DatasetResultField` will now fail to compile, and the fix is to supply the `type` the server always sends. Nothing in this repo needed changing: every value of this type originates in `ObjectStackAdapter.queryDataset`, which already declares the spec element, and no consumer reads `.type` at all, so the widening had bought no caller anything while advertising a `string | undefined` the wire never produces. Marked `minor` per the repo's bump policy, which reserves `major` for following `@objectstack/spec` across a major.

  The exported name is unchanged and the `PercentScale` re-export from this module is untouched, so existing import paths keep working. `packages/core/tsconfig.typetests.json` (chained off the package's `type-check`) compiles the new parity test, so the pins are checked by CI rather than merely written down — including a negative pin that goes red if the hand-written interface is ever restored, and the `ChartResultField` superset relationship the module's comment claims.

- d9d3463: Retire four zero-consumer declared surfaces (dead-surface sweep batch 3, #4328). Each was
  measured as declared-but-never-read at the branch point, and each is removed rather than
  left as an authoring surface whose values nothing acts on.

  Breaking for anyone who typed against the removed declarations, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/core` no longer exports `mergeViewsIntoObjects`. It was a second copy left
    behind by the move of that step to the provider layer, and it had drifted: it ignored a
    view container's default `list` and keyed views by the authored bare key instead of the
    composer's `<object>.<key>` identity. The live implementation — `MetadataProvider`'s, in
    `@object-ui/app-shell` — is unchanged and remains the only one. (#3775)
  - `@object-ui/types`' `RoleDefinition` no longer declares `permissions`. A role's grants
    live in `ObjectPermissionConfig.roles`, keyed by object; that is the only home any
    consumer reads (`resolveRoles` walks `inherits` and matches on `name`). The removed
    field was _required_, so five fixtures across three packages had been declaring an empty
    array for a value nothing would ever look at. Role-attached grants are now a compile
    error rather than silently ignored data. (#4288)
  - `@object-ui/react`'s `RecordContextValue` no longer declares `loading` / `error`. Both
    had zero producers and zero consumers — no host passed them, no `record:*` renderer read
    them — and only the provider's memo dependency list still named them. Record-level
    loading and error state stays where it is actually expressed: each renderer's own data
    source. (#3773)

  No behaviour change, no request-count change:

  - `@object-ui/data-objectstack` drops five `metadataCache.invalidate('views:<object>')`
    calls across `updateViewConfig` / `createView` / `updateView` / `deleteView`. No read
    path has ever populated that key — `listViews` fetches directly, uncached — so all five
    were permanent no-ops. The invalidations of the keys that do have readers
    (`view:<object>:<viewId>` for `getView`, `view-overrides:<object>` for
    `listViewOverrides`) are untouched and now pinned. (#3778)

- 38ab505: Retire the `global_nav` Studio designer surfaces, and track the `@objectstack` family at `17.0.0-rc.6` (objectstack#7100 / objectstack#6888).

  ## The retirement

  `global_nav` was an `ACTION_LOCATIONS` member no running-app surface ever rendered. The console's ⌘K palette (`app-shell/src/chrome/CommandPalette.tsx`) builds its groups from nav items, objects, dashboards, pages, reports, recent items, record search and theme; it holds no reference to `global_nav`, to `actionRendersAt`, or to any action-metadata source. An action declaring `locations: ['global_nav']` therefore never reached a user.

  The Studio designer previewed it anyway — a mock frame reading `⌘K · Command palette` with the author's button inside it. That is the sharp edge the maintainer's 2026-08-09 ruling on objectstack#6888 named: an authoring tool promising a surface the product does not have teaches authors, and every AI copying this corpus, to declare dead metadata. `@objectstack/spec` `17.0.0-rc.6` retired the member (7 members → 6) with a named rejection message; this release removes the designer surfaces that outlived it.

  - `metadata-admin/previews/ActionPreview.tsx` — the mock command-palette placement frame is gone. The metadata strip above it still ECHOES whatever `locations` the draft declares, deliberately: reporting what a (possibly stale) draft says is honest, whereas the frame CLAIMED the platform renders it.
  - `metadata-admin/inspectors/ActionDefaultInspector.tsx` — the `global_nav` entry is gone from `LOCATION_LABELS`. That map is typed `Record< ActionLocation, string >`, so the retirement reached it as a compile error rather than as a silently stale dropdown — the mechanism objectui#3017 installed, firing as designed.
  - `metadata-admin/previews/block-config.ts` — the `record:quick_actions` location dropdown no longer offers it, and both locale tables drop the now-orphaned `…option.location.global_nav` key.
  - `@object-ui/components`' `action:bar` doc comment is aligned. The component's published enum is `[...ACTION_LOCATIONS]`, so it followed the retirement on its own; only the prose was stale.

  `@object-ui/core`'s `ActionEngine.getActionsForLocation` is **unchanged and still answers a literal string match**. Narrowing it to the six live members would put a second rejection point beside the schema's — the tolerant-consumer shape the strict-contract rule forbids, inverted. Enforcement stays where it belongs: the parameter type is now six-membered so no type-correct caller can spell the retired value, and `ActionLocationSchema` rejects it by name at authoring and publish time.

  ## The dependency move

  All 37 `@objectstack/*` declarations across 30 `package.json` files move from `^17.0.0-rc.5` to `^17.0.0-rc.6`, and `pnpm-lock.yaml` resolves one copy of each family package at rc.6. The siblings move with `spec` because `client` / `formula` / `lint` pin it **exactly** — leaving them behind would keep two copies of the spec in the tree, the split brain objectui#3560 called out.

  Bumping the pin and repairing the fallout cannot be split: at rc.5 the `Record< ActionLocation, string >` above is missing a key, at rc.6 it has an excess one.

  ## Breaking, in FROM → TO form

  - **`@object-ui/types`' `Theme` now binds the spec's `Theme`, not `ThemeInput`.** rc.6 retired every `…Input` alias and moved the bare name onto the `z.input` side (`X` = `z.input`, `XParsed` = `z.infer`). The runtime shape and this package's exported name are unchanged — `Theme` was, and still is, the AUTHORING shape where `mode` is optional. Re-pointing at `ThemeParsed` would have been the silent swap.
  - **`SpecReport` / `SpecReportChart` re-point to `ReportParsed` / `ReportChartParsed`, and `SpecReportInput` / `SpecReportChartInput` to `Report` / `ReportChart`.** Same rename, same rule: each local alias keeps the SIDE it had at rc.5.
  - **`@object-ui/types` no longer re-exports `I18nObject`, `LocaleConfig`, `PluralRule`, `DateFormat` or `NumberFormat`** — all five were retired by rc.6. They were dead re-exports here: nothing in this repo imported them from `@object-ui/types` (`@object-ui/i18n`'s formatter vocabulary in `utils/spec-formatters.ts` is locally declared and never bound the spec symbols). `I18nLabel` survives and is unchanged as a name.
  - **`I18nLabel` itself widened from `string` to `string | Record< string, string >`** — rc.6 folded the retired `I18nObject`'s per-locale map into it and ships `resolveI18nLabel(label, locale)` as the shared resolver. Every read in this repo that lands in a text slot now goes through that resolver, so an inline map renders its locale instead of `[object Object]`. Reads the compiler cannot see are audited separately in objectui#4163.
  - **`@object-ui/types`' `GlobalFilterSchema` derives via `.safeExtend`, not `.extend`.** rc.6's `GlobalFilterSchema` carries a refinement and zod 4 refuses `.extend()` on a refined object outright, which threw at module load. `.safeExtend` is zod's prescribed replacement and KEEPS the refinement, so the spec's cross-field rule now also runs on this package's dialect — which is the intended behaviour, since the pinned divergences widen individual fields and were never meant to switch off a whole-object rule.

- 92250d6: One home for the number-display policy — and a percent stops meaning two different things between a list cell and a dashboard measure

  `formatDisplayNumber`, `shouldGroupDisplayNumber` and `DisplayNumberFormatOptions` move from `@object-ui/i18n` into `@object-ui/core`. `@object-ui/i18n` re-exports all three under the same names, so every existing import path keeps working unchanged and both spellings resolve to the same function object; nothing published was removed.

  The move is what fixes the bug. `@object-ui/core`'s `formatMeasure` needed exactly this policy and could not import it — `core` is the React-free engine and is a runtime dependency of React-free consumers (the `object-ui` VS Code extension, `@object-ui/data-objectstack`), while `i18n` depends on `i18next`/`react-i18next` and peer-depends on React. So `formatMeasure` carried a parallel `Intl` implementation, recorded at both ends as deliberate duplication, and the two drifted in the one place a hand-built string and `Intl` disagree. A German session read `1.234,5 %` from a list cell and `1.234,5%` from a dashboard measure showing the same number. The function is pure, so the boundary was never a property of the code — only of where the code sat; moving it down removes the obstacle instead of working around it. `core` imports nothing from `i18n`, so the new edge adds no cycle.

  **Behaviour change — a measure's percent sign now follows the locale.** `formatMeasure` appended a literal `%` in every locale; it now renders the locale's own percent convention, the same one the list-cell `formatPercent` has used since the fix to its own machine-locale defect. Measured to change output in de, fr, es, ru, sv, cs, fi (a no-break space appears before the sign), tr (the sign moves to the FRONT: `%1.234,5`) and ar (its own percent sign plus U+061C). English, Japanese and Chinese are byte-identical — their convention is a bare trailing sign — which is why this was invisible in an English session.

  **No numeral moves, in any locale, at any magnitude.** The obvious route to the locale's convention is `Intl`'s `style: 'percent'`, but that style expects a fraction, so a value already in percentage points would have to be divided by 100 for `Intl` to multiply it straight back — and that round trip is lossy. Measured, it moves 27,581 of 1,200,013 ordinary-magnitude en-US forms at rounding ties (`0.175` at two decimals becomes `0.17%` instead of `0.18%`), plus `MAX_SAFE_INTEGER` and everything from 1e23 up, where `100,000,000,000,000,000,000,000%` becomes `99,999,999,999,999,990,000,000%`. The percentage points are formatted directly instead, through a new `style: 'percentPoints'` on `DisplayNumberFormatOptions`; that route was measured to produce a byte-identical percent affix to `style: 'percent'` across all 171 locale tags tested while moving none of those 1,200,013 forms. Callers holding a fraction keep using `style: 'percent'`, whose behaviour is unchanged — naming the two cases apart is what stops the next caller from reaching for the lossy one.

  `@object-ui/i18n`'s entry declaration is byte-identical, but the declaration it points at now lives in `@object-ui/core` and the package gains that dependency, so it takes the same minor bump rather than a patch.

- c1d939f: One `SchemaNode`, and one label vocabulary — the union wins, and labels resolve where the locale lives

  Two packages published a type called `SchemaNode` and they were not the same type. `@object-ui/core` hand-declared `interface SchemaNode { type: string; … [key: string]: any }`; `@object-ui/types` exported `type SchemaNode = BaseSchema | string | number | boolean | null | undefined`, whose own doc comment names `'Plain string'` a valid node. Both were exported under one name from packages the same consumers import together, so which declaration a call site got depended on which package it happened to import from — #4548's canary measured 19 of 35 errors as exactly that collision. Core's declaration is now a re-export of types', so there is one declaration left to disagree with. Core's entry surface is unchanged: `dist/index.d.ts` is byte-identical across the change.

  Reconciling it exposed a real defect rather than a mechanical narrowing, which is why the first attempt was withdrawn instead of forced. The spec bridges write `spec.label` — the spec's `I18nLabel`, an INLINE locale map like `{ en: 'Owner', 'zh-CN': '负责人' }` — into `node.label`, and `BaseSchema.label` declared `string`. Under core's old index signature that assignment was invisibly `any`; under one honest `SchemaNode` it is a type error. `BaseSchema.label` and `.description` therefore now accept `string | I18nLabel`, and the two bridge assignments compile with their expressions untouched.

  Resolution happens at READ time, in the renderer, against the display locale — not at the bridge. Resolving at the bridge was measured unimplementable: it is a plain class method that cannot call a hook, `BridgeContext` declares no locale, and `updateContext()` has zero callers, so a bridge-resolved label would freeze one audience's language into the node tree with no re-translation channel. React's own invalidation re-translates for free at the read site.

  The widening turned every blind `schema.label`-as-string read into a named compiler error, and that inventory is the audit: it named four sites repo-wide, all one class — the label reaching a React child position, where a map does not render as `[object Object]` but THROWS `Objects are not valid as a React child`, failing the whole subtree. Three are `@object-ui/components` renderers (`filter-builder`, `sidebar-group`, `dropdown-menu`), which now resolve with the spec's own `resolveI18nLabel` against `useDisplayLocale()`. The fourth is `plugin-dashboard`'s `DashboardGridLayout` heading, which resolves with `pickLocalized` against the active UI language — matching the widget-title resolution already in that same component rather than putting two resolvers and two disagreeing locale channels in one render; the two resolvers are limb-for-limb twins with a parity test pinning them.

  One interface now carries both label vocabularies two properties apart — `label`/`description` are the spec's INLINE map, `ariaLabel` is the KEYED bundle reference — and each accepts the other's shape vacuously. That confusability is objectui#4167's known hazard, inherent to the spec's `I18nLabel` design; both shapes are named with cross-referenced doc comments stating which resolver owns which slot, and a pin asserts the two unions do not collapse into each other.

  Finally, the spec bridges declare their return type as `BaseSchema` instead of the union. Both bridges end in a single `return node` on an object literal, so the union described nothing real while forcing a narrowing at every read — 272 mechanical errors across five suites in the first round. That change is a type annotation only; the emitted JavaScript is byte-identical.

- 2459a3e: Retire `ActionEngine`'s event-mapping API (objectui#3368). `ActionEngine.addMapping()`,
  `ActionEngine.dispatch()`, the private `mappings` registry behind them, and the exported
  `ActionMapping` interface are removed under enforce-or-remove: all four were public surface
  of `@object-ui/core` with zero production callers. Nothing in the repo ever registered a
  mapping, so `dispatch()` had no reachable caller either, and every call site was in the
  engine's own test file.

  Breaking for anyone who typed against or called the removed declarations, marked `minor`
  per this repository's version-alignment convention (the major tracks `@objectstack`, never
  an API-break count). Actions are still entered by name (`executeAction`), by location
  (`getActionsForLocation`), by shortcut (`handleShortcut`) and in bulk (`executeBulk`) —
  only the event-keyed entry point is gone, and no runtime behaviour changes because no
  runtime path reached it.

  The three ways the retired condition gate had drifted from the `visible` contract that
  `getActionsForLocation` implements die with the path rather than being fixed on it: it
  entered on a raw truthy check (`condition: false` dispatched anyway), typed `condition` as
  `string` only (a `{ dialect: 'cel', source }` envelope could not reach the canonical
  `@objectstack/formula` engine), and evaluated without `throwOnError` (a throwing predicate
  failed OPEN, the opposite of `visible`'s fail-closed posture). Aligning the contract of an
  API nobody calls would only have widened behaviour nobody uses.

- fe52a04: `rowHeightToDensityMode` answers only for the five spec row heights — the coerce-to-`comfortable` fallback is gone

  Two surfaces narrow a list view's `rowHeight` onto the renderer's three-step
  density vocabulary, and since objectui#4352 they answered differently for the
  same off-spec input: `@object-ui/react`'s spec bridge declined to answer, while
  `@object-ui/core`'s `rowHeightToDensityMode` rehabilitated anything unknown into
  `comfortable`. One metadata-driven system, two answers for one input
  (objectui#4440).

  The strict answer wins, per AGENTS.md #0.1: a renderer-side rehabilitation of
  off-spec metadata is a second de-facto contract, and one strict contract beats N
  dialects — a bad `rowHeight` gets fixed at the producer, where the schema already
  rejects it. The five mappings themselves are untouched (`compact`/`short` →
  `compact`, `medium` → `comfortable`, `tall`/`extra_tall` → `spacious`), and the
  table keeps its `Record< RowHeight, … >` typing, so a row height added upstream
  still fails the build here.

  **Breaking semantics, deliberately graded `minor`** (this repo never publishes
  `major` — its major tracks `@objectstack`). Two things change:

  - **Published type.** `rowHeightToDensityMode` is exported from
    `@object-ui/core`, and its return widens from `DensityMode` to
    `DensityMode | undefined`. A host assigning the result straight into a
    `DensityMode` now has to say what an off-spec row height should mean to it.
  - **Rendered output, for input the spec already rejects.** `ListView` — the one
    in-repo caller — used to render an off-spec `rowHeight` one step looser than an
    ABSENT one (`comfortable`, 40px rows, vs `compact`, 32px). It now renders it
    exactly like an absent one, `compact`, which is also `ObjectGrid`'s own default.
    A sweep of this repo, the `objectstack` example apps and one downstream app
    found zero authored off-spec values, and the legacy `densityMode` alias cannot
    produce one (`DENSITY_MODE_TO_ROW_HEIGHT` is typed
    `Record< DensityMode, RowHeight >`).

  Also closed while retiring the branch: the lookup guarded membership with `in`,
  which walks the prototype chain, so `rowHeight: 'toString'` returned
  `Object.prototype.toString` — a function — from something typed `DensityMode`. It
  is an own-property check now.

- bb68488: Stop declaring 14 symbols under names `@objectstack/spec` owns at `17.0.0-rc.6`
  (objectui#4167, objectstack#4115).

  The rc.6 bump published nine names this repo already declared locally, on top of
  four that predate it — `check:spec-symbols` reported all thirteen at once, and a
  fourteenth (`GlobalFilterSchema`) appeared during the bump itself. Each was
  triaged on its own rather than blanket-renamed, because the right answer differs
  per symbol: five bind to the spec, three are renamed because the spec's
  same-named export means something else, five arrive by derivation, and one is a
  declared dialect with a written reason.

  **Breaking for importers of `@object-ui/react`, `@object-ui/app-shell` and
  `@object-ui/types`** — three exported names changed, because the spec exports the
  same name for a _different_ thing:

  | package               | was                | now                            | what the spec's same-named export actually is                                                                                                          |
  | :-------------------- | :----------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `react` / `app-shell` | `MetadataState`    | `MetadataCacheState`           | a metadata item's LIFECYCLE state — `'draft' \| 'active' \| 'deprecated' \| 'archived'` (`MetadataStateSchema`, `@objectstack/spec/system`)            |
  | `react` / `app-shell` | `resolveI18nLabel` | `resolveKeyedI18nLabel`        | a resolver for the INLINE per-locale map (`{ en: 'Owner', 'zh-CN': '负责人' }`) against a BCP-47 locale                                                |
  | `types`               | `DateRangePreset`  | `FilterBuilderDateRangePreset` | the thirteen HISTORICAL dashboard filter-bar presets; this one is the filter-builder set, which adds eight FUTURE windows the dashboard schema rejects |

  `resolveI18nLabel` is the one where the collision had already started costing
  something. rc.6 widened `I18nLabel` from `string` to
  `string | Record< string, string >`, so the same authored value now reaches
  either resolver — and each answers wrongly, silently, for the other's input: the
  keyed one returns `undefined` for `{ en: 'Owner' }` (no `key`, no
  `defaultValue`), and the spec's reads `key` / `defaultValue` / `params` as locale
  tags. The rc.6 bump PR met this and aliased the spec's import as
  `resolveInlineI18nLabel` in five files, with hand-written comments at two of
  them. That is a review convention, which is what objectstack#4115 exists to
  replace with a rule — so `Keyed` is now the counterpart of that `Inline`, and the
  name says which vocabulary it resolves at every call site.

  **Eleven keep their names and are now imported or derived from the spec** instead
  of re-declared: `DATE_RANGE_PRESETS`, `NavigationMode`, `AddressValue`,
  `BreakpointColumnMap`, `BreakpointOrderMap`, `KanbanConfig`, `CalendarConfig`,
  `GanttConfig`, plus the three renamed above at their new names.

  **Four of the copies were losing information, not just duplicating it.**

  - **`GanttConfig` declared six keys and called itself canonical; rc.6's
    `GanttConfigSchema` declares seventeen.** The eleven it never mentioned —
    `parentField`, `typeField`, `baselineStartField`, `baselineEndField`,
    `groupByField`, `resourceView`, `assigneeField`, `effortField`, `capacity`,
    `quickFilters`, `autoZoomToFilter` — are all read by
    `plugin-gantt/src/ObjectGantt.tsx`, through a local `GanttConfigEx`
    intersection that existed only because this type did not carry them. It now
    derives from the spec, with `timeSegments` (shift segmentation) as the one
    genuinely local extension; the schema is `$loose` upstream, so that key is
    legal metadata rather than a second dialect.
  - **`GanttConfig.tooltipFields` carried the comment "not part of the upstream
    GanttConfigSchema".** It is, as of rc.6, so the key now arrives from the spec.
  - **`AddressValue` declared five of the spec's seven parts** — `countryCode` and
    `formatted` were missing, under a comment already claiming to be "the part
    names of `AddressSchema`". The widget still renders five inputs; binding the
    type stops it from asserting the platform cannot store the other two, and makes
    the `{ ...address }` write-through say so.
  - **`DATE_RANGE_PRESETS` was `Object.keys(PRESET_RANGES)`,** a third copy of a
    vocabulary the spec extracted in objectstack#4614 precisely to collapse — its
    own doc comment names this module as one of the three. It is now the spec's
    array by reference, and the local date-macro bounds table is pinned complete
    against it with `satisfies`, so a preset the schema gains without bounds here
    is a compile error rather than a filter that validates clean and then selects
    nothing.

  `NavigationMode` was one hop from the spec already (`NavigationConfig['mode']`);
  it is bound directly, with a both-directions type pin that it stays the same type
  as the config's own `mode`. `KanbanConfig` / `CalendarConfig` /
  `BreakpointColumnMap` / `BreakpointOrderMap` were exact hand copies of `$strict`
  schemas and are now re-exports — "still exact" is the argument for binding them,
  since a copy with nothing to protect can only drift.

  `GlobalFilterSchema` is the one ALLOW entry. It is the same spread-composition
  dialect as `SelectOptionSchema` next to it, and it collided only because rc.6's
  new refinement forced `.extend()` to be respelled as a `.shape` spread — which
  moved a derivation the guard could see into an object literal it deliberately
  does not descend into. The dialect is unchanged and its three divergences are
  pinned; which side moves on the refinement itself is objectui#4165.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/layout`: its public type surface now references the spec.

### Patch Changes

- ee26e65: Analytics: the dimension label net's fetch-and-memo glue is written once, not once per surface

  PR #4388 (objectui#4330) put the same React glue on two surfaces — the dashboard's `DatasetWidget` and plugin-report's dataset block. The resolution RULES were never duplicated (both call the same `@object-ui/core` helpers), but the wiring around them was: read the object schema through the host's authenticated `apiFetch`, keep the fetched metadata locale-free in state, derive the label maps in a render memo. Two copies meant two statements of the same two bug fixes, which is a drift surface rather than a defect — nothing a user could hit today, filed as objectui#4389 so it was retired deliberately.

  It is now split along the layer that can actually hold each half. `@object-ui/core` gains the React-free parts — `loadDimensionFieldMeta` (the base-object read composed with the dimension walk), `deriveDimensionLabelMaps` (the locale-applying derivation) and `dimensionOptionTranslator` (binding the bundle resolver to the object that OWNS a terminal field, which for a dotted path is the relationship target). `@object-ui/react` gains `useDatasetDimensionLabels` / `useDatasetDimensionMeta`, the React wiring that cannot live in core, beside the `useViewData` / `useElementDataSource` / `useDiscovery` hooks that already read `SchemaRendererContext` the same way. Both plugins consume it; the dashboard keeps its chart-only per-category colour and category-order derivation layered locally, since a table renders no palette.

  The card originally proposed `@object-ui/core` as the whole glue's home. That home was disproven by measurement and retired in the card's PM RULING #2: `SchemaRendererContext` is defined in `@object-ui/react`, which depends on core, so core importing it back is a cycle — and core is React-free by declaration, by content, and by the topology in AGENTS.md. objectui#3367 had already ruled this direction for the same family (core-canonical logic, react re-exports).

  Behaviour is unchanged by construction: same read count, same best-effort fallback, same memoization boundary. The two bug fixes are now stated once and pinned at the shared hook — the read rides the host's authenticated `apiFetch` (objectui#4121, pinned by asserting that a new channel re-issues the read, i.e. that it really is in the effect's deps), and the fetched metadata stays locale-free (objectui#4030 / PR #4324, pinned by switching language at runtime and asserting the labels flip with no second metadata read). All 39 assertions PR #4388 landed across both surfaces pass unchanged, and their files are byte-identical to before.

- 5900ac5: Analytics surfaces now run resolved select-option labels through the locale bundle — the chart legend and the related list on one page stop disagreeing

  A dashboard widget grouped by a `select` field rendered the option's authored English label while the related list beside it rendered the translation. The decisive evidence in objectui#4030 is the stored value `orion`: the chart read `Orion Engineered Carbons`, a string with no resemblance to the value and matching the object's `label` byte for byte. So the analytics path had already RESOLVED the option label — it simply never ran the result through the i18n bundle before display. (`domestic → Domestic` differs from its value by case alone, which is why the first diagnosis, "the report groups by stored value", was wrong.)

  There is exactly one resolution channel and this change reuses it rather than adding a chart-side dialect: `fieldOptionLabel` from `useObjectLabel`, i.e. `{ns}.fieldOptions.<object>.<field>.<value>` — the convention `@objectstack/spec` names objectui as the reader of, and the one list, form, kanban and record-picker surfaces already translate select options through. The bundle is applied ONCE, at the output of the label net that landed in objectui#4053/#4263, on the shared option list every consumer reads: chart axis and legend, the table/pivot cells of a dotted dimension, that table's CSV export, per-category colours and the declared category order. `@object-ui/core` gains `localizeFieldOptions` (the pure mirror of `translateOptions`), an optional translator on `buildDimensionLabelMap`, and `resolveDimensionFieldMeta` — the same single relationship walk `resolveDimensionFieldOptions` performs, now keeping the object that OWNS the terminal field, because for `crm_account.industry` the bundle key is `crm_account`, not the dataset's base object.

  Two properties the fix is shaped around. The rows reach this net keyed either way — by stored value when the server did not resolve the dimension, by the English label when it did (ADR-0021) — and the reported screen is the second case, so the map answers to both keys and lands on the same translated display. And identity is untouched: `relabelDimensions` still rewrites display only, so a drilled chart segment clicked as `欧励隆` filters by `orion`, bucket ids and pivot totals keep their raw keys, and an option with no bundle entry (or an `en` console) renders exactly the authored label it renders today.

  The per-locale work moved from the metadata fetch into the render, so switching language now re-labels in place instead of waiting for a refetch.

  Not covered, and unchanged here: a LOCAL select dimension on a table/pivot, whose label the server resolves and whose client-side net is deliberately off (objectui#4263), and a dashboard global filter's own field label, which has no object name in its metadata to key a bundle lookup with — tracked on objectui#4030.

- aca27fa: The multi-dimension pivot branch buckets a null first-dimension value instead of dropping its bar (objectui#4497)

  `buildChartSeries`' pivot branch (2+ dimensions, single measure) bucketed rows by `String(xRaw ?? '')` but wrote the RAW value into the emitted row, so a null first-dimension value produced `{status: null, Low: 3}` and reached recharts with a null category — which draws no mark. Measured at the DOM: a two-group pivot drew ONE bar, and an all-null pivot drew axes and gridlines with zero bar rectangles and no empty state. That is the same mechanism objectui#4466 fixed one branch below, on the branch that card deliberately left pinned as-is until the pivot's own bucketing had been measured.

  The pivot now maps a null/undefined first-dimension VALUE to the same bucket label the single-dimension branch uses — `ChartSeriesOptions.nullCategoryLabel`, defaulting to `NULL_CATEGORY_LABEL`. One doctrine, one predicate, two call sites; no new export, and every existing call site compiles and behaves identically.

  The bucket KEY is untouched, which is what keeps this a display fix: `String(xRaw ?? '')` still decides which rows share a bar, so every existing grouping is byte-identical and only the label the bucket carries changes. Rows that lack the category key entirely are still not bucketed — that shape is a dimension grouped by but never projected (framework#4033), a different defect with a different answer.

  Drill-through needed no change, which was measured rather than assumed: the pivot's emitted rows are AGGREGATED, so they are not index-aligned with `drillRawRows` and the one production caller (`DatasetWidget.handleChartDrill`) already drills by SEARCHING the raw rows through `findChartSeriesRow`. Those raw rows still carry their null, and objectui#4466's label-matching covers the multi-dimension arm as well as the single-dimension one, so the newly-visible bar resolves to the right record. Pinned at both levels so a regression in either half surfaces as the dead click it would be.

- 613b167: A dataset dimension on a dotted relationship path now renders its option labels instead of the raw stored enum

  A `DatasetDimension` whose `field` is a relationship path (`crm_account.industry`) got no select-option resolution at all: the chart plotted `education`, `finance`, `manufacturing` — the database column, unresolved — while the **same underlying field** reached as a **local** dimension rendered `Education`, `Finance`, `Manufacturing` beside it on the same dashboard. Nothing errored, so the widget just quietly showed database enum values to end users; on a non-English deployment those are words that appear nowhere else in the UI, since every form and list shows the translated label.

  The label lookup read options as `baseObject.fields[<path>]`, which only ever matches the local spelling. For a dotted path the options live on the **related** object, so the lookup missed and the renderer fell through to the stored value.

  The object-resolution step of that one lookup now walks the path: each segment before the last must be a declared relationship (`lookup` / `master_detail`, target read from `reference` / `reference_to` / `referenceTo` / `reference_to_object`), and the terminal field's options are read off the object that actually owns it. This is the same lookup for both spellings rather than a dotted-path variant beside it — a single-segment path never enters the walk and resolves exactly as before, so the local and joined paths cannot drift apart. Multi-hop paths (`crm_account.owner.department`) resolve too, which is the shape the dataset designer already emits.

  Hops ride the caller's existing `GET /meta/object/:name` channel — the same authenticated read that fetched the base object — so no new fetch layer is introduced, and objects are fetched once per resolution even when several dimensions share a prefix. Every failure stays best-effort: a segment that is not a relationship, a target that cannot be loaded, or a terminal field with no options yields no mapping and the raw value survives, exactly as it does today.

  Applies to both surfaces that carried this lookup: dashboard dataset widgets (`DatasetWidget`) and the chart view's dataset path (`ObjectChart`).

  Scope: this ends at "the label is in hand". Whether that label then passes through the i18n bundle is a separate gap tracked upstream as objectstack#5076.

- abb0f81: A dashboard date filter's default has one spelling again — the bare preset name — and the `{ preset }` object becomes a documented legacy alias with a retirement window

  `@objectstack/spec` 17.0.0-rc.6 added a cross-field refinement to `GlobalFilterSchema` holding a `type: 'date'` filter's `defaultValue` to three spellings: a preset NAME (`last_7_days`), an ISO date (`2026-01-15`), or a date-macro token (`{today}`). objectui's derived schema had widened `defaultValue` to `z.any()` and did not carry the refinement, so it accepted `{ preset: 'last_7_days' }` — metadata the platform refuses. That is the tolerant-consumer shape where the designer goes green and the save fails server-side, and it is now closed: the refinement is adopted, the widening is retired, and the object form is refused with the spec's own message.

  Per the maintainer ruling on objectui#4165, the spec stays strict and the bare preset name is the single canonical spelling. `{ preset }` is handled as an ADR-0089 legacy alias rather than by a permanently tolerant schema: `liftLegacyGlobalFilterDefault` / `liftLegacyDashboardFilterDefaults` (new exports on `@object-ui/types`) convert it to the bare name, `@object-ui/core`'s `resolveDashboardFilterDefs` applies the lift when it reads a stored dashboard, and the console's dashboard designer applies it as the document enters the editable draft so the next save persists the canonical spelling. The retirement window is recorded at the read site: the alias may be removed in `@object-ui/types` 18.0.0, and every lift warns on the console so a surviving legacy document is visible rather than silently tolerated.

  No stored dashboard has to change for this release. The lift means a document carrying the object form keeps loading and rendering exactly as before — measured, not assumed: a legacy declaration already resolved correctly, because `{ preset }` also happens to be the runtime value shape objectui's own date filters use, and that coincidence is why the object form went unnoticed for so long. What changes is that the declaration is now canonicalized on read and rewritten on save, so the two spellings converge instead of accreting.

  The other two divergences in this schema — the bare-string `options` shorthand and the optional `optionsFrom.labelField` — are unaffected. Carrying the spec's refinement while keeping them needed a new composition: a refined object schema in zod 4 rejects `.extend()` and `.omit()` outright and types every `.safeExtend()` override as `never`, so objectui's schema now spreads the spec's shape and re-attaches the spec's object-level rules by delegating to the spec schema itself. Nothing restates the spec's grammar, and a refinement the spec adds later flows in with no change here.

- 7e4f0e5: fix(dashboard,i18n): KPI cards and dashboard filters resolve authored labels instead of dropping them (#4032)

  A `type: 'metric'` dashboard widget rendered raw English while every other widget
  type on the same dashboard rendered the translation, and dashboard filter chips
  rendered `[object Object]` or the raw stored value. Both come from the same
  cause: authored labels reaching a render site that could not read the
  vocabulary `@objectstack/spec` actually admits.

  - **KPI cards rejoin the widget translation channel.** The self-contained
    `metric` branch built its own label from the raw `widget.title`, so the
    `{ns}.dashboards.{dash}.widgets.{id}.title` value the renderer had already
    resolved was computed and thrown away. It now reads that channel like every
    other widget header.
  - **The three private `resolveLabel` copies** (`DashboardRenderer`,
    `MetricWidget`, `MetricCard`) are gone. Each read the retired
    `{ key, defaultValue }` key-reference form and ended `defaultValue || key`, so
    handed the inline per-locale map the spec admits today they returned nothing —
    a KPI card with a map title rendered the literal string `metric`. All three
    now use `pickLocalized`, the resolver already used for this vocabulary
    elsewhere in the package.
  - **Dashboard filter labels and static option labels resolve per locale.**
    `DashboardFilterDef.label` widens to `string | I18nLabel`, the filter bar
    resolves before rendering (fixing `[object Object]: All` in the trigger, and
    in `aria-label` / `placeholder`), and the `def.label || def.name` gate now
    tests the RESOLVED string — an object is always truthy, so it never reached
    the fallback before.
  - **Option labels are no longer discarded.** `normalizeFilterOptions` coerced a
    map label to the raw stored value in every locale, English included, so
    `{ value: 'domestic', label: { en: 'Domestic', … } }` displayed as `domestic`.
    The pair shape is still normalized; the label vocabulary is preserved for the
    render side to resolve.
  - **`DashboardComponentSchema.globalFilters` is bound to the spec's
    `GlobalFilter`** instead of restated by hand. The restatement was both too
    narrow (`label?: string`, which is what made these read sites invisible to
    `tsc`) and too wide (it declared a bare-string option shorthand the spec
    rejects at publish).

  Plain-string labels are unaffected and render byte-identically.

- 49ae9f4: Pivot buckets encode an empty dimension value as JSON `null`, so it no longer collides with a row whose value is literally the placeholder character

  objectstack#5473 / objectstack#5665 replaced the pivot's delimiter-joined ids
  with `JSON.stringify`, because every delimiter that had been tried — an empty
  string, a plain space, a control character — assumed the data would not contain
  it, and each assumption failed on ordinary data. This closes the last place the
  same assumption survived: the ids were JSON, but the VALUES fed into them were
  spelled `String(row[d] ?? '∅')`, so an absent dimension value became the
  ordinary string `"∅"` and shared a bucket with a row whose value literally is
  that character (U+2205). One bucket, later row overwriting the earlier one — the
  cell showed a different row's measure, the overwritten row was unreachable, and
  drill-through followed the same wrong index into the wrong records, all without
  an error. The trigger requires that character to appear as a dimension value, so
  this is the assumption being removed rather than a defect users hit today.

  An empty value now encodes as JSON `null`, which `JSON.stringify` renders as a
  bare `null` that no string can spell. The normalization lives in
  `@object-ui/core` as `pivotDimensionValue` (absent ⇒ `null`, everything else ⇒
  its string form) rather than at each call site, because a placeholder spelled by
  a caller is a placeholder that can collide again — which is exactly how this one
  survived the previous fix. `pivotBucketId` accepts `Array<string | null>`
  accordingly; that is a widening, so existing callers passing `string[]` are
  unaffected.

  Both renderers' bucket keys move together, which the fix requires: a bucket id
  and the subtotal map keyed by it are built from the same expression, so changing
  one alone would split the headers while the subtotal map still merged, landing
  every column subtotal under the wrong header. In `plugin-dashboard`'s
  `DatasetWidget` that is the row bucket id, the column bucket id, the cell key,
  and both the `rowTotalById` and `colTotalById` lookups; in `plugin-report`'s
  `DatasetReportRenderer` the single `bucketId` helper already feeds all five.

  The dashboard's column bucket id also stops being a bare string and becomes a
  one-element tuple through the same shared encoder. It was the one id in the
  family still built by hand, on the reasoning that a single value needs no
  boundary — true of the boundary, false of everything else the encoder does, and
  it is why the across axis kept carrying this collision after the row ids were
  fixed.

  No display change: these placeholders only ever entered ids, never labels. An
  unset dimension still renders through `formatDimensionValue` exactly as before,
  and data containing neither an absent value nor that character buckets
  identically — the ids are opaque lookup keys, never parsed back into a value,
  never shown, never persisted.

- d6aa172: Retire `params.newTab` on a url action — `openIn: 'new-tab'` is the sanctioned spelling

  `ActionRunner`'s navigator read a legacy `params.newTab` escape hatch below `openIn` and above the external-URL heuristic. That read is removed, executing the objectstack#6828 maintainer ruling of 2026-08-10, whose contract half shipped in objectstack PR #7375: the url-side readings of an object-form `params` are retired, not renamed.

  Nothing that ever validated can regress. `params` is declared as `z.array(ActionParamSchema)`, so an object-form `params` has always failed the props parse — the fallback could only fire on a stack the spec refuses. The removal also closes a collision hazard: a params dialog declaring a field named `newTab` had the user's own collected input silently steering navigation.

  `openIn: 'self' | 'new-tab'`, the legacy `navigate.newTab` modifier on the `navigation` shape, and the external/relative default are all unchanged.

- 9461dd3: Form actions no longer carry a record id across an object boundary (#4292).

  `ActionRunner.executeForm` forwarded `/forms/:name?recordId=<id>` unconditionally,
  and that URL says nothing about which object the id belongs to — so the form route
  resolved it against the FormView's own target object. When an action fired from a
  record of a DIFFERENT object and ids collide across objects (per-table integer
  keys), the form silently prefilled and, since the route learned to honour the param,
  `PATCH`ed a same-id record of the wrong object.

  - **Producer**: the id is forwarded only when the firing context record's object
    (`context.objectName`) matches the target view's object; on a mismatch no id is
    forwarded, preserving create semantics. When it IS forwarded, the object travels
    with it as `?recordObject=`.
  - **Consumer**: `/forms/:name` refuses — no record read, no write — when
    `recordObject` disagrees with the FormView's object. A URL without the param
    behaves exactly as before, so existing deep links are unaffected.

- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [92876f0]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [1f9b905]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [7e4f0e5]
- Updated dependencies [c1d939f]
- Updated dependencies [bb68488]
- Updated dependencies [ab04728]
  - @object-ui/types@17.5.0

## 17.4.0

### Minor Changes

- c3b01a7: Give composite and grouped field widgets a real accessible name: the form renderer now associates its label by IDREF for widgets that declare `labelling: 'group'`, instead of emitting a `<label for>` that nothing labelable answers (objectui#3961).

  Six widgets rendered a visible group label that named **nothing** in the accessibility tree. Measured in a real form, one field per row, reading each label's `for` against the DOM:

  ```
  address      for=…-form-item -> MISSING            byLabelText=0   role+name=0
  geolocation  for=…-form-item -> MISSING            byLabelText=0   role+name=0
  checkboxes   for=…-form-item -> div                byLabelText=0   role+name=0
  radio        for=…-form-item -> div[radiogroup]    byLabelText=0   role+name=0
  rating       for=…-form-item -> div                byLabelText=0   role+name=0
  file         for=…-form-item -> div[role=button]   byLabelText=0   role+name=0
  ```

  Two shapes, one outcome. `address` / `geolocation` spread the host's id onto their first sub-input and then replaced it with that input's own unique id (objectui#3343, correct in itself), so the `for` named an id no element carried — clicking "Shipping Address" did nothing and the group label was absent from the accessibility tree entirely. `checkboxes` / `radio` / `rating` / `file` kept the id, but on a `div`: a `<label for>` on a non-labelable element is inert HTML — `HTMLLabelElement.control` is `null`, so it activates nothing and contributes no name. A screen reader heard "Street Address", "City", "Alpha", "Beta" — never which group they belonged to.

  The fix is the WAI-ARIA group pattern, driven by a DECLARATION rather than by the host guessing at widget DOM:

  - `@object-ui/core` — `ComponentMeta` gains `labelling?: 'control' | 'group'`. Additive and optional; absent means `'control'`, which is every existing component's behaviour.
  - `@object-ui/components` — the form renderer reads it. For a `'group'` field the `<FormLabel>` publishes an `id` and drops its `for`, and the widget receives `aria-labelledby`. The single-control path is unchanged down to the attribute: no id on the label, no `aria-labelledby` key on the widget, so no field acquires a second naming channel. `ui/form.tsx` is untouched (Shadcn no-touch) — both halves travel as ordinary props, since `<FormLabel>` spreads props after its own `htmlFor`.
  - `@object-ui/fields` — the six audited widgets declare `labelling: 'group'`. `address` / `geolocation` move the host id (and only the id) from their first sub-input to the group container; `checkboxes` / `rating` answer a host-supplied `aria-labelledby` with `role="group"`; `radio` keeps Radix's more specific `radiogroup`; `file` takes the name on its dropzone with no invented group layer, because it has exactly one control that merely happens not to be labelable.

  No new key in the widget props contract: `aria-*` is already declared on it and forwarded by `toDomProps`, the same channel `aria-required` (objectui#3290) travels.

  Deliberately unchanged: sub-labels keep naming their own inputs (`aria-labelledby` overrides `<label for>`, so putting the group name on the first sub-input would have replaced "Street Address" with the field name — the concatenated-name outcome this issue rejected), `aria-describedby` stays on the first focusable sub-input where focus can reach it (objectui#3318), the sub-input ids of objectui#3343 do not move, and standalone rendering — the inline grid editor, a bare SDUI node, where nobody hands down an id and there is no host label to point at — emits no role and no IDREF at all.

  A widget that does not declare itself keeps the old `for`, which the label-association tests report as an association resolving to a non-labelable element. Silence was the failure mode being fixed; the default path stays loud.

- 48132f7: Track the `@objectstack` family at `17.0.0-rc.5` (objectui#3560).

  The pin moves from `^17.0.0-rc.2` to `^17.0.0-rc.5` across all 37 declarations in
  30 `package.json` files, and the sibling `@objectstack/*` packages (`client` /
  `formula` / `lint`) move with it — they pin `@objectstack/spec` **exactly**, so
  leaving them behind would keep a second copy of the spec in the tree and have
  `@objectstack/lint` validating against schemas that still accept the keys rc.3–rc.5
  retire. `pnpm-lock.yaml` now resolves one copy of each of the six family packages
  (`spec` / `client` / `core` / `formula` / `lint` / `sdui-parser`), all at rc.5.

  Bumping the pin and repairing the fallout cannot be split: the pin alone reddens
  CI, and the code alone targets a shape that is not in effect yet.

  ## A live bug this upgrade fixes

  **`ObjectStackDataSource.delete()` never emitted its mutation event, and resolved
  `undefined` instead of a boolean.** `@objectstack/client`'s `DeleteDataResult`
  declared a key called `deleted` — a key no schema has ever declared and no server
  path has ever returned on `DELETE /data/:object/:id`. So `result.deleted`
  compiled and read `undefined` at runtime: the guard never fired, a successful
  delete notified no subscriber, and every consumer's cache stayed stale.
  objectstack#5638 corrected the interface to the schema's `success`; following the
  rename is what restores both behaviours. Nothing in this repo had to change shape
  for it — the code was already asking the right question of the wrong key.

  ## Breaking, in FROM → TO form

  - **The five `@objectstack/spec/ui` interaction-config modules are gone** —
    touch / dnd / keyboard / animation / offline, 32 defs and 64 exports
    (objectstack#4988, PR objectstack#5321). None of them had an authoring door: no
    metadata document could ever carry one of these blocks, so a stack that parsed
    before the retirement parses byte-for-byte the same after it. `@object-ui/types`
    drops the 32 `export type` re-exports. The vocabulary each one's only real
    consumer needs is now declared by that consumer, which is the remedy the spec's
    own retirement ledger prescribes ("declare that union locally — it is your
    client's policy, not the platform's"):

    - `@object-ui/react`'s `useOffline` owns `OfflineStrategy`, `ConflictResolution`,
      `PersistStorageType`, `EvictionPolicyType`, `OfflineConfig`,
      `OfflineCacheConfig`, `OfflineSyncConfig`;
    - `@object-ui/core`'s `DndProtocol` / `KeyboardProtocol` own `DndConfig`,
      `DragItem`, `DropZone`, `DragConstraint`, `DragHandle`, `DropEffect`,
      `KeyboardNavigationConfig`, `KeyboardShortcut`, `FocusManagement`,
      `FocusTrapConfig`;
    - `@object-ui/types`' `mobile` module owns `SpecGestureConfig`,
      `SwipeGestureConfig`, `PinchGestureConfig`, `LongPressGestureConfig`,
      `TouchTargetConfig`, `TouchInteraction` (plus a new `SPEC_GESTURE_TYPES`
      runtime tuple), so `@object-ui/mobile`'s import paths are unchanged.

    Every shape is moved verbatim — same keys, same members, same optionality — so
    no hook or bridge changes behaviour. Consumers importing these names from
    `@object-ui/types` must import them from the owning package instead. Note the
    spec's _surviving_ `ConnectorConflictResolution` (`/integration`, connector sync)
    and `ConflictResolutionStrategy` (`/api`, route merge policy) are **different
    concepts** — do not re-point at them.

  - **`@object-ui/types` no longer re-exports `NotificationAction` or `EmbedConfig`**
    (objectstack#5015, PR objectstack#5300). Both were published `ui` vocabulary with
    no authoring door; no notification action was ever parsed from metadata and no
    iframe route ever read an embed config. The presentation enums
    (`NotificationType` / `NotificationSeverity` / `NotificationPosition`) and
    `SharingConfig` **survive** and are untouched — public form sharing still gates
    the anonymous endpoints on `allowAnonymous` + `publicLink`.
    `@object-ui/core`'s `SharingProtocol` keeps `resolveEmbedConfig` /
    `generateEmbedCode` against a locally declared `EmbedConfig`, so its surface is
    unchanged.
  - **`ThemeEngine` stops emitting nine retired CSS variable groups**
    (objectstack#5021 option 2, PR objectstack#5289). `theme.animation`,
    `theme.zIndex` and five typography groups (`fontSize` / `fontWeight` /
    `lineHeight` / `letterSpacing`, plus `fontFamily.heading` / `fontFamily.mono`)
    are tombstones the schema now rejects by name, so `--duration-*`, `--timing-*`,
    `--z-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`,
    `--letter-spacing-*`, `--font-heading` and `--font-mono` had become structurally
    dead code — no author could produce the input that reached them.
    `generateAnimationVars` and `generateZIndexVars` are removed from
    `@object-ui/core`, and `@object-ui/types` drops `Animation` / `ZIndex` /
    `AnimationSchema` / `ZIndexSchema`. **`theme.customVars` is the declared — and
    since #5021 the only — door**: each entry is emitted verbatim as
    `--<key>: <value>`, so a `--z-modal` or a `--duration-fast` goes there now.
    LIVE emission is untouched byte for byte: `colors`, `borderRadius`, `shadows`,
    `typography.fontFamily.base` (→ `--font-sans`) and `customVars`.
  - **`@object-ui/types`' `HttpMethodSchema` now binds the spec's
    `HttpMethodSubsetSchema`, and `HttpMethod` binds `HttpMethodSubset`**
    (objectstack#5832, PR objectstack#5976 — objectui#3499). The spec renamed its
    5-value UI subset because `schemaNameFromExportKey` strips the `Schema` suffix,
    so the 5-value and 7-value enums both published as `shared/HttpMethod` and the
    later write won — the emitted JSON Schema and reference page described only one
    of them. **The runtime domain is unchanged and this repo's exported names are
    unchanged**; this follows the rename without touching cross-package semantics.
    Deliberately NOT re-pointed at the spec's bare `HttpMethod`: that is the 7-value
    enum, and widening to it would let `method: 'HEAD'` compile and then throw in
    `HttpRequestSchema.parse()`.
  - **`dashboard.widgets[].actionUrl` / `actionType` / `actionIcon` / `aria` are
    refused, not stripped** (objectstack#5010, ADR-0049 enforce-or-remove). A
    dashboard widget has no action button and never had one — every action the
    dashboard dispatches comes from `header.actions[]` — and no renderer ever applied
    the widget `aria`, so it promised accessibility compliance it did not deliver.
    A stale dashboard now gets a named error telling it where the affordance moved,
    instead of silently losing it. Run `os migrate meta --from 16` to rewrite.

### Patch Changes

- 6719877: `condition: false` now actually prevents the action from executing (objectui#3872)

  `ActionRunner.execute` — the engine's public execution entry, shared by every
  action surface — gated conditional execution on `if (action.condition)`, i.e. on
  the raw value's TRUTHINESS. Truthiness cannot answer the question the gate needs
  answered ("did the author declare a condition?"), and on this key it answered in
  the over-permissive direction: `condition: false` fell on `if (false)`, so the
  whole block was skipped, `evaluateCondition` was never consulted, and the action
  executed. Measured with a call-counting handler:

  - `condition: false` — handler ran: **true**, result `{ success: true }`
  - `condition: { dialect: 'cel', source: 'false' }` — handler ran: false, result `{ success: false, error: 'Action condition not met' }`

  Two spellings of the same statement, opposite outcomes. `false` is the most
  explicit "never execute this" metadata can carry — and what a template that
  switches an action off emits — so the direction matters: the action really ran,
  possibly writing. This is the over-permission half of the objectui#3492 family
  (the `disabled` gate one line below is objectui#3848, whose defect pointed the
  other way).

  The gate now asks whether a `condition` gate is DECLARED before evaluating.
  "Nothing to evaluate" is read from core's single predicate normalizer
  (`toPredicateInput`, which maps `''`, `null`, an empty-`source` envelope and
  non-predicate values to `undefined`), plus the whitespace-only string, which the
  normalizer wraps rather than collapses — objectui#3850's ruling on the scope of
  "empty predicate", the same one the `disabled` gate already applies. Once the
  door asks the right question the verdict needs no boolean branch of its own:
  `evaluateCondition` returns a boolean argument verbatim.

  **Behaviour change surface, deliberately one-directional and one row wide.**
  Exactly one shape changes verdict — a declared boolean `false`, from executing to
  refused (`{ success: false, error: 'Action condition not met' }`, the message the
  key already used). Everything else is byte-identical: `condition: true`, an
  absent `condition`, and truthy expressions/envelopes still execute; falsy
  expressions, falsy CEL envelopes and falsy `${…}` templates are still refused,
  as before; the three empty predicates (`''`, whitespace-only, an empty-`source`
  envelope) still execute, now because nothing was declared rather than because
  `if ('')` happened to be falsy; and non-predicate junk (`0`, `{}`) still
  executes — a value that is not a predicate must not decide an action's fate,
  which is the fail-open posture this module already committed to for `disabled`.
  So this change can only start refusing execution, never start allowing it — the
  mirror image of objectui#3848's fix.

  `ActionDef.condition` is widened to `string | boolean` to match what the gate now
  honours (and the `disabled` key beside it). This is not a lenient consumer
  alias: the boolean was always accepted at runtime through the interface's index
  signature, it was simply ignored.

  The value handed to the evaluator is deliberately left RAW rather than normalized
  first, for the same reason as objectui#3848 with the sign flipped:
  `toPredicateInput` wraps unconditionally, so an already-templated `'${x}'`
  becomes `'${${x}}'`, fails to parse, returns verbatim and coerces to a constant
  `true` — on `disabled` that blocks everything, on `condition` it would EXECUTE
  everything. That normalizer defect is objectui#3871; a tripwire next to the new
  pins goes red the day it is fixed.

- 56ff091: An empty `disabled` predicate no longer refuses to run the action (objectui#3848)

  `ActionRunner.execute` — the engine's public execution entry, shared by every
  action surface — gated on `action.disabled != null && action.disabled !== false`
  and handed the value straight to `evaluateCondition`. That function documents one
  default for "there is no condition here": return `true`, meaning
  _visible/enabled_. On `disabled`, `true` means BLOCKED. So every empty predicate
  was read as "disabled": the handler was never invoked and the caller got
  `{ success: false, error: 'Action is disabled' }` — a state the metadata never
  declared. Measured with a call-counting handler:

  - `disabled: ''` — handler ran: false
  - `disabled: '   '` (whitespace only) — handler ran: false
  - `disabled: { dialect: 'cel', source: '' }` (the empty envelope `objectstack build` can emit) — handler ran: false

  After objectui#3842 / objectui#3849 fixed the renderer halves, this was live
  user-visible behaviour: the button became clickable and clicking it returned
  `Action is disabled` — the renderer and the execution entry disagreeing about one
  predicate value, the shape objectui#3314 already paid for once.

  The gate now asks whether a `disabled` gate is DECLARED — whether there is a
  condition to reach a verdict on — before evaluating. "Nothing to evaluate" is
  read from core's single predicate normalizer (`toPredicateInput`, which maps
  `''`, `null`, an empty-`source` envelope and non-predicate values to
  `undefined`), plus the whitespace-only string, which the normalizer wraps rather
  than collapses and which `evaluateCondition` itself calls "no condition"
  (`evalRowPredicate` applies the same blank-source rule).

  **Behaviour change surface, deliberately one-directional.** Only values with
  nothing to evaluate change, and only from blocked to allowed: `''`,
  whitespace-only, an empty-`source` envelope, and non-predicate junk (`0`, `{}`,
  which previously coerced to "disabled"). `disabled: true`, a truthy expression
  and a truthy CEL envelope still block; `disabled: false` and an absent `disabled`
  still run; no expression- or envelope-valued predicate changes verdict. The
  existing `catch { isDisabled = false }` fail-open posture is untouched, and this
  change can only stop blocking things, never start.

  The value handed to the evaluator is deliberately left RAW rather than normalized
  first. `evaluateCondition(toPredicateInput(x))` is not interchangeable with
  `evaluateCondition(x)` for a string that is already a `${…}` template:
  `toPredicateInput` assumes a bare expression and wraps unconditionally, so
  `'${x}'` becomes `'${${x}}'`, fails to parse, returns verbatim, and coerces to a
  constant `true` — a template-spelled predicate evaluated that way is ALWAYS
  "disabled", whatever it says. That normalizer defect is filed as objectui#3871
  (it is live at the action renderers and `ActionEngine`, while `SchemaRenderer` and
  `page:header` evaluate the raw value and pin the correct verdict); a tripwire next
  to the new pins goes red the day it is fixed. Two rows therefore still differ
  between the execution and renderer paths, each recorded with its owning issue:
  the empty envelope (objectui#3850 owns the renderer half's scope ruling) and the
  `${…}` spelling (objectui#3871).

- 4bc6c23: Converge dashboard widget `compareTo` on the executor's `{ kind, dimension? }` contract, and make the dataset path actually render a comparison

  `CompareToConfig` was a three-branch union (`'previousPeriod' | 'previousYear' | { offset }`). `@objectstack/spec` collapsed it to the shape the analytics executor already implements — `DatasetCompareTo`, a plain strict object `{ kind: 'previousPeriod' | 'previousYear'; dimension?: string }` (objectstack#5011) — so this renderer now reads that one shape:

  - `shiftFilterByCompareTo` / `compareToTrendLabelKey` dispatch on `compareTo.kind`. The `{ offset }` duration shift is gone: `{ offset: '1y' }` is `kind: 'previousYear'`, while `'7d'` / `'1M'` have no faithful target and are restated by the author on the widget's own `filter` plus `kind: 'previousPeriod'`. No trend label key is retired — the offset arm resolved to `vsPreviousPeriod`, which survives as the `previousPeriod` fallback.
  - `DatasetWidget` no longer discards part of `compareTo`. It used to forward only the object form because the two string forms had no meaning downstream; with one shape there is nothing to discard, and a stale string is now invalid metadata rejected where it is authored rather than silently reinterpreted here.
  - **The comparison now actually runs on the dataset path.** A widget states its window in its own `filter` (a date macro, or the dashboard date-range filter merged in), but the executor shifts a `timeDimensions` entry carrying a `dateRange` — so a dataset widget asking for a comparison got "compareTo needs a dated window to shift" and rendered none. When (and only when) a comparison is requested, the resolved filter's bounded date windows are lowered into `selection.timeDimensions[].dateRange` and moved out of `runtimeFilter` (a copy left behind would intersect the shifted window with the current one and empty every comparison column). Which dimension gets shifted stays the executor's decision: every window found is lowered under the name the author wrote, and zero or two candidates surfaces the executor's own error, listing them.
  - The `<measure>__compare` columns that come back are now shown: a delta + window label on KPI widgets, a comparison column on tables, and a `variant: 'comparison'` overlay series on charts — the same treatment and the same `dashboard.trend.*` labels the inline object-provider widgets already use.

- e06810e: `PageComponentSchema.dataSource` is now consumed instead of discarded — a
  `list-view` page component can reference a **saved view by name** for the first
  time, and writing the binding no longer breaks the component
  (objectstack#5576).

  The spec declares a per-element data binding on every page component —
  `dataSource: { object, view?, filter?, sort?, limit? }` — and objectui read none
  of it. `ViewDataProvider.resolveElementDataSource` forwarded
  `filter`/`sort`/`limit` and dropped `view` entirely, and had no caller outside its
  own test; nothing mapped `object` onto the `objectName` a list actually reads. So
  "reference a saved view by name" was published, validated and inert, and every
  page that wanted a saved view's columns/filter/sort had to inline a second copy of
  them — the drift the binding exists to remove.

  Writing the binding also **broke** the block, for a reason unrelated to `view`:
  `SchemaRenderer` spread the schema's `dataSource` metadata onto the component as a
  React prop, and that is the prop name the host uses to inject the data-source
  ADAPTER. The plain `{ object, view }` object shadowed the adapter, so the first
  `dataSource.find(…)` threw `dataSource.find is not a function` and `list-view`
  rendered "Couldn't load records" — a spec-compliant component failing next to
  identical ones that omitted the binding.

  - `@object-ui/react` — `SchemaRenderer` no longer spreads `schema.dataSource` as a
    prop (it is metadata, like `visibleWhen`); renderers read it off `schema`. An
    explicit React `dataSource` prop is unaffected. New
    `useElementDataSource(schema, dataSource?)` hook resolves a binding, fetching
    the named saved view from the object definition's `listViews` and the metadata
    overlay's `listViews()`.
  - `@object-ui/core` — new `isElementDataSourceConfig` / `collectSavedViews` /
    `resolveSavedView` / `composeElementDataSource`, and `resolveElementDataSource`
    now honours `view` through an optional `DataFetcher.fetchViews`, reporting an
    unresolvable view as an error instead of silently returning every record.
    `resolveViewId` moved here from `@object-ui/app-shell` (re-exported there) so
    one matcher serves both the object page and a page component.
  - `@object-ui/plugin-list` — `list-view` maps the binding onto the props
    `ListView` reads. `dataSource.*` keys are authoritative, view-supplied values
    are a baseline the component's own keys override, and `filter` AND-combines at
    every level (the spec calls the binding's filter "additional criteria"), so a
    binding can narrow a saved view but never widen it. A `view` name that does not
    resolve renders a configuration error naming the object's actual views and
    issues no query — it never falls back to the object's default view, because that
    turns a typo into a silently wider answer.

- ab3ad4f: An empty predicate is no longer a declared gate anywhere (objectui#3850, objectui#3862)

  "Is a gate DECLARED on this key — is there a condition to reach a verdict on?" was
  answered three times in this repo, with three different scopes, and the widest
  answers sat on `disabled`, where the mistake is not benign:

  - `hasDeclaredVisibilityGate` (the action face) asked `!= null && !== ''`, so every
    OBJECT counted — including `{ dialect: 'cel', source: '' }`. That envelope is not
    a hand-written curiosity: `@objectstack/spec`'s `ExpressionInputSchema` normalizes
    every authored predicate into one, so "the author left the predicate empty"
    compiles to exactly it. The verdict path normalized the same value back to
    `undefined`, and `evaluateCondition(undefined)` answers `true` — "no condition, so
    visible/enabled". On `visible` that `true` means SHOW, so the two mistakes
    cancelled; on `disabled` it means GREY, so they compounded: a button disabled
    forever that no author asked to disable (objectui#3850, the residue objectui#3842
    left behind).
  - `SchemaRenderer` asked `disabled !== undefined` inline, one notch wider again, so
    `disabled: null` greyed out too — on the GENERIC rendering path, since that block
    runs for every node type, and not as an internal flag either: `_disabled` is
    forwarded to the component as a real `disabled` prop (objectui#3862).
  - `ActionRunner`'s execution gates asked "does this normalize to something
    evaluable?" — the scope that turned out to be right (objectui#3848 / objectui#3872).

  There is now ONE definition, `hasDeclaredPredicate`, exported from
  `@object-ui/core` (`evaluator/declaredPredicate.ts`, beside the `toPredicateInput`
  normalizer it is derived from): a gate is declared when normalization still leaves a
  condition to evaluate. `''`, a whitespace-only string, an empty-`source` envelope
  and any non-predicate value (`0`, `{}`) are NOT declared; `false` IS (a verdict is
  not a missing gate — objectui#3812). `hasDeclaredVisibilityGate` keeps its name as a
  re-export of it, so the five member-action renderer call sites, `DeclaredActionsBar`
  and `record-quick-actions` are unchanged and inherit the scope;
  `SchemaRenderer`'s `disabled` / `disabledOn` chain and `ActionRunner`'s two gates
  read the same function. No consumer got a local "and also check for empty" test —
  that fourth dialect is what objectui#3842 / objectui#3849 spent two PRs merging away.

  Measured behaviour change, `action:button` and the generic path, before → after:

  | value                                                     | `visible`      | `disabled` | `enabled` | `SchemaRenderer` `disabled` prop |
  | --------------------------------------------------------- | -------------- | ---------- | --------- | -------------------------------- |
  | `''`                                                      | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `null`                                                    | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `{ dialect: 'cel', source: '' }`                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `{ source: '' }`                                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `'   '` (whitespace)                                      | HIDDEN → shown | on → on    | GREY → on | forwarded → absent               |
  | `0` / `{}` (not predicates)                               | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `true` / `false` / bare CEL / `${…}` / non-empty envelope | unchanged      | unchanged  | unchanged | unchanged                        |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — the verdict is still read from the raw value, only
  the gate in front of it narrowed. Two rows are behaviour changes rather than the
  equivalence the ruling expected, and are pinned as such: the whitespace string moves
  on `visible` / `enabled` (it used to normalize to `'${   }'`, which evaluates falsy,
  so a predicate that says nothing HID the action from everyone), and non-predicate
  junk stops greying controls out (fail-open, the posture `ActionRunner` already
  committed to).

  One blank spelling is knowingly still outside the scope: an envelope whose `source`
  is blank but not EMPTY (`{ dialect: 'cel', source: '   ' }`) — the normalizer folds a
  `source` of `''` and does not trim, so the string spelling of a blank predicate is
  trimmed and the envelope spelling is not, and `disabled` still greys out for that one
  value. The ruling enumerated three empty spellings; this is a fourth, measured and
  filed as objectui#3960 rather than widened in here.

  One chain is deliberately untouched: `SchemaRenderer`'s `visible` / `visibleWhen` /
  `visibleOn` / `visibility` / `hidden` / `hiddenOn` legs keep `!== undefined`, because
  narrowing them would change ALIAS PRECEDENCE, not just emptiness. The `hidden` legs
  are not negated and therefore carry this same defect with the polarity that makes the
  node vanish — measured, out of this ruling's scope, filed as objectui#3955.

- c2fd122: fix(actions): forward `bodyShape` end-to-end so a declared body wrap is honoured

  Sibling of the `bodyExtra` fix, same failure shape one key over. `bodyShape` is
  the spec's body-WRAPPING declaration for a `type: 'api'` action — `'flat'` (the
  default) or `{ wrap: key }` to nest the collected params under `key`, the shape
  better-auth's `organization/update` needs. The console `apiHandler` read it
  unconditionally while **no** action renderer forwarded it, so an author who
  declared `bodyShape: { wrap: 'data' }` on an `action:button` / `:group` / `:icon`
  / `:menu` action got a FLAT body on the wire: the endpoint received the params at
  the top level, and the declaration read as honoured because it parsed and
  published.

  The four declared-action renderers now forward the key, and `ActionSchema`
  declares it (typed by derivation from the spec, so the union cannot drift).
  `ActionRunner.executeAPI` — the fallback path taken when no host registered an
  `api` handler — now reads it too, closing a second asymmetry in which the same
  action changed body shape depending on which host executed it. The wrap covers
  the collected params only; `bodyExtra` and other top-level keys stay flat, which
  is the spec's own wording for the key and what both console read-sites already
  did.

  `element:button` deliberately does **not** forward it: its whitelist mirrors
  spec's `InlineActionSchema` pick list field for field, and that pick list does
  not include `bodyShape` — it is not inline vocabulary.

- 1d723e3: fix(core): stop re-wrapping an already-`${…}` predicate, so action-face `visible` / `disabled` finally honour it (objectui#3871)

  `toPredicateInput` — the one normalizer every action surface and the action
  engine share — wrapped **every** string as `${string}`, assuming a bare
  expression. But `${…}` is a spelling this repo documents for a predicate
  (AGENTS.md §4) and one the normalizer's own output type lists as valid, so an
  already-normalized value was wrapped a second time: `'${x}'` became `'${${x}}'`,
  which cannot match the evaluator's single-template fast path and does not parse.
  The author's expression then decided nothing, and which constant came back
  depended on the caller's error policy:

  - **fail-soft** legs (every `disabled` / `enabled` leg; `visible` on
    `action:icon`, `action:group` and the related-list toolbar) got the unparsed
    string back, so `Boolean(…)` was a constant `true`: `disabled: '${…}'` greyed
    the action out permanently, `visible: '${…}'` showed one the author had gated
    away, and `enabled: '${…}'` never disabled anything.
  - **fail-closed** legs (`throwOnError: true` — `visible` on `action:button`,
    `action:bar`, `action:menu`, `DeclaredActionsBar`, and
    `ActionEngine.getActionsForLocation`) got a **throw**, which each site turns
    into "hidden": an action gated with a template predicate was invisible even
    while its gate held, and the fail-closed warning blamed the author's
    expression.

  A string that already carries `${` is now returned untouched (the same guard
  covers the envelope branch, where an unwrapped `source` reaches the identical
  wrap), which makes the normalizer idempotent. Every affected surface goes from a
  constant verdict to the predicate's real one — converging the action face with
  `SchemaRenderer` and `page:header`, which read the raw value and have always
  been right about this spelling (objectui#3314's shape). Bare expressions and
  `{ dialect: 'cel' }` envelopes are untouched.

  `ActionRunner`'s two execution gates already read the raw value and are
  unchanged; the objectui#3871 tripwires they carried have been replaced by pins
  of the now-converged behaviour.

  Whether `${…}` should be _authorable_ on an action predicate at all is a
  separate, spec-side question (`@objectstack/spec`'s `PredicateInput` models a
  bare string and a dialect envelope): if it is to be rejected, that belongs in
  publish-time validation, not in a consumer that silently invents a verdict.

- 0109f54: Blank predicates and non-predicate values are no longer gates, at the last three entries that still judged them (objectui#3955, objectui#3957, objectui#3960)

  objectui#3850 sank "is a predicate gate DECLARED here?" into one definition,
  `@object-ui/core`'s `hasDeclaredPredicate`. Three places were left out of that
  ruling's placement clause, each with the same shape of defect: the evaluator's
  single default for "there is nothing here to evaluate" is `true`, meaning
  _visible/enabled_, and wherever a too-wide "declared" test hands it an empty
  predicate on an INVERTED key, that `true` turns a control off for a value the
  metadata never used to say anything.

  **`SchemaRenderer`'s `hidden` / `hiddenOn` legs (objectui#3955)** asked
  `!== undefined` and did NOT negate the verdict, so an empty predicate meant HIDE
  and the node disappeared — on the generic rendering path, since that block runs
  for every schema type. Harder to diagnose than the `disabled` twin objectui#3862
  fixed: a greyed-out control is still on screen, while a node that never rendered
  is indistinguishable from metadata that meant to hide it. Both legs now read the
  shared definition.

  **The "blank" criterion now covers the envelope spelling (objectui#3960).** The
  definition trimmed a whitespace-only STRING and not an envelope's whitespace-only
  `source`, because `toPredicateInput` folds a `source` of `''` and does not trim.
  So `{ dialect: 'cel', source: '   ' }` was a declared gate whose verdict came from
  core's own CEL entry calling that exact value "no predicate" (`if (!source.trim())
return true`) — `disabled` greyed out forever and `ActionRunner.execute` answered
  `{ success: false, error: 'Action is disabled' }` with the handler never invoked.
  Blankness is now decided once for both spellings, at the definition. The
  NORMALIZER's contract is deliberately unchanged: "what shape does the evaluator
  accept" is not the same question as "is there a condition", and moving the trim
  there would have flipped verdicts for every
  `useCondition(toPredicateInput(…))` call site, including container-level `visible`
  reads that never asked this question at all.

  **`ActionEngine.getActionsForLocation`'s `visible` filter (objectui#3957)** was the
  last consumer answering the question with a range of its own — three empty
  spellings folded by hand, everything else coerced with `Boolean(raw)`. It now reads
  the shared definition and the coercion branch is gone, so one value no longer gets
  two answers depending on whether an action was surfaced by the engine or rendered
  standalone (the invariant objectui#3314 established). Its fail-CLOSED posture on a
  predicate that THROWS is untouched (`throwOnError: true` + `warnHiddenPredicate`):
  "the predicate faulted" and "there is no predicate" are different facts.

  Behaviour changes, before → after. Observation-class: each needs an author to write
  an empty/blank predicate or a non-predicate value, and there is no known user path
  today.

  | value                                                       | `ActionEngine` `visible` | `SchemaRenderer` `hidden` | `disabled` (action face + generic path) | `ActionRunner.execute` `disabled` |
  | ----------------------------------------------------------- | ------------------------ | ------------------------- | --------------------------------------- | --------------------------------- |
  | `''` / `null`                                               | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `'   '` (blank text)                                        | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `0` / `NaN`                                                 | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{}` / `[]`                                                 | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '' }`                            | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '   ' }`                         | shown → shown            | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `{ source: '   ' }` (no dialect)                            | HIDDEN → shown           | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `true` / `false` / bare CEL / `${…}` / a non-blank envelope | unchanged                | unchanged                 | unchanged                               | unchanged                         |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — a declared `false` is still a verdict, not a
  missing gate (objectui#3812), and blankness is `trim()`, not "short": `{ dialect:
'cel', source: ' x ' }` is a predicate. One alias precedence changes with the
  `hidden` legs and is pinned rather than claimed as an equivalence: an undeclared
  `hidden` no longer short-circuits the chain, so a declared `hiddenOn` is finally
  consulted.

  `SchemaRenderer`'s four `visible*` legs keep `!== undefined` deliberately, as
  objectui#3850 ruled: their `true` is negated, so an empty predicate already lands
  on "shown", and narrowing them would change alias precedence rather than fix
  anything.

- 7e5bb5d: fix(actions): forward `bodyExtra` end-to-end through the action chain

  An action's static request body (`bodyExtra`) was dropped one hop before the
  `ActionRunner`: every action renderer forwards an explicit whitelist of keys, and
  none of them listed `bodyExtra`. Since `@objectstack/spec` 17 made it the only way
  a `type: 'api'` action can carry a payload (`params` keeps its single meaning as
  the parameter definition array), and the ADR-0087
  `inline-action-api-params-to-body-extra` conversion rewrites older object-form
  `params` pages onto it at load, a previously-working published page validated,
  published and then POSTed an empty body.

  `element:button`, `action:button`, `action:group`, `action:icon` and `action:menu`
  now forward the key; `ActionRunner.executeAPI` merges it into the request body
  **last** (so a constant always overrides a same-named user param, matching the
  console `apiHandler`); `ActionSchema` declares it; and a non-array `params` on a
  `type: 'api'` action keeps working for one version window with a dev-mode
  deprecation warning naming `bodyExtra`.

- fbc23e0: Action params that inherit a field's options now keep the keys that field declared

  A field-backed action param (`{ field: 'tier' }`) had its inherited option list
  rebuilt entry by entry as `{ label, value }`, which silently dropped every other
  key the field's options declared — most consequentially the per-option
  `visibleWhen` predicate (ADR-0058). A select field whose options narrow by
  predicate in an object form therefore offered the FULL list in an action dialog,
  including the entries the predicate exists to hide, with no diagnostic on either
  side; `color` / `icon` / `disabled` were lost the same way. Options authored
  inline on the param were never affected — they always passed through verbatim,
  which is the asymmetry this restores.

  The resolver now preserves each inherited entry and only does its two real jobs:
  expanding bare strings into label/value pairs and translating the label through
  `fieldOptionLabel`. The option widgets already filter on `visibleWhen`, so a
  role-gated option (`'admin' in current_user.positions`) inherited by a dialog
  param now narrows the offered set and clears a seeded value the predicate hides.

  `ActionParamDef.options` (`@object-ui/core`) and the resolver's `RawActionParam`
  are widened to match: `ActionParamOption` names the two keys the param layer
  reads and carries the rest of a field's option vocabulary through.

- 6bb454a: `evalRowPredicate`: the fail-closed report now names the engine's failure reason, and the ROW always wins over host scope (objectui#3792, objectui#3796)

  Two defects in one function, `packages/core/src/evaluator/listConditional.ts`,
  shared by every surface that gates on a row predicate: the row kebab, the bulk
  selection bar, kanban conditional formatting, and — since objectui#3521 — the
  record page header.

  **The safest path said the least (objectui#3792).** `evalRowPredicate` has two
  diagnostic routes, and their information content was inverted. The single-eval
  fast route lets the canonical helper warn, so it prints the engine's own reason
  (`Reason: [runtime] No such key: owner_id`). The `warnOnError: true` route — the
  fail-CLOSED one, taken by every caller that makes a button disappear — runs
  `evalFieldPredicate` twice with `{ warn: false }` to tell a fault from a genuine
  `false`, and that silence discarded the reason along with the duplicate warning.
  So the more decisively a surface hid a control, the less it said about why: the
  console line named the predicate but not the defect, and `No such key: owner_id`
  or `no such overload: string == null` is usually the whole answer.

  `FieldPredicateDiagnostic` gains an optional `onFault(reason)` passback:
  `evalFieldPredicate` hands out the engine's verbatim text (kind tag, message and
  source excerpt — the exact string it prints after `Reason:`) even when its own
  warning is suppressed. It fires per fault, deliberately independent of the
  once-per-predicate warning dedupe, so a caller doing its own warn-once
  bookkeeping keeps control of it; the verdict is unaffected, and callers that pass
  nothing are unchanged. `evalRowPredicate` threads that reason into its labelled
  warning, and the legacy-dialect route does the same with the message its engine
  throws (`Reason: [legacy] …`), so both dialect paths report a fault the same way.
  Warn-once semantics are unchanged — the reason is deliberately not part of the
  dedupe key.

  **Wording: not a list function, and not for a long time.** The same message
  called every caller a "**list** conditional predicate". A hidden button on a
  record page header reporting "a list conditional predicate" sends its author to
  the list view to look for a control that was never there. Both messages this
  module emits (evaluation failure and the legacy-dialect deprecation) now read
  "conditional predicate".

  **The row is the subject — on both dialect paths (objectui#3796).** The scope
  merge pinned `data` after the host-scope spread but not `record`, leaving
  `record` to each engine's own binding — and the two engines disagreed. The legacy
  evaluator re-pinned `record` to the row (row won); the CEL engine takes its
  `extra` bag over its `record` binding, so a host scope carrying a `record` key
  won there instead. One function, one predicate text, two subjects — selected by
  whether the string happens to contain `===` or `${…}`, the dialect-routing
  markers, which no author picks deliberately. `record` is now pinned after the
  spread exactly as `data` is, which fixes both paths at the merge site rather than
  relying on either engine's precedence.

  No host injects a `record` key today — `ExpressionProvider` binds
  `current_user` / `user` / `ctx` / `os` / `app` / `data` / `features` — so nothing
  observable changes for existing apps; this closes the edge before a host adds one
  (`ctx.record` already exists, which is exactly how it would arrive). A row FIELD
  named `record` is likewise no longer able to become the row root; it stays
  addressable as `data.record`.

  Shipped as a patch: no new exported symbol, one optional field added to an
  already-exported options interface, and no existing call signature changed.

- 523be48: `object-timeline` and `record:line_items` now apply the filter / sort / row cap they are given, so a named `dataSource.view` narrows them instead of contributing nothing

  These were the two residual gaps in objectstack#7121's per-block coverage table
  (objectstack#7137). Both blocks are object-bound lists, both accepted the spec's
  per-element `dataSource` binding, and neither had a read site for `filter` or
  `sort` anywhere in its fetch:

  - `object-timeline`'s entire query was
    `find(objectName, { options: { $top: 100 } })`.
  - `record:line_items`' was the parent FK plus a fixed `$top: 500`.

  So `dataSource: { object, view: 'hot' }` resolved the view — a typo still reported
  a configuration error, it never degraded into an unfiltered query — and then
  dropped everything the view said. The rendered rows could be **wider than the view
  they named**, silently, which is exactly the class of mistake AI-authored metadata
  hides best: the page looks like it works. objectstack#7121 deliberately left the
  keys unmapped and recorded the gap rather than writing composed values onto schema
  keys nobody read; this closes it at the fetch instead.

  What each block now reads:

  - **`object-timeline`** — `$filter: schema.filter`,
    `$orderby: convertSortToQueryParams(schema.sort)`, and
    `$top: schema.limit ?? 100`, matching the form `object-gantt` / `object-map` /
    `object-calendar` already use. Its registry mapping gains
    `filter` / `sort` / `limit`; `columns` stays unmapped, because a timeline
    projects the fields its `timeline` config names.
  - **`record:line_items`** — the composed filter is **AND-combined** with the parent
    relationship condition through `mergeFilterNodes`, never substituted for it, the
    same way `record:related_list` composes its own since objectstack#7118: a
    line-items panel is always scoped to the record it sits on, so an _additional_
    criterion can only narrow this parent's children and can never surface another
    parent's rows. `sort` becomes the load order and `limit` the row cap (default
    500). `columns` stays unmapped — here they are `GridColumn[]` driving an editable
    grid, not a field-name projection, so a view's column list would be the wrong
    _shape_ rather than merely a wider answer.

  **Behaviour change worth knowing about:** the timeline's default window is now a
  real cap. `{ options: { $top: 100 } }` nested the limit under a key that is not a
  `QueryParams` field and that no adapter in this repo reads (`convertQueryParams`
  maps `params.$top`), so the intended window never reached the wire and a timeline
  over a large object fetched whatever the server chose to return. It is now sent as
  `$top`, and authorable via `limit` or a view's `pagination.pageSize`.

  `@object-ui/core` gains `convertSortToQueryParams`, the sort→`$orderby` lowering
  the three sibling blocks each inline privately. It is shared rather than copied
  twice more, and is slightly more faithful to the declared contract than those
  copies: a sort entry that omits `order` means ascending instead of being dropped
  (the string spelling `"amount"` already meant ascending in the same copies), and
  nothing orderable yields `undefined` rather than a truthy empty `{}`. Migrating
  the three existing copies onto it is objectstack#7148 and is not done here.

- Updated dependencies [d229dfa]
- Updated dependencies [c2fd122]
- Updated dependencies [48132f7]
- Updated dependencies [7e5bb5d]
- Updated dependencies [e6fdbdc]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/types@17.4.0

## 17.3.0

### Minor Changes

- 5781fb1: `@object-ui/core` now ships the server-action dispatcher factory —
  `createServerActionHandler({ fetch, baseUrl, resolveObject, ... })` — so any
  consumer of the runner (standalone renderers, SDUI hosts, embedded usage) can
  run `action.body` script actions by registering the produced handler, instead
  of dead-ending on the built-in `executeScript`'s "must be executed server-side"
  error with no supported way to make it run (objectui#2904, the follow-up
  objectui#2896 deferred).

  The factory is deliberately opinion-free about the three things core has no
  business deciding — auth (`fetch` is an injected authenticated wrapper), origin
  (`baseUrl` string or thunk; no bundler env convention), and fallback object
  scope (`resolveObject`) — and owns everything protocol-shaped, once:

  - name-based action identity (ADR-0110 D1 — `target` is a binding expression,
    never an identity);
  - the record-id resolution dance, also exported as
    `resolveServerActionRecordId` (`_rowRecord`, `recordIdField`, toolbar
    selection fallback with its single/zero-select guards, aggregate
    `_selectedIds` bypass), replaceable wholesale via `resolveRecordId` for
    hosts with their own policy (record pages);
  - a re-entrancy guard per action+record;
  - the `/actions` response-envelope rule: `interpretActionResponse`,
    `readActionPayload` and `actionErrorDetail` moved from `@object-ui/app-shell`
    internals into core and are now public exports.

  `@object-ui/app-shell`'s two hand-rolled copies of this POST —
  `useConsoleActionRuntime.serverActionHandler` and `RecordDetailView`'s — are
  collapsed into one console wrapper (`createConsoleServerActionHandler`) that
  layers the browser-only choreography (popup pre-open dance, zero-roundtrip
  `newTabUrl` fast path, `redirectUrl` convention) over the core factory. The
  copies had already drifted twice (objectstack#3913 — envelope; framework#3935 —
  identity, fixed in one copy only): RecordDetailView now also dispatches by
  declarative `name` instead of `target || name`, and no longer leaks the
  client-side `_rowRecord` stash to the server.

- f833d3a: Retire `validation` from the action-param contract — it was declared on both
  halves, read by neither, and rejected outright by the server (objectui#3201).

  FROM: `validation?: string` was declared on the AUTHORING type
  (`@object-ui/types`' `ActionParam`) and on the RESOLVED type (`@object-ui/core`'s
  `ActionParamDef`). TO: it is declared on neither.

  **Breaking for anyone who declared it — but it never did anything.** This is
  marked `minor`, not `major`, per the repo's version-alignment policy (objectui's
  major tracks `@objectstack`'s, so objectui's own breaking changes ship as `minor`
  with the breaking semantics spelled out here).

  **Migration: delete it.** If you authored `validation: '...'` on an action param,
  it never took effect, and publishing that metadata to the server is a hard parse
  failure — so any metadata that reached production either never carried the key or
  never parsed. Removing it changes no runtime behaviour; it only moves the error
  from "silent no-op, then rejected at publish" to a `tsc` error at the keystroke.

  Why it could not work as authored:

  - `ActionParamSchema` in `@objectstack/spec/ui` is `.strict()` and does not list
    `validation`, so an authored key is a PARSE REJECTION on the server:
    `Unrecognized key(s) on this action param: \`validation\``. Meanwhile `tsc`
    against the public type accepted it — the type vouched for a key the platform
    itself refuses.
  - Nothing read it on the resolved side either: it was never a key of
    `resolveActionParams()`'s `RawActionParam`, the runtime field metadata a
    field-backed param inherits from carries no `validation` to source one from,
    and `paramToField()` never mapped it — so it could not reach the field widgets,
    whose rules `buildValidationRules()` builds from `required` / `minLength` /
    `maxLength` / `pattern`.

  Removed rather than implemented, on ADR-0049 enforce-or-remove. Giving it meaning
  would mean first deciding what an "expression" is here (CEL? a formula? a regex?)
  and adding it to `@objectstack/spec`, which is where such a capability has to
  start — not accreted renderer-side around a key the contract does not have.

  This also retires the last named exception in objectui#3174's drift guard
  (`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`), which carried
  `validation` as the one key `ActionParam` added on top of the spec's set. The
  rule it pins — **the authoring type declares exactly the spec's authorable
  keys** — is now literal: the guard asserts the local-only key set is empty, so
  any future addition fails the build instead of being waved through.

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

- 18cd432: `ActionEngine.getActionsForLocation` now evaluates a `{ dialect: 'cel', source }` action `visible` predicate on the canonical `@objectstack/formula` engine instead of the legacy JS evaluator. The method used to unwrap the envelope into a `${source}` string before calling `evaluateCondition`, which only routes to the CEL engine while its argument is still an envelope — so the engine silently demoted every CEL predicate to the legacy path while every action renderer (`action-button`, `action-menu`, `action-bar`, … via `toPredicateInput`) ran the same predicate on CEL (#2661). Because `ExpressionInputSchema` normalizes even a bare authored string into a CEL envelope, that was the common case, and the two engines disagree: `null < null` faults in CEL (fail-closed hide) but is `false` in JS, and CEL-only builtins such as `today()` do not exist on the JS path at all — so one `visible:` predicate could hide a button in the renderer while the engine kept it (or the reverse). Normalization now goes through a shared `toPredicateInput` helper exported from `@object-ui/core`, pinned to the renderer-side twin by a parity suite. Bare strings, non-`cel` dialects, empty `source`, and boolean predicates all behave exactly as before (#3314).
- d915c47: Relation fields (`lookup` / `master_detail` / `user` / `tree`) are now usable in action and conditional-formatting predicates: they bind as the stored foreign key on every surface, and the fields a predicate reads are included in the query projection (#3501).

  Before this, one predicate over one relation field had four different fates, decided by things its author does not control. `$expand` **replaces** the id in place with the whole related record, and a view expands exactly the relations it shows as COLUMNS — so `record.owner == "U1"` was **true** where the column was absent, **false** where it was displayed, and a **fault** where the field was neither displayed nor projected (a list's `$select` was built from its columns alone, and CEL treats an absent key as a fault, not as null). A fault is fail-CLOSED on the row kebab and the selection bar and fail-OPEN on the lenient paths, so the same authoring mistake hid the button from everyone on one surface and showed it to everyone on the next, with nothing on screen to point at either. The server, meanwhile, only ever sees the id — so client and server could not agree, which is the one thing ADR-0036 / ADR-0058 exist to guarantee.

  Two changes close it. `toPredicateRecord` (new, `@object-ui/core`) collapses expanded relation values back to their ids when a record is bound for evaluation — driven by the object's own field types, not by sniffing for an `id` key, so a `json` field that happens to carry one is untouched. It is threaded through `evalRowPredicate` / `resolveConditionalFormatting` (via a new `fields` option), `useRowPredicate`, `partitionBulkRows`, and both `page:header` evaluators, with the object schema supplied by `ObjectGrid` / `ListView` / `ObjectKanban` / the record context. Kanban card formatting is threaded the same way, so a rule cannot match on the grid view of a list and silently never match on its board. Display is unaffected — a detail-page title still renders the related record's name, and the schema-only `kanban-ui` entry point (which has no object schema to offer) keeps using the payload verbatim. `collectPredicateFieldRefs` / `listViewPredicates` (new) harvest the `record.x` / `data.x` references out of a view's conditional formatting, row-action defs, bulk-action defs, promoted object actions and `userActions` overrides, and add them to `$select` — intersected with the object's declared fields plus the platform columns every object carries (`isProjectableField`), because an unknown key is not ignored by every backend. No `$expand` is added: a predicate wants the foreign key, which is what an unexpanded relation already is.

- 509104a: Fix matrix report cells showing another bucket's numbers when dimension values run together.

  The cross-tab in `DatasetReportRenderer` built its bucket ids by joining dimension values with the EMPTY string, so adjacent values had no boundary at all: `"x"` + `"yz"` and `"xy"` + `"z"` were the same bucket on both axes, and the later row silently overwrote the earlier one. Its cell key then joined the two bucket ids with a plain space, while dimension values contain spaces constantly ("New York", "In Progress"), so `"New"` × `"York Q1"` and `"New York"` × `"Q1"` also met in one key. A merged bucket showed a different row's measure, the overwritten row's value was unreachable, the per-row and per-column subtotals matched the wrong header, and drill-through followed the same wrong index into another record's list — none of it with an error.

  Bucket ids and cell keys are now encoded with `JSON.stringify`, which carries the boundary in its own quoting rather than in a character the data is assumed never to contain. All four lookups in the renderer (row headers, column headers, row subtotals, column subtotals) share the one encoder, so they agree by construction.

  The encoders moved to `@object-ui/core` as `pivotBucketId` / `pivotCellKey` and are now shared with the dashboard `DatasetWidget`, which carried the same defect and fixed it separately: two packages each hand-rolling the same key is why one fix left the other broken. The dashboard keeps its existing exports and behaviour.

- a4cff5b: Conditional-rule predicates that fail to evaluate are no longer silent
  (objectstack#5149, appeal 2). `evalFieldPredicate` — the canonical funnel for
  `visibleWhen` / `readonlyWhen` / `requiredWhen`, view-level `visibleOn`, legacy
  `condition`, per-option `visibleWhen`, screen-field predicates and list
  conditional formatting — now logs **one `console.warn` per predicate text**
  when evaluation fails (parse error, unbound identifier, engine fault), carrying
  the predicate source, the engine's failure reason, and the field/rule locator
  the call site provides. Renderer call sites thread that locator
  (`visibleWhen of field 'amount'`), so a broken predicate identifies itself in
  the browser console instead of being indistinguishable from an absent one.

  Verdicts are unchanged: evaluation still fails open to the caller's safe
  default (flipping that default is objectstack#5149 appeal 1, tracked
  separately). Fault-probing callers (`evalRowPredicate`'s fail-closed path,
  `ExpressionEvaluator`'s `throwOnError`) opt out via the new
  `diagnostic.warn: false` and keep their own single diagnostic, so no broken
  predicate ever warns twice.

- 2a9513d: `toFilterNode` now lowers a spec `ViewFilterRule[]` into ObjectQL AST nodes instead of returning the array verbatim, so a saved view's stored filter reaches `$filter` as something the server accepts. It previously did not: `ListViewSchema.filter` / `ViewTab.filter` are declared `z.array(ViewFilterRuleSchema)`, and the whole read path — `ObjectView` → `ListViewSchema.filter` → `buildEffectiveFilter` → `mergeFilterNodes` → `toFilterNode` — carried those rule objects untouched into the query. `isFilterAST` is `false` for an array of objects, so the data API answered `400 INVALID_FILTER` and the list rendered no rows at all. Measured against a real backend on the showcase's shipped `showcase_task.in_progress` view: `$filter=[{"field":"status","operator":"equals","value":"in_progress"}]` returned `400`, while the lowered `[["status","equals","in_progress"]]` returned its 2 rows. Every saved view carrying a filter was affected, on both producers that share this sink — `plugin-list`'s `buildEffectiveFilter` (the grid and its export) and `plugin-view`'s `ObjectView` (calendar / kanban / gallery / timeline).

  Operators are canonicalised through the spec's own `normalizeFilterOperator`, the same exit the write side (`viewFilterFold`) uses, so the two directions cannot drift into two dialects; no second operator table is introduced. An operator the spec does not know is passed through verbatim so the server still refuses it loudly rather than having a misspelling coerced into a valid filter. AST nodes and MongoDB-style object filters are unaffected, mixed arrays (a view's rules concatenated with `?filter[<field>]=<value>` URL triples) fold element-wise with the triples untouched, and a rule with a blank `field` is deliberately left unlowered — `["", op, value]` passes `isFilterAST` and returns an empty list, whereas the unlowered rule keeps the loud `400`.

- Updated dependencies [d915c47]
- Updated dependencies [9e9e9a9]
- Updated dependencies [23018cc]
- Updated dependencies [f44d872]
- Updated dependencies [f833d3a]
- Updated dependencies [d22ae31]
  - @object-ui/types@17.3.0

## 17.2.0

### Minor Changes

- bca45cc: Declare the 18 spec-owned action keys `ActionDef` had been absorbing silently.

  `ActionDef` ends with `[key: string]: any`, so it accepted any key of any type —
  a typo (`targt`) and a retired spec key (`execute`) both type-checked, then the
  runner silently bound no handler (the #2169 "Mark Done does nothing" shape).
  Step 1 (objectstack#4075) made that audible with a dev-mode warning. This is
  step 2: the keys the warning identified as legitimate are now real fields.

  - **18 keys promoted to explicit optional fields** — `ai`, `aria`, `bodyExtra`,
    `bodyShape`, `bulkEnabled`, `component`, `icon`, `locations`, `mode`,
    `objectName`, `order`, `recordIdField`, `recordIdParam`, `requiredPermissions`,
    `requiresFeature`, `shortcut`, `variant`, `visible`. Every type is **derived**
    from `@objectstack/spec`'s `ActionInput` (`SpecActionInput['locations']`, …),
    never hand-copied: a hand-written duplicate of a spec shape is a second
    contract that drifts, which is the failure this issue is about. Wrong-typed
    values are now compile errors — `order: 'first'`, `variant: 'chartreuse'`,
    `locations: ['nope']` — where before they were absorbed silently.
  - **Derived from `z.input`, not `z.infer`.** `ActionSchema` is a `ZodPipe` whose
    transform narrows `visible` from `string | { dialect, source }` to the
    envelope alone. This runner consumes authored/stored rows, which are
    rehydrated unparsed, so it sees the input shape; deriving from the inferred
    `Action` would have rejected the raw-string predicate `ActionEngine`
    explicitly supports.
  - **Three `as any` casts deleted** in `ActionEngine` — `visible` and
    `requiredPermissions` at the location filter, `locations` at registration.
    They existed only because the fields were undeclared.
  - **Four objectui-dialect keys marked `@deprecated`** with the spec spelling to
    use instead — `actionType` (→ `type`), `api` and `endpoint` (→ `target`;
    `executeAPI` already resolves `api || endpoint || target`), and `navigate`
    (→ flat `target` / `openIn`). Only these four: the remaining dialect keys are
    runner mechanics (chaining, toasts, post-execution reload/close) with no spec
    counterpart, and pointing them at a spelling that does not exist would be
    worse than leaving them declared.

  **Breaking edge, deliberate.** `shortcut` and `bulkEnabled` were retired by
  `@objectstack/spec` 17 as `retiredKey()` tombstones (`z.never()`), so authoring
  either is already a hard parse rejection. Deriving their types rather than
  hand-writing them turns that runtime rejection into a **compile error**: code
  that assigned `shortcut: 'ctrl+k'` to an `ActionDef` compiled before and does
  not now. Such metadata was already refused by the platform — this only moves the
  failure to where it can be fixed. A host may still pass either explicitly via
  `ActionEngine.registerAction(action, { shortcut, bulkEnabled })`; only authored
  metadata stopped carrying them. `bulkEnabled`'s replacement is the list view's
  `bulkActions` / `bulkActionDefs`; `shortcut` has none.

  The index signature **stays** — removing it is step 3, and the inverted pin
  asserting it is still present remains the issue's own completion check.

- 4bf612c: Aggregate single-call mode for bulk actions: `execution: 'aggregate'` (objectui#3139).

  A `bulkActionDefs` entry with `operation: 'custom'` used to have exactly one
  dispatch shape: one action-runner call per selected record (`_rowRecord`
  attached). "Select N rows → ONE call that receives every selected id" — the
  zip-of-QR-codes / merged-PDF / batch-print shape — could not be expressed, so
  downstream projects fell back to per-row `window.open` storms or gave up.

  `BulkActionDef` now carries `execution?: 'perRecord' | 'aggregate'` (default
  `'perRecord'`, existing views untouched). An aggregate def dispatches its
  action exactly once for the whole selection with `params._selectedIds:
string[]` injected and the full records published as
  `context.selectedRecords`. The authored form usually just names a declared
  object action — `{ name, operation: 'custom', execution: 'aggregate' }` —
  and `resolveBulkActions` attaches the declaration. Results are
  all-or-nothing: a failure is attributed to every id with the real error and
  per-row Retry is hidden (re-running the action is the retry; a total failure
  keeps the selection). `batchSize` does not apply; `maxRecords` still gates.

  The executor rides the existing `executeBulkBatch` bulk-first decision tree —
  the aggregate call is its `bulkCall`, and the per-row "fallback" only
  re-throws the captured error for attribution, never fans out N dispatches
  against an endpoint written for one `_selectedIds` call.

  Also: url/api target interpolation now exposes `${ctx.selection.ids}` (comma
  -joined) and `${ctx.selection.count}` from the grid's checkbox selection, so
  a plain `list_toolbar` action can carry the selection without bulk plumbing;
  the console's server-action handler recognizes `_selectedIds` and skips the
  single-record multi-select guard for aggregate dispatches.

- 335041c: Stop declaring 13 `@object-ui/core` symbols under names `@objectstack/spec` owns
  (objectui#3158, objectstack#4115 batch 4).

  **Breaking for importers of `@object-ui/core`** — seven exported names changed,
  because the spec exports the same name for a _different_ thing:

  | was                      | now                               | what the spec's same-named export actually is                                |
  | :----------------------- | :-------------------------------- | :--------------------------------------------------------------------------- |
  | `ChartSeries`            | `ChartSeriesBinding`              | the authored dataset-binding descriptor (a measure `name`, no `data`)        |
  | `ActionHandler`          | `ActionRunnerHandler`             | the SERVER-side objectql handler, `(ctx) => unknown`                         |
  | `PluginDefinition`       | `RegistryPluginDefinition`        | the platform PACKAGE manifest (`id`/`slug`/`staticPath`/install hooks)       |
  | `ValidationError`        | `SchemaNodeValidationError`       | plugin-manifest validation, keyed by `field`, no severity                    |
  | `ValidationResult`       | `SchemaNodeValidationResult`      | ditto, with both arrays optional                                             |
  | `defineView`             | `defineSystemView`                | the VIEW-DOCUMENT factory: parses a `ViewSchema`, returns a validated `View` |
  | `resolveCrudAffordances` | `resolveEffectiveCrudAffordances` | the object-level affordance matrix, with no notion of server API operations  |

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

- b414983: fix(dashboard): a date globalFilter's preset-name default becomes a range, not an equality

  Setup → System Overview rendered EVERY KPI tile as 0 while its period selector
  read "All time" (objectstack#4475). Every request was `200 OK`, the widgets
  rendered normally, and nothing in the UI signalled a failure — zeros read as
  "nothing has happened yet" rather than as an error, which is why this survived
  to an RC.

  Both symptoms are one missing normalization. `resolveDashboardFilterDefs` lifts
  the built-in `dateRange` declaration's preset NAME to `{ preset }`, but passed a
  `globalFilters` entry's `defaultValue` through raw. `@objectstack/spec`'s
  `GlobalFilterSchema.defaultValue` is `string | number | boolean`, so a bare
  preset name is the ONLY spelling an author can write — and nothing ever mapped
  it. System Overview declares
  `{ field: 'created_at', type: 'date', defaultValue: 'last_7_days' }`, so:

  - `buildFilterCondition` fell through to its "a bare string date means equality
    on that day" branch and the widget sent
    `runtimeFilter: { created_at: 'last_7_days' }`. The backend compiled
    `SELECT COUNT(*) AS "user_count" FROM "sys_user" WHERE created_at = $1`
    — verified against a live server, byte-for-byte the SQL in the issue. The
    actual `sys_user` count is 4; that equality matches no row.
  - `DateRangeFilter` derives its selected item from `value.preset` / `.from` /
    `.to`, all `undefined` on a bare string, so the control fell through to its
    ALL sentinel and displayed "All time" while sending that equality. The tiles
    therefore looked deliberately unfiltered and merely empty.

  `normalizeDateDefault` now applies the same lift the sibling `dateRange`
  declaration already receives, for `date`/`dateRange` filters whose default names
  a preset this module actually knows. This is not consumer-side leniency: it is
  one normalization function completing the same conversion for the sibling
  declaration, and the spec admits no other spelling for an author to fix at the
  producer. A genuine ISO date string still means equality on that day (the
  documented behaviour), and numbers, booleans and unrecognised strings are left
  exactly as declared.

  No backend change is needed: given a real range the dataset path already lowers
  it correctly (`WHERE (created_at >= $1 AND created_at < $2)` → 4). The
  framework's dashboard metadata needs none either — it is spec-compliant as
  written, and editing it would only hide the defect.

  Levelled `minor` rather than `patch` because the change is visible in rendered
  dashboards rather than internal: any dashboard declaring a date-typed
  `globalFilters` default now emits a different query shape, its numbers change
  (from 0 to real values), and its filter control's displayed label changes with
  them. Anything asserting on the previously-emitted condition will see it move.

  Known residual, filed separately rather than widened into here: a `date` filter
  whose value is neither a known preset nor a parseable ISO date still degrades
  silently to an equality that matches nothing, producing the same
  healthy-looking zero. Preset names are covered by this change; a misspelled
  custom value is not.

- 256f8cc: fix(dashboard): an unrecognised date filter value is skipped and named, not compared

  The residual the preset-name fix (objectui#3150 / objectstack#4475) left behind,
  and the more deceptive half of it: a `date`/`dateRange` filter value that is
  neither a known preset name nor a parseable date used to fall through to the
  "a bare string date means equality on that day" branch. A misspelled default —
  `defaultValue: 'last_7_dayz'` — therefore reached the widget query as
  `runtimeFilter: { created_at: 'last_7_dayz' }`, which the backend faithfully
  compiled to `WHERE created_at = $1`. `200 OK`, widget renders, count is 0 —
  indistinguishable from "this range genuinely has no data". No 4xx, no console
  warning, no UI signal. objectstack#4475 took a full RC cycle to catch for
  exactly this reason: **0 looks like a legitimate answer**.

  `buildFilterCondition` now holds a date value to three spellings, and only
  three:

  1. a known preset name → range bounds (unchanged, objectui#3150);
  2. an ISO date (`2026-01-15`, `2026-01-15T08:30:00Z`) or a date-macro token
     (`{today}`, `{7_days_ago}`) → equality on that day (the documented
     behaviour, unchanged);
  3. **anything else → the filter is skipped and `console.warn` names the filter,
     the offending value, and the accepted spellings.**

  The `{ preset: '<unknown>' }` object form gets the same voice. It already
  dropped the filter — silently — because the preset lookup missed and no
  `from`/`to` remained; that drop is now announced. When explicit bounds ride
  along with an unknown preset the bounds are still honoured, and the warning says
  which of the two won.

  Rule 3 is deliberately the same strictness `buildWidgetScopedFilter` already
  applies to a _default binding on a field the object does not have_ — skip and
  warn, with the same rationale spelled out there: never emit a query the backend
  can only empty-match. Field _names_ had that guard; field _values_ did not.

  The macro-token check asks `resolveDateMacros` itself whether it recognises the
  string, rather than restating its token grammar in a second place. One
  vocabulary, no dialect to drift — and a token that resolver does not know
  (`{last_7_dayz}`) is precisely the typo this guard exists to catch.

  Levelled `minor`, matching objectui#3150, because the emitted query shape
  changes: a dashboard carrying a misspelled date value stops sending a
  never-matching equality and instead sends no constraint for that filter (its
  numbers go from 0 to unfiltered) while the console says why. Anything asserting
  on the previously-emitted equality will see it disappear.

  Note the direction of the relaxation is chosen, not incidental: skipping widens
  the result set, so the number visibly changes and the warning explains it —
  whereas the old behaviour narrowed it to zero, which is the one outcome an
  author cannot tell from a correct answer. Author-time rejection (validating
  `GlobalFilterSchema.defaultValue` at publish, in `@objectstack/spec`) is the
  stricter complement and belongs on the platform side; it is filed separately.

- d3584c6: Bring the whole `@objectstack` family to `17.0.0-rc.1`, so the dependency graph resolves a
  single copy of `@objectstack/spec`.

  #3178 bumped **only** `@objectstack/spec` to `17.0.0-rc.1`. The rest of the family —
  `client`, `core`, `formula`, `lint` (and `sdui-parser`, reached through `lint`) — stayed on
  `17.0.0-rc.0`, and each of them depends on spec at an **exact** version rather than a
  caret:

  ```
  @objectstack/client@17.0.0-rc.0  -> spec "17.0.0-rc.0"
  @objectstack/core@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  @objectstack/formula@17.0.0-rc.0 -> spec "17.0.0-rc.0"
  @objectstack/lint@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  ```

  So `main` carried **two** spec copies: objectui's own code read `17.0.0-rc.1` while every
  `@objectstack/*` package read `17.0.0-rc.0` from its own nested `node_modules`. That breaks
  the single-contract invariant this repo's guards are built on, and it breaks them
  _silently_ — the affected checks depend on identity, not on version strings:

  - `spec-subschema-parity.test.ts` distinguishes a genuine re-export from a fork by
    **reference identity** of the zod schema object. Two spec copies make every schema a
    distinct object, so a real re-export starts reading as a fork (or a fork slips through,
    depending on which copy each side resolved).
  - `scripts/check-spec-symbol-derivation.mjs` and `spec-symbol-parity.test.ts` use
    `createRequire` to resolve spec's `.d.ts` and run it through the TS checker. With two
    copies installed, _which_ declaration file the checker sees is a function of resolution
    order rather than of intent.

  The declared ranges were already `^17.0.0-rc.0`, which technically admits rc.1 — the pin
  lived in the lockfile. Raising the remaining ranges to `^17.0.0-rc.1` makes the floor
  explicit and forbids a future install from silently sliding back onto a family member that
  drags rc.0 along with it. The rc.1 family members pin spec at `17.0.0-rc.1` exactly, so the
  graph now converges on one copy by construction, not by luck.

  No product behaviour changes here. `check:spec-symbols` reconciliation was already
  completed by #3178 and stays green under the unified graph; this changeset is `minor`
  per the repo's fixed-group version policy.

- 444457c: feat!: follow the framework's `managedBy: 'system'` → `'system-data'` retirement (objectstack#3355)

  **FROM → TO: `managedBy: 'system'` → `managedBy: 'system-data'`.** The framework
  retired the residual `system` bucket in protocol 17; this is the UI half of that
  change, landing with it so the closed `ManagedByBucket` union stays a mirror
  rather than a fork.

  ADR-0103 split the overloaded `system` bucket additively in v16 — the
  engine-owned objects moved to the explicit `engine-owned`, the admin/user-writable
  ones stayed on `system` — which left that value named after the half that had
  already moved out. `system-data` names what it actually holds: the SCHEMA is the
  platform's, the DATA is the admin's or the user's.

  **The derivation this deletes is the point.** Because v16's `system` doubled as
  both the engine-owned default and the writable set, three UI surfaces had to
  RECOVER the distinction from `userActions` at render time:

  - `isSystemWritable()` probed `userActions` for any opted-in write. It is now
    `managedBy === 'system-data'` — the bucket answers directly.
  - `ManagedByBadge` derived a synthetic `'system-writable'` variant key. The
    variant map is now 1:1 with the bucket union, so a new bucket is a compile
    error to miss instead of a silent fallthrough. The `systemWritable` /
    `system` i18n keys are **unchanged**, so no locale bundle moves.
  - `resolveManagedByEmptyState()` asked the resolved `create` affordance whether a
    `system` list should read "entries appear automatically" or show the New
    button. `system-data` now falls through to the generic empty state by
    definition; `engine-owned` keeps the automatic-entries copy.

  **Breaking (UI API):** `ManagedByBadge`'s `userActions` prop and the exported
  `ManagedByUserActions` interface are **removed**. The bucket alone selects the
  variant now, so the prop had become metadata nothing read — the exact defect the
  framework change exists to remove; shipping it as an accepted-but-ignored prop
  would have reproduced it one layer up. Drop the prop from call sites; no other
  change is needed.

  `MANAGED_BY_BUCKETS` and `ManagedByBucket` no longer contain `'system'`.

- 850033c: Stop offering the retired `action.shortcut` / `action.bulkEnabled` keys.

  `@objectstack/spec` 17 retired both as `retiredKey()` tombstones: authoring
  either one is a hard PARSE REJECTION, so a draft carrying it cannot be saved
  at all. The designer still offered controls for both — a "Bulk — apply to
  multiple selected rows" checkbox and a "Shortcut" text field — which meant the
  Studio action inspector let an author build a draft the platform would then
  refuse, with the rejection arriving later and nowhere near the checkbox.

  - **Action inspector**: both controls removed. The keys stay hidden from the
    fallback form (the server's live schema still advertises them, so dropping
    them from the hidden list would put the inputs straight back) — now under a
    `RETIRED_FIELDS` list that says why, so nobody "restores the missing
    control". `bulkEnabled`'s replacement is the list view's `bulkActions` /
    `bulkActionDefs`; `shortcut` has none.
  - **Action preview**: the `shortcut` and `bulk` pills are gone — they could
    only ever render for metadata the platform now refuses.
  - **`ActionEngine.registerActions`**: no longer harvests the two retired keys
    from authored metadata, which made two dead registration options look
    load-bearing. Both are still accepted on the single-action
    `registerAction(action, options)` overload, where a HOST passes them
    explicitly.

- 009e25d: Report / chart / query symbols stop wearing `@objectstack/spec`'s names
  (objectui#3155, objectstack#4115).

  **Breaking for TypeScript imports** — six exported names change. Each was a
  different concept than the spec export it collided with, so an author reading
  the objectui declaration as "the spec's" was reading a false claim:

  | was                 | now                      | why they were never the same thing                                                                                                                               |
  | :------------------ | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `ChartSeries`       | `ChartDataSeries`        | ours is a display name plus literal `data: number[]`; the spec's is a dataset-bound series descriptor (`type`/`stack`/`yAxis`/`variant`) with no data at all     |
  | `ChartSeriesSchema` | `ChartDataSeriesSchema`  | zod twin of the above                                                                                                                                            |
  | `QueryAST`          | `SqlQueryAST`            | ours is a compiled SQL syntax tree (`select`/`from`/`join`/`group_by`); the spec's is the ObjectQL request descriptor (`object`/`fields`/`where`/`expand`)       |
  | `QuerySchema`       | `DriverQueryConfig`      | ours is the high-level config `QueryASTBuilder` compiles; the spec exports that name as a zod schema value                                                       |
  | `DriverInterface`   | `SqlDriverInterface`     | ours is objectui's SQL-oriented client abstraction (`query(sql, params)`); the spec's is the platform runtime driver contract                                    |
  | `DatasourceSchema`  | `DatasourceRegistration` | ours is the in-memory record `DatasourceManager` holds — its `driver` is a live instance; the spec's is the authored metadata document, where `driver` is a name |

  Three more are now DERIVED from the spec instead of hand-restated, which fixes
  live silent-stripping defects, since a `z.object()` drops unknown keys:

  - **`DashboardWidgetSchema`** declared 10 of the spec's 22 keys, so
    `objectui validate` deleted the other 12 without a word — `chartConfig`,
    `colorVariant`, `filter`, `responsive`, `aria`,
    `actionUrl`/`actionType`/`actionIcon`, `compareTo`, `suppressWarnings` and the
    `requiresObject` / `requiresService` capability gates the dashboard renderer
    honours at runtime. The TS interface had declared most of them all along, so a
    widget could type-check and still lose half its configuration on validation.
    Pinned divergences kept: `id` stays optional, `type` stays widened for the
    objectui-only `list` / `custom` families, and the legacy `component` envelope
    stays.
  - **`GlobalFilterSchema`** took `scope` as a free-form string (any typo
    validated); it now uses the spec's `widget | dashboard` vocabulary. The three
    objectui widenings that back a real runtime normalizer are kept and pinned:
    the bare-string `options` shorthand, the normalized `{ preset }` date default,
    and an optional `optionsFrom.labelField`.
  - **`AppContextSelectorSchema`** was a full restatement; spec keys and their
    defaults now flow in by reference, with `label` widened for objectui's i18n
    label envelope — which `AppContextSelectors` already renders.

  `ListViewSchema`'s zod node now names the spec in its own initializer rather
  than one hop away through a local const, so its long-standing derivation is
  visible where it is declared.

  Drift guard: `packages/types/src/__tests__/report-chart-query-spec-parity.test.ts`.

- 726b89c: `@object-ui/types` stops declaring sixteen symbols under names `@objectstack/spec` owns (objectui#3156, objectstack#4115).

  Seven are now **derived** from the spec, nine are **renamed** to the local
  dialect they always were. Both halves remove the same hazard: a local
  declaration under a spec export's name reads as the spec's own definition to
  the next reader, so a copy that is merely _correct today_ is a planted premise
  tomorrow.

  **Derived** — the spec now supplies the keys, by reference:

  | symbol                   | derivation                                                                        |
  | :----------------------- | :-------------------------------------------------------------------------------- |
  | `ActionParam`            | `z.input<typeof ActionParamSchema>`, `type` widened to the local legacy spellings |
  | `CreateExportJobRequest` | `Omit<CreateExportJobInput, 'object'>` (`object` is the method argument)          |
  | `CreateExportJobResult`  | re-export from `@objectstack/spec/contracts`                                      |
  | `ImportRowResult`        | re-export from `@objectstack/spec/api`                                            |
  | `NavigationArea`         | spec keys, with `navigation` / `visible` pinned locally                           |
  | `NavigationAreaSchema`   | `specFieldsExcept(NavigationAreaSchema.shape, …)`                                 |
  | `Theme`                  | re-export of the spec's `ThemeInput` (the authoring shape)                        |
  | `ExportJobFormat`        | re-export of the spec's `ExportFormat`                                            |

  Four of these close real gaps rather than tidy names. `ActionParam` never
  declared `reference` — the key `resolveActionParams()` actually reads for an
  inline lookup target — nor `defaultFromRow`, which the metadata designer's own
  inspector writes; it also narrowed `visible` to a bare string although the
  resolver has always accepted the `{ dialect, source }` envelope too.
  `CreateExportJobResult.createdAt` and `ImportRowResult.action` were optional
  here and required by the server, leaving every consumer a branch that could
  never run. And `NavigationArea`'s `id` now carries the spec's own length rule
  instead of accepting any string.

  **Renamed** — same word, different concept:

  | was                | now                      | why                                                                                                                            |
  | :----------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
  | `FileMetadata`     | `UploadedFileMetadata`   | field-VALUE payload (`url`, `original_name`), not the storage file record                                                      |
  | `GestureType`      | `TouchGestureType`       | direction-fused (`swipe-left`), not the spec's type+direction pair                                                             |
  | `GestureConfig`    | `TouchGestureConfig`     | gesture→`action` binding, not per-gesture tuning                                                                               |
  | `OfflineConfig`    | `PWAOfflineConfig`       | service-worker route caching, not the offline data/sync model                                                                  |
  | `PageRegion`       | `PageNodeRegion`         | region of the renderer page NODE, holding `SchemaNode`s                                                                        |
  | `PageRegionSchema` | `PageNodeRegionSchema`   | zod twin of the above                                                                                                          |
  | `ResponsiveConfig` | `MobileResponsiveConfig` | mobile box config, not the spec's SDUI grid contract                                                                           |
  | `WidgetManifest`   | `RuntimeWidgetManifest`  | SDUI component manifest, not the field-widget plugin manifest                                                                  |
  | `WidgetSource`     | `RuntimeWidgetSource`    | `module`/`inline`/`registry` loader union — and its `inline` carries a resolved component where the spec's carries source code |

  **Migration**: the old names are gone, not deprecated — an alias would preserve
  exactly the ambiguity being removed. Import the new name; nothing about the
  shapes changed. `@object-ui/types` already re-exports the spec's own
  `SpecResponsiveConfig`, and `@object-ui/react`'s `useOffline` config remains the
  spec-shaped `OfflineConfig`, so both concepts stay reachable under
  distinguishable names.

  Each rename carries a bidirectional tripwire
  (`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`): it fails if
  the spec ever claims the new name, and also if the spec retires the old one —
  at which point the natural name can be taken back rather than the workaround
  outliving its reason.

### Patch Changes

- d9668a7: Honor the server's declared percent scale, so a ratio of exactly 1 renders as 100.0% (#3136)

  A dataset measure declared `format: '0.0%'` rendered every ratio below 1
  correctly and got the single most consequential one wrong: a rate of exactly
  `1` printed as **`1.0%`**. On an SLA / pass-rate dashboard that turns
  "everything met the SLA" into "1% met the SLA", on both surfaces the issue
  names — the KPI card and the dataset-bound table (they share `formatMeasure`).

  The cause was never a bad multiplier; it was a missing fact. `formatMeasure`
  scaled by magnitude — `percentDisplayValue` multiplies by 100 only strictly
  inside `(-1, 1)` — because the column arrived with a `%` format string and
  nothing saying what scale its numbers were on. That guess is undecidable at
  exactly 1, which is both a full-compliance ratio ("100%") and one percentage
  point ("1%"), and it resolved to the reading almost nobody means.

  The server now answers the question instead (framework: `percentScaleOf` +
  `AnalyticsResult.fields[].percentScale`, the sibling of the ADR-0053 currency
  chain): a `derived: { op: 'ratio' }` measure is a `fraction` by definition, and
  a measure over a `percent` field inherits that field's scale. `formatMeasure`
  takes the declared scale as a fourth argument and, when present, scales by it —
  `fraction` ×100, `whole` verbatim — instead of inspecting the value. Every
  dataset-bound call site passes the column's `percentScale`: the dashboard
  metric/table/pivot cells, the report renderer's cells, totals and KPI, and the
  dataset preview.

  `percentDisplayValue` is untouched and still the fallback for a column that
  arrives without the annotation (an older server, or a non-dataset percent cell
  in a list view), so nothing that renders correctly today changes.

- a8ad6c0: A required boolean must be savable in its UNCHECKED state — `false` and `0` are values.

  Reported against an AI-built task tracker whose 任务 object has a required
  `是否完成` boolean: the create form showed the switch OFF, answered "是否完成不能
  为空", and saved instantly once the switch was turned ON. The app could only ever
  create ALREADY-DONE tasks — the one state the control shows by default was the
  one value it refused to save (cloud#972).

  Two defects stacked, and either alone is enough to break it:

  **The `required` verdict read truthiness, not presence.** `@objectstack/spec`
  FieldSchema.required (ADR-0113) is "an insert must provide a NON-NULL value",
  and objectql's record validator implements exactly that. react-hook-form's
  built-in rule instead fails whenever `isBoolean(value) && !value` — its
  accept-the-terms checkbox heritage — silently redefining every required boolean
  as "must be TRUE", including a select whose chosen option value is `false`. It
  also disagreed the other way, letting a whitespace-only string through for the
  server to reject with a 400. The form renderer no longer hands RHF its own
  `required`: the check is now a `validate` entry keyed `required` (so the error
  still surfaces as `type: 'required'`, which the conditional-required cleanup
  keys on) backed by a new shared `isMissingForRequired` in `@object-ui/core`, a
  deliberate mirror of objectql `record-validator.isMissing` — `undefined`,
  `null`, blank-after-trim string, empty array. Deleting the inherited rule also
  stops a `required` that rode in on `validation` from outliving a `requiredWhen`
  that resolved to FALSE.

  **A boolean field held `undefined` while displaying "off".** A two-state control
  has no third state, but a field with no entry in `defaultValues` rendered an OFF
  switch backed by nothing: the create payload omitted the column (it lands null,
  which reads as unchecked but isn't) and the presence check above would still
  refuse it. The form renderer now folds `false` into `defaultValues` for every
  boolean-widget field the caller left unset — in `defaultValues` itself, not
  per-Controller, because that object is also the dirty-check baseline and what
  the defaults-reset window replays. Every surface gets it, including the
  modal/drawer create dialogs that start from a bare `{}`. An authored default
  (or a loaded record, `null` included) still wins.

  `WizardForm`'s cross-step gate had its own copy of the empty-value predicate; it
  now imports the shared one so it cannot drift from the per-field verdict. And
  the field-demo renderer read `schema.defaultValue || schema.value`, throwing
  away an authored default of `false` / `0` / `''` — same falsy-as-empty class,
  now `??`.

  Verified end to end on a local stack against the exact metadata shape
  `apply_blueprint` materializes (`{ type: 'boolean', required: true }`, no
  default): a 是否完成 = 否 task with 工时 = 0 now creates and persists as
  `{ hours: 0, is_done: false }`, turning the switch on still stores `true`, and a
  blank required text is still refused.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [4bf612c]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [444457c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0

## 17.1.0

### Minor Changes

- 62311b6: feat(core): inventory `ActionDef`'s keys and warn on the ones nothing reads — objectstack#4075 step 1

  `ActionDef` ends with `[key: string]: any`, so it accepts any key of any type.
  Deleting `ActionDef.execute` produced **zero** compile errors even though the
  field had just been removed (objectui#2990), and stale metadata still authoring
  `execute: 'markDone'` type-checks today. The same deletion against
  `@object-ui/types`' `ActionSchema` — which has no index signature — correctly
  produced `TS2353` at the authoring site. One of the two readers can catch a
  retired key; the other is structurally incapable, which is how a typo (`targt`)
  and a tombstoned key both reach a runner that then silently does nothing.

  This is the non-breaking first step of the staged narrowing: it makes the key set
  **visible** and warns on anything outside it, without changing a single type.

  New exports from `@object-ui/core`:

  - `ACTION_DEF_KEYS`, `SPEC_ACTION_KEYS`, `NAVIGATION_ALIAS_KEYS`,
    `RETIRED_ACTION_KEYS`, `KNOWN_ACTION_KEYS` — the inventory.
  - `classifyActionKeys(action)` — splits an action's own keys into `unknown` and
    `retired`.
  - `warnOnUnknownActionKeys(action)` — dev-mode only, warn-once. Called by
    `ActionRunner.execute`, so no consumer wiring is needed.

  A retired key gets a louder, more specific warning than an unknown one: an
  unknown key is probably a typo, a retired key is metadata that used to work.
  `execute` is not simply gone from the spec — it is a live **tombstone**, still
  present in `ActionSchema` so the parser can reject it by name with the rename
  prescription.

  Nothing is rejected and no types changed, so existing metadata behaves exactly as
  before. Promoting the legitimate keys to explicit optional fields, then removing
  the index signature so `tsc` catches both typos and retired keys, are steps 2 and
  3 of objectstack#4075.

- 9e7349e: **`target` is the only action handler slot — the `execute` alias is gone from the renderer (framework#3856).**

  `ActionRunner.executeScript` read `action.target || action.execute`. That fallback
  is unreachable against `@objectstack/spec` 17: `execute` is now a tombstoned key
  (framework#3855) that the parser **rejects** with the rename prescription, so no
  parsed action can carry it and the `||` could only ever yield `target`. Verified
  against 17.0.0-rc.0 — an action declaring `execute` fails `ActionSchema.safeParse`,
  and a `target` action's parsed output has no `execute` key at all.

  Deleted rather than left as harmless residue: two handler slots is what let one
  action run one script server-side and a different one client-side (framework#3713,
  where this renderer preferred the alias while the spec transform preferred
  `target`). A dead slot still reads as a live contract to the next maintainer.

  `execute` is also **removed from the types**, which is the part that had never
  landed. framework#3856 predicted a compile error here; there wasn't one, because
  neither reader was typed against the spec's `z.infer`:

  - `@object-ui/types` `ActionSchema` hand-declared `execute?: string`. Removed, so
    `execute: '…'` now fails `tsc` at the authoring site (TS2353).
  - `@object-ui/core` `ActionDef` hand-declared it too. Removed — but `ActionDef`
    carries a `[key: string]: any` index signature, so stale hand-authored metadata
    that never passed through the parser still compiles. For that path
    `executeScript` now returns the rename prescription instead of a bare
    "No script provided", matching the spec tombstone's rule that removing an
    authorable key must be audible: silently binding no handler is the
    "Mark Done does nothing" shape (framework#2169).

  The four action renderers (`action:button`, `action:icon`, `action:menu`,
  `action:group`) no longer forward `execute` into the runner, and Studio's
  `ActionPreview` no longer falls back to it — previewing an alias-only draft as
  "bound" contradicted the parse that rejects it on save.

  Requires `@objectstack/spec` 17. Metadata still on the alias is rewritten by
  `os migrate meta --from 16`.

- 6ae818e: feat(core): one column identity per column — `field` stamped at ingestion (#3104)

  A column's field identity was resolved twice, with two different precedences
  over the same `schema.columns` array, and the two halves disagreed:

  - **request path** — `ListView`'s `$expand` and `$select` builders, and
    `ObjectGrid.getSelectFields`, read `f?.field` and only `f?.field`.
  - **render path** — the FLS gate, the hidden-field filter, `fieldOrder`, both
    export branches and the hide-fields popover read
    `f.name || f.fieldName || f.field` — name FIRST.

  So `{ field: 'account', name: 'account_name' }` fetched `account` while the
  renderer keyed off `account_name`, and `{ name: 'account' }` rendered a column
  the request dropped entirely — neither `$select` nor `$expand` carried it. That
  is the mechanism behind the "relation column shows a bare id / column is empty
  / sort does nothing / export is missing a column" defect class.

  Per AGENTS.md #0.1 the fix is not another `?? name` at the read sites. Legacy
  acceptance moves to the one boundary that already folds this view's vocabulary,
  `normalizeListViewSchema`, which now also canonicalizes each column's identity.

  New in `@object-ui/core`:

  - `columnIdentity(entry)` — the single reader. Resolves `field` → `name` →
    `fieldName`, canonical-first, so it agrees with `buildExpandFields` instead
    of racing it. Handles bare-string columns.
  - `normalizeColumnIdentity(entry)` / `normalizeColumnIdentities(columns)` — the
    fold. Stamps `field`; a legacy key that is **already present** is mirrored
    onto the same identity so name-first readers resolve what the request asked
    for; a legacy key that is **absent is never invented**, and an
    already-canonical column is returned by reference.
  - `hasConflictingColumnIdentity(entry)` — true when a column's keys disagree.
  - `CANONICAL_COLUMN_IDENTITY_KEY`, `LEGACY_COLUMN_IDENTITY_KEYS`,
    `TABLE_ADAPTER_COLUMN_KEY`.

  The fold **mirrors** rather than deleting the legacy key, unlike the other
  folds in `normalizeListViewSchema`. Deleting would work inside this repo (every
  name-first read falls through to `field`), but `columns` entries cross the
  package boundary into host renderers and dropping `name` from under them is a
  breaking change with no inventory. Deletion is a later call, once the in-repo
  consumers read `columnIdentity()`.

  Behaviour is unchanged for any column carrying a single identity key — every
  read site resolves the same string it did before. The entries whose resolution
  moves are exactly the ones where two sites already disagreed.

  `accessorKey` is deliberately untouched: it is TanStack Table's own column key
  (`TableColumn.accessorKey`), not ObjectStack metadata identity, and folding
  across that boundary would fossilize the merge.

- 746dd00: feat(sdui): curate the page:\*, element:\* and action:\* families into the public contract

  The AI-authoring vocabulary and the Studio page designer disagreed by thirteen
  blocks: `PUBLIC_BLOCKS` carried one `page:` tag and one `element:` tag while
  the designer palette — and @objectstack/spec's page schema — offered the whole
  families. A block a human can drag in Studio was invisible to a model writing
  the same page, which is the objectui#3006 state at 10× the scale.

  Fifteen tags join the contract (36 → 42 → **57**), every one shipping a
  renderer with declared inputs (objectui#3065):

  - `page:` — tabs, card, accordion, section, footer, sidebar
  - `element:` — text, number, button, definition-list, repeater
  - `action:` — button, group, menu, icon

  Five stay out, each with its reason recorded and guarded: `action:bar`
  (`record:quick_actions` covers the record action strip; the spec blesses the
  other four), `element:image` (duplicates the curated `image` — one spelling
  per concept), and `element:record_picker` / `element:text_input` /
  `element:metadata_viewer` (mirroring the Studio palette's own exclusions, so
  the two vocabularies stay out for the same reasons rather than by
  coincidence).

  The console's reverse-coverage guard now sweeps all four semantic namespaces
  instead of `record:` alone — checking only the namespace you just fixed is
  exactly how the last 22 doubled keys went unnoticed (objectui#3037). A new
  prop-less allowlist (`element:divider`, `page:section`, `page:footer`,
  `page:sidebar`) keeps "declares no inputs" a pinned decision in both
  directions: those four must stay at zero, everything else curated must declare
  a surface.

- 38ca8be: refactor(fields): `requiredWhen` is the only required-predicate slot — drop the retired `conditionalRequired` alias

  `@objectstack/spec` 17 (objectstack#3855) **retired** `Field.conditionalRequired`,
  the long-deprecated alias of `requiredWhen`. ObjectUI carried a back-compat read
  for it in seven places; all of them are removed.

  The removal is safe because the spec did not merely _stop emitting_ the key — it
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

  | package                  | site                                                                                                      |
  | :----------------------- | :-------------------------------------------------------------------------------------------------------- |
  | `@object-ui/types`       | the `conditionalRequired?:` member on `FormField`                                                         |
  | `@object-ui/core`        | the `??` fallback + rules-param member in `resolveFieldRuleState`                                         |
  | `@object-ui/components`  | three pass-throughs in the form renderer                                                                  |
  | `@object-ui/plugin-form` | `ObjectForm`, `ModalForm`, `sectionFields`, `deriveMasterDetail` (×2)                                     |
  | `@object-ui/app-shell`   | the field inspector's legacy read/auto-migrate, and the key's entry in `clientValidation`'s CEL lint list |

  **Studio authors lose nothing.** The object designer's draft validation parses
  against the spec's own `ObjectSchema`, so a draft carrying the key now surfaces
  the tombstone's rename prescription under the same `fields.<name>.conditionalRequired`
  path the CEL lint used to report — a better message than the inspector's silent
  auto-migration, and one the server agrees with. That behavior is pinned by a test.

  **Migrating:** rename the key to `requiredWhen` (the CEL value is unchanged), or
  run `os migrate meta --from 16`.

- 02aef0c: fix(sdui): a `kind:'html'` page can use lazily-registered blocks, and recovers when one registers late

  objectui#2953 had a twin one tier over, unreported. The whitelist a
  `kind:'html'` page's source compiles against was built from `getAllTypes()` +
  `getConfig()` — both loaded-only — so any block registered via `registerLazy()`
  was rejected as _"not an allowed component"_.

  The blast radius is worse than the react tier's. There, a missing block cost one
  identifier; here a compile diagnostic fails the **whole page**, so a single
  `<object-kanban>` replaced the entire page with `HTML page failed to compile (2)`.
  And it never recovered: `layoutElement` was memoised on `[schema, pageType]` with
  no registry signal, so the cached error panel outlived the plugin actually
  landing — permanently broken for the session.

  `ComponentRegistry` gains three lazy-aware reads:

  - `getKnownTypes()` — loaded registrations **plus** pending lazy stubs, deduped.
    The set a whitelist or manifest should be built from. `getAllTypes()` keeps its
    loaded-only meaning ("what can render right now") and now says so.
  - `getMeta(type, namespace?)` — metadata from the loaded registration, else from
    a pending stub. `getConfig()` stays loaded-only, since callers read
    `.component` off it.
  - `getVersion()` — monotonic counter of changes to the known set, bumped on
    register / unregister / registerLazy. A cache key that a type _count_ cannot
    substitute for: one registration plus one unregistration leaves the count
    untouched while the set changed.

  `getJsxManifest()` builds from those, and `PageRenderer` subscribes to the
  registry so a page that could not compile retries when the registry grows.

  A stub carries no `inputs` yet, so its props surface as `unknown-prop` warnings
  rather than errors — the page compiles and renders, and the inner
  `SchemaRenderer` triggers the loader and swaps in the real block. Authoring-time
  prop validation is unaffected: `sdui.manifest.json` is generated with every
  plugin eagerly loaded, and asserts as much.

- c4db402: refactor(views): ListView's `aria` and `sharing` are the spec sub-shapes (#2890 scope A step 5)

  Last rename batch in the ListView vocabulary migration.

  **`aria`** is now the spec's `AriaPropsSchema`: `label` → `ariaLabel`,
  `describedBy` → `ariaDescribedBy`, folded at the ListView boundary like every
  other legacy key. Two things fall out of adopting the spec shape:

  - `role` becomes authorable. The list region hardcoded `role="region"`; it now
    reads `aria.role` and falls back to `region`.
  - `aria.live` stays as a documented local extension — it has no spec
    counterpart, and dropping it would silently disable a shipped capability.
    Promote it rather than growing that extension.

  **`sharing`** is now the spec's `ViewSharingSchema` (`{ type, lockedBy }`),
  imported by reference — the local four-key object is gone. The legacy pair folds
  in: `visibility` collapses onto the two ownership kinds the spec models (only
  `private` is `personal`; `team` / `organization` / `public` are all
  `collaborative`), and a bare `enabled: true` maps to `personal`, which is the
  badge the user already saw (the old title fell back to `'private'`).

  _Visible change_: the share badge's tooltip shows the spec ownership type, so a
  view authored with `visibility: 'team'` reads "Sharing: collaborative" instead
  of "Sharing: team". The four-value audience has no spec home and nothing but
  that tooltip consumed it; keeping a second audience enum alive would re-open the
  fork this issue closes.

  Also fixes the **spec bridge**, which was doing the opposite of its job: given a
  spec-shaped `sharing`, `transformListView` _downgraded_ it — inventing a legacy
  `visibility` audience and an `enabled` flag that the renderer then had to fold
  back. Both sides speak `ViewSharing` now, so it passes through.

  `conditionalFormatting` and `exportOptions` are deliberately **not** folded.
  Both objectui shapes are supersets carrying capability the spec cannot express —
  the `{ field, operator, value }` rule form, and `maxRecords` / `includeHeaders`
  / `fileNamePrefix`. Folding them onto the narrower spec shapes would delete
  working features; they want promotion upstream, not a rename.

- 5319bf1: feat(views): the list toolbar speaks one vocabulary — `userActions` (#2890 scope A step 3)

  The seven bare `show*` toolbar flags fold into the spec's `userActions`, and the
  renderer reads nothing else. `showDescription` folds into
  `appearance.showDescription` at the same boundary.

  | legacy                                                    | canonical                                                 |
  | :-------------------------------------------------------- | :-------------------------------------------------------- |
  | `showSearch` / `showSort` / `showFilters` / `showDensity` | `userActions.search` / `.sort` / `.filter` / `.rowHeight` |
  | `showGroup` / `showHideFields` / `showColor`              | `userActions.group` / `.hideFields` / `.rowColor`         |
  | `showDescription`                                         | `appearance.showDescription`                              |

  **The last three are new keys, and they close a capability hole rather than just
  renaming one.** `@objectstack/spec`'s `UserActionsConfigSchema` documents itself
  as "which interactive actions are available to users in the view toolbar — each
  boolean toggles the corresponding toolbar element on/off", and already carries
  `rowHeight` (objectui's `showDensity` under its spec name). Grouping, column
  visibility and row coloring are the same kind of toggle: the spec models all
  three as _configuration_ (`grouping`, `hiddenFields`, `rowColor`) but has no
  "may the user change it" switch for any of them.

  The consequence was visible in the product. With no `userActions` key to read,
  the two list surfaces **hardcoded opposite policies**: `InterfaceListPage` (the
  author-curated interface page) pinned all three OFF, `ObjectDataPage` pinned two
  ON — and an interface-page author could not turn grouping back on for end users
  at all. Both surfaces now express their policy as `userActions` defaults, which
  an author can override.

  Until the keys land in `@objectstack/spec`, `@object-ui/types` carries them as a
  documented `.extend()` on `UserActionsConfigSchema` (the same shape
  `ListColumnSchema` uses while waiting on objectstack#3761); it collapses into a
  plain re-export once they do. Note the spec schema is not `.strict()`, so before
  this an author writing `userActions: { group: false }` had it **silently
  stripped** — valid on parse, no effect at render.

  Defaults are unchanged and deliberately asymmetric, matching what these flags
  have always done: `search` / `sort` / `filter` / `rowHeight` / `group` are on
  unless turned off; `hideFields` / `rowColor` are off unless turned on. Making
  them uniform would grow two buttons on every existing view, so it is left as its
  own product decision rather than smuggled into a vocabulary migration.

  Also drops a dead relay in app-shell's `ObjectView`, which forwarded
  `showDescription` onto the node although `ListView` has only ever read
  `appearance.showDescription`.

- f59f2c1: refactor(actions): `navigation` becomes a named alias of the spec's `url`, sharing one navigator (#2944)

  The last open item of #2944: `ActionRunner` dispatched a seventh action type,
  `navigation`, that `@objectstack/spec`'s `ActionType` does not contain. The issue
  asked for a decision — promote it upstream or delete the case. Neither, as stated.

  - **Promoting it is wrong.** The spec already has `url` for "go to a location",
    with `openIn` for the new-tab/same-tab choice. A seventh type would put a
    second spec name on one operation, which is the exact failure the #2901 audit
    is named after: _a second definition of the vocabulary exists, and the renderer
    is faithful to the wrong one_.
  - **Deleting it is worse, because it is silent.** `{ type: 'navigation', to: … }`
    is authored today (`element:button` CTAs). Without the case the action falls
    through to `executeActionSchema`, which returns `{ success: true }` — a green
    toast that navigates nowhere. That is #2960's trap.

  So it stays, but stops being dialect. `ObjectUiLocalActionType` /
  `OBJECTUI_LOCAL_ACTION_TYPES` in `@object-ui/types` declare it as objectui's own
  alias of `url` — the same treatment #2985 gave `PageVisualizationAlias` — and the
  runner routes both names through one navigator.

  **The alias had already drifted, which is the point.** `executeNavigation` was
  quietly the weaker of the two implementations: no `${param.X}` / `${ctx.X}`
  interpolation, `openIn` ignored, and no `/api/…` full-page short-circuit (the
  redirect-dance case `url` exists to handle). An author who wrote
  `{ type: 'navigation', to: '/x?p=${param.p}' }` shipped the literal `${param.p}`,
  while the identical `url` action resolved it. Both names now behave identically;
  `url` in turn gains `replace` pass-through, the one modifier only the alias had.

  Additive only. `replace` is omitted from the `NavigationHandler` options object
  when unset, so hosts see the option shape they already saw.

  The new guard is structural rather than another assertion. The runner's built-in
  dispatch is a table typed `Record<RunnableActionType, …>` instead of a `switch`,
  so an `ActionType` the spec **adds** stops compiling until an executor exists for
  it — the Tier-2 "validates at save, renders nothing at run time" failure (#2942)
  becomes a build error for actions. `spec-derived-unions.test.ts` additionally
  asserts `navigation` is _absent_ from the spec enum, so the day it is adopted
  upstream, the test fails and names the alias to retire.

- ce08d55: chore(deps): upgrade `@objectstack/*` to 17.0.0-rc.0, and let the spec take back what it now owns

  `spec` / `client` / `formula` / `lint` move from `^16.x` to `^17.0.0-rc.0`. Two
  groups of v17 changes reach this repo, and they pull in opposite directions —
  the spec pruned surface objectui re-exported, and adopted surface objectui had
  been carrying locally.

  **The spec pruned dead Theme config (objectstack#3494), so the re-exports went
  with it.** `ThemeSchema` dropped `spacing`, `breakpoints`, `logo`, `density`,
  `wcagContrast`, `rtl`, `touchTarget` and `keyboardNavigation` — authorable but
  never enforced, so authoring them was already a silent no-op. `@object-ui/types`
  re-exported those sub-schemas _by reference_ (issue #2231), so they could not
  survive the prune without becoming hand-written mirrors — exactly the second
  de-facto contract AGENTS.md #0.1 forbids. Removed from the public surface:

  - Types: `Spacing`, `Breakpoints`, `DensityMode`, `WcagContrastLevel`,
    `ThemeLogo`, and the deprecated `SpacingScale` alias
  - Schemas: `SpacingSchema`, `SpacingScaleSchema`, `BreakpointsSchema`,
    `ThemeLogoSchema`, and the `SpacingSchemaType` / `BreakpointsSchemaType` helpers
  - `Theme.spacing`, `Theme.breakpoints` and `Theme.logo`

  `mergeThemes` no longer merges the three dropped keys. `generateThemeVars` is
  unaffected — it never emitted them, which is why the liveness audit called them
  dead. The one real consumer was `ThemeProvider`, which set the favicon from
  `theme.logo.favicon`; that path is gone, because v17 strips the key at parse and
  it could never arrive again. The live favicon is unaffected: it comes from
  operator branding (`getFaviconUrl()`), applied in the console's `index.html`,
  `main.tsx`, and on route change.

  Nothing else read the pruned types. In particular the list-density feature is
  untouched — `useDensityMode` and `rowHeightToDensityMode` use `@object-ui/core`'s
  own local `DensityMode`, which never came from the spec.

  **The spec adopted objectui's ListColumn extensions (objectui#2231), so the
  extension collapsed.** `ListColumnSchema` used to `.extend()` the spec with two
  fields, each carrying a note to promote it upstream rather than grow the
  extension; v17 did exactly that. `summary` is now the spec's
  `union([ColumnSummarySchema, ColumnSummaryConfigSchema])` — the same enum ∪
  `{ type, field }` form `useColumnSummary` reads — and `prefix` is the spec's
  `ColumnPrefixSchema`. `ListColumnSchema` is now a plain by-reference re-export.
  One behavior change rides along: `prefix.type` defaults to `'text'` on parse
  instead of staying `undefined`, so the cell renderer always gets a value.

  **Node 22 is now the floor.** Every `@objectstack` package declares
  `engines.node: ">=22.0.0"` (objectstack#3825; Node 20 reached EOL 2026-04-30).
  This repo claimed `>=20` and ran CI on Node 20.x, so it promised — and validated
  — a runtime its own core dependency does not support. `engines.node` is now
  `>=22`, CI runs Node 22.x, and the CI/deployment docs say so.

  The major stays 17: per AGENTS.md the major tracks `@objectstack`'s major, which
  is also 17, and that convention deliberately outranks semver purity — so the
  removals above ship as a minor rather than desyncing the two.

- 390c071: feat(record): declare inputs for the seven configurable record:\* blocks, and curate six

  Seven `record:*` blocks shipped with renderers that read props but declared no
  `inputs`. That combination is the worst of both: the renderer honours
  `limit`, `severity`, `location` …, while every authoring surface — the designer
  panel, the AI vocabulary, the generated manifest — reports the block takes no
  configuration. objectui#3013 recorded them as deliberately uncurated for
  exactly that reason.

  The declarations mirror what each renderer actually reads:

  | block                                  | inputs                                                                       |
  | -------------------------------------- | ---------------------------------------------------------------------------- |
  | `record:activity`                      | 11 — from `RecordActivityComponentProps`                                     |
  | `record:chatter` / `record:discussion` | 5 — from `RecordChatterComponentProps`                                       |
  | `record:alert`                         | 8 — severity, title, body, visible, icon, action, dismissible, dismissKey    |
  | `record:quick_actions`                 | 7 — actionNames, requiredPermissions, location, align, inline, variant, size |
  | `record:history`                       | 3 — limit, emptyText, unknownUserText                                        |
  | `record:reference_rail`                | 1 — hideEmpty                                                                |

  `inputs` describe what an AUTHOR writes, which is a subset of what the renderer
  reads. `entries`, `loading` and resolved `actions` are injected by the host
  shell off RecordContext; declaring them would invite a model to hand-write the
  data the page is supposed to fetch. `aria` is omitted for the reason it is
  omitted on `record:details` — an accessibility escape hatch, not a layout
  choice. `location` takes its enum from the spec's `ACTION_LOCATIONS` rather
  than restating it, per objectui#3019.

  Six of the seven are now in `PUBLIC_BLOCKS`: configurable and absent from the
  contract is the state objectui#3006 was about. The contract goes 36 → 42 tags,
  all resolving.

  `record:chatter` stays out — it is the same renderer as `record:discussion`
  under a Salesforce-familiar name, kept for schemas already in the wild. Two
  spellings of one block is ambiguity an authoring model cannot resolve, so the
  vocabulary carries the spec's name. A test compares the two input lists, so the
  day they diverge the exclusion stops being justified and fails.

  A companion assertion requires every curated `record:*` tag to declare inputs.
  A curated tag with none reads as "takes no configuration" when the renderer in
  fact reads props — the same gap objectui#3006 opened, pointed the other way.

- 912496d: feat(types,core): the `*Validation` rule types derive from spec 17, and the engine agrees with the server — objectstack#4115

  The five spec-named rule variants in `data-protocol.ts` were hand-written
  interfaces, each labelled `(ObjectStack Spec v2.0.1)` while the installed spec
  was `17.0.0-rc.0`. Nothing bound them to the spec, so fifteen majors of drift
  accumulated with `tsc` silent throughout and the comment still vouching for it.
  They are now `z.input` derivations of `ScriptValidationSchema` /
  `StateMachineValidationSchema` / `CrossFieldValidationSchema` /
  `ConditionalValidationSchema` / `FormatValidationSchema`, and canonicity is
  carried by that binding plus a parity gate rather than by a comment (#3017).

  `z.input`, not `z.infer`, because objectui consumes **authored** metadata as it
  arrives over `/meta` — before the spec applies its defaults and canonicalizes
  expressions. That is the shape actually in the JSON.

  **Breaking, in the shape of the rule types** (minor per this repo's version
  policy — see AGENTS.md §9):

  |                                   | was                                         | is                                                      |
  | --------------------------------- | ------------------------------------------- | ------------------------------------------------------- |
  | `ConditionalValidation`           | `condition` + `rules[]`                     | `when` + `then` / `otherwise`                           |
  | `FormatValidation`                | `pattern` + `flags`, 8 named formats        | `regex`, the 4 formats the server implements            |
  | `Script`/`CrossField` `condition` | `string`                                    | `string \| { dialect, source }`                         |
  | `StateMachineValidation`          | —                                           | gains `initialStates` (objectstack#3165)                |
  | `BaseValidation`                  | no `priority`, `events` included `'delete'` | gains `priority`; `'delete'` retired (objectstack#3184) |

  `UniquenessValidation` / `AsyncValidation` / `RangeValidation` are now
  `@deprecated`. They have no spec counterpart — the spec removed the first two
  deliberately (uniqueness → a unique index, since SELECT-then-INSERT is racy;
  async → the form layer) — and the spec's `ValidationRuleSchema` rejects all
  three, so no rule in those shapes can ride in `ObjectSchema.validations`.

  **`ObjectValidationEngine` now agrees with `objectql`'s rule-validator.** It is a
  client PRE-CHECK of rules the server enforces, so every disagreement cost the
  user something real. Fixed:

  - **Polarity was inverted.** The server violates a rule when the predicate is
    TRUE; the engine violated it when the predicate was FALSE. Every
    spec-authored `script` / `cross_field` rule produced the opposite verdict.
  - **Envelope conditions were a silent no-op.** `{ dialect, source }` reached
    `expression.trim()`, threw, was caught, and read as "passes".
  - **`conditional` was a silent no-op**, reading `rule.condition` / `rule.rules`
    where the spec says `when` / `then`; `otherwise` was never evaluated at all.
  - **`format` produced FALSE REJECTIONS** — it read `rule.pattern`, and
    `undefined.test(...)` threw into a catch that reported a violation, blocking
    writes the server accepts.
  - **An absent `active` disabled the rule** and an absent `events` threw; both
    arrive absent from `/meta` because the spec defaults them at parse time.
  - `priority` now orders execution; `initialStates` is enforced on insert;
    `format`/`state_machine` only fire when the write touches the field; a broken
    predicate or an uncompilable `regex` fails OPEN with a warning; and a rule type
    the engine cannot evaluate (the spec's `json_schema`) warns instead of
    reporting the record as valid.

  The default `SimpleExpressionEvaluator` is not CEL and never was; it now binds
  both the spec's `record.x` scope and objectui's historical bare `x`, and
  documents that richer predicates need a CEL-backed evaluator. `validateRecord`'s
  `event` parameter no longer accepts `'delete'`.

  Gates: `packages/types/src/__tests__/validation-rule-spec-parity.test.ts` (key
  sets, wire shapes, the pinned `then`/`otherwise` divergence with an inverted pin
  that fails when objectstack#4171 is fixed upstream) and the rewritten engine
  suite. objectstack#4115's ledger drops 120 → 115.

### Patch Changes

- b41f401: **Authoring types are input types (framework#4074 steps 2–3): `ActionParam` takes the spec's declaration forms, `ListViewSchema` stops promising parse-output defaults, and `FormField.dependsOn` matches its runtime reader.**

  Three public types said something different from what the platform accepts. All
  three divergences were found by making `packages/types`' tests compile (#3009)
  and then resolving the declared `p1-spec-alignment.test.ts` debt site-by-site
  instead of papering over it.

  **`ActionParam` is now the authoring shape, aligned with the spec's input.**
  `name` / `label` / `type` become optional and `field` / `objectOverride` appear:
  the spec's primary way to declare a param — a bare field reference that inherits
  label/type/validation/options from an object field — was unrepresentable while
  all three were required. The _resolved_ shape the dialog consumes (after
  app-shell's `resolveActionParams()` inlines the reference) remains
  `@object-ui/core`'s `ActionParamDef`, with all three required. Authoring and
  resolved are different types on purpose. `label` and option labels take the
  spec's `I18nLabel` by import — which the new compile-time guard promptly
  revealed to be aliased to plain `string` in the current spec (the per-locale
  record is the separate `I18nObject`), so this is not a behavioural widening
  today; importing the alias means objectui tracks any future widening
  automatically.

  **Breaking:** code destructuring `param.name` / `param.label` / `param.type` as
  guaranteed must now handle the field-backed form (or consume the resolved
  `ActionParamDef` instead, which is what dialog-side code should be doing).

  **`ListViewInferred` is `z.input`, not `z.infer`.** The spec sub-schemas that
  flow into the list-view surface (`userActions`, `tabs` → `ViewTab`, `sharing`)
  carry `.default()`s, so the inferred output type made fields like
  `userActions.refresh` or a tab's `pinned`/`visible` _required_ — but nothing on
  the render path ever runs `.parse()`: `normalizeListViewSchema` deliberately
  applies no defaults ("an absent flag stays absent", its own suite). The output
  type therefore rejected valid authored metadata (`userActions: { sort: true }`)
  while promising renderers defaults that never arrive. Typing the surface as
  input matches both the author and the runtime object. Code that _trusted_ those
  phantom defaults now gets an optionality error — which is a latent bug surfacing,
  not a regression: the value really could be absent.

  **`FormField.dependsOn` is `DependsOnInput`.** The runtime reader
  (`resolveCascadingOptions`) has always accepted a bare name, a list of names, or
  lookup-parameter entries `{ field, param }` — its parameter type says so. The
  public property said `string`, so array-authored metadata type-errored while
  working, and the form renderer read the key through `(f as any).dependsOn` to
  get past its own type. The shape now lives in `@object-ui/types` (single source
  of truth next to `FormField`), `@object-ui/core` imports and re-exports it, and
  the two `as any` reads in the components form renderer are typed.

  **The `p1-spec-alignment.test.ts` exclusion is gone.** Its 14 errors resolved:
  the two "sharing in ObjectUI format" tests and the legacy-ARIA-spelling fixture
  are deleted/rewritten — those dialects are _normalizer input_, folded by
  `normalizeListViewSchema` and asserted branch-by-branch in core's
  `normalize-list-view.test.ts`, the seam where the fold actually runs; asserting
  them on the canonical type only ever "passed" because nothing compiled the file.
  One fixture claimed a shape no surface ever admitted (an ObjectQL triplet as a
  spec `ViewTab.filter`) and was corrected to the rule-object form. Every test
  file in `@object-ui/types` is now compiled, with no exclusions.

  Discrimination-checked: reverting `ListViewInferred` to `z.infer`, `dependsOn`
  to `string`, or `ActionParam.name` to required each produces the expected
  compile error in the now-compiled test files (`TS2739` / `TS2322` / `TS2741`);
  restored, all projects are clean.

- 95b7214: fix(list,grid,detail,tree,core): every column resolver reads one key (#3104 PR2)

  PR1 (#3119) put a canonicalizing fold at ListView's ingestion boundary. This
  converges the 22 read sites themselves onto `columnIdentity()` from
  `@object-ui/core`, so a surface that is NOT downstream of that fold resolves
  the same identity anyway.

  That distinction is the user-visible part. A standalone `object-grid` node —
  authored directly on a page, with no `list-view` above it — never passed
  through `normalizeListViewSchema`. Its `getSelectFields` read `c.field` alone
  while the `ensureId` probe one line above read `f?.name || f?.field`, so a
  legacy `{ name: 'account' }` column reached `$select` as a literal `undefined`
  hole: the server never returned the field and every cell in that column came
  back empty. Same for `ObjectTree`, `RelatedList` and the `record:details` /
  `record:related_list` renderers.

  Converged:

  | Surface                                  | Was                                            | Now                                 |
  | ---------------------------------------- | ---------------------------------------------- | ----------------------------------- |
  | `ListView` ×9 + its 2 request builders   | `name \|\| fieldName \|\| field` vs `f?.field` | `columnIdentity()`                  |
  | `RelatedList` ×8                         | `accessorKey \|\| field \|\| name`             | `accessorKey \|\| columnIdentity()` |
  | `ObjectGrid`                             | name-first probe vs `c.field` projection       | `columnIdentity()`                  |
  | `ObjectTree`                             | `name \|\| fieldName \|\| field \|\| key`      | `columnIdentity() \|\| key`         |
  | `buildExpandFields`                      | `field ?? name ?? fieldName`                   | `columnIdentity()`                  |
  | `record-details` / `record-related-list` | `field \|\| name (\|\| key)`                   | `columnIdentity() (\|\| key)`       |

  `accessorKey` keeps its precedence in `RelatedList` — it is TanStack Table's
  column key, not ObjectStack metadata identity, and only the `field || name`
  tail was converged. `key` stays a tail fallback in `ObjectTree` and
  `record-related-list` for the same reason: it is a generic entry key.

  Two incidental fixes that TypeScript surfaced once the resolver stopped
  returning `any`: ListView's filter-field options and its hide-fields popover
  both built entries keyed `undefined` for a column with no resolvable identity.
  Those entries could never match a column; they are now dropped.

  **Inventory re-triage.** PR1 recorded 24 family members. Two were mis-classified
  and are reclassified here rather than converged — reading what they actually
  feed shows they are not column reads at all:

  - `ViewPreview.tsx` adapts a ViewItem **form** section to what `object-form`
    selects by (`field` → `name`) — the #3090 two-layer join.
  - `SchemaForm.tsx` renders an arbitrary metadata **array** into a popover
    summary and guesses at a display key; the entries are validations, actions,
    or whatever the JSON schema declares.

  So the family was 22, and it is now **0**. The ratchet asserts that, asserts
  each converged surface actually routes through the shared reader (a surface
  that dropped identity resolution instead of converging it goes red), and pins
  `accessorKey`'s precedence in `RelatedList`.

- 7d9734d: feat(core): say which column identity key won, out loud (#3104 PR3)

  Closes the battle opened in #3104. PR1 (#3119) put the canonicalizing fold at
  ingestion; PR2 (#3122) converged all 22 read sites onto `columnIdentity()`.
  This is the audible half.

  A column carrying two identity keys that **disagree** — `{ field: 'account',
name: 'account_name' }` — now logs a one-time dev-mode warning naming which key
  won and what to change:

  ```
  [ObjectUI] Column carries two identities: `field: 'account'` and
  `name: 'account_name'`. `field` wins — it is the only key `ListColumnSchema`
  declares — and `name` has been rewritten to match, so the rendered column and
  the requested field agree. Fix the producer: drop `name` and author `field`
  only. (objectui#3104)
  ```

  The fold making the two halves agree is what stops the bug, but silently
  rewriting `name` to match `field` also hides that the producer is emitting a
  contradiction. The renderer recovering is not the same as the metadata being
  right, so the recovery says so.

  Deliberately narrow:

  - **Only contradictions.** A legacy-only column (`{ name: 'stage' }`) is legacy,
    not conflicting — it is stamped without noise.
  - **Warn once per (identity, conflicting spelling).** Columns are re-normalized
    on every render; a warning that floods the console is a warning that gets
    muted. Keyed by the pair rather than the identity alone, so a column carrying
    two different stale spellings reports both — the author needs to fix every
    producer, not just the first one seen.
  - **Silent under `NODE_ENV=production`**, and the fold still runs there.

  `resetColumnIdentityWarnings()` is exported for tests.

  **No lint rule, and that is a measured decision.** #3104 asked for
  `no-restricted-syntax` on `.field ?? .name` to be evaluated on its
  false-positive rate first. With the family at zero, all 12 remaining scanner
  hits are legitimate — a syntactic rule cannot tell a two-layer join from a dual
  read, because the distinction is what the keys mean in that layer, not how the
  expression is spelled. Adopting it would mean 12 inline disables on correct
  code, which trains the next author to reach for the disable. The ratchet carries
  a `verdict` and a `why` per site instead, so a new hit gets triaged rather than
  silenced. The evaluation is written into the ratchet's header.

  **Ledger item resolved with no change needed.** #3104 flagged `ListColumn` for
  disposition under objectstack#4115 (spec-named symbols must be imports, not
  declarations). `ListColumnSchema` is already a by-reference re-export of
  `@objectstack/spec/ui`, and `spec-subschema-parity.test.ts` already pins it by
  reference identity — the only check that distinguishes a re-export from a
  faithful fork. Already compliant; nothing to do.

- aebfa4f: chore(core): deprecate `ObjectValidationEngine` — rule enforcement stays single-implementation on the server (#3110)

  `ObjectValidationEngine` / `defaultObjectValidationEngine` / `validateRecord` are
  now `@deprecated`. **Nothing is removed and no behaviour changes** — existing
  callers keep working exactly as they did after #3103.

  **Why.** Object-level validation rules are _enforcement_, and enforcement is
  single-implementation on the server (`objectql`'s rule-validator). objectui
  already draws that line for the predicates it _does_ evaluate client-side:
  `evaluator/fieldRules.ts` handles the presentation predicates (`visibleWhen` /
  `readonlyWhen` / `requiredWhen`) by delegating to the canonical
  `ExpressionEngine`, "rather than re-implementing a parallel evaluator"
  (ADR-0036). This engine was that parallel evaluator, on the enforcement side.

  #3103 converged its semantics onto the server rule-for-rule, with eight
  mutation-tested gates — and still left a known divergence: the server carries
  ADR-0113's legacy-violation exemption (reject only when the merged state violates
  _and_ this write makes it worse), which this engine does not implement. Editing
  an unrelated field on a legacy row would be blocked here and accepted there. One
  careful pass still left a gap, which is the argument: mirroring cross-repo
  behaviour is structurally unreliable, not unreliable-this-time.

  **What to use instead.** Let the write fail and render the server's rejection —
  it is already structured (`field` / `code` / `message`, plus a label since
  objectstack#3957). For pre-submit feedback, the answer is a validate-only
  (dry-run) write on the server: identical UX, zero parity risk, and it covers the
  two rule kinds a client can never check — `unique` (needs the database) and
  `json_schema` (ajv lives server-side).

  **The decision is a mechanism, not a comment.** What #3103 removed was a doc
  comment claiming spec canonicity that had been false for fifteen majors;
  shipping its successor as another comment would repeat the mistake one level up.
  `validation-engine-stays-unwired.test.ts` scans `packages/*/src` and fails if a
  production module starts referencing the engine, naming the file and the issue to
  reverse first. Barrels still re-export it — publishing a deprecated API is not
  wiring — and host applications are free to keep importing it.

  The five spec-derived rule TYPES in `@object-ui/types` are unaffected: they are
  the anchor for objectstack#4115's ledger and are independent of whether objectui
  ships an engine.

- c4d7b20: fix(view,list,core): a view's filter no longer disappears, or arrives as a predicate on columns that don't exist

  Sweeping the other `$filter` producers after #3078 turned up two live defects in
  `ObjectView`, which fetches its own data for calendar / kanban / gallery /
  timeline (grid delegates to `ObjectGrid`).

  **1. An object filter was dropped, and only for non-grid views.**
  `table.defaultFilters` is declared `Record<string, any>`, and the merge tested
  `baseFilter.length > 0` — `undefined > 0` for an object. So the filter vanished
  and the view returned **every record**. `ObjectGrid` assigns the same value
  straight to `params.$filter`, so one view definition filtered correctly as a
  grid and returned everything as a calendar.

  **2. Rule objects were spread into the `and`, not wrapped.**
  `['and', ...baseFilter, ...userFilter]` is only correct when the source is an
  array of AST nodes. `activeView.filter` is a spec `ViewFilterRule[]`, so
  spreading put bare rule objects where the AST expects nodes:

  ```js
  isFilterAST([
    "and",
    { field: "stage", operator: "eq", value: "won" },
    ["owner", "=", "me"],
  ]);
  // false → 400 since objectstack#4121
  parseFilterAST(same);
  // {$and:[{field:'stage',operator:'eq',value:'won'}, {owner:'me'}]}
  ```

  That second line is a predicate over three columns named `field`, `operator`
  and `value` — which don't exist.

  > **Correction.** The first version of this note said the spread was "reachable
  > whenever a view with a filter meets a user filter value". That was wrong for
  > `ObjectView`: the branch required a non-empty user filter, and nothing ever
  > wrote the state it was built from, so it could never run. The shape is
  > genuinely broken — a live server answers it with a 400 — and the adapter-level
  > defence added alongside is still warranted for any producer that emits it, but
  > **this particular site was dead code, not a live defect.** Defect 1 above was
  > live: it sat on the always-taken path. The dead machinery behind the wrong
  > claim is removed in a follow-up.

  New in `@object-ui/core`: `toFilterNode` normalizes one source (rule array / AST
  / MongoDB object) and `mergeFilterNodes` combines sources as siblings under one
  `and`. `ObjectView` and `ListView.buildEffectiveFilter` both use them, so the
  three filter shapes are reconciled in one place instead of by hand at each
  renderer.

  `ObjectStackAdapter` also now translates a bare rule object sitting directly
  under a logical node — the chokepoint defence for any producer still emitting
  the spread shape. Only rule-_shaped_ objects are touched; a child with no
  `field` is a genuine MongoDB condition and passes through untouched.

  **Correcting a comment shipped in #3078.** `buildEffectiveFilter` documented the
  dropped-object case as unreachable, "nothing in this repo produces one for a
  list view". That was wrong: `ObjectView` passes `mergedFilters` straight into
  that schema's `filter`, and its last fallback is `table.defaultFilters`. The
  case is now handled rather than explained away.

  Verified with 19 tests across the four packages; reverting each source file
  fails the ones that cover it. Emitted filters are asserted against the spec's
  own `isFilterAST` / `parseFilterAST`, including an executable pin on what the
  old spread shape produced.

- 6f29aa5: fix(grid): a legacy string row action runs instead of green-toasting a no-op — objectui#2960

  A list view declaring `rowActions: ['convert_lead']` rendered a menu item that
  performed **zero network requests** and reported success. Where the object also
  declared the same action with `locations: ['list_item']`, the row menu showed a
  working entry and a dead duplicate of it side by side.

  **The name never became an action.** `ObjectGrid` dispatched the legacy form as
  `{ type: <action name>, params: { record } }` — the action _name_ landing in the
  runner's `type` slot, never resolved against the object's action defs. It
  matches no built-in type and (absent a handler registered under that exact name)
  no handler either, so it fell through to `ActionRunner.executeActionSchema`,
  which returned `{success: true, reload: true, close: true}` for a schema with
  nothing in it. `handlePostExecution` then fired the green "Action completed
  successfully" toast.

  Two changes, either of which would have surfaced the bug:

  **① `ObjectGrid` resolves legacy names against `objectDef.actions`.** A name
  that matches a declared action is promoted to that def and dispatched through
  the same path as a `list_item` action — so it actually runs, and it picks up the
  def's label, `visible`/`disabled` predicates, param dialog and capability gate,
  none of which the string form could carry. A name that matches an action already
  rendered as a def is dropped, which is what removes the dead twin. Names that
  resolve to nothing are still dispatched by name, since a consumer may have
  registered a runner handler under exactly that name.

  **② `ActionRunner`'s empty-schema fallthrough fails loudly.** It no longer
  reports success for an action it never ran: a dispatch with no registered
  handler and no `api`/`endpoint`/`navigate`/`redirect`/`onClick` returns a
  failure naming the action. Schema-only shapes that _do_ declare something — a
  bare `redirect`, an explicit `reload`/`close` — run exactly as before.

- ad0183a: fix(data-objectstack,core): an object filter no longer depends on whether the query expands a lookup

  #3072 single-sourced the ARRAY branch of the adapter's two `find()` routes. The
  object branch was left as it was: `convertQueryParams` converted a MongoDB-style
  filter to AST while `translateFilterToAST` returned it verbatim — so the same
  `$filter` went out in two formats, decided by whether the query happened to
  expand a lookup.

  Measured across 21 operator shapes, **four diverged**. Most of the gap turned
  out to be harmless — `{$and: […]}` survives the plain route as a
  `['$and','=',[…]]` comparison that `parseFilterAST` reads back as a real `$and`,
  and `$exists` vs `$null` is a difference the server treats identically. Two were
  not harmless:

  - **The unknown-operator guard only ran on one route.** `convertFiltersToAST`
    throws on an unrecognised operator, with a comment saying it does so "to avoid
    silent failure" — but the expanded route never called it, so a typo'd operator
    threw on a plain read and shipped silently whenever a lookup was expanded.
  - **`$regex` was silently rewritten to `contains`.** `$regex: 'a.c'` matches
    "abc"; `contains 'a.c'` matches only those three literal characters. That is a
    _different question_, not a weaker version of the same one, and neither result
    looks wrong on screen. The rewrite sat behind a `console.warn`, which is not
    an error channel in a deployed app — and the function's own unknown-operator
    message never listed `$regex` among the supported set. The spec has no
    `$regex` (`FILTER_OPERATORS`, `data/filter.zod.ts`), so there is nothing to
    translate it into: it is now refused, the same treatment the neighbouring
    unknown operator already got. Nothing in the repo depended on the conversion.

  Both refusals now throw `FilterOperatorError`, carrying `code: 'INVALID_FILTER'`
  / `httpStatus: 400`. The pre-existing unknown-operator throw was a bare `Error`,
  which `classifyLoadError` classifies as a network fault — so a malformed filter
  told the user to check their connection (#3066), the one thing it definitely
  was not.

- aa1240a: fix(sdui): lazily-registered public blocks reach a `kind:'react'` page's scope, and ReactRunner keeps the errors it catches

  Two defects in the trusted `kind:'react'` page tier.

  **objectui#2953 — the contract skipped lazy blocks.** `getPublicConfigs()`
  resolved every curated `PUBLIC_BLOCKS` tag through `getConfig()`, which reads
  loaded registrations only, so a block registered with `registerLazy()` was
  absent from the contract until its plugin chunk happened to be imported. In
  `apps/console` that silently dropped `object-kanban`, `object-calendar`,
  `object-gantt`, `object-timeline`, `object-map` and `markdown` from every react
  page's scope — writing `<ObjectKanban/>` threw `ReferenceError` even though the
  tag is a first-class contract member, and whether it threw depended on load
  order. `getPublicConfigs()` now resolves pending lazy stubs too, returning them
  with `lazy: true` and no `component` (new `PublicComponentConfig` type); the
  injected wrapper renders through `SchemaRenderer`, which triggers the loader and
  shows its placeholder. `getConfig()` stays loaded-only by design.

  **objectui#2954 — ReactRunner discarded its own error state.**
  `getDerivedStateFromProps` re-transpiled and re-evaluated the page source on
  every render and unconditionally set `error: null`. React runs it before the
  re-render that follows `getDerivedStateFromError`, so the boundary threw away
  the error it had just caught, rebuilt an identical throwing element, and the
  throw escaped past its own `fallback` to the renderer's generic panel; `onError`
  was gated on state that had already been cleared and never fired for a
  compile-time error at all; and each compile minted a fresh page function — a new
  element type — that remounted the subtree and wiped the page's `useState`. The
  transpile+eval is now memoised on `(code, scope)`, errors persist until the
  inputs actually change, and `onError` reports each error exactly once.

- d10f526: fix(sdui): the curated contract lists `record:line_items`, the tag that actually resolves

  `PUBLIC_BLOCKS` carried `line_items` — the bare tag. `@object-ui/plugin-form`
  registers the block as `record:line_items` with `skipFallback: true`, which
  exists precisely so the bare name is _not_ claimed, so that key never existed
  and the curated entry could never resolve. Its four siblings in the list are all
  `record:`-prefixed, and plugin-form's own comment says "Register
  record:line_items"; the bare spelling was a slip.

  The effect was a block that has shipped all along — a full renderer, a label,
  five declared `inputs` — being absent from the public contract, from the JSX
  type surface, from the generated manifest, and from every `kind:'react'` page's
  scope. It read as an unimplemented aspirational entry, which is how it was
  recorded when objectui#2979 added the contract-coverage guard.

  With the tag corrected the contract has no gaps left: all 36 curated tags
  resolve in the console, `record:line_items` among them with its full `inputs`.
  The guard's known-unimplemented list is now empty and stays asserted, so the
  next entry that cannot resolve surfaces instead of being explained away.

- 2d5d594: fix(list,detail): sorting a lookup column no longer orders by an invisible key — #3096

  A relational column (`lookup` / `master_detail` / `user` / `tree`) never holds
  the string its cell shows: it holds the `$expand`-ed record, or a raw foreign-key
  id whose label was resolved separately. Every sort path took that raw value as
  its key, so the column of names came back in an order with no relation to the
  names — sorting looked broken, with nothing saying the key was something else.

  The two halves are fixed differently, because they can order by different things:

  - **Client-side sorts** (grid column headers, any `data-table`, a non-windowed
    related list) now key off the label the cell renders, via the new
    `getSortValue` / `compareSortValues` in `@object-ui/core` — which resolves an
    expanded record through `getRecordDisplayName` (ADR-0079), so the sort key and
    the lookup cell agree on which field names a record. This replaces two broken
    comparators: `a[col] < b[col]` is always false between two objects (the
    comparator collapsed to a constant and permuted the rows), and
    `String(a[col])` is `"[object Object]"` (every row compared equal, so the sort
    silently did nothing).
  - **Server `$orderby` sorts** cannot be fixed here — the key is the stored id by
    construction, and `objectstack#4256` settled that no relation join is coming.
    So those entry points stop offering the illusion: the ListView toolbar sort
    picker withholds relational fields and explains why (pointing at a formula
    field as the supported way to sort by a related name), and a windowed related
    list renders no sort button for them.

  A relational field the view's CURRENT sort already uses stays listed, labelled
  `(by ID)`, so view metadata authored or saved with such a sort round-trips
  instead of rendering a blank row and losing the sort on the next edit.

- 7f23cd0: fix(form): a numeric/boolean select option survives selection with its type intact — #3090

  `SelectOptionSchema.value` has accepted `string | number | boolean` for as
  long as it has existed, but the Radix controls underneath speak strings:
  picking `{ value: 2 }` silently submitted `"2"` — a wrong-typed write into a
  number field that nothing on the client ever reported. (Display half-worked:
  a numeric default matched its numeric item; only SELECTION morphed the type.)

  The renderers now stringify on the way into the control and map the selection
  back to the AUTHORED option value on the way out (`matchOptionValue`), across
  the in-form select, the standalone `type: 'select'` component, and the
  standalone `type: 'radio-group'` component. The TS types stop lying to match:
  `SelectOption.value` / `RadioOption.value` and the corresponding
  `value`/`defaultValue`/`onChange` channels widen to what the zod schemas
  always accepted — a call site treating `option.value` as `string` is now a
  compile error pointing at a real latent crash, not a false comfort.

  The ripple the widening named, handled at each boundary: `@object-ui/core`'s
  `OptionLike.value` widens (the option engines compare by identity, so values
  flow opaquely; the option-lint's CEL-literal domain stringifies at its
  boundary), and the multi-value field widgets (checkboxes / multiselect /
  radio) stringify at theirs — multi-value fields store string arrays.

  Round-trip pinned by real Radix interactions in jsdom: the in-form select
  submits `2` (number), the standalone select hands its handler `false`
  (boolean).

- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [38ca8be]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ce08d55]
- Updated dependencies [2374a49]
- Updated dependencies [ea7f477]
- Updated dependencies [7f23cd0]
- Updated dependencies [24e0e0a]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [9867281]
  - @object-ui/types@17.1.0

## 17.0.0

### Minor Changes

- f9bbddb: feat: gate detail/form edit & delete on the server's effective operation set (#3546)

  PR-4 (#3391) wired the **list/toolbar** surface (ObjectView Import, ListView /
  ObjectGrid Export) to the server-resolved effective API operation set
  (`/me/permissions` `apiOperations`, intersected via
  `resolveCrudAffordances(obj, effectiveApiOperations?)`). The **detail / form**
  surfaces still gated edit/delete on the bucket + `userActions` alone. This
  extends the same intersection to them, so the record page and its forms never
  offer an operation the server would 405.

  - **core** `isObjectInlineEditable(obj, effectiveApiOperations?)` gains the same
    optional second argument as `resolveCrudAffordances` — inline-edit is now
    additionally ANDed with the server allowing `update`.
  - **app-shell** `RecordDetailView` threads the object's effective operations into
    the synthesized Edit/Delete header actions and the record-body inline-edit
    gate (`canEdit`); `RelatedRecordActionsBridge` intersects each **child**
    object's Create/Edit/Delete handlers with that child's own effective set.
  - **plugin-detail** `record:details` ANDs its inline-edit affordance with the
    object's effective `update`.
  - **plugin-form** `ObjectForm`'s blanket managed-object field lock also engages
    when the server denies `update` (edit mode) / `create` (create mode).

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no `PermissionProvider`) leaves the resolved affordance untouched —
  the bucket/`userActions` decision wins, exactly as today. Layers on top of the
  existing per-object `check('edit')` / `check('delete')` permission gates
  (intersection, never union).

- 2735de6: feat: render the server's effective API operation set (#3391 PR-4)

  The frontend now consumes the per-object **effective API operation set** the
  server resolves (from `/me/permissions` `apiOperations`, framework #3391) —
  never the raw `apiMethods` — so Import/Export/New/Edit/Delete buttons match what
  the server will actually admit, and a 405 import refusal shows a dedicated
  message instead of silently falling back.

  - **core** `resolveCrudAffordances(obj, effectiveApiOperations?)` — new optional
    second argument intersects each affordance bit with its API operation
    (create/import→create/import, edit→update, delete→delete, exportCsv→export).
    Omitting it (old backend / no effective set) leaves affordances unchanged.
  - **permissions** — `/me/permissions` response carries per-object
    `apiOperations`; `PermissionContextValue.getObjectApiOperations(object)`
    exposes it (undefined when absent → callers keep current behavior); `check()`
    maps `import→allowCreate`, `export→allowRead`.
  - **app-shell** `ObjectView` intersects its toolbar affordances with the object's
    effective operations (Import); the platform-admin identity-import bypass is
    unaffected.
  - **plugin-list** `ListView` / **plugin-grid** `ObjectGrid` gate the Export
    button (and export handler) on effective `export`; `plugin-grid` gains the
    `@object-ui/permissions` workspace dependency.
  - **plugin-grid** `ImportWizard` — a 405 / `OBJECT_API_METHOD_NOT_ALLOWED`
    import refusal is detected by a new `isImportNotAllowed` predicate at every
    catch site (async, sync, dry-run) and STOPS with a dedicated
    `grid.import.notAllowed` message (10 locales + fallback dict) — it never falls
    back to the sync/legacy path (which 405s too), distinct from the 404
    route-absent fallback.

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no permission provider) preserves the current default-allow
  behavior everywhere.

- cd09a7b: refactor(views): ListView reads the spec-canonical `columns`, with legacy `fields` folded in one normalizer (#2890 scope A step 1)

  `ListViewSchema` has been derived from `@objectstack/spec/ui` since #2231, but
  the renderer still spoke objectui's own vocabulary for the same concepts. First
  rename closed: **`fields` → `columns`**.

  Legacy acceptance does not disappear — stored view metadata in user databases
  carries `fields` — but it now lives in exactly one place instead of being
  re-implemented per read-site:

  - **New `normalizeListViewSchema` (`@object-ui/core`)** folds `fields` into
    `columns` (canonical wins when both are present) and drops the legacy key, so
    a read-site that was missed fails loudly instead of quietly taking the legacy
    path. It also absorbs the `viewType` renderability default ListView applied
    inline. Non-mutating, idempotent, and returns its input by reference when
    there is nothing to fold, so ListView's downstream memos keep a stable
    dependency identity.
  - **`ListView` normalizes once at the component boundary**, before anything
    reads the schema. This is what guarantees the fold runs: nothing on the render
    path parses view metadata through zod (the zod schemas serve the CLI
    validator, the VS Code extension and tests), so a `z.preprocess` on
    `ListViewSchema` — spec-side or local — would never execute.
  - **Producers emit `columns`**: `ObjectView`'s `renderListView` payload,
    `ObjectDataPage`, `InterfaceListPage` and the `list-view` registry defaults
    had been _downgrading_ already-canonical `columns` config back to `fields`.

  Two latent inconsistencies go away with it: the filter builder's
  objectDef-not-loaded fallback now resolves `ListColumn.field` (it read only
  `name`/`fieldName`, so object-form columns produced unnamed filter entries), and
  the column list no longer depends on which of the two keys a host happened to
  emit.

  `fields` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — it is still valid input, and `@objectstack/spec`'s `react-blocks.ts`
  sanctions it as the React-tier `<ListView fields>` prop — but it is input-only.

- f1abf0e: fix(views): ListView reads the spec-canonical `filter`, so a view's base filter reaches every visualization (#2890 scope A step 4)

  Third rename in the ListView vocabulary migration: **`filters` → `filter`**. Unlike
  the first two this closes a live bug, because the fork was asymmetric.

  `ListView` was the **only** surface in the repo reading `filters`. Every child
  view — `ObjectGrid`, `ObjectGallery`, `ObjectKanban`, `ObjectCalendar`,
  `ObjectGantt`, `ObjectMap`, `ObjectTree`, `ObjectChart` — reads `filter`, and
  `ListView` handed them `filters`. Wherever a child fetches its own rows instead
  of receiving `ListView`'s, the view's base filter was silently dropped:

  - **a `chart` list view aggregated the whole object.** The chart branch built an
    `object-chart` node with `filters:`; `ObjectChart` reads `schema.filter` and
    never read `filters`, so a chart view with a base filter charted unfiltered
    totals.
  - the same applied to any of the other view components rendered standalone from
    a list-view-shaped config.

  Conversely, a **spec-authored** list view — one carrying `filter`, which is what
  the spec says and what `runtime-metadata-persistence` and "Save as view" already
  persist — rendered **unfiltered** in `ListView`, because nothing read that key.

  The fold is a key rename only. Both keys carry an ObjectQL FilterNode array
  everywhere in objectui; every consumer passes the value straight to `$filter`.
  (The spec types `filter` as `ViewFilterRule[]` — `{field, operator, value}`
  objects — so objectui's field is typed from the spec but used as something else.
  That mismatch is real and left alone here: converting formats inside a
  vocabulary fold would change what reaches the data source.)

  Also collapses a duplicated computation in `app-shell`'s `ObjectView`, which
  computed the same effective filter **twice** — once as `filter` for the child
  views, once as `filters` for `ListView` — with the two copies subtly different
  (only one fell back to `listSchema.filter`; only the other ran token
  substitution over the URL filters). There is now one computation, keeping both
  behaviors.

  `filters` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — stored views carry it and it is still valid input — but it is input-only.

- f05b84e: refactor(views): ListView resolves density from the spec-canonical `rowHeight` (#2890 scope A step 2)

  Second rename in the ListView vocabulary migration: **`densityMode` → `rowHeight`**,
  folded in the same `normalizeListViewSchema` that step 1 introduced.

  Unlike `fields`/`columns` this is not a pure alias — the two vocabularies are
  different sizes. The spec has five row heights (`compact`/`short`/`medium`/
  `tall`/`extra_tall`); ListView's toolbar offers three densities
  (`compact`/`comfortable`/`spacious`). Both directions now live in one place as
  `DENSITY_MODE_TO_ROW_HEIGHT` / `ROW_HEIGHT_TO_DENSITY_MODE`, chosen so a fold
  followed by a read is a round trip (`spacious` → `tall` → `spacious`), with the
  narrowing collapse (`short` → `compact`, `extra_tall` → `spacious`) stated once
  instead of being re-derived per call site.

  Two behavior fixes fall out of it:

  - **Precedence is no longer inverted.** `ListView` read `densityMode` _first_, so
    a view carrying both keys rendered the legacy value — backwards from every
    other legacy/canonical pair in the schema. The canonical key now wins.
  - **The toolbar stops re-seeding the legacy key.** `ObjectView`'s
    `onDensityChange` persisted `densityMode` into stored view metadata on every
    density toggle, so the legacy vocabulary kept regrowing underneath the
    migration. It persists `rowHeight` now.

  `densityMode` stays declared on `ListViewSchema` and in the drift guard's
  sanctioned set — stored views carry it and it is still valid input — but it is
  input-only.

### Patch Changes

- 7b35e4b: fix(dashboard,charts): resolve `{current_user_id}` in widget filters (framework #3574)

  A dashboard widget filtered on `{current_user_id}` rendered `0`. The token
  reached SQL as a literal, matched no row, and nothing was logged on the client
  or the server — a silent zero that reads as "you have no work" rather than
  "this filter did not resolve". The same token in a list-view filter resolved
  correctly, so a user-scoped list and a user-scoped widget over the same data
  disagreed.

  There was no shared resolver. Three ad-hoc implementations had grown up
  independently — `ObjectView` for list views, `ObjectDataPage` for URL filter
  triples, `NavigationRenderer` for hrefs — and each understood only the filter
  shape its own surface used. `ObjectView`'s opened with
  `if (!Array.isArray(filter)) return filter`, so it could not have been reused
  by dashboard widgets even in principle: widget filters are MongoDB-style
  objects. Widgets therefore got no resolution at all — `DatasetWidget` called
  `resolveDateMacros` and nothing else, which is why `{today}` worked in a widget
  and `{current_user_id}` silently did not.

  - **`@object-ui/core`** — new `utils/filter-tokens.ts` with
    `resolveContextTokens` and `resolveFilterPlaceholders`. The latter expands
    _every_ placeholder vocabulary in one call and is what surfaces should use;
    resolving only some of them is the whole defect. The walk handles arrays and
    plain objects uniformly, so one resolver covers both platform filter shapes.
  - **`@object-ui/react`** — new `FilterScopeProvider` / `useFilterScope`. The
    renderer packages deliberately do not depend on `@object-ui/auth`, so the
    shell supplies the session values. This is a separate context from
    `PredicateScopeContext`, which is the expression evaluation scope and carries
    no organization.
  - **`@object-ui/plugin-dashboard` / `@object-ui/plugin-charts`** — all six
    widgets that previously resolved date macros only now resolve both
    vocabularies: `DatasetWidget`, `ObjectMetricWidget`, `ObjectDataTable`,
    `ObjectPivotTable`, and `ObjectChart` (dataset-bound and inline paths). The
    chart's `compareTo` comparison filter gets the session pass too — otherwise
    the overlay series silently ignored the owner clause the primary series
    honoured.
  - **`@object-ui/app-shell`** — `ObjectView`'s local `substituteFilterTokens`
    and `ObjectDataPage`'s inline `=== '{current_user_id}'` ternary now delegate
    to the shared resolver, so both also gain `{current_org_id}` and date macros.
    Two of the three ad-hoc implementations are gone rather than joined by a
    fourth.

  An unresolvable token is left intact rather than dropped: leaving it yields an
  empty result, whereas dropping the clause would _widen_ the result set and show
  a signed-out viewer everyone's data. It is no longer silent — the resolver
  warns, naming the token, and suggests the intended spelling for known
  near-misses (`{current_user}`, `{user_id}`, `{organization_id}`). Authoring-time
  enforcement lands separately as `filter-token-unknown` in `@objectstack/lint`.

- e16ed2d: fix(dashboard,charts): send widget `dateGranularity`/`sortBy`/`limit` to the query, and give funnels a real stage order (framework#3588)

  `DatasetWidget` never read `widget.options`. Four keys an author writes there
  change the query the server compiles, so a widget declaring
  `options: { dateGranularity: 'month' }` grouped by the raw timestamp and drew
  one bar per record, and `sortBy`/`sortOrder` produced no ordering at all.

  - `DatasetWidget` lowers `options.dateGranularity`, `options.sortBy` +
    `options.sortOrder`, and `options.limit` into the `DatasetSelection` it posts.
    A `sortBy` naming something the widget does not project is dropped rather than
    sent, so a stale sort key left by an edit degrades to "unordered" instead of
    failing the widget against the server's stricter validation. These keys also
    join the refetch signature, so editing one in the designer refetches instead
    of re-rendering the previous grid.
  - Funnel stages follow a **declared order**. `AdvancedChartImpl` sorted funnel
    segments by value descending, unconditionally — which overrode any server
    ordering and rendered a sales pipeline as a tidy narrowing shape whatever the
    stages' real sequence, hiding the very anomaly (a bulge at Proposal) the chart
    exists to show. It now honours a `categoryOrder`, which `DatasetWidget`
    derives from the dimension field's picklist option order — the pipeline order
    an author already declared on the object — or from an explicit
    `options.stageOrder`. With no declared order the value-descending default is
    unchanged, and a category missing from the order is kept (after the declared
    ones), never dropped.
  - New `@object-ui/core` helpers `buildCategoryOrder` / `buildCategoryRank`,
    keyed by both the stored value and the display label like the existing
    `buildOptionColorMap`, so ordering works whether or not the server resolved
    the dimension's labels.

  Requires the framework-side fix in objectstack#3588 for the selection keys to
  take effect server-side.

- 53642d4: fix(core,fields): a string `$orderby` is a clause, not a character array — and localize the sharing-rule widgets (objectstack#3821)

  **The recipient picker listed nothing, ever.** `QueryParams['$orderby']` was
  typed as `Record | string[] | SortObject[]`, so `queryParamsToRecord` sent any
  non-array value through `Object.entries`. Handed the clause string `'name asc'`
  — which callers do build by hand — it walked the string index by index and
  emitted `$orderby=0 n,1 a,2 m,3 e,4 ,5 a,6 s,7 c`. The server sorted by columns
  that don't exist and every row was filtered out, so
  `sys_sharing_rule.recipient_id` rendered "No matches" for every recipient type
  and no sharing rule could be created from the Console. `ObjectGrid` builds the
  same shape from a schema-level `sort` in three places, so grids with a string
  sort silently showed an empty table.

  A string `$orderby` is now passed through verbatim (the server's OData
  normalizer has always parsed `'name asc'`), and the type admits `string`.
  `RecipientPickerField` additionally switched to the structured
  `{ name: 'asc' }` form so it can't regress this way against any data source.

  **The three sharing-rule authoring widgets never had translations.**
  `ObjectRefField`, `RecipientPickerField` and `FilterConditionField` hardcoded
  their English copy — a Chinese Console showed "Select an object", "Select a
  user", "Search…", "No matches", "Edit as JSON". They now go through
  `useFieldTranslation` like every other widget, with keys added under `fields.*`
  in all ten locales.

  The recipient placeholder was the interesting one: it read
  `` `Select a ${recipientType.replace(/_/g,' ')}` ``, interpolating the enum
  value into an English sentence — a shape no locale can translate. It is now a
  per-type key (`fields.recipient.selectUser`, `…selectBusinessUnit`, …), so
  "选择业务单元" and "Select a business unit" no longer have to share a structure.

  **Editing a rule silently dropped its recipient.** The picker resets the stored
  id when `recipient_type` changes, because an id valid for a user is meaningless
  for a team. It treated the edit form's `'' → 'user'` hydration as such a change:
  opening any saved rule blanked the recipient, and saving persisted the blank.
  Only a non-empty predecessor now counts as a type switch.

  **Building a filter submitted the surrounding form.** None of `FilterBuilder`'s
  controls declared `type="button"`, and a bare `<button>` inside a `<form>`
  defaults to `type="submit"`. Adding, removing or clearing a condition therefore
  submitted the sharing-rule dialog — firing validation mid-edit, and on an
  already-valid form saving the record before the admin was done.

  **A rejected write showed the user raw server diagnostics.** The form rendered
  `error.message` verbatim, so a sharing / RLS denial reached the dialog and the
  toast as `FORBIDDEN: insufficient privileges to update showcase_private_note
pi-TgoJ4_DM55Fqz` — untranslated, and leaking the object's machine name and the
  record id to whoever hit it. Permission failures now render localized copy
  (`form.noPermissionToSave`, added in all ten locales), with the server text kept
  on the console for debugging; other failures still show the server's message,
  which is the useful part, and fall back to `form.submitFailed` when there is
  none — replacing the previously hardcoded English "An error occurred during
  submission".

  **The detail header offered "Edit" on records the user may only read.** Object
  permissions can't express "this one record is read-only" — a read-only sharing
  grant sits inside an object the user may otherwise edit — so the header showed
  the primary Edit CTA, opened the form, and let the user retype a field before
  the server rejected the save. `DetailView` now gates Edit / Delete on the
  object-level check AND on the explain engine's record-grained verdict
  (`POST /api/v1/security/explain` with a `recordId`, ADR-0090 D6 / ADR-0095 C2 —
  the same pipeline the enforcement middleware runs, so button and server cannot
  disagree). Explaining oneself needs no special permission. The probe is one
  cached request per record, skipped entirely when the object-level check already
  says no, and **fails open** on every uncertainty — an unanswered hint must never
  be the reason a permitted user cannot act; the server stays the authority
  (ADR-0057 D10).

  **A long option rendered straight past the combobox border.** `Combobox`'s
  trigger pinned itself to the component's `w-[200px]` default while the fields
  around it ran the full form column, and the selected label was a bare text child
  of a flex button — flex items need `truncate` AND `min-w-0` to clip, and it had
  neither. So "成员 (showcase_project_membership)" in the object picker overflowed
  the control and collided with the field beside it. The label now truncates, the
  trigger can shrink, the dropdown matches the trigger's width instead of a
  hardcoded 200px (a widened combobox used to clip its own options), and the two
  sharing-rule pickers ask for `w-full` so they line up with every other input.

  Hardens `evaluatePermission` while there: a role config carrying only
  `fieldPermissions` (no `actions`) made `check()` throw a TypeError that
  propagated out of the render. A permission check must not be able to crash a
  view.

  Browser-verified against the framework showcase Console in Chinese: object /
  criteria / recipient copy is fully localized, the recipient dropdown lists real
  users, business units and positions, a saved rule reopens with its recipient and
  criteria intact, editing the filter no longer submits, and a rule created
  end-to-end stores a real record id rather than free text. The criteria authored
  in the builder is honored by the evaluator: `{"pinned":true}` on an owner-private
  object granted the recipient exactly the matching records and nothing else.

- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [dfd3705]
- Updated dependencies [6dee2cb]
- Updated dependencies [c7cff19]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d147a13]
  - @object-ui/types@17.0.0

## 16.1.0

### Minor Changes

- 1c8935a: feat(app-shell): render ActionParamDialog params through the shared form field-widget renderer (ADR-0059, #2700)

  `ActionParamDialog` no longer hand-rolls a per-type ternary chain (select /
  lookup / textarea / number / boolean, everything else → text input). Every
  declared action param now renders through the same `fieldWidgetMap` the object
  form uses, so a param of ANY form-supported field type — `file`, `image`,
  `richtext`, `markdown`, `color`, `address`, `code`, `date`, … — gets its real
  widget, lazily loaded behind `Suspense`. Subsumes the single `file` branch ask
  in #2698: `type: 'file'` params render the real `FileField` upload control via
  the ambient `UploadProvider`, honoring `multiple`/`accept`/`maxSize`.

  - `@object-ui/fields`: new exports `resolveFormWidgetType(type)` (widget-key
    resolution incl. spec aliases, text fallback) and `getLazyFieldWidget(type)`
    (per-type-cached `React.lazy` over the form's own widget loaders).
  - `@object-ui/core`: `ActionParamDef` gains `accept`/`maxSize`; `multiple` is
    now general widget config (was lookup-only).
  - `@object-ui/app-shell`: new pure `paramToField()` adapter (param → field
    shape) with a drift test pinning param support ⊇ form support (`FORM_FIELD_TYPES`),
    mirroring the FieldEditWidget parity guard; `resolveActionParams()` inherits
    `multiple`/`accept`/`maxSize` from the referenced field for every type.
    `required` validation, `visible` CEL gating, helpText, error styling, and
    value shapes for previously-supported types are unchanged.

- 2e7d7f0: feat(evaluator): route `{ dialect: 'cel' }` component/action predicates to the canonical CEL engine (#2661)

  Component and action `visible` / `disabled` / `hidden` predicates were evaluated
  by the home-grown JS `ExpressionEvaluator`, while field rules
  (`visibleWhen`/`readonlyWhen`/`requiredWhen`, via `fieldRules.ts`) and row/list
  conditionals (via `evalRowPredicate`) already delegate to the canonical
  `@objectstack/formula` engine. That split meant a `{ dialect: 'cel' }` predicate
  in a renderer/action surface was executed as **JavaScript** — CEL-only forms
  (`x in list`, `has()`, typed `==`, the `today()`/`daysFromNow()` catalog) behaved
  differently from, or faulted against, the server's enforcement.

  This converges the remaining tier onto the same engine:

  - **`@object-ui/core`** — `ExpressionEvaluator.evaluateCondition` now detects a
    `{ dialect: 'cel', source }` envelope and evaluates it on `@objectstack/formula`
    (via `evalFieldPredicate`), binding the `record` namespace plus the whole
    context bag as top-level scope (`record.*`, `features.*`, `user.*`, `app.*`).
    Fail-soft to visible/enabled to match the legacy default; `throwOnError`
    callers still fail closed on a _faulting_ predicate (a genuine `false` never
    throws). This fixes every `SchemaRenderer` visibility/disabled read at once.
  - **`@object-ui/react`** — `toPredicateInput` preserves a CEL envelope instead of
    collapsing it to a `${source}` string, and `useCondition` accepts and forwards
    the envelope (keyed on a stable `(dialect, source)` so it doesn't re-evaluate
    each render). Action buttons (`action-icon`/`group`/`bar`/`button`) therefore
    evaluate CEL `visible`/`enabled`/`disabled` on the canonical engine.

  **Back-compat:** bare strings and `${…}` templates stay on the legacy JS path
  (deprecation window); only an explicit `{ dialect: 'cel' }` envelope is rerouted.
  `{ dialect: 'template' }` is unaffected.

  Together with the `^15.1.1` alignment (#2662), a renderer CEL predicate now
  reaches the identical verdict as the server — including the framework's
  `dateField == today()` equality fix (objectstack-ai/objectstack#3205) once it
  lands in a published 15.x. The broader home-grown-vs-canonical divergence
  motivation is #2661.

- 31b77d4: **Add the explicit `engine-owned` lifecycle bucket (tracks framework ADR-0103 addendum / #3343).** The framework split the overloaded `managedBy: 'system'` bucket by promoting the engine-owned case to its own enum value; this mirrors it in the UI type + runtime + badge.

  - **`@object-ui/types`** — `ManagedByBucket` union and `MANAGED_BY_BUCKETS` gain `'engine-owned'` (canonical order: `platform, config, system, engine-owned, append-only, better-auth`). The union stays closed, so every consumer that missed the new value is a compile error.
  - **`@object-ui/core`** — `resolveCrudAffordances` gains the `engine-owned` default row (identical all-locked matrix as `system`/`append-only`), so `isObjectInlineEditable` / the grid + form gates treat it as read-only automatically.
  - **`@object-ui/app-shell`** — the `ManagedByBadge` renders `engine-owned` with the same read-only "System-managed" copy as a locked `system` object (reuses the existing `managedByBadge.system` i18n key — zero translation churn; the distinction is at the schema level, not the user-facing string), and `resolveManagedByEmptyState` reuses the `system` engine-owned empty state.

  Behaviour-preserving: `engine-owned` resolves to the same locked affordances `system` did by default, so nothing about how a locked object renders changes — the value just makes the schema self-documenting. New unit coverage for the bucket in `resolveCrudAffordances` / `isObjectInlineEditable` / `MANAGED_BY_BUCKETS` / the empty-state helper.

- 62b9ab5: feat(data): unify master-detail saves behind `DataSource.batchTransaction`, isolate the non-atomic fallback in the adapter (#2679)

  Master-detail saves (`MasterDetailForm`, `LineItemsPanel`) now always persist
  through `dataSource.batchTransaction(operations)` — one ordered cross-object
  operation list, with `{ $ref: <op index> }` linking a child to a parent created
  in the same batch. The form no longer contains any client-side orchestration or
  best-effort compensation-delete; that atomicity anti-pattern is gone from the UI
  layer (framework #1604 / framework ADR-0034 item 4).

  - **`@object-ui/types`** — `batchTransaction?` is now a first-class (optional)
    method on the `DataSource` contract, typed via `BatchTransactionOperation` /
    `BatchRef`. Replaces the previous `(dataSource as any).batchTransaction`
    method-sniffing.
  - **`@object-ui/core`** — new `emulateBatchTransaction(dataSource, operations)`
    (sequential writes, `$ref` resolution, best-effort reverse-order compensation)
    and `runBatchTransaction(dataSource, operations)` (prefers the adapter's method,
    emulates otherwise). `ApiDataSource` / `ValueDataSource` implement
    `batchTransaction` via the emulation.
  - **`@object-ui/data-objectstack`** — `ObjectStackAdapter.batchTransaction` uses
    the server's atomic `POST /api/v1/batch`, prefers the typed
    `client.data.batchTransaction` SDK method when the installed client exposes it,
    and degrades to the client-side emulation ONLY when the endpoint is missing
    (404/405) or the runtime can't do transactions (501). Real errors (400/401/403/
    409/500) still surface. This is the isolated, tested home of the non-atomic
    fallback.
  - **`@object-ui/plugin-form`** — removed `applyDetail` / `createMany` /
    `ApplyDetailResult` from `masterDetailTx.ts`; `MasterDetailForm` and
    `LineItemsPanel` build ops and call `runBatchTransaction`. `LineItemsPanel`
    saves are now atomic on a capable backend, with the rollup folded into the same
    batch.

  No behavior change on a current ObjectStack backend (it has `/api/v1/batch`);
  older/limited backends keep a working — now clearly non-atomic — save path.

- 1629313: feat(fields): RadioField per-option `visibleWhen` cascading + `dependsOn` gating; single-source the option resolver

  Brings `RadioField` to parity with `SelectField` / `MultiSelectField` for ADR-0058
  cascading & role-gated options, and collapses the three copies of the
  gate-then-filter logic onto one shared resolver.

  - **`@object-ui/core`**: new pure `resolveCascadingOptions(rawOptions, record, dependsOn, scope)`
    → `{ options, gated, dependsOnFields }` — the single source of truth for
    `dependsOn` gating + per-option `visibleWhen` filtering.
  - **`@object-ui/fields`**: `RadioField` now narrows its offered radios against
    the live record + `current_user`, gates behind a "select the parent first"
    hint while a `dependsOn` field is empty, and clears a value no longer offered
    (scalar cascade clear). The `useCascadingOptions` hook is refactored to a thin
    React wrapper over `resolveCascadingOptions`.
  - **`@object-ui/components`**: the form renderer's inline option pre-filter and
    cross-field cascade-clear effect now call `resolveCascadingOptions` instead of
    re-deriving gating/filtering, so they can't drift from the widgets (no
    behavior change).
  - Tests: `RadioField.cascade.test.tsx` mirrors the select cascade tests; core
    gains `resolveCascadingOptions` unit coverage.

- 2331ac9: feat(report): drill a date-bucket cell into its time range, not a superset (#1752)

  Clicking a report/dashboard cell grouped by a `dateGranularity` date dimension
  ("2026-Q2") used to drill into a **superset** — the date dimension was skipped,
  so the record list spanned every time bucket. It now scopes to the clicked
  bucket's half-open range, consuming the framework's new `drillRanges` sidecar.

  - **`@object-ui/core`** — `buildDatasetDrillFilter` accepts the per-row
    `drillRanges` and emits an ObjectQL range operator object
    (`{ [field]: { $gte, $lt } }`) alongside the equality dims.
  - **`@object-ui/plugin-report` / `@object-ui/plugin-dashboard`** — the report
    renderer and dashboard widget forward `drillRanges`, and a **date-only**
    report (no equality drill dim) is now drillable via the range alone.
  - **`@object-ui/app-shell`** — the "Open in list →" escape hatch
    (`useOpenRecordList`) now targets the ADR-0055 **bare data surface**
    (`/:object/data`, "the URL is the view" — no baked-in view filter to
    over-narrow the drill) and serializes a range to the
    `filter[field][gte|lt]` operator contract. `ObjectDataPage` parses those
    operators (equality shorthand unchanged), renders a range as a single chip,
    and removes both bounds together. A new `drillUrlFilters` module owns the
    write/read serialization so both sides can't drift (round-trip tested).

  Companion to the framework analytics change (objectstack-ai/objectstack#3256).

### Patch Changes

- 8b8b744: chore(deps): align `@objectstack/formula` / `lint` / `client` to `^15.1.1`

  These three were still pinned to `^14.6.0` while `@objectstack/spec` was already
  `^15.1.1` — a version skew from the v15 upgrade (formula/lint/client publish in
  lockstep with spec, and their own 15.0.0 entries are pure dependency bumps, so
  this is alignment, not a behavioral migration).

  Practical effect: the client-side field-rule evaluation
  (`visibleWhen`/`readonlyWhen`/`requiredWhen` via `fieldRules.ts`, which delegates
  to `@objectstack/formula`'s `ExpressionEngine`) now tracks the 15.x engine — and
  will pick up the framework's `dateField == today()` equality fix
  (objectstack-ai/objectstack#3205) automatically at the next 15.x release via the
  caret range. Renderer/action `visible`/`disabled` predicates are unaffected (they
  use the home-grown JS evaluator — tracked separately in #2661).

- 7cf4051: chore(deps): align every `@objectstack/*` dependency to `^16.0.0-rc.0`

  Bumps `@objectstack/spec` / `client` / `formula` / `lint` from `^15.1.1` to the
  `16.0.0-rc.0` pre-release across the workspace (root + `apps/console` +
  `apps/site` + all consuming packages). ObjectUI's own packages are already on
  major 16, so this closes the 15↔16 skew between ObjectUI and the `@objectstack`
  contract libraries (which publish in lockstep with `spec`).

  This is a dependency alignment, not a behavioral migration: the full workspace
  build (43/43) and the `@objectstack`-consuming package test suites
  (`core` / `app-shell` / `data-objectstack` / `plugin-form` / `types`) are green
  against `16.0.0-rc.0` with no source changes required.

  Practical effect: `@objectstack/client@16.0.0-rc.0` now ships
  `data.batchTransaction` (framework #3271), so `ObjectStackAdapter`'s feature
  detect (`typeof client.data.batchTransaction === 'function'`) routes
  master-detail cross-object saves through the typed SDK method instead of the
  raw `fetch('/api/v1/batch')` fallback — realizing the "verify SDK path" half of
  #2694. The raw-fetch branch stays as a defensive fallback (removal tracked in
  #2694).

- 6d4fbe6: **Consolidate the `managedBy` lifecycle-bucket logic into one shared source of truth (follows framework ADR-0103).** The bucket taxonomy was hand-mirrored in several places — `crudAffordances.ts`, `ManagedByBadge.tsx` (its own `Bucket` union + `isWriteOptedIn` + the writable-system derivation), and `plugin-detail`'s `record-details.tsx` (`NON_EDITABLE_BUCKETS`, duplicated because it can't depend on app-shell) — a drift risk, and the object-schema `managedBy` type was open-ended (`(string & {})`) so unknown buckets slipped through and silently defaulted to fully-editable.

  - **`@object-ui/types`** now owns the closed `ManagedByBucket` union (+ `MANAGED_BY_BUCKETS`), and `ObjectSchema.managedBy` is tightened from `'platform' | 'better-auth' | (string & {})` to that union — unknown buckets are now a type error at authoring time.
  - **`@object-ui/core`** now owns the React-free runtime logic — `resolveCrudAffordances`, `isWriteOptedIn`, `isSystemWritable`, `isObjectInlineEditable` — reachable by every UI package including `plugin-detail` (which could not import app-shell).
  - **`app-shell/utils/crudAffordances.ts`** is now a thin re-export of `@object-ui/core` (existing imports keep working); `ManagedByBadge` consumes the shared `isSystemWritable`; `plugin-detail` `record-details.tsx` replaces its hand-mirrored `NON_EDITABLE_BUCKETS` with `isObjectInlineEditable`.

  Behavior-preserving — all existing affordance/edit-gate tests stay green; the shared module adds direct unit coverage (including the previously-untested `isSystemWritable` derivation). Translated copy (badge variants, empty-state messages) stays in app-shell.

- 0a3710b: **Finish the `managedBy` / `userActions` de-dup — one parser for the override shape (completes objectui#2712, framework#3343).** #2712 consolidated the bucket _union_ + affordance _set_ mirrors but left four surfaces still parsing the `userActions.{create,edit,delete}` override shape by hand. They now all route through the shared `@object-ui/core` policy, so no package re-implements the boolean / #2614-object-form parse locally.

  - **`@object-ui/core`** promotes the internal `normalizeOverride` to the exported **`normalizeUserAction(v, base)`** (the one parser) and adds **`userActionPredicates(v)`** for per-record CEL predicate extraction.
  - **`app-shell/utils/managedByEmptyState.ts`** — the writable-`system` create check and its local `EmptyStateUserActions` interface are replaced by `resolveCrudAffordances({ managedBy, userActions }).create`.
  - **`plugin-grid/rowCrudAffordances.ts`** — the local `isOptedOut` / `predicatesOf` helpers (and duplicated `RowCrudUserAction` / `RowCrudPredicates` types) fold into `normalizeUserAction`; the historical type names stay re-exported for compat.
  - **`plugin-detail/RelatedList.tsx`** — its inline `predicatesOf` fold into `userActionPredicates`.
  - **`plugin-form/ObjectForm.tsx`** — the hand-rolled `managedBy !== 'platform'` blanket lock + `userActions` unlock is replaced by the resolved affordance for the current mode (`edit` / `create`), the **same** `resolveCrudAffordances` contract the detail (`isObjectInlineEditable`) and grid surfaces use.

  Behavior-preserving for `platform` / `system` / `append-only` / `better-auth`, with one deliberate alignment: an admin-editable **`config`**-bucket object (e.g. `sys_webhook`, `sys_permission_set`) is now editable in `ObjectForm` — it was previously over-locked as "non-`platform`", while detail/grid already treated it as editable (`config` resolves `edit: true`). New unit coverage for the shared parser and the config / create-mode form gate; all existing affordance/edit-gate tests stay green.

- eee4ded: feat(fields): render `select` + `multiple` through the multi-value chip picker; restore fields/core lint gates

  - **Multi-value select** — a `select` field/param declared `multiple: true`
    now renders the multi-value chip picker (the `multiselect` widget) and stores
    a `string[]`, instead of collapsing to a single-value dropdown that could
    hold only one value. The delegation lives inside `SelectField`, so the object
    form, the inline grid editor, and the app-shell `ActionParamDialog` all
    inherit it from the one `select` widget with no per-surface drift. Single
    selects keep the cascading dropdown (multi + per-option `visibleWhen`
    cascading is not a combination in use today).
  - **`autonumber` mapping is unchanged** here; this change is orthogonal.
  - **Lint gates restored** — fixed the pre-existing baseline lint errors that
    had left the `@object-ui/fields` and `@object-ui/core` package lints red (so
    the gate could not catch new violations): `react-hooks/rules-of-hooks` in
    `ImageField` / `TextAreaField` / `index.tsx` (hooks hoisted above early
    returns; the `useFieldTranslate` hook no longer wrapped in try/catch), plus
    `no-useless-assignment` / `no-useless-escape` / `no-control-regex` /
    `prefer-const` / `preserve-caught-error` in the core evaluator and utils. No
    behavior change from the lint fixes.

- Updated dependencies [7cf4051]
- Updated dependencies [94d4876]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [62b9ab5]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [199fa83]
  - @object-ui/types@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0

## 14.1.0

### Minor Changes

- 0890fa7: feat(core): build-time guardrail for cascading select option predicates (#1583)

  `@object-ui/core` now exports `lintOptionPredicates(fields)` — a static,
  conservative validator for the per-option `visibleWhen` CEL predicates that
  drive cascading / role-gated `select` options (#2284). An option predicate fails
  _closed_ — a wrong one makes its option silently never appear — so this catches
  the class of bug runtime fail-open can't surface:

  - `syntax` — invalid CEL, delegated to `@objectstack/formula`'s
    `validateExpression` (no schema hint, so a legitimate `current_user.roles`
    reference is never mistaken for an error);
  - `unknown-field` — a `record.<name>` reference to a field the form never
    declares (a sibling typo);
  - `option-literal-not-in-domain` — a literal compared against an _enum_ sibling
    that is outside its declared option values, e.g. `record.country == 'chna'`
    when `country` is `cn`/`us` (the AI-authoring typo #2284 called out).

  It only flags what it can statically prove — non-`record.` roots
  (`current_user.*`), open-domain fields, and unrecognized shapes are left alone,
  so there are no false positives. The schema catalog runs it over every shipped
  example. Design recorded in ADR-0058.

- 5523fc4: Dashboard-level filters — the three #2578 item-5 enhancements (framework#2501):

  - **react**: nested `PageVariablesProvider`s now MERGE instead of shadowing
    wholesale. A filtered dashboard embedded in a Page with its own `variables`
    keeps the outer page variables readable inside widget subtrees (`page.*`);
    an inner definition shadows only the SAME name; writes route to the scope
    that defines the variable (writing an outer-defined name from inside the
    nested subtree updates the outer provider); `resetVariables` stays local.
    Names defined nowhere still write locally, exactly as before.
  - **core**: `buildWidgetScopedFilter` accepts an optional `knownFields` set —
    a DEFAULT binding whose target field is not on the widget's object is
    skipped with a console warning instead of emitting a query the backend
    empty-matches. Explicit `filterBindings` strings are always honoured (a
    typo surfaces as a visibly empty widget, never a silently dropped filter).
    Omitting `knownFields` preserves the previous unchecked behaviour.
  - **plugin-dashboard**: `DashboardRenderer` feeds `knownFields` from
    `dataSource.getObjectSchema` for inline `object` widgets (best-effort —
    unchecked while metadata loads or when the source can't describe objects).
    `optionsFrom` dynamic filter options now resolve DISTINCT values
    server-side via a dataset GROUP BY (`queryDataset` with an inline draft)
    when the data source supports it, falling back to the previous client-side
    top-200 dedupe otherwise.

- 887062c: feat(dashboard): dashboard-level filters (date / region) driving multiple charts (framework#2501)

  A dashboard's `dateRange` + `globalFilters` declarations are now wired end to
  end: the filter values live as dashboard-level variables (the page variables
  primitive, so they're also readable as `page.<name>` in widget expressions),
  a filter bar renders above the widgets, and at render time the dashboard
  broadcasts the active values into every bound widget's inline query —
  `AND`-merged with the widget's own `filter`. Charts stay inline and
  self-contained; each widget maps a filter to **its own** field.

  - **`@object-ui/types`** — `globalFilters[].name` (stable filter/variable key,
    defaults to `field`) and `DashboardWidgetSchema.filterBindings`
    (`Record<string, string | false>`: per-widget field override / `false`
    opt-out). Zod mirrors included. **Pending paired `@objectstack/spec`
    alignment (framework#2501)** — same precedent as `dataset` /
    `categoryGranularity`.
  - **`@object-ui/core`** — new pure `dashboard-filters` module
    (`resolveDashboardFilterDefs`, `dashboardFilterVariableDefs`,
    `buildFilterCondition`, `buildWidgetScopedFilter`); `mergeFilters` lifted
    from plugin-report (re-exported there unchanged). Date presets emit
    date-macro tokens (`{30_days_ago}` …) so widgets resolve them at query time
    like hand-authored filters.
  - **`@object-ui/plugin-dashboard`** — `DashboardFilterBar` (date presets +
    custom range calendar, select with static `options` or `optionsFrom`,
    text/number inputs, reset); `DashboardRenderer` mounts a
    `PageVariablesProvider` when filters are declared and merges the
    widget-scoped condition into inline widgets' `filter` and dataset widgets'
    `runtimeFilter`. Dashboards without filters render exactly as before.

  Binding precedence: explicit `filterBindings` string/`false` → legacy
  `targetWidgets` allow-list → the filter's own `field` (dateRange defaults to
  `created_at`). Static-data widgets are not filtered.

- dea65f7: Unify the list-view conditional tier onto the canonical CEL engine (#1584).

  Conditional formatting (list / grid / kanban) and row-action `visible` /
  `disabled` predicates are now evaluated by `@objectstack/formula`'s
  `ExpressionEngine` — the same engine the server uses — instead of the legacy
  JS-dialect `ExpressionEvaluator`, matching how `@objectstack/spec` already types
  these surfaces (`ExpressionInputSchema` / CEL). The whole platform now speaks one
  expression dialect (framework ADR-0058).

  - `@object-ui/core`: new `evalRowPredicate` + `resolveConditionalFormatting`
    helpers (next to `evalFieldPredicate`). One implementation of all three
    formatting rule shapes; dialect routing (a `{ dialect: 'cel' }` envelope is
    always CEL; a bare string is CEL unless it carries legacy-only syntax
    (`${…}` / `===` / `?.` / `.includes()`), which routes to the old engine with a
    one-time deprecation warning); the native `{ field, operator, value }` form is
    translated to CEL.
  - `@object-ui/react`: new `useRowPredicate` hook (canonical CEL, ambient
    predicate scope merged).
  - Consumers converged: `ListView.evaluateConditionalFormatting` (thin wrapper,
    export kept), `ObjectGrid` row styling (inline copy removed), kanban card
    styles, and the grid / data-table row-action menus. `plugin-view`'s kanban
    branch now forwards top-level `conditionalFormatting` (previously dropped).
  - Row-action `visible` fails **closed** (broken predicate → hidden + warn);
    `disabled` fails soft. The CEL `in` operator (and list membership) now work in
    row predicates — the legacy engine could not parse them.
  - The legacy `FormField.condition: { field, equals/notEquals/in }` is retired to
    a CEL translation (back-compat preserved); `FieldDesigner` migrated to
    `visibleWhen`.

  Fully back-compat: existing conditional-formatting rules, row-action predicates,
  and form `condition` metadata keep working (translated / routed as needed).

### Patch Changes

- 2ded18c: Fix: a dashboard filter declaring its static `options` in the
  `@objectstack/spec` object form (`options: [{ value, label }]` — the shape
  the spec validates and what framework-authored dashboards ship) crashed the
  whole dashboard with "Objects are not valid as a React child". Caught driving
  the showcase Revenue Pulse dashboard in a real browser.

  `resolveDashboardFilterDefs` now normalizes both the spec object form and the
  bare-string shorthand (`options: ['EMEA']`) to `{ value, label }` pairs —
  `DashboardFilterDef.options` is typed accordingly — and the filter bar's
  select renders labels (the trigger now shows the selected option's label, not
  its raw value). `@object-ui/types` aligns the `GlobalFilterSchema.options`
  shape with the spec union.

- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/types@14.1.0

## 14.0.0

### Patch Changes

- 443360a: Action params support a `visible` CEL predicate — the param dialog omits a param
  when it evaluates false, against the same scope as action `visible` (features /
  user / app / data). Fixes the create-user form offering a **Phone Number** field
  the default backend rejects ("Phone numbers require the phoneNumber auth plugin"):
  paired with the framework gating that param on `features.phoneNumber`, the form
  now follows the plugin — no phone field unless the opt-in phoneNumber auth plugin
  is loaded. `filterVisibleParams` is exported + unit-tested (feature-off hides,
  feature-on shows, malformed predicate fails open).
- 05e56ca: 导出/导入模板的下载文件名与内容本地化。

  **导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-视图名-时间戳.扩展名」(如 `任务-In Progress-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先(且作为完整前缀,不再追加视图名)。视图名与对象名重复时自动省略;`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName, viewLabel }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。app-shell/plugin-view 的 ObjectView 现将当前视图的显示标签写进传给 ListView 的 schema(`label`),使导出文件名能区分同一对象的不同保存视图。

  **导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。

- Updated dependencies [86c69c3]
- Updated dependencies [6a74160]
  - @object-ui/types@14.0.0

## 13.2.0

### Patch Changes

- @object-ui/types@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [619097e]
  - @object-ui/types@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [c31874d]
  - @object-ui/types@12.1.0

## 12.0.0

### Minor Changes

- 226fde9: Cascading & role-gated `select` options (#2284).

  `select` options now accept a per-option `visibleWhen` CEL predicate — the option
  is offered only when it evaluates TRUE against the live record **plus
  `current_user`** (same engine/env as a field-level `visibleWhen`). Combined with a
  field-level `dependsOn`, this drives dependent selects (country → province → city)
  and role/context gating with no bespoke matrix — the same primitives dependent
  lookups (#2215) already use.

  - `@object-ui/core` exposes `resolveVisibleOptions` / `isOptionGroupGated` /
    `resolveDependsOnFields` / `isValueStillOffered` (evaluator), reusing the
    canonical `evalFieldPredicate`.
  - The form renderer narrows a dependent select's option list, gates the control
    with a "Select {parent} first" hint while a `dependsOn` field is empty, and
    clears a now-invalid value when the parent changes.
  - The standalone `SelectField` widget applies the same resolution via
    `dependentValues` + the global predicate scope.

  Client-side hiding is UX, not authorization: gate authorization-sensitive option
  values on the server too. Aligns with `@objectstack/spec` `SelectOption.visibleWhen`.

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [c38d107]
  - @object-ui/types@11.4.0

## 11.3.0

### Minor Changes

- d23d6eb: Three-tier AI page authoring: `kind:'html'` and a trusted `kind:'react'` tier.

  - **`@object-ui/react-runtime`** (new) — the trusted runtime-React tier for
    `kind:'react'` pages (vendored react-runner: Sucrase transpile + scope-eval,
    no sandbox). Renders real JSX/TSX (any HTML + JS + hooks/useState/map/onClick)
    in the main React tree with an injected scope (React, the public data blocks,
    page data) and a built-in error boundary.
  - **`@object-ui/core`** — new runtime capability gate (`enableCapability` /
    `disableCapability` / `isCapabilityEnabled`, `CAP_REACT_PAGES`). `react-pages`
    defaults **ON** (the platform trusts reviewed, draft-gated authors); a
    deployment turns it OFF server-side (the runtime injects the disable global
    when `OS_DISABLE_REACT_PAGES` is set). Never controlled from authored metadata.
  - **`@object-ui/components`** — PageRenderer now routes `kind:'react'`
    (capability-gated, lazy-loads the runtime) and renders `kind:'html'` (the
    former `kind:'jsx'`, still accepted as a deprecated alias). The `html` tier
    now resolves the full safe native HTML tag set (h1–h6, p, a, ul/ol/li, img,
    blockquote, pre, strong/em, …) so authored HTML lives up to its name.

### Patch Changes

- @object-ui/types@11.3.0

## 11.2.0

### Minor Changes

- 9e7a986: ADR-0080: AI-authored UI pages. New `@object-ui/sdui-parser` compiles a constrained JSX/HTML+Tailwind source into the SchemaNode tree (parse, never execute) with whitelist sanitization, manifest validation, and `.d.ts` codegen for the JSX type surface. `PageRenderer` renders `kind:'jsx'` pages; `ComponentRegistry` gains `tier` + `getPublicConfigs()` (capability vs contract).
- 1311749: ADR-0080 M5: curated PUBLIC block contract (capability ≠ contract). Adds `PUBLIC_BLOCKS` — the single, reviewable list of ~36 object-aware + layout/content blocks that form the AI/contract surface (Salesforce-App-Builder-shaped). `getPublicConfigs()` now returns the curated set (plus any `tier:'public'` opt-in), keyed by bare tag and deduped across the registry's dual-key registrations. The full ~244 registered types remain a rendering capability.

### Patch Changes

- @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/types@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0

## 7.1.0

### Patch Changes

- 08c47da: feat(dashboard): dataset chart widgets paint select/lookup dimensions in their option colors

  A dashboard `DatasetWidget` chart grouped by a select/lookup dimension (e.g.
  project `health`) painted its categories from the generic `--chart-1..5`
  palette — the same gap the chart view (`object-chart`) had before #1932. It now
  resolves the dimension field's option colors (using the dataset's base `object`

  - dimension→field map the query already returns) and threads them to the
    renderer as a per-category `categoryColors` map, so health green/red/yellow
    paints semantically.

  The value/label→color resolution is extracted into a shared `buildOptionColorMap`
  (`@object-ui/core`) now used by both `DatasetWidget` and `ObjectChart`.

- Updated dependencies [677f7ed]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0

## 7.0.0

### Minor Changes

- f7f325d: feat: action progress state + Undo affordance

  - **core**: `ActionResult.undo` (an `UndoableOperation`) and `ActionDef.undoable`.
    On success the `ActionRunner` pushes the operation onto the global UndoManager
    and the success toast carries an "Undo" affordance (`ToastHandler` gains an
    `undo` option).
  - **app-shell**: the console action runtime mounts `useGlobalUndo` (Ctrl+Z /
    Ctrl+Shift+Z) and renders the toast's "Undo" button; its `apiHandler` resolves
    the row id from the list row record and, for `undoable` actions, captures the
    changed fields' prior values so the update can be reverted.
  - **plugin-detail**: record-header quick-action buttons show a spinner + disable
    while the action runs (a visible progress state for slow/flow actions).

- c12986e: Add resultDialog + target interpolation for one-shot action reveals

  Some platform actions return values the user MUST copy now because the
  server will not surface them again — 2FA TOTP URI + backup codes, freshly
  minted OAuth client_secret, regenerated recovery codes. Previously these
  had to ship as bespoke pages in `apps/account` because actions only
  emitted a fire-and-forget toast.

  **`@object-ui/core` — ActionRunner**

  - New `ActionDef.resultDialog: ResultDialogSpec` field. When set on a
    successful action, the runner suppresses the `successMessage` toast and
    awaits the registered `ResultDialogHandler` instead. Missing handler is
    non-fatal (logs a warning); rejected handler is treated as acknowledged.
  - New `setResultDialogHandler(handler)` setter.
  - New types: `ResultDialogSpec`, `ResultDialogFieldSpec`,
    `ResultDialogHandler`.
  - `executeUrl` and `executeAPI` now run `${param.X}` and `${ctx.X}`
    interpolation against `target` before fetching / navigating. Values are
    `encodeURIComponent`'d, missing keys resolve to empty string. `ctx`
    exposes `origin`, `user`, `org`, `recordId` by default; consumers can
    inject more via `context.ctx`.

  **`@object-ui/react`**

  - `ActionProvider` and `useActionRunner` both gained an `onResultDialog`
    option that wires straight through to the runner.

  **`@object-ui/app-shell`**

  - New `ActionResultDialog` component — promise-based, blocks click-outside
    and Escape (the user MUST click acknowledge), renders five field
    formats: `qrcode` (client-side via the `qrcode` package — never sent
    off-device, so 2FA URIs stay secret), `code-list`, `secret`, `text`,
    `json`. Falls back to `json` when a value's shape doesn't match its
    declared format.
  - `ObjectView` and `RecordDetailView` install the handler and mount the
    dialog automatically, so any action with `resultDialog` declared in
    metadata now works without code changes.
  - New dependency: `qrcode@^1.5.x` for client-side QR rendering.

  Pairs with the framework-side `Action.resultDialog` schema added in
  `@objectstack/spec` and the `sys_two_factor` / `sys_oauth_application` /
  `sys_account` updates in `@objectstack/platform-objects`.

- 053c948: feat(app-shell): zero-roundtrip `newTabUrl` fast path for `opensInNewTab` actions

  Actions that declare `newTabUrl` (a path template with a `{recordId}` placeholder
  whose target endpoint performs all auth/authz itself) now drive the pre-opened
  popup straight to that URL on click, skipping the action POST entirely — applied
  to both server-action paths (list rows via `useConsoleActionRuntime`, record
  header via `RecordDetailView`). The popup paints the existing spinner page until
  the (possibly slow) endpoint commits its redirect; the URL is resolved absolute
  because `about:blank` gives a bare-relative href no reliable base. The
  popup-blocked toast fallback is unchanged. Removes one full round trip of
  white-screen latency from every such Open click.

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- d54346c: feat: action/flow completion messaging

  - **core**: `ActionResult.silent` — a handler sets it when the action only
    HANDED OFF to a follow-up UI (rather than completing), so `ActionRunner`
    skips the automatic success toast. Fixes the misleading "Action completed
    successfully" toast that fired the moment a `flow` action opened its wizard.
  - **app-shell**: both flow handlers now return `silent: true` when the flow
    pauses at a screen (the wizard only opened — it hasn't completed). `FlowRunner`
    renders the flow's declared `successMessage` / `errorMessage` (from the
    terminal `AutomationResult`) instead of a generic "Done" / the raw error.

- 2270239: feat: scoped style-object rendering (ADR-0065)

  A metadata node may carry `responsiveStyles` (per-breakpoint CSS-property maps);
  `SchemaRenderer` compiles it to **id-scoped CSS** injected as a `<style>` tag and
  appends a scope class to the node. Build-independent (arbitrary values + design
  tokens pass through verbatim — no Tailwind JIT), collision-free (per-node scope,
  unlayered so it beats base utilities), responsive-correct (model breakpoint maps
  → generated `@media`, never `md:` variant classes). Adds `compileScopedStyles`/
  `scopeClassFor`/`hasResponsiveStyles` to `@object-ui/core` and an SDUI design-token
  palette (`--space-*`, `--surface`, `--brand`, …) to the theme. Mirrors Builder.io.

### Patch Changes

- 5976ba3: fix(core): evaluate bare CEL predicates in `evaluateCondition`

  `ExpressionEvaluator.evaluateCondition` delegated to `evaluate`, which only
  processes `${...}` templates and returns any other string verbatim. A bare
  predicate such as `record.status == "converted"` (the shape `objectstack build`
  emits for `disabled`/`visible`/`condition`) was therefore returned as a
  non-empty string and coerced to `true` — so every bare-expression predicate was
  silently always-truthy.

  The most visible symptom: a param-collecting `api` action invoked from the
  record header (e.g. CRM "Reassign Lead") was treated as permanently `disabled`,
  so `ActionRunner.execute` bailed before opening the param dialog. The renderer
  (`page:header`) was unaffected because it evaluates via `evaluateExpression`
  directly.

  `evaluateCondition` now treats a non-`${}` condition as a single expression
  (via `evaluateExpression`), keeps the `${...}` template path, and preserves the
  "empty/undefined ⇒ visible/enabled" and "unparseable ⇒ default visible/enabled"
  fallbacks. Also hardens `ActionRunner`'s `disabled` gate to evaluate the
  boolean/string/envelope form rather than treating any object as truthy, and
  unifies the grid row-action predicate scope so `record.*` and bare-field
  predicates resolve identically on every surface.

- eaccefd: fix(actions): warn when an action is hidden by a throwing `visible` predicate

  `ActionEngine.getActionsForLocation` is fail-closed: a `visible` predicate that
  throws hides the action. The most common cause is an authoring bug — a BARE
  field reference (`done` instead of `record.done`), which is undeclared in the
  `{ record, recordId, objectName, user }` eval scope. Hiding it silently made
  that bug invisible (a long debugging hunt). The catch now emits a one-time
  `console.warn` naming the action + predicate + error, with the `record.<field>`
  tip. Deduped per predicate so re-renders don't spam.

- 71d7ce0: fix(actions): handle `type: 'form'` in ActionRunner

  A `form` action had no `case` in `ActionRunner`'s execution switch, so it fell
  through to `executeActionSchema` and silently no-opped — clicking a Log-Time /
  "open form" action did nothing. Add `executeForm`, which opens the FormView as a
  routed page (`/forms/:name`, per the action spec) via the navigation handler,
  forwarding the current record id as `?recordId=` for hosts that support it.
  Covered by ActionRunner unit tests.

- 2d47e94: B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

  - **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
  - **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale _required_ error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).

- c3749eb: feat(dashboard): dataset chart widgets drill through to records

  Dataset-bound **chart** widgets (bar/line/pie/area/donut/funnel/…) are now
  click-drillable, matching table/pivot. Clicking a segment maps it back to its
  dataset row and opens the same governed drill drawer (raw group keys preserved),
  so a chart-only dashboard is no longer an exploration dead-end. This closes the
  "object-backed chart drills but dataset chart doesn't" inconsistency and aligns
  with mainstream BI (click a chart → see records).

  - `@object-ui/core`: `findChartSeriesRow` — inverse of `buildChartSeries`,
    maps a clicked `{category, series}` back to the source dataset row index
    (matches both dims when a 2nd dimension is pivoted into series).
  - `ObjectChart`: optional `onSegmentClick` lets a host own the chart click
    (and suppress the widget's own object-drill).
  - `DatasetWidget`: lifts the drill machinery to cover both table/pivot and
    chart, and wires the chart's segment click to the precise dataset drill.

- 1394e34: feat(chart): visualise the second dataset dimension as grouped series

  A dataset chart with two dimensions (e.g. `['status','priority']`) previously
  only rendered the first dimension — the second was invisible (repeated x-axis
  labels, no grouping). New shared `buildChartSeries` helper (`@object-ui/core`)
  pivots the second dimension into one series per value; `ObjectChart`
  (plugin-charts) and `DatasetWidget` (plugin-dashboard) both use it, so
  multi-dimension charts render consistently as grouped/coloured bars.

  Refs objectstack-ai/objectui#1759, objectstack-ai/objectstack#1890

- 7c239fd: Add `ComponentRegistry.unregister(type, namespace?)` — the inverse of
  `register()`. Clears the namespaced key and the bare-name fallback (when it
  still resolves to that registration) plus any matching lazy stub, and notifies
  subscribers only when something was removed. Lets callers (and tests) restore
  prior registry state cleanly.
- 8d1195d: Fix `type: 'url'` actions so they actually reach the backend in split-origin dev setups, and so reveal-once result dialogs render.

  - `ActionRunner.executeUrl`: when context provides `apiBase`, relative `/api/...`, `/_auth/...`, and `/_account/...` URLs are now promoted to absolute (`${apiBase}${path}`) before navigation. Same-origin API paths (with or without `apiBase`) trigger a full-page `window.location.href` rather than React-Router push — this is required for server-side OAuth redirect dances (e.g. better-auth `/sign-in/social`) that React Router would otherwise swallow into the SPA's fallback route.
  - `ActionRunner.buildInterpolationContext`: surfaces `ctx.apiBase` for action targets that want to template it explicitly.
  - `ObjectView`: passes `apiBase: import.meta.env.VITE_SERVER_URL` into the toolbar `ActionProvider` context so the above resolves.
  - `action-button` and `action-menu` renderers now forward `resultDialog` when invoking the runner. Previously this field was silently dropped by an explicit whitelist, breaking every "show once, then hide" flow (2FA QR/backup codes, OAuth client_secret, regenerated tokens).

- Updated dependencies [ddbe4a2]
- Updated dependencies [9049bbe]
- Updated dependencies [cb2fdb1]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [300d755]
- Updated dependencies [4eb9cb6]
- Updated dependencies [858ad94]
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3

## 6.2.2

### Patch Changes

- @object-ui/types@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/types@6.2.0

## 6.1.0

### Minor Changes

- 991b62d: Add `compareTo` field to dashboard widgets for period-over-period
  comparison. Supports `'previousPeriod'`, `'previousYear'`, and
  `{ offset: '7d' | '4w' | '1M' | '1y' }`.

  - **Metric / gauge widgets** now compute a delta percentage when `compareTo`
    is set and surface it as a derived `trend` (auto-labelled via
    `dashboard.trend.vsLast*` i18n keys sniffed from the filter macros).
  - **Chart widgets** (line / area / bar / horizontal-bar / scatter / combo)
    overlay a muted comparison-period series (dashed line, lower fill opacity).
    Pie / donut / funnel ignore `compareTo`.
  - New core utilities: `shiftFilterByCompareTo`, `compareToTrendLabelKey`,
    `computeMetricDelta`, and `CompareToConfig` type.
  - `ChartSeries` now accepts `variant: 'comparison'`, `dashArray`, and
    `opacity` overrides for visual treatment.

  See `packages/plugin-dashboard/SKILL.md` for usage examples.

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/types@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1

## 5.2.0

### Minor Changes

- de0c5e6: Add `DataSource.bulkDelete(resource, ids)` as the symmetric counterpart
  to `bulkUpdate`. Implemented in `data-objectstack` via the client's
  `deleteMany` primitive with a per-id fallback that emulates
  `continueOnError` semantics for older clients.

  Extract the bulk-vs-per-row decision into a reusable
  `executeBulkBatch(input, ops)` helper in `@object-ui/core`:

  - Single decision tree shared by both update and delete fast paths.
  - Bulk success → no per-row pass.
  - Bulk partial-count → aggregate batch error.
  - Bulk throw → per-row fallback so users still get id-level error detail.

  `useBulkExecutor` in plugin-grid now uses the helper for both `update`
  and `delete` batches, cutting "delete 500 selected rows" from 500 HTTP
  requests down to ~3.

### Patch Changes

- d1442e3: test(core): comprehensive security + correctness tests for SafeExpressionParser

  Add a ~50-case suite covering literals, operators, ternary, property
  access, calls/arrows, and a full security section (blocks
  `constructor` / `__proto__` / `prototype` / `__defineGetter__` /
  `__defineSetter__`, denies `eval` / `Function` / `window` / `process`,
  rejects assignment syntax). No production code changes.

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [70b5570]
  - @object-ui/types@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1

## 5.1.0

### Minor Changes

- 5b80cfd: feat: Optimistic Concurrency Control (OCC) on DataSource writes

  `DataSource.update()` and `DataSource.delete()` now accept an optional fourth /
  third argument `opts?: { ifMatch?: string }`. When supplied, adapters forward
  the token to the backend; servers that implement OCC (e.g. ObjectStack
  `>=4.2.0`) compare it against the record's current `updated_at` and reject
  with `409 CONCURRENT_UPDATE` on mismatch, preventing silent overwrites in
  multi-user editing scenarios.

  **`@object-ui/data-objectstack`**

  - Exports `ConcurrentUpdateError` (carries `currentVersion` and
    `currentRecord`) and `isConcurrentUpdateError()` type guard.
  - `update()` / `delete()` accept `opts.ifMatch` and forward it via the
    `@objectstack/client` data API (header: `If-Match`). Requires
    `@objectstack/client@>=4.1.2` for the header to reach the server;
    older clients silently drop the option and fall back to today's
    "last writer wins" behaviour.
  - Adapter-level error handling maps a 409 with `code === 'CONCURRENT_UPDATE'`
    into a typed `ConcurrentUpdateError` so callers can detect and recover
    from conflicts without parsing the wire format.

  **`@object-ui/core`**

  - `ApiDataSource.update()` and `.delete()` accept `opts.ifMatch` and emit
    the `If-Match` HTTP header.

  UI consumers (Detail view, inline cell-edit) will be wired in a follow-up
  patch to capture `updated_at` at load time, pass it as `ifMatch` on save,
  and present a Reload / Overwrite / Cancel dialog on conflict.

### Patch Changes

- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
  - @object-ui/types@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/types@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [7213027]
  - @object-ui/types@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
  - @object-ui/types@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0

## 4.3.1

### Patch Changes

- @object-ui/types@4.3.1

## 4.3.0

### Patch Changes

- @object-ui/types@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/types@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/types@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/types@4.0.8

## 4.0.7

### Patch Changes

- 7c9b85c: Fix compatibility with the framework's normalized Expression envelope format.

  `@objectstack/spec` now emits predicate (`visible` / `enabled`) and template
  (`titleFormat`) fields as `{ dialect, source }` envelopes instead of bare
  strings. The previous implementation assumed strings and crashed the record
  detail view (`TypeError: titleFormat.replace is not a function`) and printed
  `Failed to evaluate expression: ${[object Object]}` for every action visibility
  predicate.

  - `@object-ui/core`: `ExpressionEvaluator.evaluate` / `evaluateCondition` now
    unwrap Expression envelopes transparently.
  - `@object-ui/react`: new `toPredicateInput()` helper to safely normalize
    `boolean | string | Expression` predicate inputs into the `${expr}` form
    expected by `useCondition`.
  - `@object-ui/components`: `action-bar`, `action-button`, `action-group`,
    `action-icon`, `action-menu` renderers use `toPredicateInput()` instead of
    template-literal interpolation that produced `${[object Object]}`.
  - `@object-ui/plugin-detail`, `@object-ui/plugin-kanban`,
    `@object-ui/plugin-calendar`, `@object-ui/app-shell`,
    `@object-ui/console`: title-format helpers accept both legacy strings and
    the new `{ source }` envelope.

  All changes are backward-compatible — legacy bare strings continue to work.

  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/types@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1

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

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.2.2

### Patch Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**

  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**

  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

- Updated dependencies
  - @object-ui/types@0.3.0

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

- Updated dependencies
  - @object-ui/types@0.2.1
