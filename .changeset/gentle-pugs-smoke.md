---
'@object-ui/components': patch
---

`container`: honour a declared `maxWidth: false` as "no maximum width"

`ContainerSchema` has always declared `maxWidth?: … | false`, but the renderer
read it as `schema.maxWidth || 'xl'`, so `false` folded into the default and a
container asking for **no** constraint rendered `max-w-xl` (`max-width: 36rem`)
— the opposite of what it declared. The `false` arm of the union had no
reachable path from the day it was declared.

`maxWidth` is now read with `??` (the spelling `stack` / `grid` always used, and
the one objectui#4003 gave this file's `padding` and `flex`'s `gap`), and `false`
emits an explicit **`max-w-none`** rather than simply omitting a class. The two
are not the same fact: an omitted class leaves an inherited max-width standing —
`@tailwindcss/typography`'s `.prose` sets `max-width: 65ch` — while `max-w-none`
cancels it. The registry `inputs` enum for `maxWidth` gains `false` to match the
type it lagged, so the designer and `sdui-parser`'s manifest gate stop reporting
a legal value as `invalid-enum`.

No authored node in the repo declared `maxWidth: false`, so nothing that renders
today changes.
