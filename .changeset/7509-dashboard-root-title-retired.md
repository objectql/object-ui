---
'@object-ui/app-shell': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-designer': minor
---

Retire the dashboard-**root** `title` read across all five surfaces (objectui#7509,
maintainer ruling 2026-09-04, decision batch #29, option C, under ADR-0049).

**What changes for an operator.** A stored dashboard whose header came from a legacy
root `title` now shows its `label`. `label` is the only header source, then the raw
`name`.

Per surface:

- Console dashboard page (`DashboardView`) — header falls to `label`, then `name`.
- Standalone dashboard embed (`DashboardRenderer`) — `header` shows `label`; a document
  with no `label` now shows no header title at all.
- The `dashboard-grid` SDUI component (`DashboardGridLayout`) — heading falls to
  `label`, then the generic `Dashboard`.
- Studio dashboard designer (`DashboardEditor` preview panel, `DashboardDesignPage`
  heading) — both fall to `label`, then `name` / the generic heading.

**Why now.** `@objectstack/spec`'s `DashboardSchema` refuses a root `title` **by name**
(`unrecognized_keys(title)`), and the save route answers `422 INVALID_METADATA` — so no
authored dashboard can acquire the key, and what retires is compatibility with documents
stored before that refusal existed. Until now five surfaces read the legacy spelling
independently, which meant a legacy document could show one header in the console and a
different one in the designer. One spelling now answers everywhere.

**Migration.** `label` is REQUIRED on `DashboardSchema`, so a spec-valid stored dashboard
already carries it and needs no change — it simply starts showing that `label` instead of
the legacy `title`. A document carrying `title` and no `label` was already invalid; give
it a `label`. No in-repo document needed migrating: a sweep of all 627 tracked JSON found
9 dashboard-shaped nodes, and the 6 carrying a root `title` are `type: 'dashboard'`
component examples that declare no `header`, so none of them rendered a header title
either before or after.

**Not affected: widget titles.** `DashboardWidget.title` is a different, spec-**declared**
key (the spec's `I18nLabel`) on a different receiver, and is untouched — widget headings,
the designer's widget-title input and its per-locale write path all behave exactly as
before. Root and widget arms were separated by receiver, and the retirement's pins carry
widget-level controls on every surface for that reason.
