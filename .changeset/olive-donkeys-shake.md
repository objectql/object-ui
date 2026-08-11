---
---

Compile-time only, no published behaviour change (objectui#4281).

`action:button` and `action:icon` composed their `execute({ … })` payload as a
single object literal that spread `localContext`. That binding is `any`, and a
literal spreading an `any` is not excess-property checked — so those two
renderers absorbed invented and misspelled action keys in silence while
`action:group` and `action:menu`, whose payloads carry no spread, rejected them
with `TS2353`. `ActionDef` being a closed surface (objectui#4046) bought those
two sites nothing.

Their explicit keys now live in an `ActionDef`-annotated binding, with the
spreads composed around it, which restores the check. The object that reaches
the runner is unchanged — the same keys, the same values, the same insertion
order, and the same "host context overrides the authored key" precedence, each
pinned in `action-forward-precedence.test.tsx`.

`check:action-forward-parity` now enforces the property structurally, so a
renderer added with the unchecked shape fails CI instead of silently reopening
the hole.
