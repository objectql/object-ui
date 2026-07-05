---
name: objectui-app-composition
description: Choose the right metadata construct when composing an app — object navigation vs named views vs custom pages vs dashboards. Use this skill whenever generating or reviewing app navigation, deciding between a view / page / dashboard / report for a requirement, or authoring `navigation` items in an app schema. This is the canonical decision guide for AI app generation and for human authors in the metadata studio.
---

# App Composition: Choosing the Right Metadata

This guide answers **"which construct do I reach for?"** — not "how do I build it."
It is the single source of truth for app-composition decisions. AI generators,
inspector UIs, and human docs must all follow the same rules; do not fork or
paraphrase the decision tables elsewhere — link here instead.

## The Least-Power Principle

Every requirement should be expressed with the **least powerful construct that
can express it**. The hierarchy, from least to most powerful:

```
object nav (default view)
  → object nav + viewName (named slice)
    → dashboard / report (aggregation)
      → page (free-form SDUI composition)
```

A more powerful construct can always imitate a weaker one — a page can embed a
single object view — but doing so **discards the built-in chrome** the weaker
construct provides for free, and every future improvement to that chrome will
skip your app. Powerful constructs are escape hatches, not defaults.

## What Each Navigation Target Buys You

The nav contract is a discriminated union on `type` (see `NavigationItemSchema`
in `@object-ui/types`; aligned with `@objectstack/spec`). Runtime resolution is
`resolveHref` in `packages/layout/src/NavigationRenderer.tsx` — the single
source of truth for nav → URL mapping.

| Nav item | Route | What the runtime provides |
|---|---|---|
| `{type:'object', objectName}` | `/:objectName` | Full `ObjectView` shell: default view, **view switcher**, object actions, create button, `record/:id` detail routing, search & recents integration, permission trimming |
| `{type:'object', objectName, viewName}` | `/:objectName/view/:viewId` | Same shell, entry **anchored to a named view** (user can still switch) |
| `{type:'object', objectName, recordId}` | `/:objectName/record/:id` | Direct record deep-link; supports template vars like `{current_user_id}` ("My Profile") |
| `{type:'object', objectName, filters}` | `/:objectName/data?filter[k]=v` | **Parameterized bare data surface** (#2251): URL conditions over everything row-level security permits, NOT anchored to any saved view. No saved-view tab bar; conditions render as removable chips; full filter/sort/group toolbar; "Save as view" is the exit into the workspace |
| `{type:'dashboard', dashboardName}` | `/dashboard/:name` | Dashboard renderer (widgets, KPIs, charts) |
| `{type:'report', reportName}` | `/report/:name` | Report renderer |
| `{type:'page', pageName}` | `/page/:name` | **Bare SDUI rendering only.** No object shell — view switching, actions, and record routing must be hand-assembled in the page schema |
| `{type:'url', url}` | external | External link (`target` controls tab) |
| `{type:'group', children}` | — | Grouping only; no target |

## Decision Rules (in priority order)

1. **Default: one bare `object` entry per core business object.**
   "Tasks", "Projects" → `{type:'object', objectName}`. No `viewName`. The
   default view comes from view metadata; the nav layer stays decoupled.
   Least metadata, most user freedom.

2. **Add `viewName` only when the menu item is a *named slice* of an object.**
   Test: the label is a *perspective*, not the object's name — "By Status",
   "Due This Week", "My Tasks". Create a named view (naming convention:
   `<object>.<key>`, e.g. `showcase_project.by_status`) and point the nav
   entry at it. `viewName` is an **entry anchor**, not a lock — users can
   still switch views once inside. That is a feature.

3. **Use `filters` (the `/data` surface) for one-off / parameterized slices.**
   When a condition-driven entry is transient, user-specific, or generated —
   a dashboard drill-through, an AI-produced link, a shared "open tickets
   assigned to me" URL — put the condition in the URL via `filters` instead
   of authoring a view. A slice graduates to a named view (rule 2) only when
   it is curated and reused. Values support `{current_user_id}` /
   `{current_org_id}` templates. The `/data` surface is never a security
   boundary: it shows what row-level permissions allow, nothing more.

4. **Reach for a `page` only for cross-object or free-form composition.**
   Qualifying cases (any one suffices): multiple objects' views side by side
   or in tabs, KPI cards mixed with lists, static/onboarding content,
   parameterized pages driven by `params`.
   **A page that wraps a single object's single view is an anti-pattern** —
   it is a degraded copy of rules 1–3 that loses the object shell and adds a
   second metadata document to maintain.

5. **Pure metric/chart aggregation → `dashboard`, tabular analysis → `report`.**
   Do not simulate either with a page of hand-placed chart blocks.

6. **One entry per target (dedup constraint).**
   A navigation tree must not contain both a bare `object` entry and a page
   that merely wraps that object's default view. If one object needs several
   menu entries, make **all of them** named-view entries (rule 2) — mixing a
   bare entry with slice entries breaks active-state highlighting, and
   `resolveHref` cannot dedup entries for you.

7. **Generation order follows the hierarchy.**
   objects → named views (extracted from the "perspectives" in the
   requirement) → nav (rules 1–3) → only what remains inexpressible becomes a
   page/dashboard. **Page count is an inverse quality signal**: in a typical
   business app, ~80% of nav entries should be `object` (± `viewName` /
   `filters`); pages are for home/onboarding/cross-object workbenches.

## The One-Sentence Rule (for generation prompts)

> Prefer the object's default view over a pinned `viewName`; prefer URL
> `filters` (the `/data` surface) over authoring a view for one-off slices;
> prefer a named view over a page; use a page only for composition a single
> object view cannot express. Every target appears exactly once.

Generation prompts should embed only this sentence plus a link to this guide —
never an inline copy of the tables above.

## Contract Reminders (spec-strict)

- Nav items are a **discriminated union on `type`**. There is no `path` and no
  `kind` — those keys are ignored by `resolveHref` and rejected/stripped at
  save. Emit the typed target field for the chosen type (`objectName`,
  `pageName`, `dashboardName`, `reportName`, `url`, `componentRef`).
- Object-item target precedence: `recordId` → `filters` → `viewName`
  (`filters` is a `Record<string, string>`; equality semantics, serialized as
  `filter[<field>]=<value>` on the `/data` route).
- Every nav item needs a snake_case `id` and a `label` (both required by
  `NavigationItemSchema`).
- The `navigation` key is the spec'd root for app nav. `menu` is deprecated
  legacy (`MenuItem[]`, auto-migrated at runtime via
  `menuItemToNavigationItem`); never generate it.

## Anti-Pattern Checklist

Reject (or fix) generated apps that contain any of:

- [ ] A page whose schema is a single object view wrapper.
- [ ] Nav items carrying `path` or `kind` keys.
- [ ] The same object reachable via both a bare object entry and a
      default-view page.
- [ ] Dashboards rebuilt as pages of chart blocks.
- [ ] Nav written under `nav` / `tabs` / `items` / `menu` instead of
      `navigation`.
- [ ] View names not following `<object>.<key>`, or nav `id`s not snake_case.

## Related

- Navigation item schema: `packages/types/src/zod/app.zod.ts`
  (`NavigationItemSchema`), `packages/types/src/app.ts` (`NavigationItem`)
- Runtime resolution: `packages/layout/src/NavigationRenderer.tsx`
  (`resolveHref`)
- Console routes: `packages/app-shell/src/console/AppContent.tsx`
- Bare data surface decision record: `docs/adr/0055-parameterized-bare-data-surface.md`
  (amends ADR-0053's context table)
- Human-facing version: `content/docs/guide/designing-app-navigation.md`
  (derived from this guide — update both together)
