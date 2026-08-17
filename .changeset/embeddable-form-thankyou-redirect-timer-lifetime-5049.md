---
'@object-ui/plugin-form': patch
---

A public form's thank-you redirect no longer outlives the form that armed it, and
"Submit Another Response" now cancels it.

`EmbeddableForm` armed the `thankYouPage.redirectUrl` wait with a bare
`setTimeout` inside the submit handler: the handle was not stored, nothing cleared
it, and no part of the component owned it (objectui#5049). Two consequences, and
the second needs no unmount at all:

- For the whole of the delay a full-page navigation was pending that survived the
  form being taken off screen — an embed removed by the host page, a route change,
  a re-keyed subtree. With `redirectDelay` unset that window is the 3000 ms
  default, so this was the normal state of every submit on this surface rather
  than an edge authoring; the thank-you panel says as much out loud with
  `Redirecting in {{seconds}} seconds…`.
- Under `allowMultiple`, `Submit Another Response` only flipped `submitted` back
  to false while the pending navigation kept ticking. The component invited the
  submitter into a fresh form and then, about three seconds later, threw the whole
  page away while they were typing the next response.

The wait now lives in an effect keyed on the accepted destination, with a
`clearTimeout` cleanup, so unmounting cancels it; and `handleReset` drops the
destination, so pressing `Submit Another Response` cancels it too. The button
offers the submitter a fresh form, and that offer cannot be honoured alongside
discarding the page a moment later. This is the same move `ObjectForm` /
`WizardForm` (objectui#5033) and `apps/console`'s `FormPage` already made for
their own copies of this defect.

Nothing else changed. Which destinations are followed and which are refused is
still decided by the same `isRedirectUrlSafe` / `allowedRedirectHosts` guard, on
the same line as before — only who owns the wait changed. The delay is captured
together with the destination at the moment the write is accepted, so a host
re-rendering with a different `redirectDelay` mid-wait cannot restart the pause
under the submitter. The countdown copy is untouched. No data was ever at risk:
the write has already succeeded before the wait begins, so the harm was a
surprising navigation — and, on the `allowMultiple` path, the loss of what the
submitter had just re-typed.
