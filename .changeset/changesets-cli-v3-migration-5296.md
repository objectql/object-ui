---
---

Release-tooling only, no published package changes (objectui#5296).

`@changesets/cli` moves from `^2.31.1` to `^3.0.0`, together with the
`.changeset/config.json` changes v3's defaults require — the two halves are
broken apart, and each half is broken silently until the next release, so they
land in one commit.

- `privatePackages` is now declared explicitly as `{ "version": true,
  "tag": false }`. Omitting it used to mean exactly that under v2 and means
  `{ "version": false, "tag": false }` under v3, and `version: false` marks
  private packages *ignored* rather than merely unbumped. This repo keeps one
  private package inside the `fixed` group — `object-ui`
  (`packages/vscode-extension`), which ships to the VS Code marketplace instead
  of npm — and one pending changeset names it beside four published packages,
  which under the new default makes the release plan a rejected "mixed
  changeset". Measured: `changeset status` and `changeset version` both exit 1
  on the bump alone, and green PR CI cannot see it, because no PR workflow runs
  either command.
- `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH.onlyUpdatePeerDependentsWhenOutOfRange`
  is removed. `@changesets/assemble-release-plan@6` reads it in six places and
  `@7` in none, so it is load-bearing under v2 and inert under v3 — removable
  only in the commit that lands the bump.
- `$schema` moves from `@changesets/config@3.1.2` to `@changesets/config@4.0.0`.
- `scripts/check-changeset-fixed.mjs` gains the two rules that make the above
  mechanical: `privatePackages` must be declared, and a private package in the
  `fixed` group must not be paired with `version: false`. Rehearsed against the
  real pending stock in a throwaway clone; the v3 release plan is identical to
  the v2 one, package for package.
