---
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
'@object-ui/fields': minor
---

Detail-page related lists: `relatedList: 'primary'` → own tab, multi-FK & self-referential related lists, unified picker columns (framework #2579).

- **plugin-detail** (`buildDefaultTabs`): the default related-list layout is now
  the ADR-0085 prominence rule — lists whose FK declares `relatedList: 'primary'`
  each get their OWN tab; every other related list collapses into a single
  "Related" tab. With no primary lists this is byte-for-byte the previous stacked
  default, so it is opt-in per relationship. `relatedLayout: 'tabs' | 'stack'`
  remain app-level overrides (force all-own-tabs / all-stacked).
- **app-shell** (`deriveRelatedLists`): emits one related list per eligible FK —
  a child referencing the parent through several relationships (e.g.
  `primary_account` + `partner_account`) now surfaces each, disambiguated by the
  FK label; includes self-referential relationships (hierarchies → a "child"
  list); and carries the `isPrimary` prominence flag through. `RecordDetailView`
  threads `isPrimary` into the synthesized page.
- **fields** (`deriveLookupColumns`): the lookup-picker default columns now
  prefer the object's ADR-0085 `highlightFields` (then legacy `displayFields`,
  then the field walk) — the same "how to list this object" source the related
  list uses, so a picker and a related list of the same object agree with zero
  per-surface config.

Pairs with the `@objectstack/spec` change that makes `relatedList` a tri-state
(`boolean | 'primary'`) and `record:related_list` `columns` optional.
