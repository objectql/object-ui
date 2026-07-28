# Spec enum ↔ renderer coverage audit (#2901)

Audited against `@objectstack/spec@16.0.0-rc.0` and `objectui@cd09a7b90`.

Every row below was confirmed by reading the dispatch code. Nothing was exercised at
runtime, so symptoms are read off the code path, not observed. Rows the auditors could
not confirm are marked and kept separate rather than padded into the table.

---

## The premise moved

#2901 described `ChartTypeSchema` as a 7-value spec enum that `plugin-charts` had outgrown
with 13 renderer-local names. That is backwards. The spec enum has **19** values
(`ui/chart.zod.ts:18`). The 7-value list is an objectui fork —
`packages/types/src/zod/data-display.zod.ts:209` — re-exported from `@object-ui/types`
under **the same symbol name the spec uses**. Two packages export `ChartTypeSchema`; they
differ by twelve values.

That inversion is the audit's most useful result, because it generalises: the failure is
rarely "renderer forgot a name". It is usually "a second definition of the vocabulary
exists, and the renderer is faithful to the wrong one".

---

## Headline numbers

| | |
|---|---|
| Named enum exports in spec `ui/` | 30 |
| …with a real consumer outside `packages/types` | **11** |
| …named only in a `packages/types` deny-list or local fork | 14 |
| …with zero mentions anywhere in the repo | 5 |
| Confirmed Direction A gaps with a user-visible defect | **24** |
| …plus inert Direction A gaps (validates, changes nothing) | 11 |
| Surfaces carrying Direction B dialect | 10 |
| objectui forks shadowing a spec symbol name | 5 |
| Enum-value parity guards in the repo | **1** |

The middle number is the structural one: **19 of 30 UI vocabularies have nothing
mechanically tying them to the spec.** That measures *derivation*, not coverage —
`VisualizationTypeSchema` obviously has a renderer, it just restates the nine values
instead of importing them. Drift there is unpoliced by construction, which is why the
gaps below went unreported rather than why they exist.

---

## Triage by runtime symptom

The issue's step 3 asks for judgment, not a dump. The useful axis turned out to be **what
the user sees**, because it orders the work by how long a bug can survive undetected.

### Tier 1 — silently wrong output

The worst class, and one the original #2897 bug did *not* belong to. A blank cell is
detectable; a plausible wrong number is not.

| Finding | Location | What happens |
|---|---|---|
| Pivot aggregation falls back to **sum** | [PivotTable.tsx:114](../../packages/plugin-dashboard/src/PivotTable.tsx) | `count_distinct`, `array_agg`, `string_agg` each return a sum. Wrong total, no signal. |
| Report chart falls back to **bar** | [DatasetReportRenderer.tsx:370](../../packages/plugin-report/src/DatasetReportRenderer.tsx) | 10 of 19 chart types silently draw a bar chart. Wrong picture, no warning. |
| `selection.type: 'single'` renders **multi-select** | [ObjectGrid.tsx:1610](../../packages/plugin-grid/src/ObjectGrid.tsx) → [data-table.tsx:1284](../../packages/components/src/renderers/complex/data-table.tsx) | Per-row checkboxes *and* select-all. `single` is never distinguished from `multiple`. |
| Filter `type: 'select'` renders multi-check | [UserFilters.tsx:227](../../packages/plugin-list/src/UserFilters.tsx) | A single-choice filter accepts many values. |
| `addRecord.position: 'both'` collapses to `top` | [ListView.tsx:389](../../packages/plugin-list/src/ListView.tsx) | Binary ternary; the bottom button never renders. |
| `tabular` vs `summary` report resolved from data, not type | [DatasetReportRenderer.tsx:779](../../packages/plugin-report/src/DatasetReportRenderer.tsx) | A `tabular` report that declares `rows` renders grouped. |

### Tier 2 — silently absent

The #2897 shape. Validates, renders nothing, nobody knows it should be full.

| Finding | Location | What happens |
|---|---|---|
| **`element: 'toggle'` removes the entire filter bar** | [UserFilters.tsx:162](../../packages/plugin-list/src/UserFilters.tsx) | `default: return null`. See "the deprecation that broke the renderer" below — this one is worse than a gap. |
| 7 chart types draw an **empty plot** | [AdvancedChartImpl.tsx:343](../../packages/plugin-charts/src/AdvancedChartImpl.tsx) | Grid, axes, tooltip and legend all render; every series mark hits `return null`. Looks like an empty dataset. |
| 6 of 9 animation presets do nothing | [useAnimation.ts:64](../../packages/react/src/hooks/useAnimation.ts) | `PRESET_CLASSES` is keyed in **hyphens** (`'slide-up'`), the spec enum in **underscores** (`slide_up`); `rotate`/`flip` absent entirely. Lookup misses → `''` → no animation. |
| 3 of 6 easings emit **invalid CSS** | [useAnimation.ts:112](../../packages/react/src/hooks/useAnimation.ts) | Same split, but `EASING_MAP[easing] \|\| easing` falls through to the raw string. `animationTimingFunction: 'ease_in_out'` — browser drops it, devtools shows the attribute populated. |
| `mode: 'auto'` breaks theming | [ThemeProvider.tsx:38](../../packages/app-shell/src/chrome/ThemeProvider.tsx) + [providers/ThemeProvider.tsx:33](../../packages/providers/src/ThemeProvider.tsx) | Renderer branches on `"system"`; spec says `auto`. `root.classList.add('auto')` matches no Tailwind variant → light theme, OS preference no longer followed, no error. |
| Export **PDF** downloads nothing | [ObjectGrid.tsx:1258](../../packages/plugin-grid/src/ObjectGrid.tsx), [ListView.tsx:1611](../../packages/plugin-list/src/ListView.tsx) | Excluded from `serverEligible` and absent from the client fallback. Popover closes, no file. `xlsx` does the same whenever the server path is unavailable. |
| Timeline `scale` blanks the axis | [renderer.tsx:270](../../packages/plugin-timeline/src/renderer.tsx) | `hour`/`quarter`/`year` produce zero header columns. All six are ignored entirely on the default `vertical` variant. |
| All 6 toast positions discarded | [toaster.tsx:15](../../packages/components/src/renderers/feedback/toaster.tsx) | `<SonnerToaster />` with no props, `inputs: []`. |
| All 5 notification types collapse to toast | [NotificationContext.tsx:155](../../packages/react/src/context/NotificationContext.tsx) | `displayType` is stored on the item and never read. |
| `navigation.size` ignored off app-shell | [useNavigationOverlay.ts:27](../../packages/react/src/hooks/useNavigationOverlay.ts) | Hook declares `width`, no `size`. Every non-app-shell host silently uses the default width. |
| `date-range` / `text` filters are dead controls | [UserFilters.tsx:456](../../packages/plugin-list/src/UserFilters.tsx) | Chip renders; popover shows the literal "No options". |
| 4 gesture types become **tap** | [useSpecGesture.ts:49](../../packages/mobile/src/useSpecGesture.ts) | Hook never reads `config.type`; branches on sub-object presence. `pan`/`drag`/`rotate`/`double_tap` match nothing and keep the `'tap'` initializer. |
| Report `aggregate: 'unique'` → blank cell | [ReportViewer.tsx:102](../../packages/plugin-report/src/ReportViewer.tsx) | `default: return ''`. Textbook #2897. |
| 9 field types get a **plain text input** inline | [FieldEditWidget.tsx:54](../../packages/fields/src/FieldEditWidget.tsx) | In neither `EDIT_WIDGETS` nor `INLINE_EXCLUDED_FIELD_TYPES`. Includes `secret`, `json`, `composite`, `record`, `repeater` — see security note. |
| 5 accepted filter operators never offered | [filter-builder.tsx:58](../../packages/components/src/custom/filter-builder.tsx) | `$startsWith`, `$endsWith`, `$notContains`, `$null`, `$exists` are unreachable from the UI. |

### Tier 3 — loud failure

Bad, but visible. `SchemaRenderer` renders a red `role="alert"` panel naming the type
([SchemaRenderer.tsx:365](../../packages/react/src/SchemaRenderer.tsx)). This tier is
cheaper to triage precisely because it cannot hide.

| Finding | Location | Missing |
|---|---|---|
| `PageComponentType` unregistered | Registry, [Registry.ts:288](../../packages/core/src/registry/Registry.ts) | 24 of 34 registered. Hard: `ai:chat_window`, `element:filter`, `element:form`. Soft (placeholder, and only in hosts calling `registerPlaceholders()`): `app:launcher`, `nav:menu`, `nav:breadcrumb`, `global:search`, `global:notifications`, `user:profile`, `ai:suggestion`. |
| Dashboard chart dispatch | [DashboardRenderer.tsx:131](../../packages/plugin-dashboard/src/DashboardRenderer.tsx) | `gauge`, `solid-gauge`, `kpi`, `bullet` |
| Editable dashboard grid | [DashboardGridLayout.tsx:173](../../packages/plugin-dashboard/src/DashboardGridLayout.tsx) | 8 types |

### Tier 4 — inert

Validates, type-checks, changes nothing. No user-visible harm *today*; each becomes a live
bug the moment someone wires the surface up.

`RecordHighlightsProps.layout` (never read) · `ElementMetadataViewerProps.mode` (never
read) · widget-level `actionType`/`actionUrl`/`actionIcon` (authored, round-tripped through
the config panel, never rendered) · `addRecord.mode` (read nowhere) · all four
`ui/offline.zod.ts` enums (restated in `useOffline.ts`, never branched on) ·
`DragHandleSchema`/`DropEffectSchema` (emitted as pass-through DOM attributes nothing
reads; every real drag site hardcodes `'move'`) · `DensityModeSchema` (spec marks it
`[EXPERIMENTAL — not enforced]`).

---

## The four findings that need a decision, not a patch

**1. The deprecation that broke the renderer instead of the name.**
`ui/view.zod.ts:315` says of `toggle`: *"Kept in the enum so existing configs keep
rendering; do not author new `toggle` filters."* [UserFilters.tsx:162](../../packages/plugin-list/src/UserFilters.tsx)
returns `null` for it — the whole filter bar vanishes. The component's own docstring at
`:122` advertises *"**toggle**: on/off toggle buttons per field"*. Three artifacts describe
one value; the only one that executes is the one that says nothing. Either the spec's
compatibility promise is false and should be withdrawn, or `toggle` needs a branch.

**2. `ai:chat_window` is offered by Studio and has no renderer.**
The page palette lists it with a label and icon ([block-types.ts:116](../../packages/app-shell/src/views/metadata-admin/previews/block-types.ts))
and gives it a config panel ([block-config.ts:352](../../packages/app-shell/src/views/metadata-admin/previews/block-config.ts)).
[placeholders.tsx:97](../../packages/components/src/renderers/placeholders.tsx) documents a
deliberate decision to *exclude* it so it produces "a loud Unknown component type". The
reasoning is sound; the palette was never told. An author drags a block Studio offers and
gets a red error box. Prune it from the palette, or ship the renderer.

**3. Two record-component vocabularies are fully disjoint.**
`RecordChatterProps.position` — spec `sidebar | inline | drawer` (default `sidebar`);
renderer [RecordChatterPanel.tsx:95](../../packages/plugin-detail/src/RecordChatterPanel.tsx)
tests `'right' | 'left'` and `'bottom'`. Zero overlap, so **authoring the spec's own default
value falls past every branch** — while omitting the prop works, because the renderer
defaults to `'right'`. `packages/types/src/record-components.ts:171` mirrors the *renderer*
dialect under a comment claiming alignment with the spec.
`RecordDetailsProps.layout` is worse: spec `auto | custom` selects a **field source**;
renderer `stacked | inline | compact` selects **label orientation**. Two different axes
wearing one key name — this probably needs two props, not a reconciled enum.

**4. `$ncontains` is a straight bug.**
[FilterConditionField.tsx:114](../../packages/fields/src/widgets/FilterConditionField.tsx)
emits `{ $ncontains: value }`. The token appears **zero times** in the entire spec, and
objectui's own [filter-converter.ts:126](../../packages/core/src/utils/filter-converter.ts)
throws `Unknown filter operator '$ncontains'` — naming the correct spelling
(`$notContains`) in the error message. The UI's "notContains" option is unreachable in
practice. No policy question here; fix the spelling.

**Security-adjacent, flagged separately:** `secret` is in neither `EDIT_WIDGETS` nor
`INLINE_EXCLUDED_FIELD_TYPES`, so grid inline edit falls back to a plain text input.
`password` *is* excluded, two lines away. Per `data/field.zod.ts:19` a `secret` is
encrypted-at-rest and fail-closed (ADR-0100). This almost certainly belongs next to
`password`. `json`/`composite`/`record`/`repeater` have the same gap, where the risk is
value corruption rather than disclosure.

---

## Direction B — renderer-local dialect

| Name | Location | Call |
|---|---|---|
| `navigation` action type | [ActionRunner.ts:539](../../packages/core/src/actions/ActionRunner.ts) | Fully implemented (`executeNavigation`). **Promote** — it is a real capability the spec doesn't name. |
| `combo` chart type | [normalizeChartSchema.ts:63](../../packages/plugin-charts/src/normalizeChartSchema.ts) | Drawn at `AdvancedChartImpl.tsx:819`. Promote or delete. |
| `system` theme mode | ThemeProvider ×2 | Delete — the spec name is `auto`, and `react/ThemeContext.tsx` already gets it right. |
| `scale-fade` preset | [useAnimation.ts:71](../../packages/react/src/hooks/useAnimation.ts) | Delete with the hyphen/underscore fix. |
| `modal` notification type | [NotificationContext.tsx:23](../../packages/react/src/context/NotificationContext.tsx) | Inert — nothing reads `displayType`. |
| `before` / `after` filter ops | [view-config-utils.ts:59](../../packages/plugin-view/src/config/view-config-utils.ts) | Persisted **verbatim** into saved view metadata; in no spec vocabulary. `ListView.tsx:75` lowers the same tokens to `<`/`>`. Two contradictory translations of one token in one repo. |
| `'not in'` (with a space) | [ListView.tsx:74](../../packages/plugin-list/src/ListView.tsx) | Escapes as a literal operator when the value isn't an array. |
| `$ncontains` | see above | Bug, not dialect. |
| `right`/`left`/`bottom`, `stacked`/`inline`/`compact` | `plugin-detail` | See decision 3. |
| `status`, `owner`, `geolocation`, `object`, `grid` field types | `packages/fields` | Triage individually. |

---

## Systemic causes

**Nine disagreeing filter-operator vocabularies in the spec itself.** `FieldOperatorsSchema`
(15, `$`-camelCase) is what the data layer accepts. Alongside it: `VALID_AST_OPERATORS` (25
spellings, infix + snake_case + squashed), `FilterOperator` (`api/websocket.zod.ts`, bare
camelCase, adds `regex`), `ODataFilterOperatorSchema`, a GraphQL set, `lookupFilters[].operator`
(9), plus ad-hoc subsets in `ai/skill.zod.ts`, `ui/app.zod.ts`, `system/metrics.zod.ts`.
And `ViewFilterRuleSchema.operator` (`ui/view.zod.ts:71`) is `z.string()` — no enum at all,
while its own `@example` uses `operator: 'this_quarter'`, which no renderer implements. The
renderers then add a third register (`greaterOrEqual`, `isNotEmpty`) appearing nowhere in
the spec. No renderer can be correct against nine vocabularies; this needs consolidation
upstream before the UI side is worth fixing.

**Two spec vocabularies for chart type.** `ChartTypeSchema` (19) and
`ListChartConfigSchema.chartType` (`ui/view.zod.ts:360`, 5) reach the same `chartType` prop
of the same component. A list view cannot author `donut`, `funnel`, `treemap`, `sankey`,
`radar` or `horizontal-bar` even though the renderer draws all six. If the narrowing is
intentional it should be derived — `ChartTypeSchema.extract([...])` — not retyped.

**`ActionType` (6) vs `WidgetActionTypeSchema` (5).** They differ only by `form`, and
dashboard header actions funnel into the same `ActionRunner` that implements `form`. The
narrower enum rejects at validation what the shared dispatcher executes. One of the two is
wrong.

**Five objectui forks shadowing spec symbol names.** Each re-exports under the spec's own
name, so an importer cannot tell which they got.

| Fork | Spec | Drift |
|---|---|---|
| `types/src/zod/data-display.zod.ts:209` `ChartTypeSchema` | 19 | **7** |
| `types/src/zod/layout.zod.ts:258` `PageTypeSchema` | 5 | 4 — missing `list` |
| `types/src/layout.ts:432` `PageType` (TS) | 5 | **10** — adds the five visualizations the spec explicitly repudiates |
| `types/src/reports.ts:337` `ReportType` | 4 | 3 — missing `joined` |
| `types/src/ui-action.ts:72` `ActionType` | 6 | 5 — missing `form`, under a comment claiming it is canonical |

The `PageType` trio is one package holding three disagreeing definitions of one vocabulary,
drifting in **both** directions at once. All five are currently **inert** — no renderer
parses with them — so these are latent, not live. They are also already-settled policy
violations rather than open questions: #2231 established "re-export by reference; a
faithful copy is still a fork", and
[spec-subschema-parity.test.ts](../../packages/types/src/__tests__/spec-subschema-parity.test.ts)
pins reference identity for the schemas it covers. These five simply aren't covered.

**Dead spec-bridge code.** `packages/core/src/protocols/` — `DndProtocol`,
`NotificationProtocol`, `ResponsiveProtocol` — has **zero importers** outside itself. It
contains complete and correct mappings for notification severity, notification position and
breakpoints. Every one is dead. Separately, `types/src/data-protocol.ts:478`
(`AdvancedFilterOperator`, ~30 invented operators), `types/src/designer.ts:692`
(`DesignerFieldType`), and `types/src/complex.ts:228` (`FilterOperator`) have zero consumers
— a parallel spec nobody reads.

**Field-type knowledge is duplicated five ways.** No single field-widget registry exists:
form/edit dispatch, cell/display dispatch, inline-edit widgets, the Studio palette and the
Studio form-preview stub are five independent hand-written tables with different coverage,
plus `EXPANDABLE_FIELD_TYPES`, `NUMERIC_FIELD_TYPES`, `IMAGE_FIELD_TYPES`,
`NON_EDITABLE_FIELD_TYPES`, `OPTION_FIELD_TYPES` and `normalizeFieldType`. This is direct
support for the objectui#2731 position that value-shape belongs in the spec keyed by
`FieldType`.

---

## Why the existing guards can't see any of this

The repo has a mature drift-guard doctrine for schema **shape** (#2231 — three tests in
`packages/types`) and exactly **one** guard for enum-value **renderer coverage**
([summary-spec-parity.test.ts](../../packages/plugin-grid/src/__tests__/summary-spec-parity.test.ts),
from #2897). These catch different failures and the first kind is blind to the second:
`list-view-spec-parity.test.ts` asserts field *keys*, not enum *values*, so none of the
drift above trips it.

Two guards that look like coverage tests but aren't:

- `packages/fields/src/field-type-coverage.test.ts:19` hard-codes its own expected field
  list instead of importing `FieldType`, so it can only regress-test what someone
  remembered to type. It lists `autonumber` under form widgets but not cell renderers —
  which is exactly why the display-map gap survived.
- `block-config.test.ts:26` asserts palette *exclusions* by hand rather than deriving
  inclusion from `PageComponentType`, so it locks the drift in instead of detecting it.

The #2897 template ports without new machinery: `.options` reads cleanly through the
`lazySchema` wrapper on every enum tested. One prerequisite — of the 13 packages that would
need a guard, **6 cannot import the spec today**: `plugin-list`, `plugin-charts`,
`plugin-dashboard`, `plugin-report`, `components`, `mobile` all lack the
`@objectstack/spec` devDependency.

---

## Suggested sequencing

1. **`$ncontains`** and **`secret` inline edit** — bugs with no design question. Ship now.
2. **Consolidate the spec-side vocabularies** (filter operators, the two chart-type enums,
   `ActionType`/`WidgetActionTypeSchema`) while spec 16 is still RC. After GA, retiring a
   name is breaking. No renderer fix is durable until this lands.
3. **Retire the five forks** under the #2231 doctrine — mechanical, and they are inert
   today, so it is cheap.
4. **Tier 1** — silently wrong output, ordered by blast radius.
5. **Tier 2**, then guard each pair as it is fixed.
6. **Tier 4 / dead code** — decide enforce-or-remove, the doctrine already applied to
   `PageTypeSchema` at `ui/page.zod.ts:180` and not at all to prop-level enums.

Coverage gaps and dialect have different owners; the spec-side consolidation in step 2 is
upstream of most of the rest.
