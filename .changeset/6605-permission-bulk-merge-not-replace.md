---
'@object-ui/app-shell': patch
---

Permission matrix bulk buttons (R / CRUD / All) now merge into the object's
permission row instead of replacing it, so spec-declared keys the matrix does
not author — `allowExport` and the ADR-0057 access-depth axis `readScope` /
`writeScope` — survive a bulk click the same way they already survived the
per-checkbox path. Previously one click on any bulk button silently dropped
them from the saved row, and the **All** button could widen effective read
access by deleting a `readScope: 'own'` narrowing with no diff and no error.
**None** deliberately keeps clearing the whole row, narrowings included:
merging there would leave `allowExport: true` alive after a click on the
button labelled None (objectui#6605).
