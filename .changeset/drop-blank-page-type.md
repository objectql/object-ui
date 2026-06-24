---
"@object-ui/types": minor
"@object-ui/react": minor
---

chore: drop the unrendered `blank` / `record_review` page types and their config

The `blank` and `record_review` page types have no renderer and were removed
from `@objectstack/spec`'s `PageTypeSchema` (framework#2265, enforce-or-remove).
This drops their now-dead references in objectui so the upstream spec can hard-
remove `BlankPageLayoutSchema` / `RecordReviewConfigSchema`:

- `PageType` union: removed `dashboard` / `form` / `record_detail` /
  `record_review` / `overview` / `blank` (grid/gallery/kanban/calendar/timeline
  remain — those are list *visualizations*, a separate cleanup).
- Removed `blankLayout` from `PageLayout` and the `blankLayout` / `recordReview`
  handling in the spec→SDUI page bridge.
- Removed the redundant `BlankPageLayout{,Schema,Item,ItemSchema}` re-import from
  `@objectstack/spec/ui` (it was never used).
