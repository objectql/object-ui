---
"@object-ui/components": patch
---

fix(test-setup): stop shadowing ten real registrations, and declare page:header's inputs

`vitest.setup.dom.tsx` re-registered `text`, `email`, `password`, `textarea`,
`image`, `html`, `avatar`, `select`, `slider` and `grid` by hand — ~380 lines of
renderer copied out of @object-ui/components — to undo bare-name fallbacks that
@object-ui/fields and the plugins claimed by loading after it.

Both sides now register under their own namespace with `skipFallback: true`, so
nothing overwrites the `ui:` originals and the workaround is obsolete. It was
not free: the copies carried no `inputs` and no `defaultProps`, so inside the
test environment four curated public blocks reported an empty configuration
surface while the real registrations declare one. `apps/console`'s contract
test reads that registry, so its picture of the contract was fiction for those
tags — a guard that measures a fixture instead of the product.

Deleting the block restores what the app actually boots with. Verified: the ten
tags keep their namespace and canonical type, and their declared surface comes
back — `text` 1 input, `email` 6, `password` 6, `textarea` 6, `image` 3,
`html` 1, `avatar` 4, `select` 6, `slider` 5, `grid` 7, plus `defaultProps`.
The heavy DOM setup also got roughly twice as fast (~545s to ~235s of setup
time across the suite), since every file in that project was paying to evaluate
the duplicated renderers.

With the shadowing gone, `page:header` was left as a genuine gap: a curated
public block whose renderer reads `title`, `subtitle`, `actions`, `breadcrumb`,
`recordChrome`, `showStar` and `showCopyId`, with none of them declared. Now
declared.

`element:divider` keeps zero inputs on purpose — its renderer reads only
`className`, so there is nothing to author.
