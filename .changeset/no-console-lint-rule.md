---
'@object-ui/app-shell': patch
'@object-ui/fields': patch
'@object-ui/plugin-detail': patch
'@object-ui/runner': patch
'object-ui': patch
---

objectui#4029 — the repo root now lints `no-console` (`error`, allowing
`warn`/`error`) so a stray module- or function-scope `console.log`/`info`/
`debug` fails CI instead of shipping silently (as `console.log('Registering
object-map...')` did in #7139, caught only by hand). Landing the rule meant
individually judging every real hit outside the tooling exemptions
(`scripts/**`, `**/examples/**`, test files, `packages/cli/src/**`,
`packages/create-plugin/src/**`) — this changeset covers the published
packages whose call sites changed:

- `@object-ui/app-shell`: `ObjectDataPage`'s dropped-URL-filter message is a
  real diagnostic (data silently discarded), so it moves from `console.debug`
  to `console.warn` to match the house convention.
- `@object-ui/plugin-detail`: `DetailView`'s Web Share API failure now reports
  via `console.error` (it is a real failure, not debug noise); a redundant
  "Link copied to clipboard" success log is removed.
- `@object-ui/fields`: `MasterDetailField`'s `handleView` stub no longer logs
  the item it does nothing with.
- `@object-ui/runner`: `App`'s loader-selection debug prints, `LayoutRenderer`'s
  unused click-handler stub log, and `MockDataSource`'s per-call narration
  (`find`/`create`/`getObjectSchema`) are removed — none diagnosed a problem,
  they only echoed the happy path.
- `object-ui` (VS Code extension): the "extension is now active!" activation
  log is removed.

No behavior changes beyond console output. `@object-ui/core` and
`@object-ui/data-objectstack` also touch `no-console`-adjacent lines
(`debugLog`/`debugTime`/`debugTimeEnd`, `createQuietHttpLogger`) but only to
add `eslint-disable-next-line` documentation — those ARE the repo's
deliberate debug/logger infrastructure, not leaked residue, so their own
changeset carries empty frontmatter.
