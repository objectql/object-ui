---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

`TextAreaField`'s character counter no longer re-announces itself on every keystroke. Measured on `main` in a zh session with `maxLength: 500`, typing a 52-character sentence one character at a time produced 52 distinct screen-reader announcements totalling 979 spoken characters — roughly 19x the text being written, each one cutting off the reader's echo of the letter just typed. The counter element was simultaneously the visible `{n}/{max}` digits, the carrier of the translated sentence and the `aria-live` region itself, so "re-render" and "announce" were the same event; the field also had no `aria-describedby`, so focusing it said nothing about the cap at all (#3408).

It is now the three-node shape the GOV.UK Design System character-count component uses: the visible digits are `aria-hidden` and purely decorative; the counter sentence (`fields.textarea.characterCount`, unchanged in all ten packs) has moved onto the textarea's `aria-describedby`, so focus reads "Character count: 12 of 500" once and then stays quiet; and a separate visually-hidden `aria-live="polite"` region carries a new near-limit warning, `fields.textarea.charactersRemaining` (new in all ten packs), which stays silent until the value is inside the last 10% or last 20 characters of the cap — whichever the typist reaches first — and updates only after typing pauses for a second. The same 52-keystroke probe now produces zero announcements; a run that types all the way onto a 500-character cap produces five. Any `aria-describedby` the host already supplied (the form renderer's description and error-message ids) is appended to, never replaced.

No metadata change: the counter still renders exactly when the field declares `maxLength` (or the legacy `max_length`), and a widget rendered with no `I18nProvider` still shows the same English sentences.
