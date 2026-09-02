---
'@object-ui/core': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-grid': patch
---

A synthesized default list view now always leads with the object's name field
(objectui#7245).

**The defect.** An object that declares no list view gets its default grid columns
synthesized from `highlightFields`, taken verbatim. But `highlightFields` is ADR-0085's
*"most important fields"* role, not a column list — and its first consumer, the
detail-page highlight strip, **deliberately removes the title field**, because the page
H1 directly above it already shows one. So metadata that is entirely correct routinely
omits the record's name from `highlightFields`. The showcase `showcase_account` declares
`nameField: "name"` and `highlightFields: ["status", "industry", "annual_revenue"]`, and
its default `所有记录` grid rendered 14 rows whose columns were `#` / Lifecycle / Industry
/ Annual Revenue / actions — no name column, and no way to tell one account from another.

A list has no H1 to lean on, so the same declaration needs the opposite treatment here.
This is not a new convention: `deriveLookupColumns` in `@object-ui/fields` already leads
its record-picker columns with the display field and filters it out of the declared list.
The list faces now agree with it.

**What changed.** `@object-ui/core` gains two exports on the ADR-0079 title ladder:

- `resolveNameField(objectDef)` — *which field* titles an object: the declared
  `nameField` (then its deprecated `displayNameField` / `NAME_FIELD_KEY` aliases), else
  the type-aware derivation. The name-space twin of `getRecordDisplayName`, which answers
  what that field *says* on one record. Both now read one spelling of the declared
  pointer, so they cannot drift into naming different fields.
- `leadWithNameField(objectDef, columns)` — moves that field to the front of a
  **synthesized** column list.

All three faces that synthesize default list columns call it: `ObjectView`
(`defaultListColumnsFromObject`), `InterfaceListPage` (`defaultColumnsFromObject`) and
`ObjectGrid`'s own derivation. The name field is **moved**, not merely appended, so an
author who lists it third still gets it first — "the column that identifies the row"
means first. On the two capped faces the lead is applied *before* the 5 / 6-column slice,
so an object declaring its name field late no longer loses it off the end.

**Scope, deliberately narrow.** Author-declared column lists are untouched — a view or
grid that declares `columns` / `fields` said what it wants, and reordering it would be
renderer-side second-guessing of metadata. Three cases also decline to lead: a name field
the object carries no field def for (never fabricate a column), one marked
`hidden: true` (the author said don't show it), and a *derived* pick that lands on a
system-managed column — `deriveTitleField` filters by type only, and leading a default
list with a raw id is the regression objectui#2702 / #2777 fixed. A *declared*
`nameField` pointing at a system field still leads: `sys_migration` really does point at
`id`, and an explicit designation is not a heuristic misfire.
