---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(studio): make the Automations and Interfaces pillars authorable in a fresh package

Dogfooding a brand-new package end-to-end (design objects → automations →
interfaces → publish → use) surfaced two blocking dead-ends in the pillar
Studio, both now fixed:

- **Automations pillar had no way to create a flow.** For a package with zero
  flows the rail rendered an endless "加载中…" (loading conflated with empty)
  and offered no create affordance, so automations could never be authored.
  It now tracks the list-loaded state (real empty state "还没有自动化 — 点「新建」开始")
  and has a "+ 新建" inline creator that saves a minimal, valid `start → end`
  autolaunched flow skeleton as a draft and opens it in the flow designer.

- **Interfaces nav items could not be bound to a target — and silently failed
  to save.** Selecting a nav item showed no inspector, and the item shape the
  editor produced (`{ label, object }`, no `id`/`type`) failed the app spec's
  navigation union ("navigation.N: Invalid input"), so the draft never
  persisted and the published app navigation stayed empty. The right panel now
  renders a `StudioNavItemInspector` with a business-friendly object picker
  (populated from the package's published ∪ draft objects) that emits a
  spec-valid `ObjectNavItem` (`{ id, type:'object', objectName, label }`), and
  the nav save drops still-unbound placeholders + backfills a snake_case id so
  one blank item can't fail the whole save.

Also fills in the Home builder-cover i18n keys (`home.build.*`,
`home.template.*`) in `en`/`zh` so the "Build an app" / "Start with a template"
cards resolve real strings instead of falling back to defaults.
