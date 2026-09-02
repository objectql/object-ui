---
'@object-ui/components': patch
'@object-ui/console': patch
---

A form no longer ends on a screen asserting both a failure and a success (objectui#7252).

A refused submit raised an error toast that nothing ever retired, so when the user
fixed the input and submitted again the confirmation of that second attempt appeared
*beside* the refusal of the first — a wizard's last step showing "Invalid project
status transition." and "Your new project is ready…" at the same time.

Every outcome toast a form raises now travels under one stable per-form id, so the
later outcome supersedes the earlier one instead of stacking beside it:

- `@object-ui/components`' form renderer publishes its three outcome toasts (the
  field-level rejection, an `onAction` error, and a rejected write) under that id, and
  retires the previous attempt's toast in the same place it already cleared the
  previous attempt's in-form banner. This is what fixes the reported wizard flow: the
  refusal comes from this renderer while the success toast is raised by the host
  (`WizardForm` / `ObjectForm`), so no single raiser could supersede the other before.
- the console's own `FormPage` publishes its confirmation and its submit failure under
  one id, for the same reason.

Toast durations are unchanged — this is about supersession, not lifetime. The
objectui#4190 arm is deliberately excluded: a refused redirect *destination* still gets
its own toast, because the write succeeded and that refusal has to stay readable beside
the confirmation it qualifies.
