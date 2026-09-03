---
---

Internal test-support only: `@object-ui/test-support` gains `arrayElementSchema`
(objectui#5872 class (2)), and the three disagreeing hand-written array-element
walks in `plugin-detail`, `app-shell` (previews) and `app-shell`
(clientValidation) converge onto it, along with one `.unwrap().options` read in
`data-objectstack`. No published runtime source changes: the diff is test files
plus a `private: true` workspace package that ships in no bundle, so this
declaration carries an EMPTY frontmatter — nothing to version.
