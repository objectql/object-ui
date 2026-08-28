---
'@object-ui/data-objectstack': patch
'@object-ui/app-shell': patch
---

The metadata lock banner can no longer render an amber, padlocked box with no
title, and the ADR-0010 §3.6 lock vocabulary is declared once instead of three
times (objectui#5024).

`MetadataLayered.lock` and `MetadataAuditEntry.lockState` each spelled the four
states out by hand, 42 lines apart in one file, compared by no gate. They are now
one exported `MetadataLockState` — derived from `GetMetaItemLayeredResponseSchema`'s
`z.enum` in `@objectstack/spec`, which already owns this vocabulary, so the copies
were restating a schema rather than filling a gap.

The user-visible half is the banner. Its title was three independent `&&` branches
with no fallback, while the switch that opens the banner is true for any non-`none`
value — so a lock state outside the four opened the box and left the headline
empty. That is reachable without a fifth state ever being added here:
`MetadataClient.layered()` casts the wire value through unchecked, so a newer
server reaches this banner as-is. Measured, not assumed — feeding `no-publish`
through the page rendered the padlock, the border and an empty title. The title is
now a keyed lookup with a loud fallback that names the unrecognised token, so a
fifth state fails `type-check` here and, if one arrives from a server anyway, the
operator reads a sentence instead of a blank box.
