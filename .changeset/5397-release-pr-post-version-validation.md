---
---

CI-only: the changeset release workflow's refresh lane now renders the
post-version tree, validates the surfaces `changeset version` can move
(`QUICK_REFERENCE.md`, the generated `CHANGELOG.md` files, the manifest
versions as the tooling suite reads them) and restores the tree before
`changesets/action` opens or updates the version PR. No package changes.
