---
'@object-ui/plugin-form': patch
---

A form's declared redirect delay no longer outlives the form that armed it.

`ObjectForm` and `WizardForm` consumed `submitBehavior: { kind: 'redirect' }` by
arming the `delayMs` wait with a bare `setTimeout` inside the submit handler. The
handle was not stored, nothing cleared it on unmount, and no part of the component
owned it — so for the whole of the declared delay there was a pending full-page
navigation that survived the form being taken off screen (objectui#5033). A
submitter who dismissed the modal or drawer variant after the confirmation, who
clicked an in-app link, or whose host re-keyed the subtree for its own reasons was
pulled away from wherever they had gone by a timer belonging to a form that no
longer existed. The longer the authored delay, the wider that window — and a
non-trivial delay is the intended authoring, since `delayMs` exists so the
confirmation is readable before the redirect.

The wait now lives in an effect keyed on the accepted destination, with a
`clearTimeout` cleanup, so unmounting cancels it. This is the same move
`apps/console`'s `FormPage` already made for its own copy of this defect.

`delayMs` semantics are unchanged: the pause is still a pause, an unset value is
still "go now" (a zero timer, exactly as the in-handler version scheduled it), and
which destinations are followed or refused is untouched — the contract verdict
that decides WHETHER to navigate is the same one, only WHEN it happens is now
owned by the component. The delay is captured together with the destination at the
moment the write is accepted, so a host re-rendering with a different `delayMs`
mid-wait cannot restart the pause under the submitter. Nothing was ever at risk of
being lost: the write has already succeeded before the wait begins, so the harm
was a surprising navigation, not a corrupted record.
