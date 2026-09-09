---
'@object-ui/fields': minor
'@object-ui/plugin-form': patch
---

An authored `max_length` on a rich-content field is now VISIBLE, not only enforced at
submit (objectui#8438).

**The defect.** `markdown`, `html` and `richtext` are three registry keys served by ONE
widget, `RichTextField`. That widget read `maxLength` / `max_length` nowhere, while
`buildValidationRules` — which has no field-type gate — compiled the same key into a
react-hook-form rule for every field. So a cap authored on any of the three was enforced
when the form was submitted and invisible before then: no native stop, no character
counter, nothing named in `aria-describedby`. The person was told the limit only after
writing the text, which is the worst of the three possible orderings.

**The fix, and where it is NOT.** The card was filed as "`richtext` is missing from
`ObjectForm`'s maxLength guard and `EmbeddableForm`'s `DEFAULT_MAX_LENGTH`". Re-measured,
neither list could have carried the cap:

- `ObjectForm`'s guard writes `formField.maxLength`, but a registered widget's metadata
  carrier is `formField.field` — a different object. Ablating that assignment entirely
  changed no rendered attribute, for any of the four types it names. It is left in place
  (it is live for the other form-field producer) with the measurement recorded at the site.
- `EmbeddableForm`'s `DEFAULT_MAX_LENGTH` did deliver 5000 for `markdown` and `html`, and
  `RichTextField` then dropped it unread.

⇒ The cap was lost for **all three** rich-content keys, not for `richtext` alone.
`RichTextField` now dual-reads `maxLength ?? max_length` off its metadata carrier — the
same read `TextAreaField` has carried since framework#1878 §3 — and forwards it to the
native stop, the `CharacterCount` counter and the `aria-describedby` wiring, on both the
inline surface and the fullscreen dialog.

**What changes for you.** A `markdown`, `html` or `richtext` field that already declares
`max_length` (or the spec-canonical `maxLength`) now shows a counter and stops typing at
the cap, where before it silently accepted the overflow and failed on submit. A field with
no authored cap is unchanged. In `EmbeddableForm`, a public form's `richtext` field is now
capped at the 5000-character long-text default like its two siblings, instead of accepting
unbounded input.

**New export.** `@object-ui/fields` publishes `RICH_TEXT_FIELD_TYPES` (and the
`RichTextFieldType` union), the key set of the widget's display table, so consumers stop
hand-writing the list. `EmbeddableForm`'s cap table is derived from it. This answers the
list question objectui#4831 raised and its fix declined to remove — the root cause behind
objectui#4250, objectui#4831 and this card: a hand-written list that stops at two of one
widget's three registry keys can no longer omit the third, because it no longer names one.
