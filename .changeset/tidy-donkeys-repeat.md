---
'@object-ui/app-shell': patch
---

metadata-admin's object designer no longer re-sends a draft the server has already refused.

Adding a Lookup field with an empty target made every subsequent auto-save PUT the same
half-filled document and take the same 422 — while the designer rendered later edits as
applied and the server held none of them. The only escape was a page reload, which
discarded every unsaved edit since.

A server refusal is now held against the draft slice its issue path named, and gates all
three save doors until the author edits that slice. Live client Zod issues stay advisory
exactly as before: the new term is armed only by a 422 the server actually returned, so it
can never block a draft the server would have accepted.
