---
---

CI/docs only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared.

Deletes `.github/workflows/release.yml`, a workflow that never ran once in this
repository's history, and removes the two places on
`content/docs/guide/ci-cd-pipeline.md` that documented it as a release path.

It triggered on `push: tags: ['v*']`. No tag matching that glob has ever existed here:
of the 2896 tags on the remote, every one is a Changesets per-package tag
(`@object-ui/<pkg>@<semver>`) and not one begins with `v`. Nothing creates tags except
the Changesets action, so the trigger had no way to fire.

It is obsolete rather than misconfigured, which matters because the two have opposite
fixes. The workflow parsed and registered fine (GitHub lists it `active`) and would fire
if a `v*` tag were pushed — the job it would do, "Create GitHub Release", is simply
already being done by `changeset-release.yml`, whose Changesets action publishes GitHub
Releases tagged `@object-ui/<pkg>@<version>`. Its own npm publish step was still
commented out under "Uncomment the following steps when ready to publish to npm" while
the repo has been publishing to npm through Changesets for months, and its one-version
model (a single `v<semver>` for the whole repo, pointing at the root `CHANGELOG.md`)
never matched the 39-package fixed group this repo actually releases.

The doc edit is not optional housekeeping: `scripts/__tests__/ci-cd-pipeline-doc.test.ts`
pins that page to `.github/workflows/` in both directions, so a page still naming
`release.yml` after the file is gone fails "never names a workflow file that does not
exist".

No package `src/` is touched, so no `@object-ui/*` package changes behaviour and there is
nothing here for a consumer to upgrade to.
