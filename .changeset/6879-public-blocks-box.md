---
'@object-ui/core': minor
---

Curate `box` in `PUBLIC_BLOCKS` Tier B, so `getPublicConfigs()` offers the neutral block container the catalog already teaches.

`box` was minted as the JSON authoring surface's class-transparent replacement for the deprecated `div` and landed on every declaration face — the `BoxSchema` interface, its zod mirror, `SchemaRegistry`, the registration in `@object-ui/components`, a docs page and 27 catalog fixtures. The curated contract was the one face it missed, so the published `sdui.manifest.json` and `sdui-intrinsics.d.ts` (both generated from `getPublicConfigs()`) omitted a type the vocabulary teaches. Authoring `box` still validated — `page.tsx` builds the JSX-page compiler's manifest from the registry, not from this roster — but a model reading the curated vocabulary could not learn it.

No spec entry was needed: `@objectstack/spec` describes no Tier B layout primitive, so `box` joins `flex` / `grid` / `stack` / `card` / `container` in a population the `registry-inputs-spec-parity` gate has never judged. Measured before the roster was touched, and pinned in `apps/console` over a population derived from the zod layout union rather than restated as a list, so the next minted layout container fails by absence instead of repeating this.
