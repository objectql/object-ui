---
title: "Designing App Navigation"
description: "How to choose between object navigation, named views, custom pages, and dashboards when composing an app"
---

# Designing App Navigation

When you compose an app, the same requirement can often be expressed three
ways: a plain object menu entry, an object entry pinned to a named view, or a
custom page that embeds views. They are **not** interchangeable — this guide
gives you the decision rules. (The canonical, agent-facing version lives in
`skills/objectui/guides/app-composition.md`; keep the two in sync.)

## The Three Ways to Reach a List

Say your app has a `project` object:

| You write | User lands on | You get for free |
|---|---|---|
| `{ "type": "object", "objectName": "project" }` | `/apps/my_app/project` — the object's **default view** | The full object shell: view switcher, object actions, a create button, record detail routing, search and recent-items integration |
| `{ "type": "object", "objectName": "project", "viewName": "project.by_status" }` | `/apps/my_app/project/view/project.by_status` | The same shell, with the entry **anchored** to a named view — users can still switch |
| `{ "type": "page", "pageName": "project_overview" }` | `/apps/my_app/page/project_overview` | Nothing but your page schema. View switching, actions, and record links must be assembled by hand |

The key asymmetry: a page can imitate the other two, but it **loses the object
shell** — and every future improvement to that shell (new actions, better view
switching, permission trimming) will skip your page.

## The Rule of Least Power

Use the least powerful construct that expresses the requirement:

1. **Default: one plain `object` entry per core business object.**
   No `viewName`. The default view is defined by view metadata, so the
   navigation layer stays decoupled from presentation.

2. **Add `viewName` when the menu item is a named slice.**
   If the label is a *perspective* — "By Status", "Due This Week",
   "My Tasks" — create a named view (convention: `<object>.<key>`, e.g.
   `project.by_status`) and anchor the entry to it. `viewName` sets the
   entry point; it does not lock the user in.

3. **Create a page only for composition a single object view cannot express.**
   Multiple objects side by side or in tabs, KPI cards mixed with lists,
   onboarding or static content, parameterized pages. A page that wraps a
   single object's single view is an anti-pattern.

4. **Use `dashboard` for metric/chart aggregation and `report` for tabular
   analysis** — don't rebuild them as pages of chart blocks.

5. **One entry per target.** Don't offer the same object through both a plain
   entry and a page that wraps its default view. If one object needs several
   menu entries, make all of them named-view entries — mixing styles breaks
   active-state highlighting in the sidebar.

As a rule of thumb, in a typical business app about 80% of navigation entries
should be `object` entries (with or without `viewName`); pages are for the
home screen, onboarding, and cross-object workbenches.

## Write Spec-Shaped Items

Navigation is a discriminated union on `type`. Each type has its own target
field — there is no generic `path` and no `kind`:

```json
{
  "navigation": [
    { "id": "nav_projects", "type": "object", "objectName": "project", "label": "Projects" },
    { "id": "nav_by_status", "type": "object", "objectName": "project", "viewName": "project.by_status", "label": "By Status" },
    { "id": "nav_kpis", "type": "dashboard", "dashboardName": "company_kpis", "label": "KPIs" },
    { "id": "nav_workbench", "type": "page", "pageName": "cross_object_workbench", "label": "Workbench" },
    { "id": "nav_docs", "type": "url", "url": "https://docs.example.com", "target": "_blank", "label": "Docs" }
  ]
}
```

Requirements:

- `id` (snake_case), `type`, and `label` are mandatory on every item.
- The target field must match the type: `objectName`, `pageName`,
  `dashboardName`, `reportName`, or `url`. Keys like `path` or `kind` are
  ignored at runtime and rejected at save.
- Put items under the `navigation` key. `menu` is deprecated legacy and only
  kept for backward compatibility.

Object entries also support record deep-links — `recordId` (with template
variables like `{current_user_id}`) opens a specific record, which is how
"My Profile"-style entries are built.

## Quick Checklist

Before publishing an app, scan the navigation for:

- Pages that merely wrap a single object view → replace with an object entry.
- Items carrying `path`/`kind` → rewrite as typed items.
- The same object reachable twice (plain entry + wrapper page) → keep one.
- View names not following `<object>.<key>`, ids not snake_case → rename.
