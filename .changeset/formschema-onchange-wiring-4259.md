---
'@object-ui/components': minor
---

fix(components): call `FormSchema.onChange` — the declared callback the form renderer never invoked (objectui#4259)

`FormSchema` declares four lifecycle callbacks and the form renderer
destructures all four off `schema` in one block: `onSubmit`, `onChange`,
`onDirtyChange`, `onCancel`. Three were wired. `onChange` was destructured and
then never referenced again — the destructure was its only occurrence in the
whole file — so a consumer who authored it got a typed, exported, documented,
autocompleted callback that did nothing at all. No warning, no dev-mode notice,
no type error: the declaration said it was supported.

It is now called with the live form values whenever a value changes, through the
same `form.watch` subscription plumbing the `onDirtyChange` and `onAction`
channels already use, so the value channel cannot drift into its own schedule.

Two properties are deliberate and pinned by tests:

- **The subscription is guarded.** A schema that authors no `onChange`
  establishes no subscription at all, exactly like the existing `onAction`
  channel and unlike the unconditional `onDirtyChange` one. Watching
  unconditionally would have put a third `form.watch` on every form in the
  product on behalf of callers who asked for nothing; honouring the declaration
  is meant to be purely additive for everyone else.
- **It runs in the layout phase**, matching the `defaultValues` reset and the
  two subscriptions beside it. React runs every layout destroy before any layout
  create, so a caller passing a fresh inline arrow each render — the common
  shape — has the subscription torn down before the reset and re-established
  after. That is what keeps a record landing in edit mode from being reported to
  the host as if the user had edited every field it filled. A passive effect
  inverts that order.

The callback receives the form values, per its declared
`(data) => void` signature — not a DOM event. A top-level `onChange` spread onto
the form node is still stripped before it can reach the `form` element, where it
would have fired with a SyntheticEvent instead; that block's behaviour is
unchanged, only its now-outdated comment was corrected.

No change to `@object-ui/types` — the declaration was already there and already
correct. This is the renderer starting to honour it.
