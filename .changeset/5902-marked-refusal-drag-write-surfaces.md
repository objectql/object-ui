---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-form': patch
---

Let a producer-marked refusal reach the drag-write surfaces (objectui#5902).

The kanban card-move toast, the calendar drag-to-reschedule toast and the OCC
conflict dialog each substituted a generic string for a refusal the producer had
marked as user-facing (`userMessage`), so a user was told "Save failed" where the
application author had written a sentence addressed to them. All three now read
the marking through the shared `declaredUserMessage` reader, which covers both
places the adapter boundary parks it — the typed member on
`ConcurrentUpdateError` and the details bag on `DataApiValidationError`.

Nothing unmarked changes: the reader answers `null` for it, so every existing
generic substitution — including the localized "not authorized" message that
keeps raw server diagnostics away from end users — still governs unmarked
refusals exactly as before.

The two toasts substitute; the conflict dialog augments. Its description also
explains what the destructive "Overwrite" button does, which is affordance copy
that surface owns rather than a refusal message, so the marking leads and that
paragraph stays.
