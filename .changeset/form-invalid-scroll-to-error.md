---
"@object-ui/components": patch
---

fix(form): scroll and focus the first errored field on an invalid submit (#2793)

Submitting a form with a missing required field already toasts the offending field names (#2329), but in a long form the field itself stays off-screen, so the user still hunts for it. react-hook-form's native focus-on-error only reaches fields whose registered ref is a focusable native input — it silently no-ops for custom widgets (lookup / select / master-detail), which is exactly the reported case. The form renderer now disables RHF's unreliable `shouldFocusError` and, in its `onInvalid` handler, scrolls the first errored field (in visual/declared order) into view via its `data-field` wrapper and focuses a focusable control inside it — working for every field type.
