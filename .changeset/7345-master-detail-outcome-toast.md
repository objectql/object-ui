---
'@object-ui/plugin-form': patch
---

A master-detail form no longer ends on a screen asserting both a failure and a success
(objectui#7345).

`MasterDetailForm` raised its two save outcomes — `handleSaved`'s confirmation and
`handleError`'s refusal — under sonner's auto-generated ids, so nothing held a handle on
the previous attempt's toast. A save the server refused left its error toast on screen,
and when the user corrected the input and saved again inside that toast's lifetime the
confirmation landed *beside* the refusal, exactly the objectui#7252 defect on a renderer
that fix did not touch.

Both outcomes now travel under one stable per-form id (`React.useId()`-scoped, the same
spelling the form renderer and the console's `FormPage` publish under), and each save
attempt retires the previous attempt's toast before it starts:

- with no host `onSuccess` (SDUI / embedded hosts), the confirmation supersedes the
  refusal instead of stacking beside it;
- with a host `onSuccess` (the console), where the built-in confirmation is deliberately
  skipped, the dismissal is what retires the refusal — otherwise it stood over a save
  that had succeeded.

Toast durations are unchanged: this is about supersession, not lifetime.
