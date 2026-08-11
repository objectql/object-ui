---
'@object-ui/layout': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-designer': patch
'@object-ui/app-shell': patch
---

An inline per-locale label now renders its locale's string at the thirteen read sites the `@objectstack/spec` 17.0.0-rc.6 bump exposed

rc.6 widened `I18nLabel` from `string` to `string | Record<string, string>`, so an author may write `label: { en: 'Owner', 'zh-CN': '负责人' }` anywhere the spec accepts a display label. PR #4169 repaired eight such sites; these thirteen were invisible to it because the five packages involved build through vite/rolldown, so `turbo run build` never type-checks their sources — only `turbo run type-check` does. All thirteen are now resolved through a shared resolver against a real locale, and `turbo run type-check` is 78/78 with zero errors.

| package | what an author can now write and see |
| --- | --- |
| `@object-ui/layout` | `NavigationArea.label` — the sidebar area switcher's button and its tooltip |
| `@object-ui/plugin-list` | `ViewTab.label` — the inline pill row, and the mobile dropdown's trigger and menu items |
| `@object-ui/plugin-dashboard` | `DashboardWidget.title` — the widget card heading and its `title` attribute |
| `@object-ui/plugin-designer` | `DashboardWidget.title` — the widget card and the preview tile |
| `@object-ui/app-shell` | `ActionParam.label` **and** each `ActionParam.options[].label` |

**Patch, not minor, in every case: no public surface changes meaning.** Every entry above is a read site that previously could only be reached with a value the type system rejected, so no caller's working code changes behaviour. `@object-ui/app-shell` is the only package with an exported-type change and it is purely additive on the authoring side — `RawActionParam.label` and `RawActionParam.options[].label` widen to `I18nLabel` (they accept strictly more), `ResolveActionParamsContext` gains an optional `locale`, and the new `RawActionParamOption` names the authoring shape that was previously spelled with the resolved one. What `resolveActionParams` **emits** is unchanged: `ActionParamDef.label` and its options' labels are still plain `string`s.

Two consequences worth knowing:

- **The dashboard designer's title input is deliberately read-only for a map-valued title.** Resolving a per-locale map into a single-line input and writing `e.target.value` back would collapse every other locale on the first keystroke, so the write is guarded and an inline map survives an unrelated edit-and-save round trip untouched — the same conservative branch #4169 took for `DashboardWidgetInspector`. What Studio should actually offer for authoring a per-locale label is objectui#4163 part 2, which is unclaimed and pending design.
- **`@object-ui/layout` resolves at the spec's `en` default, not the viewer's language.** That package carries no i18n dependency by design (its whole i18n story is injection), and `AppSchemaRendererProps` exposes no locale to thread. The choice and what would change it are documented at the call site.
