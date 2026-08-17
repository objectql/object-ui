---
'@object-ui/cli': patch
---

The routed temp app's generated manifest now asks for the same `lucide-react` range this repo installs.

`utils/app-generator.ts` writes the routed variant's `dependencies` with two
quoted third-party ranges, and `lucide-react` had fossilised a minor behind the
22 sibling manifests that declare it: the generated manifest said `^1.29.0`
while the repo had moved to `^1.31.0`. A generated app therefore asked npm for
an icon library older than the one every `@object-ui/*` package it installs
alongside was built against.

The drift was not silent — `app-generator.test.ts` derives its expectation from
the in-repo range precisely so a bump on one side and not the other fails a
test, and both of its pins were red. What went wrong is that they went red too
late to stop anything: the dependency PR that moved the repo range merged while
those shards were still running, so the failure surfaced on `main` and then on
the merge ref of every unrelated open PR. The range is now caught up; the
reporting hole and the merge-ordering hole are filed separately (objectui#4968).

The remaining eleven anchored ranges were swept against the same dependabot
batch and are all in sync, so this is the batch's only consumer-side follow-up.
Deriving the value from the workspace instead of quoting it was considered and
rejected: nine of the thirteen anchored ranges quote the repo root manifest,
which is not published with this CLI, so no single derivation can serve the
table and a bespoke one for this one name would leave the class untouched.
