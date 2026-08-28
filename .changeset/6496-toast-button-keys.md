---
'@object-ui/types': minor
---

`ToastSchema` now declares the two trigger-button keys the `toast` renderer actually reads
(objectui#6496, triage scope cut 2026-08-26 — the same declare-what-runs family as
objectui#6170).

`renderers/feedback/toast.tsx` renders a `<Button>` that raises the toast, and reads two
keys off the node to do it: `variant={schema.buttonVariant}` and
`{schema.buttonLabel || 'Show Toast'}`. `ToastSchema` declared **neither**, on the TS face
or in the `@object-ui/types/zod` mirror. The registration's own designer `inputs` offered
`buttonLabel` (with `defaultValue: 'Show Toast'`), so the designer shipped a control for a
key the published type did not have; `buttonVariant` was read by the renderer and named by
nothing at all. `SonnerSchema` — the sibling with the identical trigger mechanism —
declared both all along, so only one of the two components was expressible.

The visible cost was on objectui#6250: with `buttonLabel` undeclared, its seven corrected
toast demos could not author a per-demo trigger label the way the corrected sonner demos
could, and all seven render the default `Show Toast`. Those demos are unblocked by this.

**`buttonVariant` is declared as the six Button variants, on both faces.** The model this
card was told to copy disagrees with itself: `SonnerSchema` spells the key `z.string()` in
the zod mirror and `'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'`
in TS. Matching by symmetry picks nothing, so the shape was taken from what the value
*reaches* — the renderer passes it straight into `<Button variant={…}>`, whose prop type is
`VariantProps<typeof buttonVariants>['variant']`, exactly those six. The TS face is the
correct one and both faces here carry it.

An open `string` is not merely under-validation. Measured on `cva` 0.7.1: an unrecognised
variant key contributes **no** variant class, and `defaultVariants` applies only when the
value is *absent* — so `buttonVariant: 'primary'` renders a button with no background and
no text colour, silently, while `buttonVariant: undefined` renders the default look
correctly. `primary` is the likeliest wrong spelling precisely because the default
variant's own class is `bg-primary`. And `buttonVariant: ''` is silently resolved to
`default` by the same falsy fallback — the one wrong value that does not *look* wrong,
which an open `string` would accept and never signal. That the declared six are the Button's own vocabulary
is pinned in both directions in `components/src/__tests__/toast-button-variant-parity.test.ts`
— `@object-ui/types` has zero deps and cannot import the Button, so the list there is
necessarily hand-copied, and that file is what stops it being a copy that can drift.

**`SonnerSchema`'s own two faces are left disagreeing.** Its mirror stays `z.string()`.
That is a real defect on a published surface, and it is filed as objectui#6541 rather than
fixed here —
this card's face is `ToastSchema`, and narrowing a second published key is its own
accept-set change with its own consumers to measure.

**Direction 2 of the finding is untouched.** `action` and `onDismiss` are declared on
`ToastSchema` and read by no renderer; they sit immediately adjacent to this edit and are
byte-identical after it. They are enforce-or-remove on a published type and belong to the
objectui#6124 unsatisfiable-mirror census feeding the objectui#6182 handler-dialect
decision; they are deliberately not pinned here either, so that family's ruling lands
without a test of this card's to negotiate with.

Accept-set note for consumers: both keys are **optional** and materialise no default, so
nothing that renders today stops rendering and no stored toast JSON becomes invalid. Two
keys that previously resolved as `any` through `BaseSchema`'s index signature are now
typed, so `buttonLabel: 42` and a `buttonVariant` outside the six are a type error and a
Zod rejection where they used to pass silently — values that never rendered correctly in
the first place. `BaseSchema` is untouched, so an *undeclared* key is still accepted by
both halves (objectui#5155 / objectui#6269 own that ceiling); declaring these two bought
validation of the declared keys, not rejection of misspellings.
