---
"@object-ui/core": patch
"@object-ui/console": patch
---

fix(sdui): the curated contract lists `record:line_items`, the tag that actually resolves

`PUBLIC_BLOCKS` carried `line_items` — the bare tag. `@object-ui/plugin-form`
registers the block as `record:line_items` with `skipFallback: true`, which
exists precisely so the bare name is *not* claimed, so that key never existed
and the curated entry could never resolve. Its four siblings in the list are all
`record:`-prefixed, and plugin-form's own comment says "Register
record:line_items"; the bare spelling was a slip.

The effect was a block that has shipped all along — a full renderer, a label,
five declared `inputs` — being absent from the public contract, from the JSX
type surface, from the generated manifest, and from every `kind:'react'` page's
scope. It read as an unimplemented aspirational entry, which is how it was
recorded when objectui#2979 added the contract-coverage guard.

With the tag corrected the contract has no gaps left: all 36 curated tags
resolve in the console, `record:line_items` among them with its full `inputs`.
The guard's known-unimplemented list is now empty and stays asserted, so the
next entry that cannot resolve surfaces instead of being explained away.
