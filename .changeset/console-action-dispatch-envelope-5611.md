---
---

Internal: the console's admin-override notice now travels on a declared dispatch
type instead of a cast (objectui#5611). No published API and no runtime
behaviour changes, so this changeset declares "no release" rather than a bump —
`@object-ui/app-shell` source moved, nothing it exports did.

`overrideNotice` is the safety copy shown once, ahead of a privileged admin
override that finalises an approval step over approvers who have not acted. Its
producer (`DeclaredActionsBar`) reached its reader (`useConsoleActionRuntime`'s
param-collection dialog) through a `dispatch as ActionDef` cast on one side and
`action?: any` on the other, so nothing declared the key anywhere and the two
could drift apart in silence — rename it on either side and the notice stops
appearing with every test still green, because each side's suite spells the key
itself.

Both ends now share one declaration: `ConsoleActionDispatch`
(`ActionDef & { overrideNotice?: string }`), a HOST-composed envelope that lives
at the seam, in the one package where producer and reader both live. The cast is
gone and both param-collection handlers narrow off `any` — which is what puts
those functions under the compiler at all.

The published `ActionDef` deliberately does NOT declare the key (maintainer
ruling 2026-08-22): it is the authored-metadata mirror, and `overrideNotice` is
the first key no author supplies, so declaring it there would make an unenforced
key legally writable in metadata. `@object-ui/core` is untouched by this change,
and its published `.d.ts` is byte-identical.
