---
'@object-ui/app-shell': patch
---

`CloudConnectionPanel` prefers `error.message` over `error.code` on a bind-poll failure, matching the precedence the same file already applies everywhere else.

`poll()`'s terminal branch read `body?.error?.code ?? t('cloudConnection.errors.bindFailed')`,
so a failure body that carried a human-readable sentence beside its machine code
was still rendered as the code. Fifty lines above, this file's own `getJson`
helper already reads `body?.error?.message ?? body?.error?.code ?? body?.error`;
this brings the one call site that diverged into line with it (objectui#5028).
The `code` arm is kept as the fallback — a producer still short of
`ApiErrorSchema`'s required `message` shows its code rather than nothing — and
the chain still ends at the translated string.

Narrower than the filed card, because verification moved the boundary. The card
expected this line to be what displays a device-authorization failure
(`expired_token`, `access_denied`) after objectstack#9267 / PR #9369 added
`error.message` to that envelope. It is not: `/bind/poll` serves the terminal
device-code failure with HTTP **400** (before and after that PR), and `getJson`
throws on any non-2xx whose body is not `success: true`, so the string a user
reads there was always picked by `getJson`'s already-correct precedence. The
upstream message reached the UI the moment it merged, with nothing owed here.

What the changed line genuinely governs is the 2xx path: `/bind/poll` forwards
the control plane's own `/bind` answer verbatim, with the control plane's status.
A 200 that says `success: false` — an envelope violation of the kind
objectstack#9364 is still counting — is handed back by `getJson` and lands in
this branch, and that is where a code was being shown instead of the sentence
next to it. Four cases pin the surface end to end, including a control that
records where the device-authorization text actually comes from, so the next
reader is not sent looking for it in `poll()`.
