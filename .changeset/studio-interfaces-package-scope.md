---
"@object-ui/app-shell": patch
---

fix(studio): Interfaces designs the CURRENT package's app, not another's

The Interfaces pillar resolved its app with an unscoped `list('app')` and a
client-side `.find()` by package — but list rows carry no `packageId`, so the
match never hit and it fell through to `?? apps[0]`, the first app in the whole
system. Opening `/studio/<pkg>/interfaces` for a package with no app therefore
rendered a **different** package's navigation tree (e.g. `showcase_app`), and a
package that genuinely had no app was stuck on an endless "加载中…".

Now the query is scoped to the package (`list('app', { packageId })`, matching
the header's own resolution) with no cross-package fallback; a freshly-created
(still-draft) app is picked up via `listDrafts({ packageId, type: 'app' })` so it
stays designable before its first publish. When the package has no app, the nav
rail and canvas show a real empty state ("这个软件包还没有应用") with a 创建应用
action wired to the header's existing create flow, and edit mode now renders the
nav canvas even on an empty tree so the first item can be added.
