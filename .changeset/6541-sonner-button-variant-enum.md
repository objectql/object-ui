---
'@object-ui/types': minor
---

**Accept-set NARROWING on a published surface.** `SonnerSchema.buttonVariant` in the zod
mirror (`@object-ui/types/zod`) was `z.string()`; it is now
`z.enum(['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'])`. Values
outside those six — `'primary'`, `'danger'`, `'Default'`, `''` — used to validate and now
fail. Stated as a narrowing rather than as a fix, because it removes values the published
mirror accepted (objectui#6541).

**What was wrong.** The same key on the same component shipped as two disagreeing published
faces: an open string to anyone validating (`@object-ui/types/zod`), and a closed
six-member union to anyone type-checking (`@object-ui/types`, `SonnerSchema.buttonVariant`
in `feedback.ts`). The TS face was already correct — only the mirror is changed here, so
this is the mirror being made to agree with a declaration that sat beside it all along.

**Why the wide face was wrong and not merely wide.** `renderers/feedback/sonner.tsx` passes
the value straight into `<Button variant={…}>`, whose vocabulary is exactly those six keys
of `buttonVariants`. Measured on `cva` 0.7.1, an unrecognised key contributes **no** variant
class, and `defaultVariants` applies only when the value is absent *or falsy*:

```
buttonVariants({ variant: undefined }) -> "… bg-primary text-primary-foreground …"  default look
buttonVariants({ variant: 'ghost'   }) -> "… hover:bg-accent …"                     real variant
buttonVariants({ variant: 'primary' }) -> "…"                                       NO colour at all
buttonVariants({ variant: ''        }) -> "… bg-primary …"                          silently 'default'
```

So the mirror was validating values the renderer visibly breaks on: `'primary'` — the
likeliest wrong spelling, since the default variant's own class is `bg-primary` — rendered a
button with no background and no text colour, and `''` was silently reinterpreted as
`default`. Nothing that renders correctly today stops validating.

**Blast radius, measured.** The key stays optional, so every published `sonner` node that
omits it keeps parsing. The two fixtures in the repo that set it
(`examples/schema-catalog/src/schemas/components-feedback-sonner/{error,promise-based-toast}.json`)
use `destructive` and `outline` — both inside the six. No consumer was found relying on a
seventh spelling.

**Model inherited, not invented.** objectui#6496 landed exactly this spelling on
`ToastSchema` for the same trigger mechanism, matched to `ButtonProps['variant']` as ground
truth. This card applies the settled shape to the sibling that still disagreed with itself.
