---
"@object-ui/app-shell": patch
---

fix(studio): lookup target picker can see the package's own draft objects

When designing a set of related objects in one authoring pass, the field
inspector's lookup "related object" picker only listed **published** objects
(`list('object')`), so sibling objects still in draft — the ones you're most
likely to point a new lookup at — were invisible and had to be typed as a raw
API name, blind. The picker now also merges unpublished object drafts
(`listDrafts({ type: 'object' })`, labelled "(草稿)"), so a lookup can target a
sibling object before the package's first publish.
