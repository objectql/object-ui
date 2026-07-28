---
"@object-ui/i18n": patch
---

test(i18n): ratchet the four backfilled namespaces so they cannot silently erode

objectui#2903 translated `console`, `home`, `topbar` and `layout` into all ten
packs. Nothing stopped that from decaying: `fallbackLng: 'en'` means dropping a
key from `de` renders English, which reads as "not translated yet" rather than
"we lost this", and the missing-key handler is dev-only so CI never sees it.

This is objectui#2872's P3 (full parity test) applied **only to the namespaces
that are actually complete**. Full parity would fail today by ~277 keys per
pack with no action attached to it, which is a broken build rather than a
guard. Widen `RATCHETED_NAMESPACES` as each remaining namespace is translated —
not before.

Asserts both directions, because the packs have drifted both ways before:

- every ratcheted `en` key exists in all nine other packs;
- no pack defines a ratcheted key that `en` lacks — objectui#2872 part (b) was
  exactly this failure, 74 keys deep, hidden behind a component-private
  fallback so English "happened to" render.

The four outbound agent messages are excluded, since they are deliberately
absent from the eight non-gate packs; `outbound-agent-messages.test.ts` owns
that invariant and the two guards would otherwise contradict each other.

A non-vacuity assertion pins the ratchet at >300 keys and requires every named
namespace to contribute, so a rename can't quietly reduce the whole file to a
no-op.
