---
'@object-ui/types': minor
---

`@object-ui/types/zod`: the zod const `StylePropsSchema` is renamed to `ClassNameStylePropsSchema` (objectui#5928). **The old name is gone** — there is no deprecated alias and no second spelling. Import `ClassNameStylePropsSchema`.

**What moves on the published surface.** `StylePropsSchema` is removed from `@object-ui/types/zod`; the same object is exported under the new name with the same accept set, so nothing that parsed before parses differently and nothing refused before is accepted now. The break is the name alone: an import of `StylePropsSchema` no longer resolves.

**Why the name had to move.** The const declares exactly two keys — `className` and `style`, the CSS passthrough attributes a node exposes. The TypeScript `StyleProps` (`base.ts`) is the Tailwind-SCALE vocabulary: `padding`, `margin`, `gap`, `backgroundColor`, `textColor`, `borderWidth`, `borderColor`, `borderRadius`. Measured on this branch's base with an AST read of both files: 2 keys against 8, sharing ZERO keys. In this package the `…Schema` suffix otherwise means "runtime mirror of the like-named declaration", so the shared name asserted a mirror relationship that does not exist — and building objectui#5684's parity registry by name pairing duly put the two together and reported drift on a pair that has no counterpart at all.

**Where the non-pair is recorded now.** `zod-mirror-parity.test.ts` keys its existing `EXCLUSIONS` entry — the mechanism that accounts for every exported const with no TypeScript declaration to mirror, each with its stated reason — to `ClassNameStylePropsSchema`. Named for its own two keys, the const leaves no like-named declaration for a name-derived pairing to reach for.

**No deprecation window, deliberately.** No consumer of the old name exists in this repository. Measured on this branch's base: `StylePropsSchema` had exactly three references — the definition, the barrel line, and the guard's own exclusion key — all three inside `packages/types` (lit control on the same query shape: `BaseSchema` matches 251 tracked files). A staged retirement would need named external-consumer evidence, and there is none.
