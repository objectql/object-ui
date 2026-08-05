---
"@object-ui/components": patch
---

The form renderer's built-in `textarea` branch reads the fullscreen long-text
flag on one spelling (objectui#3303).

FROM: the branch resolved the affordance as `mobile_fullscreen || fullscreen`,
and both prop strips (`stripRendererOnlyProps`, `stripRegisteredFieldProps`)
carried a matching entry discarding a `fullscreen` key. TO: a single read of
`mobile_fullscreen`, with no strip entry left for the alias.

No runtime behaviour changes for anything that exists, because the second term
was permanently `undefined`. `fullscreen` had **no producer**: a repo-wide grep
plus `objectstack`'s `packages/spec` turns up only the unrelated
feedback/loading overlay property of the same name, never a form field. The one
real producer is `ObjectForm`, which stamps `mobile_fullscreen` onto long-text
fields from `ObjectFormSchema.mobile.fullscreenLongText` — the same single
carrier `TextAreaField` and `RichTextField` read.

This closes the last member of the convergence run objectui#3232 / #3233 /
#3245 / #3301 started. The changeset for #3232 named this branch explicitly as
"a separate live path" still accepting two spellings; it is now single-read like
the two widgets, so the same authored metadata behaves the same way whether a
field type resolves to a registered widget or falls through to the built-in
branch.

Why a no-producer alias is worth removing rather than leaving as harmless
insurance: it is not insurance, it is a contract that never held. The renderer
advertised a spelling to whoever reads it next — very much including an AI
writing form metadata — and that spelling silently does nothing, with no error
and nowhere to look. That is the lenient consumer fallback AGENTS.md #0.1
forbids, and the identical mechanism behind #3245 and #3301. Dropping the strip
entries matters for the same reason: a key nobody produces should not get a
dedicated discard, it should be in the ordinary unrecognised-key class, so a
typo is as visible as any other typo instead of being quietly swallowed.

Pinned by tests in both places the alias lived: the built-in branch renders the
expand affordance for `mobile_fullscreen` and not for `fullscreen` (the
canonical case is asserted alongside the alias case, so the negative cannot pass
for the empty reason of the affordance having disappeared altogether), and the
strips are shown to own `mobile_fullscreen` — stripped from the top-level props,
delivered on `field` — while `fullscreen` is now indistinguishable from an
arbitrary unknown key.
