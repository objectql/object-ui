---
"@object-ui/types": minor
---

`@object-ui/types/zod`: `StylePropsSchema` is renamed to `ClassNameStylePropsSchema`, with the old name kept as a deprecated alias for one release (objectui#5928)

The zod const `StylePropsSchema` (`zod/base.zod.ts`) declares exactly two keys — `className` and `style`, the CSS passthrough attributes. The TypeScript `StyleProps` (`base.ts`) is the Tailwind-SCALE vocabulary: `padding`, `margin`, `gap`, `backgroundColor`, `textColor`, `borderWidth`, `borderColor`, `borderRadius`. Measured on this base with an AST read of both files: 2 keys against 8, sharing ZERO keys.

In this package the `…Schema` suffix otherwise means "runtime mirror of the like-named declaration" — 154 registered pairs on this tree (`Object.keys(MIRRORS).length` in `zod-mirror-parity.test.ts`, counted from the AST of that object literal). So the shared name asserted a mirror relationship that does not exist, and building objectui#5684's parity registry by name pairing duly put the two together and reported drift on a pair that has no counterpart at all.

**Published surface.** `ClassNameStylePropsSchema` is added; `StylePropsSchema` continues to be exported from `@object-ui/types/zod` as a deprecated alias of the same object (same reference, same accept set — nothing that parsed before parses differently), and is removed one release out. Import the new name.

**The guard half.** `zod-mirror-parity.test.ts` now carries `NAME_NON_PAIRS`: the consts a name-derived pairing must SKIP, each with the reason it is skipped and the declaration it is skipped against. The reason is not prose — the suite re-measures the claim it rests on on every run: the named declaration must still exist, and the two sides must still share no key. A collision that starts to overlap PARTIALLY (the case `assertionEveryPairOverlaps` cannot see, because it only rejects a TOTALLY empty overlap) turns the suite red and has to be decided, instead of quietly comparing like a mirror and reporting phantom drift.
