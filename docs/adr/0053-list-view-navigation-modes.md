# ADR-0053: List-view navigation — two mutually-exclusive modes

**Status**: Accepted (2026-06-18; revised after implementation spike)
**Author**: ObjectUI plugin-view / plugin-list / app-shell team
**Consumers**: `@object-ui/types`, `@object-ui/plugin-view`, `@object-ui/plugin-list`, `@object-ui/app-shell` (Studio / metadata-admin), `@object-ui/cli` (`check`), every app with an object list page or a list-in-a-page interface
**Supersedes**: the list-tab placement of **ADR-0047** (per-view `tabs` on the object data-mode list)

---

## TL;DR

This is an **architecture decision for a metadata-driven, AI-authored app
platform**, not a cosmetic fix. A list surface today exposes **five** overlapping
"change what rows you see" mechanisms with no rule preventing them from stacking
(an object list renders two tab rows). The goal is a metadata model where the
**right configuration is correct-by-construction** — an AI author cannot express
the invalid state.

**Decision:** a list has exactly **one** navigation mode, chosen by **context**,
expressed as a discriminated union `ListNav`:

| Context | `ListNav.mode` | Control | Owner |
| --- | --- | --- | --- |
| Object default list (`ObjectView`) | **`views`** | named-list-view switcher (`ViewTabBar`) | per-user (author-seeded + user-created) |
| List embedded in a page (`InterfaceListPage`) | **`filters`** | `userFilters` (`dropdown` \| `tabs`) | page author (fixed) |

We **clean-build** this model (no back-compat adapters). The five mechanisms
collapse to two; everything else is removed. Showcase / fixtures are rewritten
to the new model (sample data is disposable).

---

## The five mechanisms today (implementation spike findings)

| # | Mechanism | Source field | Renderer | Verdict |
| --- | --- | --- | --- | --- |
| 1 | View switcher | `objectDef.listViews` / saved views | app-shell `ViewTabBar` | **KEEP — canonical** |
| 2 | Named-view tabs | `schema.listViews` | plugin-view `renderNamedViewTabs` | **REMOVE — duplicates #1** |
| 3 | In-list tabs | `viewDef.tabs` (ADR-0047) | plugin-list `TabBar` | **FOLD into `userFilters` tabs** |
| 4 | Quick filters | `quickFilters` | plugin-list chips | **FOLD into `userFilters` tabs** |
| 5 | User filters | `userFilters` `{element: dropdown\|tabs\|toggle}` | plugin-list `UserFilters` | **KEEP `dropdown`+`tabs`; drop `toggle`** |

Key control point: `app-shell/views/ObjectView.tsx` `renderListView` rebuilds the
list schema as `viewDef.* ?? listSchema.*` — the real place modes are wired.
Render paths are already split: `ObjectView` (views) vs `InterfaceListPage`
(filters, drives `ListView` directly).

## Decision detail

1. **`ListNav` discriminated union** (in `@object-ui/types`) is the single config:
   ```ts
   type ListNav =
     | { mode: 'views';   /* object named views drive the switcher */ }
     | { mode: 'filters'; userFilters: { element: 'dropdown' | 'tabs'; … } };
   ```
   Context resolves `mode` (object list → `views`; page list → `filters`); the
   union makes "both modes / both controls" unrepresentable.

2. **Views mode** = `ViewTabBar` only (object `listViews`, per-user: seeded
   defaults + user-created/saved views, single-select). Remove
   `renderNamedViewTabs`.

3. **Filters mode** = `userFilters` only, `element: 'dropdown' | 'tabs'`:
   - `dropdown` = per-field value filter (each selected field → its own
     dropdown of values). Distinct, retained.
   - `tabs` = named filter presets (single-select).
   - `toggle` removed.
   Remove `viewDef.tabs`/`TabBar` and `quickFilters` — both fold into
   `userFilters` `tabs`.

4. **Status-style presets become named views** (e.g. "In Progress", "Urgent")
   so the object page keeps one-click status access *as proper views* in the
   `ViewTabBar` — the Salesforce model. Authors seed them; users add their own.

5. **Shared `ListNavBar`** renders both the views switcher and the filters
   tabs/dropdown — concepts stay separate (different ownership/persistence),
   presentation is unified.

6. **AI-authoring safety** (correct-by-construction): (a) the `ListNav` union
   makes invalid states untypable; (b) context supplies the default `mode`;
   (c) `objectql.zod.ts` `refine` + the `check`/`doctor` CLI reject leftover
   `tabs`/`quickFilters`/`toggle` and any two-mode config — the AI loop self-
   corrects on the error; (d) the rule lives in field `.describe()`/JSDoc the AI
   reads; (e) runtime resolves exactly one mode regardless.

7. **Studio**: each authoring surface exposes only its context's mode — object
   views author named views; page config authors `userFilters`.

## Clean-build, not migrate

Because this is foundational architecture and sample data is disposable, there
are **no runtime back-compat adapters**. The deprecated fields
(`tabs`, `quickFilters`, `userFilters.toggle`, `schema.listViews` duplication)
are removed from types and consumers, and showcase / example fixtures are
rewritten to `ListNav`. (External apps on the old shape get a one-time codemod /
`check` error with a fix hint, not silent runtime adaptation.)

## Consequences

- One unambiguous control per list; the object page shows a single switcher.
- Authors (human or AI) pick a mode by *where the list lives*; invalid states
  are largely untypable and otherwise caught by `check`.
- Larger blast radius: types + plugin-view + plugin-list + app-shell + Studio
  + CLI. Sequenced as several verified PRs (below).

## Phasing (each an independent, browser-verified PR)

1. Remove the duplicate renderer (`renderNamedViewTabs`); object list = one
   switcher. *(landed as the spike — PR #1801)*
2. `ListNav` union in `@object-ui/types`; runtime reads it.
3. Fold `tabs` + `quickFilters` → `userFilters`; drop `toggle`; shared
   `ListNavBar`.
4. Zod `refine` + `check` rule + field descriptions.
5. Rewrite showcase / fixtures to `ListNav`; delete removed fields.

## Alternatives considered

- **Keep all five + guards** — perpetual author confusion; rejected.
- **Back-compat adapters** — unnecessary given disposable sample data and an
  architecture-first goal; rejected in favour of a clean model + codemod.
- **Merge views & page-tabs into one concept** — collapses the user-configurable
  vs author-fixed ownership distinction; rejected (separate concepts, shared
  `ListNavBar` presentation).
