---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

A cloud-connection bind failure now reads in the user's language whichever clock
noticed it (objectui#5054).

One abandoned device approval could be noticed by either of two clocks, and the
Cloud Connection panel had a different answer for each. When the panel's own
`expires_in` deadline fired first it rendered `cloudConnection.errors.expired` —
translated in all ten packs. When the SERVER noticed first, `/bind/poll` answered
HTTP 400 with `message: 'Device authorization failed: expired_token'`; `getJson`
threw a bare `Error` carrying only that sentence, and the catch rendered it
verbatim. Same user, same failure, two languages, decided by which clock got
there first — visible on a zh console as the same abandoned approval reading
Chinese or English depending on whether the tab sat open past `expires_in`.

`getJson` now carries the envelope's `declaredCode` and `code` across its throw,
and a single closed map turns the two RFC 8628 outcomes a user can actually cause
into console copy: `expired_token` → the existing `cloudConnection.errors.expired`,
`access_denied` → a new `cloudConnection.errors.accessDenied` added to all ten
locale packs. `declaredCode` is read first, because ADR-0112 keeps the upstream
spelling there — `code` is `DEVICE_CODE_FAILED` for both.

Every other code is unchanged: `invalid_grant`, and anything upstream invents
next, still render the wire `message`, which stays the single source of truth for
failures this console has no copy for. No API, export or resolver was widened.
