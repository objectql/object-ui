---
'@object-ui/components': minor
---

A field its own `visibleWhen` hides is now cleared, so it stops carrying a stale value
to the server (objectui#6958).

**Breaking, deliberately.** Until now a field the form renderer hid because the field's
own `visibleWhen` (or its deprecated view-level sibling `visibleOn`) resolved FALSE kept
its value in form state and submitted it anyway. Measured against a real running app: an
object with four mutually-exclusive party columns and a type column naming which one
applies could not be saved once a party column had been filled and then hidden — the
server refused the row, correctly, by naming a column that was no longer on screen to
clear. On the edit path the stored value was re-sent on **every** attempt, so such a
record could never be retyped through the UI at all. The perverse consequence: *not*
declaring `visibleWhen` produced an uglier but strictly **more usable** form, because the
offending column stayed visible and therefore clearable.

**What changes.** When a field's own visibility verdict goes VISIBLE → HIDDEN and the
field holds a value, the renderer clears it: `null` for a scalar, `[]` for a multi-value.
The key is deliberately PRESENT and `null` rather than withheld — objectui#6848 measured
the write contract (`driver-memory` merges `{ ...stored, ...data }`, `driver-sql` issues
`SET` for the keys present), so an absent key means "leave it unchanged" and only an
explicit `null` overwrites the stored value. Omitting the key would have left the edit
path exactly as dead as before.

**What deliberately does NOT change.** Only the field's own conditional-visibility
predicate clears. A field claimed by a hidden section (objectui#6236), a field on a hidden
tab (objectui#6237) and a statically `hidden: true` field all keep the ruled semantics —
visibility decides what is DRAWN and nothing else, and their values still submit. A broken
predicate still fails OPEN, so a typo cannot silently null a stored column. The clear is
transition-only and never writes over an empty value, so merely opening a record cannot
strip the stored values of columns the user never saw, and a create form still omits the
key for a field it never populated (objectui#4069).

**Migration.** If you relied on `visibleWhen` to hide a field while still submitting its
value, that value is now cleared on the transition. Carry such a value on a statically
`hidden` field, or on a field claimed by a conditionally-hidden section, both of which are
unaffected.
