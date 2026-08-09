---
"@object-ui/i18n": patch
---

`grid.import` saved-mapping copy is now translated in ko / de / fr / es / pt / ru / ar instead of served as English

Five keys — `grid.import.savedMapping`, `chooseSavedMapping`, `manualMapping`,
`savedMappingHint` and `savedMappingPreviewNote` — were **byte-identical to `en`**
in seven of the nine non-`en` packs, 35 values in all. Only zh and ja had been
translated, and two of the five are multi-clause explanatory sentences rather
than placeholders or proper nouns, so this was not a deliberately untranslated
term: a German, French, Spanish, Portuguese, Russian, Korean or Arabic user
picking a saved mapping in the import wizard read English.

None of the three i18n gates could see it. `all-locales-key-parity` compares key
sets and placeholder shapes, so English passed perfectly; the call-site gate only
asks whether a key resolves; `check-i18n-en-drift.mjs` fires on an `en` **value
change** and these keys arrived in the packs already English, so no drift event
ever existed. objectui#3920 also proposed a general "no non-`en` value may be
byte-equal to `en`" gate; that is deliberately not part of this change, because
values like `auth.*.emailPlaceholder` (`name@example.com`),
`fields.image.counter` (`{{current}} / {{total}}`) and
`grid.import.templateFileName` are byte-equal across packs correctly, and
objectui#3880 records the other face of the family. The five keys are pinned by
name instead.

Each translation reuses vocabulary its own pack already ships rather than
inventing a second word for the same concept: `stepMapping` for "mapping"
(Zuordnung / Correspondance / Asignación / Mapeamento / Сопоставление / تعيين /
매핑), `legacyFallbackNotice` for "type coercion" (Typkonvertierung / conversion
de type / conversión de tipos / conversão de tipos / приведение типов / تحويل
الأنواع / 형 변환), `view.readonlyTooltip` for "read-only", and `validateHint`
for "on the server". `es` follows the usted ruling objectui#3844 measured for
this pack; `pt` is the pack's own pt-BR (mapeamento / salvo / no servidor);
`ru` keeps its ё; `fr` keeps the straight apostrophe and the space before colon
and semicolon; `ar` punctuates with U+060C and U+061B; `ko` uses the 은(는) /
이(가) spelling its `fields.file.exceedsMaxSize` already uses for a placeholder
whose particle cannot be resolved at authoring time.

The quote around `{{name}}` follows each pack's measured majority for wrapping a
placeholder — de `„…“` (38 spans against 3 ASCII), fr `« … »` with an ASCII
space (25 against 18), ru `«…»` (23 against 18), and ASCII `"…"` for ko (38:0),
pt (39:0), es (22:19) and ar (27:15). The card cited
`residue-namespaces-3546.test.tsx` as pinning "the rest ASCII", but that line
pins the `empty.*` family only and its own comment scopes the rule to "the
sibling value in the SAME pack"; `grid.import` has no other quoted span, so the
census one ring out decides.

Germanising the two `de` sentences also closes the 45/47 gap
`de-quote-pairing-3876.test.ts` documented: that pack's census moves from
`„` 45 / `“` 47 / `”` 2 to `„` 47 / `“` 47 / `”` 0, exactly as that file's header
predicted, and its `count(“) === count(„) + count(”)` identity still holds. The
three literal counts in it were updated and the two keys are now pinned by name
there, so `rdqKeys === []` cannot become an assertion that passes because nothing
is produced.

`en`, `zh` and `ja` are untouched, and `grid.import.transform` — the sixth key in
the same block, English in the same seven packs — is deliberately left alone and
pinned as still-English so the number cannot drift while that finding waits its
turn.
