---
"@object-ui/fields": patch
---

`TextAreaField`'s mobile fullscreen flag converges on its one real producer
(objectui#3232).

FROM: the widget resolved the "show the expand affordance" decision through a
four-way `??` chain — a `mobileFullscreen` (camelCase) prop, the field
metadata's `mobile_fullscreen`, a `mobile_fullscreen` prop, and
`schema.mobile_fullscreen`. TO: a single read of the field metadata's
`mobile_fullscreen`, resolved through the `field || schema` carrier pair every
widget in this package already uses.

No runtime behaviour changes, because three of those four reads were
permanently `undefined`:

- `mobileFullscreen` (camelCase) had **no producer anywhere in the repo** — the
  only occurrences of that spelling were the widget's own read and the
  destructure that kept it off the DOM spread. The doc comment nonetheless
  claimed "the host form passes `mobileFullscreen`", so the contract it
  described had never held.
- `mobile_fullscreen` as a **prop** cannot arrive: the form renderer's
  `stripRegisteredFieldProps` explicitly removes `mobile_fullscreen` and
  `fullscreen` from the props forwarded to registered field widgets.
- `schema.mobile_fullscreen` was the same object `field || schema` already
  resolves, so it could only ever restate the metadata read.

What actually drives the affordance — and is now the only thing that does — is
the field metadata flag `ObjectForm` stamps onto long-text fields from
`ObjectFormSchema.mobile.fullscreenLongText`. That path is unchanged and is now
pinned by tests (button, dialog, and the committed edit), so the cleanup cannot
have silently removed the working behaviour.

Also untouched: the built-in (unregistered) `textarea` branch of the form
renderer, which reads `mobile_fullscreen || fullscreen` off the form-field
props and renders its own `FullscreenTextarea`. That is a separate live path.

Why this is worth a changeset rather than a silent tidy-up: reads that nobody
writes are not free. They document a contract that does not exist — the next
author follows the comment, passes the prop, and is ignored without a word —
and a `??` chain that accepts four spellings and rejects none is exactly where
a misspelled key hides. With one source, a wrong spelling has no read path left
to absorb it. Per AGENTS.md #0.1 and Prime Directive #12, divergence like this
converges at the producer, not by accumulating tolerance at the consumer. No
host-override prop was invented in its place: inventing a key with no producer
is the same mistake in the other direction.
