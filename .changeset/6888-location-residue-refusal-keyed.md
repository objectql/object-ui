---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

Key `LocationField`'s THIRD refusal sentence — the residue arm — into the locale
packs (objectui#6888).

Typing a half that is only PARTLY a number (`12abc, 34`) is refused by
`LocationField` with its own sentence, added by objectui#6715. objectui#6755 had
ruled two weeks earlier that a widget's own refusal sentence goes through
`useFieldTranslation` + `FIELD_DEFAULTS`, and named three sentences — but it was
written on 2026-08-29 14:53 and this arm landed after, so it stayed a hard-coded
English literal while its two siblings were keyed.

**The consequence was worse than one more English string.** All three refusal arms
render through the SAME `<p>` and the same `refusalError` state, so after #6755
landed that one line spoke the reader's language when the format or range arm fired
and English when the residue arm did — objectui#4028's shape ("four Chinese labels
around one English one") compressed into a single sentence position, which reads to
a user as a bug rather than as a missing translation.

**Arity is answered explicitly, not defaulted.** Unlike the other two sentences, this
one had grammatical number: `verb` was `is not a number` / `are not numbers`, chosen
in TypeScript. Handing a pack an English verb form through a `{{hole}}` gives it a
fragment it cannot inflect around — Arabic has a DUAL, and two halves is exactly that
case. So the verb is not a hole. It lives inside two SIBLING keys picked at the call
site, `fields.location.refusedResidue` and `fields.location.refusedResidueOne`,
following this repo's own plural convention rather than i18next's `_one`/`_other`
suffixes — the same shape `RecordPickerDialog` already uses in this very defaults map
(`lookup.recordCount` / `lookup.recordCountOne`), and for the reason `ReactionPicker`
states in source: zh/ja/ko have no separate singular form, would legitimately omit a
`_one` half, and `all-locales-key-parity` reads that as a missing key. The `ar` pack
now uses its dual (`ليسا رقمين`), which the old implementation could not have produced.

The English conjunction `' and '` and the coordinate NOUNS go the same way: each pack
writes its own conjunction inside the two-half value, and `latitude` / `longitude`
become `fields.location.latitude` / `fields.location.longitude`, keyed once each and
interpolated into both arities so no locale holds two spellings of the same word. The
only holes carrying untranslated data are `{{text}}` / `{{otherText}}` — the
characters the person actually typed.

**No behaviour moves.** The English values are byte-identical to the literal they
replace in both arities, verified by `check:i18n-drift` (0 en values changed, 4 added)
and by objectui#6715's own `LocationField.strictNumeric.test.tsx` and `plugin-form`'s
`ObjectForm.locationResidue.test.tsx` passing untouched. Provider-less rendering is
unchanged, the refusal itself is unchanged, and the four new keys are bound from here
on by `check:i18n-keys` and `all-locales-key-parity` like their three siblings.
