---
---

CI only — this publishes nothing, declared explicitly with an empty frontmatter rather
than left undeclared.

Two changes to `.github/workflows/changeset-release.yml`, the workflow whose last step
publishes to npm.

**The duplicate `pnpm test` is gone.** It re-tested a commit already on `main`, so it
could never keep anything out — it could only stop the release afterwards, and it did:
runs #3606 and #3901, 2 of the last 27 release-PR merges, failed there and skipped the
changesets step entirely. It cost 31m19s of a 33m22s job (medians over the 106 runs of
#3712-#3911 that executed; install 6s, build 35s, the changesets action 24s). The
backstop for `main` is `ci.yml`'s push lane, which runs the whole suite under coverage
across four shards and enforces the thresholds on the merged report.

**The concurrency group is now keyed by commit rather than by branch.** A group shared by
every push to `main` does not queue: GitHub holds one pending run per group and cancels
the rest, so 93 of those same 200 runs were `cancelled` with an empty jobs array — not
one step ever ran. On a workflow that publishes, a discarded run is a discarded publish.
Ordering moves into a fail-open wait step that holds a run until every older release run
has finished, so runs are still serialised, but a contended lane now delays a release
instead of dropping it.
