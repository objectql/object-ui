---
"@object-ui/components": patch
---

fix(form): a `defaultValues` change no longer discards the field the user is filling

The form renderer adopts a changed `defaultValues` with `form.reset()`, which
replaces the **whole** react-hook-form record — so it also blanks the fields the
incoming defaults say nothing about. And it runs in a **passive effect**, one
commit after those fields have been committed and painted, so input landing in
that window was silently dropped.

The caught case is the wizard (objectui#2982). It reuses ONE inner form across
steps and feeds it `defaultValues={formData}` — the merge of the steps submitted
**so far** — so at every step boundary the incoming defaults are missing exactly
the fields now on screen:

```
RESET to {"name":"Alice"}   (values before: {"name":"Alice","note":"hello"})
-> create POST {"name":"Alice"}   — the last step is gone
```

In a browser this needs a busy main thread plus typing on the first frame after
the new defaults arrive — unlikely by hand, but paste and autofill land in a
single tick. The same shape had already bitten once before, as a `reset()` on
`defaultValues` **identity** churn wiping input mid-interaction; comparing by
value fixed that, and this is the residual hole where the value genuinely did
change.

The reset now carries such a value across instead of dropping it. Deliberately
narrow: only a field the **caller has never carried** — absent from both the
outgoing and the incoming defaults — and whose value the user actually changed
is eligible. Wherever the caller has an opinion it stays authoritative, so the
load-bearing paths are unchanged:

- an edit-mode record landing after first paint still fills every field it names
  (a field the user has NOT touched is empty-ish against the baseline, using the
  same comparison the dirty check uses, so a widget normalizing its own empty
  value on mount is not mistaken for input);
- a `recordId` swap still replaces the record outright — drawer/modal/split
  forms re-fetch without re-entering their loading branch, so record B lands in
  the still-mounted form and must not inherit an abandoned edit to record A;
- a field the caller withdraws from its defaults stops being the user's.

A reset that carries input now also reports the form as dirty (it is, against
the caller's defaults) instead of unconditionally announcing pristine, so a
host's discard guard keeps hearing the truth.
