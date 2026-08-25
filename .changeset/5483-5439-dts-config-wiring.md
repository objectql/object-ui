---
'@object-ui/components': patch
'@object-ui/fields': patch
'@object-ui/plugin-ai': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-charts': patch
'@object-ui/plugin-chatbot': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-designer': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-editor': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-markdown': patch
'@object-ui/plugin-report': patch
'@object-ui/plugin-timeline': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-view': patch
---

Published typings from every `vite-plugin-dts` package now carry an explicit extension on
every relative specifier, and a type error in the declaration build now fails the build
instead of being printed and ignored (objectui#5439, objectui#5483).

**Consumers on `moduleResolution: nodenext` or `node16` may see NEW type errors, and that
is the fix working.** These packages re-export mostly through NAMED re-exports —
`export { useObjectChat } from './useObjectChat'`. TypeScript could not follow the
extensionless hop, but it still DECLARED the name, so the symbol resolved to a silent
`any`. Nothing errored; consumers simply got no types. With the extension emitted, the
symbol carries its real type, and any call site that was relying on the `any` now type
checks for the first time. This is the mode that produced the 21 residual `TS7006` on
`@object-ui/app-shell` reported against objectui#5365 — a type hole that opened quietly,
unlike objectui#5365's own `export * from './ui'` packages where the same defect surfaced
immediately as `TS2305: has no exported member`.

410 extensionless relative specifiers across 19 packages were emitted before this change;
the count is now 0 in all 22 packages that build typings through `vite-plugin-dts`.
`@object-ui/fields` was already clean — its sources write explicit `.js` specifiers — and
is wired so it stays that way.

The second half changes no emitted output today: 22/22 packages built green unmodified, so
making the declaration step's exit code honest turns nothing red. It changes what a FUTURE
regression does — print and exit 0, versus fail the build.
