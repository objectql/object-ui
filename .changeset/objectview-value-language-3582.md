---
'@object-ui/i18n': patch
---

`console.objectView.systemViewReadonly` and `console.objectView.expandToPage`
are translated in the eight packs that stored English for them, so a Japanese,
Korean, German, French, Spanish, Portuguese, Russian or Arabic session reads
the system-view hint and the expand affordance in its own language (#3582).

This is a different defect class from #3546's ledger, and no gate in the repo
could see it. There the key was *missing* from a pack and `fallbackLng: 'en'`
rendered English; here the key was **present in all ten** and eight of them
stored English as the value. `all-locales-key-parity` compares key *sets* and
placeholder *shape* — identical before and after this change, and neither key
interpolates anything. `scripts/check-i18n-call-site-keys.mjs` and its baseline
ratchet ask whether a `t()` key exists in `en`; it did, so these two were never
in the 258.

`systemViewReadonly` carried the sharper half: the eight packs did not hold
`en`'s sentence, they held one `en` had already abandoned. `en` says the view
is read-only; the eight said `System view defined in code - duplicate to
customize.` — pointing eight locales at a duplicate-to-customize path the
product no longer presents. They are translated against `en`'s **current**
read-only meaning, not against the stale English they replaced.

Each value is built from terminology the same pack already uses rather than
invented: `view.readonlyTooltip` supplies "system view" and
`console.objectView.cannotEditMetaView` (landed in #3583) supplies "defined in
code", so the new hint agrees with the copy beside it in every pack. For
`expandToPage`, `detail.openAsFullPage` is the identical English sentence one
namespace over and was already translated everywhere — `en` and `zh` hold their
two byte-identical to each other, so the eight now do too, and one locale
cannot end up with two different words for one action.

`en` and `zh` are unchanged, byte for byte. No key is added or removed —
the diff is 16 values in 8 files. A new
`objectView-value-language-3582.test.ts` pins the `en` literal (so the next
rewording of `en` fails loudly instead of silently orphaning nine
translations), asserts that no pack but `en` serves either English spelling,
and requires the zh/ja/ko/ru/ar values to contain characters of their own
script. The repo-wide "no ASCII English sentence in a non-Latin pack" gate that
#3582 also sketched is deliberately **not** here; it is a separate, lands-green
change.
