---
"@object-ui/i18n": patch
---

`grid.import.transform` is now translated in ko / de / fr / es / pt / ru / ar instead of served as English

The third column header of the import wizard's saved-mapping summary was
**byte-identical to `en`** — the literal string `Transform` — in seven of the
nine non-`en` packs. zh (`转换`) and ja (`変換`) had translated it, which is what
rules out the "deliberately untranslated term" reading; this is the sixth key of
the same six-line block objectui#3920 / PR #3936 fixed the other five of, and it
was left out of that card only to keep its 5-keys / 35-values census verifiable.

| pack | before | after | the pack's own anchor |
|------|--------|-------|----------------------|
| ko | `Transform` | `변환` | `savedMappingHint` "이름 변경 + 변환 + 형 변환" |
| de | `Transform` | `Transformation` | `savedMappingHint` "Umbenennung + Transformationen + Typkonvertierung" |
| fr | `Transform` | `Transformation` | `savedMappingHint` "le renommage + les transformations + la conversion de type" |
| es | `Transform` | `Transformación` | `savedMappingHint` "el cambio de nombre + las transformaciones + la conversión de tipos" |
| pt | `Transform` | `Transformação` | `savedMappingHint` "renomeação + transformações + conversão de tipos" |
| ru | `Transform` | `Преобразование` | `savedMappingHint` "переименование + преобразования + приведение типов" |
| ar | `Transform` | `التحويل` | `savedMappingHint` "إعادة التسمية + التحويلات + تحويل الأنواع" |

Each value is the **singular of the word the pack already uses** for `en`'s
plural "transforms" in `grid.import.savedMappingHint` — the sentence
`SavedMappingSummary` renders directly above this header. That is the anchor
rather than `legacyFallbackNotice`'s term, because `en`'s own sentence lists
"transforms" and "type coercion" as two different server-side operations and
`legacyFallbackNotice` is about the second: reusing de "Typkonvertierung", ko
"형 변환" or ar "تحويل الأنواع" for this header would name the wrong operation.

Why it was worth a card of its own rather than waiting for a general gate: this
value is not a hidden string. It is the third `TableHead` of
`SavedMappingSummary`, sitting in one row with `csvColumn` and `mapsTo`, which
were always translated — so a German user read `Spalte` / `Zugeordnet zu` /
`Transform`, two languages in a single header row, directly under the German
hint PR #3936 had just landed. Before that PR the whole panel was English and
therefore at least self-consistent.

The three i18n gates are value-blind here exactly as they were for
objectui#3920: `all-locales-key-parity` compares key sets and placeholder shapes
(the key was present with no placeholder, so English passed perfectly), the
call-site gate only asks whether a key resolves, and `check-i18n-en-drift.mjs`
fires on an `en` **value change** — this value entered the seven packs already
English, so no drift event ever existed. `en`, zh and ja are untouched, and the
pin PR #3936 left in `gridImportSavedMapping-i18n-3920.test.ts` asserting these
seven were "still English" has been replaced by the translated pin it asked for.
