---
'@object-ui/components': patch
---

`EmptyDescription` now declares its props as `React.ComponentProps<"div">`, the
element it has always rendered, instead of `React.ComponentProps<"p">`
(objectui#8571). The rendered output is unchanged. For consumers this is a
declaration-only change: TypeScript treats the two props types as identical, so
no call site's type-check moves; what changes is what the published `.d.ts`
tells a reader, which now matches the DOM. A guard test now checks every
`custom/` member's declared intrinsic against the tag it returns.
