---
'@object-ui/types': minor
'@object-ui/components': minor
---

Mint the `box` component type — the class-transparent neutral block container
(objectui#3965, maintainer ruling 2026-08-29 方案 A).

The JSON authoring vocabulary had no neutral block box, which is why the
deprecated `div` could never actually retire: every replacement the deprecation
notice names injects layout of its own (`container` adds width/centering and a
responsive padding ramp, `flex`/`stack` add a display mode and gaps, `grid` adds
`grid-cols-*`, `card` adds border/shadow and wraps children in a `CardContent`
element — all measured through the real `SchemaRenderer`). `box` closes that
gap with a three-clause contract, pinned in
`packages/components/src/renderers/__tests__/box-neutral-container.test.tsx`:

1. renders `children`;
2. authored `className` passes through **verbatim**;
3. **zero** injected classes.

Deliberately unlike `div`, `box` reads `children` only — never `schema.body`.
The `div` renderer's `children || body` fallback is what made a mechanical
`div`→X swap silently drop content on `body`-authoring nodes while the element
count stayed unchanged; content moves into `children` at migration time (the
objectui#6771 B-ruling direction).

Landed on both contract faces per the zod-mirror-parity pairing (objectui#6424
family form): `BoxSchema` interface in `@object-ui/types`, its zod mirror in
`@object-ui/types/zod`, the `SchemaRegistry['box']` entry, and the registry
registration (`namespace: 'ui'`, `isContainer: true`). With `box` landed, the
catalog's 25 remaining `div`-authoring fixtures (80 nodes) migrate to it
mechanically with zero render difference, and the catalog ratchet closes to
zero tolerance for JSON-authored `div`.
