---
'@object-ui/plugin-form': patch
---

A public form's thank-you countdown ("Redirecting in {{seconds}} seconds…") now
actually counts down, instead of rendering a number once and leaving it frozen
for the whole wait.

All ten locale packs document `publicForm.redirecting`'s `{{seconds}}` as "the
remaining seconds", but `EmbeddableForm` computed it exactly once — at the render
that first shows the thank-you panel — from `pendingRedirect.delayMs`, and never
touched it again. On the 3 second default delay, a submitter saw a fully static
"Redirecting in 3 seconds…" for the entire wait (objectui#5083).

The number is now owned by a per-second `setInterval`, on the same ownership
model PR #5070 established for the redirect wait itself: an effect keyed on the
accepted destination (`pendingRedirect`), cancelled on unmount and on
`handleReset`'s `Submit Another Response` — the exact regression surface
objectui#5049 fixed for the navigation timer, restated here rather than
reintroduced. The interval also stops itself once it reaches 0, rather than
ticking indefinitely past a wait that has already ended.

Nothing about WHICH destinations are followed or refused changes
(`isRedirectUrlSafe` / `allowedRedirectHosts`, objectui#4989), and neither does
the navigation wait's own ownership (objectui#5049 / PR #5070) — this is the
display only.
