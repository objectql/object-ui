---
'@object-ui/app-shell': patch
---

The "modal target names no page" diagnostic is one message again, on all three surfaces

A `type: 'modal'` action whose string `target` names no page is refused on three
surfaces — `useActionModal.modalHandler` (the ActionProvider `onModal` path),
`useConsoleActionRuntime.modalActionHandler` (list pages, SDUI pages, the
declared-actions bar) and `RecordDetailView.modalActionHandler` (the record
page). Each spelled the refusal itself, and they drifted.

PR #4764 retired the object fallback (a modal target names a PAGE, only —
maintainer ruling on objectstack#6739) and rewrote the wording in
`useActionModal`, so it names the refused target and points at `type: 'form'`,
the validated way to open an object's form. The other two — the ones a console
user actually reaches — kept the pre-retirement text: the target "names no page
or object to open", with `type: 'script'` as the only way out. The "or object"
half described a limb that no longer exists, and the replacement capability was
never mentioned, so the surfaces most likely to be read were the ones giving the
worst advice.

All three now build the message from one constructor
(`utils/modalTargetDiagnostics`). Every variant names the refused target and
points at `type: 'form'`; the console runtimes additionally keep the
`type: 'script'` + `params` hint, which answers a different authoring intent
(collect input, then run a handler) and rides alongside the form pointer rather
than replacing it. `modalHandler`'s message is byte-identical to what PR #4764
settled on — this is a de-duplication, not a rewording — and that byte-equality
is pinned by a test, as is each call site's use of the shared source.

These are hard-coded English authoring diagnostics on all three surfaces, before
and after: they name a metadata key and a spec type and are read by whoever
wrote the action. Translating them is a separate decision; this change only
stops the English from disagreeing with itself.
