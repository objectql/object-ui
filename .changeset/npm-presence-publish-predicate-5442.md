---
---

CI only — this publishes nothing, declared explicitly with an empty frontmatter rather
than left undeclared.

`.github/workflows/changeset-release.yml` keys its publish lane on **"is the version this
commit declares already on npm?"** instead of on **"are changesets pending?"**
(objectui#5442, maintainer ruling 2026-08-22, Option B).

The two predicates read as interchangeable and come apart exactly where it costs a
release. The version PR is cut from `main` at T and merged at T+n; `main` takes ~18
merges a working day and the merge does not remove the changesets that landed in
between. Those belong to the *next* version, but keyed on them the version this commit
just bumped to is skipped, and the next version PR bumps straight past it. Measured on
`bc21c704b`: of the 90 versions `packages/core/CHANGELOG.md` declares, 16 never reached
npm, and the repository said `17.6.0` while `dist-tags.latest` said `17.5.0`.

The npm predicate is also cheaper than the one it replaces rather than a trade against
it: an ordinary landing does not move the manifest version, so it answers "already
published" and the expensive job is skipped.

Alongside it, a **loud check**. The defect was never a red run — run 3370 on `cfeb378b5`
completed `success` having published nothing — so the publish lane now reads the registry
back and fails if the version it exists to ship is still absent. A repo/npm divergence is
a failing run, not something an audit finds 16 versions later.

The refresh lane is untouched and still cannot publish: no `publish:` input and no npm
credentials in its `env:`, the double denial that keeps a scheduled tick from releasing
something nobody merged.
