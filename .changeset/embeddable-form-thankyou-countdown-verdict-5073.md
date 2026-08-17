---
'@object-ui/plugin-form': patch
---

A public form's thank-you panel no longer promises a redirect its own guard just
refused, and the `texts.redirectBlocked` string can finally reach a screen.

`EmbeddableForm` decided whether to redirect from `isRedirectUrlSafe` /
`allowedRedirectHosts`, but the panel's copy was keyed on something else: whether
a `thankYouPage.redirectUrl` had been *authored* (objectui#5073). An author who
declared a cross-origin destination without allowlisting its host therefore got a
submitter who was told `Redirecting in 3 seconds…` and was then never redirected.
The guard did its job; the screen contradicted it. That screen is the terminal
state of a public form, so nothing came after to correct the impression.

On the same path, the `texts.redirectBlocked` string the refusal set was
unreachable in every locale. It was recorded with `setError(...)`, whose banner
lives in the form branch — and `setSubmitted(true)` has already run one statement
earlier, so the component is showing the thank-you branch, which renders no error
at all. That was the only assignment of the key anywhere; pressing
`Submit Another Response` cleared it rather than showing it.

Both now follow the verdict:

- The countdown renders on `pendingRedirect` — the destination that was actually
  accepted — and reads its seconds from the delay captured with it, so the
  displayed wait is the wait being served. A refused destination, and the
  honeypot's silent fake-success (which accepts no destination either), simply
  omit the line.
- A refused destination renders `texts.redirectBlocked` in the thank-you panel
  when the author declared it — the case the key exists for, in the author's own
  words to the public. Undeclared means silence; the author keeps the existing
  `console.warn`, which is the channel for the person who can fix the
  declaration.

Which destinations are refused is unchanged: `isRedirectUrlSafe` and
`allowedRedirectHosts` are untouched, as is the timer ownership introduced for
objectui#5049. Nothing was ever at risk in the data — the write succeeds before
any of this — the harm was a false statement on the confirmation screen and a
shipped, translated string no user could see.
