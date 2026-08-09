/**
 * objectui#3920 — the five `grid.import` saved-mapping keys were **English** in
 * seven of the nine non-`en` packs.
 *
 * ## The defect, as measured at `origin/main` @ 230ffd875
 *
 * `savedMapping`, `chooseSavedMapping`, `manualMapping`, `savedMappingHint` and
 * `savedMappingPreviewNote` were **byte-identical to `en`** in ko, de, fr, es,
 * pt, ru and ar — 35 values. Only zh and ja were translated, which is what rules
 * out the "deliberately untranslated term" reading: two packs did translate
 * them, and two of the five are multi-clause explanatory sentences, not
 * placeholders or proper nouns. A German user picking a saved mapping in the
 * import wizard read English.
 *
 * ## Why none of the three i18n gates could see it
 *
 * `all-locales-key-parity.test.ts` compares key sets and placeholder shapes —
 * the keys were present and the placeholders correct, so English passed
 * perfectly. `scripts/check-i18n-call-site-keys.mjs` only asks whether a key
 * resolves. `scripts/check-i18n-en-drift.mjs` fires on an **`en` value change**
 * and asks the nine packs to follow; these values arrived in the packs already
 * English, so no drift event ever existed. All three are value-blind by design.
 * objectui#3920 also proposed a general "no non-`en` value may be byte-equal to
 * `en`" gate; that is deliberately NOT what this file is. Such a gate needs its
 * denominator measured first — `auth.*.emailPlaceholder`
 * (`name@example.com`), `fields.image.counter` (`{{current}} / {{total}}`),
 * `grid.import.templateFileName` and `collaboration.userStatusTitle` are
 * byte-equal across packs *correctly*, and objectui#3880 records the other face
 * of the same family (a shared `en` value must not be forced to diverge). This
 * file pins these five keys and generalises to nothing.
 *
 * ## What is asserted, and at what granularity
 *
 * Per pack and key: (1) the value is no longer the `en` value; (2) it still
 * carries `{{name}}` wherever `en` does; (3) the two sentences quote `{{name}}`
 * in the span the pack's own typography uses. Spans rather than whole
 * sentences, following `de-quote-pairing-3876.test.ts`: a legitimate copy edit
 * by a native speaker must not have to fight this file, while a re-paste of the
 * English prose or a change to the quote typography still fails by key name.
 *
 * ## The per-pack quote ruling, measured rather than assumed
 *
 * The card proposed "de `„…“`, fr `«…»`, the rest ASCII" and cited
 * `residue-namespaces-3546.test.tsx:701` as authority. That line pins the
 * `empty.*` family only (ko/fr/es/pt/ru/ar ASCII there), and its own comment
 * says the style "follows the sibling empty-state value in the SAME pack" — a
 * family-local rule, not a pack-wide decree. `grid.import` holds no other
 * quoted span to follow, so the ring outside it decides: how each pack wraps a
 * `{{placeholder}}` anywhere. Census over the packs, excluding the two English
 * carry-ins this issue removes:
 *
 *   | pack | ASCII `"…"` | `«…»` | `„…“` | ruling |
 *   |------|------------|-------|-------|--------|
 *   | ko   | 38         | 0     | 0     | ASCII  |
 *   | de   | 3          | 0     | 38    | `„…“`  |
 *   | fr   | 18         | 25    | 0     | `«…»`  |
 *   | es   | 22         | 19    | 0     | ASCII  |
 *   | pt   | 39         | 0     | 0     | ASCII  |
 *   | ru   | 18         | 23    | 0     | `«…»`  |
 *   | ar   | 27         | 14    | 0     | ASCII  |
 *
 * fr and ru are the two packs where the card's `«…»` is also the measured
 * majority, and fr writes it with an ASCII space inside the guillemets (25 of
 * 25, no narrow no-break space anywhere in the pack) while ru/es/ar write it
 * tight. es (22:19) and ar (27:15) are the near calls and went ASCII on the
 * count; both splits are authorship-batch rather than semantic (the
 * objectui#3546 slices used ASCII, older values used guillemets), which is why
 * the majority and not a meaning-based rule is the tiebreak here.
 *
 * Related: objectui#3876 / PR #3918 (de quote mispairing — the census this
 * change moves 45/47/2 to 47/47/0, see `de-quote-pairing-3876.test.ts`),
 * objectui#3919 (de `approvalsInbox` ASCII quotes, a separate card and
 * deliberately untouched here), objectui#3880, objectui#3844 (the `es` register
 * ruling these translations follow: usted).
 */
import { describe, expect, it } from 'vitest';

import { builtInLocales } from '../locales/index';

const NS = 'grid.import';
const KEYS = [
  'savedMapping',
  'chooseSavedMapping',
  'manualMapping',
  'savedMappingHint',
  'savedMappingPreviewNote',
] as const;

/** The seven packs that served `en` for all five keys. */
const PACKS = ['ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar'] as const;

/** The two multi-clause sentences; the only two of the five that quote a name. */
const SENTENCES = ['savedMappingHint', 'savedMappingPreviewNote'] as const;

/** Each pack's own span for a quoted `{{name}}` — see the census in the header. */
const QUOTED_NAME: Record<(typeof PACKS)[number], string> = {
  ko: '"{{name}}"',
  de: '„{{name}}“',
  fr: '« {{name}} »',
  es: '"{{name}}"',
  pt: '"{{name}}"',
  ru: '«{{name}}»',
  ar: '"{{name}}"',
};

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

const value = (lang: string, key: string) => at(builtInLocales[lang], `${NS}.${key}`) as string;

describe('objectui#3920 — grid.import saved-mapping keys are translated in all nine packs', () => {
  it('the ten packs all define the five keys (anti-vacuous guard)', () => {
    // Every assertion below reads these values. A renamed key would otherwise
    // let `not.toBe(en)` pass on `undefined` versus a string and read as green.
    for (const lang of [...PACKS, 'en', 'zh', 'ja']) {
      for (const key of KEYS) {
        const v = value(lang, key);
        expect(typeof v, `${lang} ${NS}.${key}`).toBe('string');
        expect(v.trim().length, `${lang} ${NS}.${key} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('no pack serves the en value any more — 35 of 35, the whole defect in one assertion', () => {
    // THE assertion. Before this change all 35 of these were byte-equal to `en`;
    // the list below is what a re-paste of the English prose into any pack would
    // print, by pack and key.
    const englishStill: string[] = [];
    for (const lang of PACKS) {
      for (const key of KEYS) {
        if (value(lang, key) === value('en', key)) englishStill.push(`${lang}.${NS}.${key}`);
      }
    }
    expect(englishStill, `packs still serving the en value:\n${englishStill.join('\n')}`).toEqual([]);
    // …and the count is the issue's own: 5 keys x 7 packs.
    expect(PACKS.length * KEYS.length).toBe(35);
  });

  it('zh and ja are untouched — they were the two packs that were already right', () => {
    // The control set the card used to rule out "intentionally untranslated".
    // Pinned so a later sweep cannot quietly re-English them.
    expect(value('zh', 'savedMapping')).toBe('已保存的映射：');
    expect(value('zh', 'manualMapping')).toBe('— 手动映射列 —');
    expect(value('ja', 'savedMapping')).toBe('保存済みマッピング：');
    expect(value('ja', 'manualMapping')).toBe('— 列を手動でマッピング —');
    for (const key of KEYS) {
      expect(value('zh', key), `zh ${key}`).not.toBe(value('en', key));
      expect(value('ja', key), `ja ${key}`).not.toBe(value('en', key));
    }
  });

  it('en still says what these translations were made against', () => {
    // The en-drift gate (objectui#3650) fires when an `en` value moves and asks
    // the nine packs to follow — it cannot know these rulings. This line goes
    // red in the same PR that rewords either sentence, which is what forces the
    // seven translations above to be re-read then.
    expect(value('en', 'savedMappingHint')).toBe(
      'Mapping “{{name}}” applies rename + transforms + type coercion on the server. ' +
        'Column mapping is read-only.',
    );
    expect(value('en', 'savedMappingPreviewNote')).toBe(
      'The preview shows your source columns; on import, mapping “{{name}}” applies rename, ' +
        'transforms and type coercion on the server.',
    );
    expect(value('en', 'savedMapping')).toBe('Saved mapping:');
    expect(value('en', 'chooseSavedMapping')).toBe('Choose a saved mapping…');
    expect(value('en', 'manualMapping')).toBe('— Map columns manually —');
  });

  it('the {{name}} placeholder survived in both sentences, in every pack', () => {
    // `all-locales-key-parity` already compares placeholder shapes, so this is
    // not a substitute for it — it is the local proof that the two values these
    // translations rewrote most heavily did not drop the hole the call site
    // fills (`ImportWizard.tsx` passes `{ name: mapping.label || mapping.name }`).
    for (const lang of [...PACKS, 'en', 'zh', 'ja']) {
      for (const key of SENTENCES) {
        expect(value(lang, key), `${lang} ${key} lost {{name}}`).toContain('{{name}}');
      }
    }
  });

  it('each pack quotes {{name}} in its own typography, not in en’s', () => {
    // The half of the fix that a machine translation gets wrong first. `en`
    // quotes with the English curly pair; carrying that pair into a pack is the
    // fingerprint of a copy-paste, and in `de` it additionally broke the census
    // `de-quote-pairing-3876.test.ts` keeps (its 45/47 gap WAS these two keys).
    for (const lang of PACKS) {
      for (const key of SENTENCES) {
        const v = value(lang, key);
        expect(v, `${lang} ${key} quote span`).toContain(QUOTED_NAME[lang]);
        // The paste fingerprint is the *pair*, and it is the safe thing to
        // forbid everywhere: U+201C on its own is not an English opener in `de`,
        // it is German's CLOSER. Asserting "no U+201C" across all seven packs
        // fails a correctly Germanised `de` — which is how this assertion first
        // went red, and why `de-quote-pairing-3876.test.ts`'s header warns that
        // U+201E and U+201C are one pixel apart in most editor fonts.
        expect(v.includes('“{{name}}”'), `${lang} ${key} kept en’s curly pair`).toBe(false);
        expect(v.includes('”'), `${lang} ${key} kept an English closing quote`).toBe(false);
        if (lang !== 'de') {
          expect(v.includes('“'), `${lang} ${key} kept en’s opening curly quote`).toBe(false);
        }
      }
    }
    // de is the one pack whose ruling is a pack-wide invariant rather than a
    // local majority, and it has its own file; assert the handshake here so a
    // reader of either file finds the other.
    expect(QUOTED_NAME.de).toBe('„{{name}}“');
    // fr writes the guillemets with an ASCII space (U+0020) inside, 25 of 25
    // across the pack — not U+202F/U+00A0, which is the habit a translator
    // importing French typography rules would introduce.
    expect(QUOTED_NAME.fr).toBe(`«${String.fromCharCode(32)}{{name}}${String.fromCharCode(32)}»`);
    for (const key of SENTENCES) {
      const v = value('fr', key);
      expect(v.includes(`«${String.fromCharCode(160)}`), `fr ${key} used a no-break space`).toBe(false);
      expect(v.includes(`«${String.fromCharCode(8239)}`), `fr ${key} used a narrow no-break space`).toBe(
        false,
      );
    }
  });

  it('manualMapping keeps the em-dash bracket its sibling select option uses', () => {
    // `manualMapping` is a select option rendered next to `noneOption` in the
    // same wizard, and `en` gives both the `— … —` shape. zh and ja kept it when
    // they translated; the seven packs must too, or the option stops reading as
    // "not a real mapping".
    for (const lang of [...PACKS, 'en', 'zh', 'ja']) {
      const v = value(lang, 'manualMapping');
      expect(v.startsWith('— '), `${lang} manualMapping opening em dash`).toBe(true);
      expect(v.endsWith(' —'), `${lang} manualMapping closing em dash`).toBe(true);
      // …and the pack's own `noneOption`, six lines above it in the source, is
      // the precedent being followed rather than a shape invented here.
      expect(at(builtInLocales[lang], `${NS}.noneOption`), `${lang} noneOption`).toMatch(/^— .* —$/);
    }
  });

  it('savedMapping keeps the trailing colon its sibling label uses, in the pack’s own form', () => {
    // `savedMapping` and `mappingTemplate` are the two labels of the same strip
    // and `en` ends both with ":". CJK packs use the fullwidth "：", fr puts a
    // space before the ASCII colon (59 of 61 colons in the pack) — so the check
    // is "same terminator as your own sibling", not "ends with U+003A".
    for (const lang of [...PACKS, 'en', 'zh', 'ja']) {
      const sibling = at(builtInLocales[lang], `${NS}.mappingTemplate`) as string;
      // The terminator is the colon plus whatever whitespace precedes it — NOT
      // the sibling's last two characters, which in `ko` is the tail of the word
      // "템플릿" and made this assertion demand that two different labels end with
      // the same syllable.
      const terminator = /(\s?[:：])$/.exec(sibling)?.[1];
      expect(terminator, `${lang} ${NS}.mappingTemplate has no colon terminator`).toBeTruthy();
      expect(
        value(lang, 'savedMapping').endsWith(terminator as string),
        `${lang} savedMapping terminator (sibling ends ${JSON.stringify(terminator)})`,
      ).toBe(true);
    }
    expect(value('fr', 'savedMapping')).toBe('Correspondance enregistrée :');
    expect(value('zh', 'savedMapping').endsWith('：')).toBe(true);
  });

  it('chooseSavedMapping keeps the ellipsis of its sibling chooser', () => {
    // U+2026, not three dots — `chooseTemplate` is the sibling and `en` uses the
    // single character in both.
    for (const lang of [...PACKS, 'en', 'zh', 'ja']) {
      expect(value(lang, 'chooseSavedMapping').endsWith('…'), `${lang} ellipsis`).toBe(true);
      expect(value(lang, 'chooseSavedMapping').includes('...'), `${lang} used three dots`).toBe(false);
    }
  });

  it('each translation reuses the vocabulary its own pack already ships', () => {
    // Terminology, not grammar: every stem below is lifted from an EXISTING
    // value in the same pack (mostly from `grid.import` itself), so the wizard
    // does not acquire a second word for "mapping" or "type coercion". These
    // are the anchors named in the PR's per-pack rationale.
    const ANCHORS: Array<[lang: string, key: string, stems: string[]]> = [
      // de: `stepMapping` "Zuordnung", `legacyFallbackNotice` "Typkonvertierung",
      // `view.readonlyTooltip` "schreibgeschützt", `validateHint` "auf dem Server".
      ['de', 'savedMappingHint', ['Zuordnung', 'Typkonvertierung', 'schreibgeschützt', 'auf dem Server']],
      ['de', 'savedMappingPreviewNote', ['Vorschau', 'Zuordnung', 'Typkonvertierung']],
      // fr: `stepMapping` "Correspondance", `legacyFallbackNotice`
      // "conversion de type" + "côté serveur", `view.readonlyTooltip` "en lecture seule".
      ['fr', 'savedMappingHint', ['correspondance', 'conversion de type', 'côté serveur', 'en lecture seule']],
      ['fr', 'savedMappingPreviewNote', ["L'aperçu", 'colonnes source', 'côté serveur']],
      // es: `stepMapping` "Asignación", `legacyFallbackNotice` "conversión de tipos",
      // `view.readonlyTooltip` "solo lectura", `validateHint` "en el servidor".
      ['es', 'savedMappingHint', ['asignación', 'conversión de tipos', 'solo lectura', 'en el servidor']],
      ['es', 'savedMappingPreviewNote', ['vista previa', 'columnas de origen', 'en el servidor']],
      // pt: `stepMapping` "Mapeamento", `legacyFallbackNotice` "conversão de tipos",
      // `view.readonlyTooltip` "somente leitura", `validateHint` "no servidor".
      ['pt', 'savedMappingHint', ['mapeamento', 'conversão de tipos', 'somente leitura', 'no servidor']],
      ['pt', 'savedMappingPreviewNote', ['pré-visualização', 'colunas de origem', 'no servidor']],
      // ru: `stepMapping` "Сопоставление", `legacyFallbackNotice` "приведение типов",
      // `view.readonlyTooltip` "только для чтения", `validateHint` "на сервере".
      ['ru', 'savedMappingHint', ['опоставление', 'приведение типов', 'только для чтения', 'на сервере']],
      ['ru', 'savedMappingPreviewNote', ['редпросмотр', 'исходные столбцы', 'на сервере']],
      // ar: `stepMapping` "تعيين", `legacyFallbackNotice` "تحويل الأنواع",
      // `view.readonlyTooltip` "للقراءة فقط", `validateHint` "على الخادم".
      ['ar', 'savedMappingHint', ['التعيين', 'تحويل الأنواع', 'للقراءة فقط', 'على الخادم']],
      ['ar', 'savedMappingPreviewNote', ['المعاينة', 'الأعمدة المصدر', 'على الخادم']],
      // ko: `stepMapping` "매핑", `legacyFallbackNotice` "형 변환",
      // `view.readonlyTooltip` "읽기 전용", `validateHint` "서버에서".
      ['ko', 'savedMappingHint', ['매핑', '형 변환', '읽기 전용', '서버에서']],
      ['ko', 'savedMappingPreviewNote', ['미리보기', '원본 열', '서버에서']],
    ];
    for (const [lang, key, stems] of ANCHORS) {
      const v = value(lang, key);
      for (const stem of stems) {
        expect(v, `${lang} ${key} dropped the pack's word "${stem}"`).toContain(stem);
      }
    }
  });

  it('ru keeps its ё and fr its straight apostrophe — the two pack-wide habits here', () => {
    // Both are pack-wide conventions asserted elsewhere for other keys
    // (`residue-namespaces-3546.test.tsx`), re-asserted on these five because a
    // machine translation drops ё and a French typography rule swaps `'` for `’`.
    expect(value('ru', 'savedMapping')).toContain('ё');
    expect(value('ru', 'chooseSavedMapping')).toContain('ё');
    for (const key of KEYS) {
      expect(value('fr', key).includes('’'), `fr ${key} used a curly apostrophe`).toBe(false);
    }
    expect(value('fr', 'savedMappingPreviewNote')).toContain("L'aperçu");
  });

  it('ar punctuates in Arabic — its own comma and semicolon, not the ASCII ones', () => {
    // Measured in the pack: 81 Arabic commas against 2 ASCII, 11 Arabic
    // semicolons against 1. `en`'s clause break in `savedMappingPreviewNote` is
    // a `;`, which is exactly where a paste leaves the ASCII character behind.
    const note = value('ar', 'savedMappingPreviewNote');
    expect(note, 'ar previewNote should break clauses with U+061B').toContain('؛');
    expect(note.includes(';'), 'ar previewNote kept the ASCII semicolon').toBe(false);
  });

  it('ko marks the ambiguous particle the way its own pack does', () => {
    // `{{name}}` is dynamic, so the 은/는 and 이/가 particles after it cannot be
    // resolved at authoring time. The pack already solved this in
    // `fields.file.exceedsMaxSize` ("{{name}}"이(가) …), and these two values
    // follow that spelling rather than guessing one branch.
    expect(value('ko', 'savedMappingHint')).toContain('"{{name}}"은(는)');
    expect(value('ko', 'savedMappingPreviewNote')).toContain('"{{name}}"이(가)');
    expect(at(builtInLocales.ko, 'fields.file.exceedsMaxSize')).toContain('"{{name}}"이(가)');
  });

  it('the hint keeps the `+` formula that en, zh and ja all use', () => {
    // `savedMappingHint` lists three server-side operations as `a + b + c` and
    // `savedMappingPreviewNote` lists the same three as prose. Both packs that
    // had translated these kept the distinction (zh " + ", ja fullwidth "＋"),
    // so the seven follow rather than flattening the hint into a comma list.
    for (const lang of PACKS) {
      const v = value(lang, 'savedMappingHint');
      expect(v.split(' + ').length - 1, `${lang} hint should join three operations with " + "`).toBe(2);
    }
    expect(value('zh', 'savedMappingHint')).toContain(' + ');
    expect(value('ja', 'savedMappingHint')).toContain('＋');
  });

  it('grid.import.transform is still English in these packs — filed separately, not fixed here', () => {
    // Recorded, not repaired. `transform` sits between `manualMapping` and
    // `savedMappingHint` in every one of these files and has the same defect
    // shape, but objectui#3920 enumerated five keys and 35 values; widening the
    // count here would make this file's own census unverifiable against the
    // card. Pinned so the number cannot drift unnoticed while that finding waits
    // its turn — and so whoever fixes it has to come back and delete this test.
    const english = at(builtInLocales.en, `${NS}.transform`);
    const still = PACKS.filter((lang) => at(builtInLocales[lang], `${NS}.transform`) === english);
    expect(still).toEqual(['ko', 'de', 'fr', 'es', 'pt', 'ru', 'ar']);
    expect(english).toBe('Transform');
    // zh and ja did translate it, which is the same control set as above.
    expect(at(builtInLocales.zh, `${NS}.transform`)).toBe('转换');
    expect(at(builtInLocales.ja, `${NS}.transform`)).toBe('変換');
  });
});
