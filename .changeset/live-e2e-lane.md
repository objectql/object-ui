---
---

ci: the live e2e suite finally runs in CI — against a real, published backend

Release-nothing: adds `.github/workflows/live-e2e.yml`, `e2e/live/ci/*`, one
root script, and no package code.

`e2e/live/**` holds 20+ Playwright specs covering the interaction-critical
paths, and none of them ran in CI — they need a real ObjectStack backend and no
job provided one. That is how framework#3528 shipped: a lazily-loaded widget's
suspension tore down its own flow dialog, a failure only a real browser against
a real backend can see. The specs existed, passed when a human remembered to
run them, and guarded nothing.

The new lane boots `objectstack dev` from PUBLISHED `@objectstack/*` packages
(pinned in `e2e/live/ci/backend.env`, matched to the `@objectstack/spec`
version in `pnpm-lock.yaml`) serving the showcase app checked out at the
commit its release tag points to — so every PR smoke-tests "this console x the
released backend" as a matched pair, with nothing built from framework source.
The showcase metadata pin mirrors the framework repo's `.objectui-sha` console
pin, in the opposite direction.

Two deliberate limits, per the maintainer's ruling on #2835:

- **Informational, non-required**: `continue-on-error: true` keeps the lane
  out of the merge gate until it has proven stable (objectstack#4850 is the
  prior art for a new lane's flake ejecting unrelated PRs from the queue).
- **Allowlist start**: only `screen-flow`, `action-modal` and `master-detail`
  run (`pnpm test:e2e:live:ci`) — grow the list a few proven specs at a time
  instead of switching all 20+ on and inheriting whatever flake exists.

Also removes ci.yml's stale `dev-server` job — `apps/dev-server` left the tree
long ago, `pnpm --filter @object-ui/dev-server build` matches nothing, and the
job has been green by vacuity ever since. And re-enables
`DashboardRenderer.designMode` (skipped since 2026-05-01 as `TODO(#ci-hang)`):
on today's dependency tree the suite passes standalone (24/24), and the
re-enabling PR's own sharded Test jobs gate the full-suite behaviour, so the
skip was outliving whatever transitive dependency caused the hang.
