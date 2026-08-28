---
'@object-ui/app-shell': patch
---

The console's `<PageHeader>` spells its secondary line `subtitle`, the same key the other `PageHeader` in this repo uses (objectui#4761).

This repository has two components named `PageHeader`. `@object-ui/layout`'s is
the renderer for the authored `page:header` / `page-header` node and converged
on `subtitle` in objectui#3789, because `subtitle` is the key
`@objectstack/spec/ui`'s `PageHeaderProps` declares. `@object-ui/app-shell`'s —
the console's own title row, drawn by `ObjectView` and `ObjectDataPage` —
spelled the very same concept `description` and had no `subtitle` at all. Both
rendered correctly; the defect was one concept carrying two key names one
package apart, the objectstack#4115 shape moved up a layer. An author reading
one component to learn the other was being taught a key the contract does not
have.

**Not a breaking change, measured rather than assumed.** The convergence is a
plain rename with no alias, because this component is not on the published
surface:

| gauge | result |
|---|---|
| exports of `dist/index.d.ts`, through the TypeScript checker | 226 symbols; `PageHeader` and `PageHeaderComponentProps` are not among them (controls: `AppShell` reachable, a nonsense name not) |
| `exports` map | declares exactly `.` and `./styles.css` |
| Node resolving `@object-ui/app-shell/layout`, `…/dist/layout/PageHeader.js`, `…/src/layout/PageHeader.js` | `ERR_PACKAGE_PATH_NOT_EXPORTED` for all three, while the declared entry resolves |
| in-repo call sites | 2, both inside this package (`ObjectView.tsx`, `ObjectDataPage.tsx`) |
| emitted declarations that change | `dist/layout/PageHeader.d.ts` only — `dist/index.d.ts` and `dist/layout/index.d.ts` are byte-identical across the change (`8c886251…`, `f9f4862b…`, both legs) |

No supported specifier reaches the prop, so there was nothing to keep
compatible, and a renderer-side `description` alias would have been exactly the
second dialect AGENTS.md #0.1 forbids — the layout side had just finished
retiring one. Out-of-repo consumers cannot be enumerated from this repository;
what can be, and is, is the set of import paths through which one could have
reached this component, which is empty.

Rendered output is unchanged: same element, same classes, same position. The
patch tier is a declaration that the tarball moved, not a claim that a consumer
must act.

`packages/app-shell/src/layout/__tests__/PageHeader.subtitle.test.tsx` is the
pin the card asked for. It asserts the subtitle on the DOM a reader gets (a
`<p>`, in the title block, after the `<h1>`), that `description` now draws
nothing and is rejected by the compiler, and — the assertion that actually goes
red if either side drifts again — that both packages' `PageHeaderComponentProps`
declare `subtitle`.
