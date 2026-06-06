---
"@object-ui/plugin-form": patch
"@object-ui/components": patch
---

fix(master-detail): never silent on save — feedback, reset, and a duplicate-submit guard

`MasterDetailForm`'s "Create" submitted successfully but gave **no feedback**: no toast, no form reset, no navigation. A successful create looked broken, and re-clicking created duplicate records.

- On success: a `toast.success`, and on create the form clears (line items reset + parent `<ObjectForm>` remounts) ready for the next entry. A page-supplied `onSuccess` still runs afterwards (e.g. to navigate).
- On failure (validation / network / atomic rollback): a `toast.error` surfaces the message instead of failing silently.
- In-flight guard: the Create button shows "Saving…" and is disabled while a submit is running, preventing duplicate submissions, with a safety release if client-side validation blocks the submit.
- `@object-ui/components` now re-exports `toast` (alongside `Toaster`) from its sonner wrapper.

Tests: two new `MasterDetailForm` tests assert success → toast + form clear, and failure → error toast.
