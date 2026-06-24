---
'@object-ui/app-shell': minor
---

feat(studio): multi-hop relationship fields in the dataset designer (ADR-0071)

The dataset designer's field catalog and Included-relationships picker now
support multi-hop relationship paths (`account.owner.region`), matching the
framework's multi-hop join support (ADR-0071 P2):

- `useDatasetFieldCatalog` walks each included path hop-by-hop, fetching every
  object along the chain, so `path.field` options surface for fields two–three
  to-one hops deep (grouped under a chained `Account → Owner → User` heading).
- The Included-relationships combo offers one level deeper along each
  already-included path (drill `account` → `account.owner`), capped at 3 hops.
- The author-time "relationship not in Included" warning generalizes to the full
  relationship path (`account.owner`), with one-click "Add it".

Single-hop datasets are unchanged.
