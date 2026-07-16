---
"@object-ui/fields": patch
---

fix(fields): PeoplePicker keyboard cursor no longer resets on identity-only
result re-emissions

The cursor-reset effect keyed on the records array identity, so a background
refetch returning the same records (StrictMode double-effect, refetch-on-focus)
yanked the active row back to none mid-navigation — surfacing as a flaky
ArrowDown→Enter CI test and a real (if rare) keyboard UX glitch. The reset is
now keyed on the record-id signature, so the cursor only resets when the
results actually change.
