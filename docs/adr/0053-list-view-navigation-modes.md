# ADR-0053: List-view navigation — two mutually-exclusive modes

**Status**: Accepted (2026-06-18)
**Author**: ObjectUI plugin-view / plugin-list team
**Consumers**: `@object-ui/plugin-view`, `@object-ui/plugin-list`, `@object-ui/types`, `@object-ui/app-shell` (Studio / metadata-admin), `@object-ui/cli` (`check`), every app with an object list page or a list-in-a-page interface

---

## TL;DR

A list surface can today render up to **three** overlapping "change what rows
you see" controls, with no rule stopping them from stacking:

1. **Named-list-view switcher** (Salesforce-style) — the object's saved views,
   from `ObjectViewSchema.listViews` / `defaultListView` / `showViewSwitcher`.
2. **`userFilters`** (Airtable-style) — page-authored, `element: 'dropdown' | 'tabs'`.
3. **`quickFilters`** — preset chip row, from `NamedListView.quickFilters`.

On an object's default list page this produces **two tab-like rows**
("All Tasks / Task List / Grid / Board" + "All / In Progress / Urgent / Done"),
blurring *switch view* vs *filter subset* — a long-standing, never-correctly
resolved confusion.

**Decision:** a list renders **exactly one** navigation mode, selected by
**context**, and the model is designed so AI-authored metadata is
*correct-by-construction*:

| Context | Mode | Control shown | Owner |
| --- | --- | --- | --- |
| Object default list (`ObjectView`) | **`views`** (Salesforce) | named-list-view switcher | **per-user** (author-seeded defaults + each user's own views) |
| List embedded in a page (`InterfaceListPage`) | **`filters`** (Airtable) | `userFilters` (`dropdown` / `tabs`) | **page author** (fixed, design-time) |

`quickFilters` is **deprecated** (it only duplicates `userFilters` `'tabs'`).
`userFilters.element` is canonically **`'dropdown' | 'tabs'`** (`'toggle'`
deprecated). The two modes are encoded as a **discriminated union** so the two
can never coexist in metadata.

---

## Context — what exists today (file map)

- **Salesforce mode** renders in `ObjectView` (`packages/plugin-view/src/ObjectView.tsx`):
  `renderNamedViewTabs` (~:1036) and the `ViewSwitcher` toggle (~:1074, gated by
  `schema.showViewSwitcher`). `ViewSwitcherSchema.variant` already supports
  `tabs | buttons | dropdown`.
- **Airtable mode** is `userFilters` (`packages/types/src/objectql.ts` ~:1833),
  authored by `FilterModeWidget` (None / Tabs / Dropdown,
  `packages/app-shell/src/views/metadata-admin/widgets.tsx` ~:1161), rendered by
  `UserFilters` (`packages/plugin-list/src/UserFilters.tsx`) inside `ListView`
  (~:1666). Page context merges `interfaceConfig.userFilters`
  (`InterfaceListPage.tsx` ~:267).
- **quickFilters** (`NamedListView.quickFilters`) renders as chips in
  `ListView.tsx` (~:2180) — the third, un-owned mechanism.

The only existing mutual-exclusion is `ListView.tsx:~670`
(`schema.tabs?.length ? undefined : resolvedUserFilters`) — it suppresses
`userFilters` when view `tabs` exist, but does **not** cover `quickFilters`
(which always render) nor the view switcher. No single context-driven
discriminator exists, so the mechanisms render independently and stack.

---

## Decision

1. **`navMode` resolved from context, not from independent fields.**
   `ObjectView` → `navMode = 'views'`; `InterfaceListPage` (list-in-a-page) →
   `navMode = 'filters'`. `ListView` honors it: `'views'` renders the named-view
   switcher and **suppresses** `userFilters` + `quickFilters`; `'filters'`
   renders `userFilters` and **suppresses** the switcher.

2. **Discriminated union `ListNav` is the canonical config** (so invalid
   "both modes" is unrepresentable):
   ```ts
   type ListNav =
     | { mode: 'views';   views: Record<string, NamedListView>; default?: string;
         switcherVariant?: 'tabs' | 'buttons' | 'dropdown' }
     | { mode: 'filters'; element: 'dropdown' | 'tabs'; fields?: …; tabs?: … };
   ```
   Legacy fields (`listViews` / `userFilters` / `quickFilters`) are read at
   runtime and adapted into this union for back-compat.

3. **Deprecate `quickFilters`.** It only duplicates `userFilters` `'tabs'`. Its
   presets fold into named views (object) or `userFilters` `'tabs'` (page). A
   read-time adapter maps residual `quickFilters` → derived named views so
   existing apps render correctly in `views` mode with a single switcher.

4. **`userFilters.element` canonical = `'dropdown' | 'tabs'`.**
   - `'dropdown'` = per-field value filters: each author-selected field renders
     its own dropdown/popover of that field's values (`DropdownFilters`).
     A distinct, **retained** capability.
   - `'tabs'` = named filter presets.
   - `'toggle'` is **deprecated** (already absent from `FilterModeWidget`; type
     value kept readable for legacy only, removed from the canonical union).

5. **Views and page-tabs are NOT merged** despite looking alike — they differ on
   the dimension that matters most, **ownership / lifecycle**:

   | | List views (`views`) | Page tabs (`filters`/`tabs`) |
   | --- | --- | --- |
   | Defined by | each **user** (+ author-seeded defaults) | **page author** only |
   | Mutable | at **runtime**, per user | **design-time**, fixed |
   | Persistence | per-user/shared records | page metadata |

   Merging would force a bad trade (expose author-fixed tabs to user editing, or
   strip personalization from list views). Instead: **separate the concepts,
   share the presentation** — both render through one `ListNavBar` component for
   visual consistency. The `mode` discriminator therefore also encodes
   *ownership* (`views` = user-personalizable; `filters` = author-fixed).

6. **Studio**: a given authoring surface exposes only its context's mode —
   object-view config authors named views; page config authors `userFilters` via
   `FilterModeWidget`. `quickFilters` editing is removed.

### Semantic change (accepted)

`quickFilters` were **additive / multi-select**; folded presets (named views /
`userFilters` tabs) are **single-select**. This simplification is intentional.

---

## AI-authoring safety (correct-by-construction)

Because metadata is authored by AI, the model must make "choose wrong"
structurally hard, not rely on the author choosing well. Five layers:

1. **Schema** — the `ListNav` discriminated union makes "both modes" a type
   error; `quickFilters` is absent from the union, so it can't be authored.
2. **Context default** — `mode` defaults from context (object list → `views`;
   page list → `filters`), so the AI usually doesn't choose at all.
3. **Validation** — `objectql.zod.ts` `refine` rejects two-mode configs and
   `quickFilters`; wired into the `check` / `doctor` CLI + CI. The AI authoring
   loop receives the validation error and **self-corrects**.
4. **Descriptions** — the rule lives in the field `.describe()` / JSDoc the AI
   reads when authoring (not only here), so the assistant's grounding carries it.
5. **Runtime determinism** — even if bad data slips through, `navMode` renders
   exactly one mode; the user never sees the two-row state.

---

## Consequences

- **Positive**: one unambiguous control per list; object page shows a single
  row; authors (human or AI) pick a mode by *where the list lives*, not by
  combining flags; invalid states are largely unrepresentable.
- **Risk**: shared plugin change affecting every app's list surface; the
  additive→single-select semantic change; needs the read-time adapter + fixture
  rewrite to fully retire `quickFilters`.
- **Back-compat**: legacy metadata keeps rendering via the adapter;
  `quickFilters` / `toggle` stay readable but deprecated until removed later.

## Phasing

- **Phase 1 — runtime determinism (stop the bleeding)**: `navMode` mutual
  exclusion in `ObjectView` / `ListView` + `quickFilters` → derived-named-views
  read-time adapter. No data change; existing apps render one row.
- **Phase 2 — correct-by-construction**: introduce the `ListNav` discriminated
  union + Zod `refine` + `check` rule + field descriptions + shared `ListNavBar`
  presentation component; canonicalize `userFilters.element` to `dropdown|tabs`.
- **Phase 3 — migration & removal**: rewrite fixtures (e.g. `showcase_task`) to
  the union; remove the adapter, `quickFilters`, and `toggle`.

## Alternatives considered

- **Keep all three, add guards only** — leaves three concepts and ongoing author
  confusion; treats symptom not cause; rejected.
- **Merge views and page-tabs into one mechanism** — collapses the
  user-configurable vs author-fixed ownership distinction; rejected (separate
  concepts, shared presentation instead).
- **Make `quickFilters` the canonical preset for both modes** — keeps a third
  concept and re-introduces a second row on the object page; rejected.
