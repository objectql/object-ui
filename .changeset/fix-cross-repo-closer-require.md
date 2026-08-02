---
---

fix(ci): hand the cross-repo token to github-script instead of requiring @actions/github

Release-nothing: touches `.github/workflows/cross-repo-issue-closer.yml` only.

`require('@actions/github')` is not resolvable from a github-script `script:`
block — the action bundles its dependencies, so the call fails at runtime with
`MODULE_NOT_FOUND`. The token is now handed to the action itself
(`github-token:`), which makes the injected `github` client the cross-repo one,
with `secrets.GITHUB_TOKEN` as the fallback so the report path can still
comment on the pull request when no cross-repo credential is configured.

Found on this workflow's first run that got past parsing. The run also
confirmed the credential logging works — `CROSS_REPO_ISSUE_TOKEN: configured`
followed by `Cross-repo targets: objectstack-ai/objectstack#4475` — so the
job now fails at the last step rather than the first.
