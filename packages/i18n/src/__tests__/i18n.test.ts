import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { I18N_PROBE_FLAG } from '../i18n';
import {
  createI18n,
  getDirection,
  getAvailableLanguages,
  builtInLocales,
  isRTL,
  RTL_LANGUAGES,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatNumber,
} from '../index';

describe('@object-ui/i18n', () => {
  describe('createI18n', () => {
    it('creates an i18next instance with default config', () => {
      const i18n = createI18n({ detectBrowserLanguage: false });
      expect(i18n).toBeDefined();
      expect(i18n.language).toBe('en');
    });

    it('creates an instance with specified default language', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.language).toBe('zh');
    });

    it('loads all built-in locales', () => {
      const i18n = createI18n({ detectBrowserLanguage: false });
      const langs = getAvailableLanguages(i18n);
      expect(langs).toContain('en');
      expect(langs).toContain('zh');
      expect(langs).toContain('ja');
      expect(langs).toContain('ko');
      expect(langs).toContain('de');
      expect(langs).toContain('fr');
      expect(langs).toContain('es');
      expect(langs).toContain('pt');
      expect(langs).toContain('ru');
      expect(langs).toContain('ar');
      expect(langs.length).toBeGreaterThanOrEqual(10);
    });

    it('translates common keys in English', () => {
      const i18n = createI18n({ defaultLanguage: 'en', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('Save');
      expect(i18n.t('common.cancel')).toBe('Cancel');
      expect(i18n.t('common.delete')).toBe('Delete');
      // U+2026, not three ASCII dots (objectui#3878 converged the ten packs).
      expect(i18n.t('common.loading')).toBe('Loading…');
      expect(i18n.t('common.selectOption')).toBe('Select an option');
      expect(i18n.t('common.select')).toBe('Select…');
    });

    it('translates new form keys in English', () => {
      const i18n = createI18n({ defaultLanguage: 'en', detectBrowserLanguage: false });
      expect(i18n.t('form.createTitle', { object: 'Contact' })).toBe('Create Contact');
      expect(i18n.t('form.editTitle', { object: 'Contact' })).toBe('Edit Contact');
      expect(i18n.t('form.saveRecord')).toBe('Save');
    });

    it('translates common keys in Chinese', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('保存');
      expect(i18n.t('common.cancel')).toBe('取消');
      expect(i18n.t('common.delete')).toBe('删除');
      // U+2026, not three ASCII dots (objectui#3878 converged the ten packs).
      expect(i18n.t('common.loading')).toBe('加载中…');
      expect(i18n.t('common.selectOption')).toBe('请选择');
      expect(i18n.t('common.select')).toBe('选择…');
    });

    it('translates new form keys in Chinese', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.t('form.createTitle', { object: '联系人' })).toBe('新建联系人');
      expect(i18n.t('form.editTitle', { object: '联系人' })).toBe('编辑联系人');
      expect(i18n.t('form.saveRecord')).toBe('保存');
    });

    it('translates toolbarEnabledCount in Chinese (not English fallback)', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.t('console.objectView.toolbarEnabledCount', { count: 3, total: 5 })).toBe('已启用 3/5 项');
    });

    it('translates the AI "Proposed plan" card keys in Chinese (not English fallback)', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.t('console.ai.planTitle')).toBe('方案预览');
      expect(i18n.t('console.ai.planQuestions')).toBe('搭建前请确认');
      expect(i18n.t('console.ai.planAssumptions')).toBe('假设');
      expect(i18n.t('console.ai.planApproveHint')).toBe('回复以确认或调整该方案。');
      expect(i18n.t('console.ai.planApprove')).toBe('开始搭建');
      expect(i18n.t('console.ai.planAdjust')).toBe('调整方案');
      expect(i18n.t('console.ai.planApproveMessage')).toBe('确认，开始搭建。');
      expect(i18n.t('console.ai.planApproveDefaultsMessage')).toBe('确认搭建，未决问题按你的合理假设和默认处理。');
      expect(i18n.t('console.ai.nextSteps')).toBe('下一步');
    });

    // Regression guard: the plan card's "Build it" and the change card's
    // "Confirm" buttons SEND these messages to the agent, and the cloud confirm
    // gate (service-ai-studio confirm-gate.ts APPROVAL_RE) decides whether the
    // text counts as approval. Text the gate does not recognise fails SILENTLY:
    // the agent re-proposes instead of acting and the button just looks inert.
    //
    // `GATE` below is a verbatim mirror of that regex. It is duplicated across
    // repo boundaries on purpose — objectui cannot import from cloud — so when
    // APPROVAL_RE changes there, update this copy in the same breath.
    //
    // How this guard earned its keep: it originally mirrored only the CHINESE
    // clause, and the English half was reduced to "starts with Confirm, contains
    // apply" because nothing here could see the real pattern. That weaker check
    // passed while the shipped English string ("…apply what you just proposed")
    // did NOT match the gate — every English conversation's Confirm button was
    // dead, and so were all eight locales that fall back to English.
    const GATE =
      /直接搭建|直接建|直接帮我(建|搭)|不用再?问我?|别再?问我?|无需确认|不用确认|确认[，,、]?\s*(开始|可以|并|要)?\s*(搭建|创建|生成|构建|修改|应用|执行|继续)|应用(你|您|刚才|这个?|那个?|该|上述|提议|建议)+的?\s*(改动|修改|变更|更改)|^\s*确[认定][。.!！\s]*$|just build it|go ahead and build|start building|build it now|don'?t ask|without confirmation|build it as proposed|build it with your best|apply (this|the) change/i;

    // Only the APPROVAL messages. `planAnswerMessage` is deliberately absent: it
    // answers a structure question so the agent can continue, and must NOT read
    // as blanket approval.
    const APPROVAL_KEYS = [
      'console.ai.planApproveMessage',
      'console.ai.planApproveDefaultsMessage',
      'console.ai.changesConfirmMessage',
    ] as const;

    it.each(['zh', 'en'])(
      'every outbound approval message the %s console sends satisfies the cloud confirm gate',
      (lang) => {
        const i18n = createI18n({ defaultLanguage: lang, detectBrowserLanguage: false });
        for (const key of APPROVAL_KEYS) {
          const msg = i18n.t(key);
          expect(msg, `${key} must not fall through to its raw key`).not.toBe(key);
          expect(msg, `${lang} ${key} does not match the cloud APPROVAL_RE`).toMatch(GATE);
        }
      },
    );

    it('the gate stays narrow — a plain build request is not approval', () => {
      // If these ever match, the preview-first gate has been widened into
      // uselessness and the mirror above is no longer worth trusting.
      expect('帮我搭建一个 CRM').not.toMatch(GATE);
      expect('Please build me a CRM app').not.toMatch(GATE);
      expect('我不确定这样对不对').not.toMatch(GATE);
    });

    it('planAnswerMessage answers a question without reading as approval', () => {
      const i18n = createI18n({ defaultLanguage: 'en', detectBrowserLanguage: false });
      const msg = i18n.t('console.ai.planAnswerMessage', {
        question: 'One shelf or many?',
        option: 'many',
      });
      expect(msg).not.toMatch(GATE);
    });

    it('translates common keys in Japanese', () => {
      const i18n = createI18n({ defaultLanguage: 'ja', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('保存');
      expect(i18n.t('common.cancel')).toBe('キャンセル');
    });

    it('translates common keys in Korean', () => {
      const i18n = createI18n({ defaultLanguage: 'ko', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('저장');
      expect(i18n.t('common.cancel')).toBe('취소');
    });

    it('supports interpolation in validation messages', () => {
      const i18n = createI18n({ defaultLanguage: 'en', detectBrowserLanguage: false });
      expect(i18n.t('validation.required', { field: 'Name' })).toBe('Name is required');
      expect(i18n.t('validation.minLength', { field: 'Password', min: 8 })).toBe(
        'Password must be at least 8 characters',
      );
    });

    it('supports interpolation in Chinese', () => {
      const i18n = createI18n({ defaultLanguage: 'zh', detectBrowserLanguage: false });
      expect(i18n.t('validation.required', { field: '姓名' })).toBe('姓名不能为空');
    });

    it('falls back to English for unknown language', () => {
      const i18n = createI18n({ defaultLanguage: 'xx', fallbackLanguage: 'en', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('Save');
    });

    it('merges custom resources with built-in locales', () => {
      const i18n = createI18n({
        defaultLanguage: 'en',
        detectBrowserLanguage: false,
        resources: {
          en: { custom: { greeting: 'Hello!' } },
        },
      });
      expect(i18n.t('custom.greeting')).toBe('Hello!');
      // Built-in translations still work
      expect(i18n.t('common.save')).toBe('Save');
    });

    it('changes language dynamically', async () => {
      const i18n = createI18n({ defaultLanguage: 'en', detectBrowserLanguage: false });
      expect(i18n.t('common.save')).toBe('Save');

      await i18n.changeLanguage('zh');
      expect(i18n.language).toBe('zh');
      expect(i18n.t('common.save')).toBe('保存');

      await i18n.changeLanguage('ja');
      expect(i18n.language).toBe('ja');
      expect(i18n.t('common.save')).toBe('保存');
    });
  });

  describe('getDirection', () => {
    it('returns ltr for English', () => {
      expect(getDirection('en')).toBe('ltr');
    });

    it('returns ltr for Chinese', () => {
      expect(getDirection('zh')).toBe('ltr');
    });

    it('returns rtl for Arabic', () => {
      expect(getDirection('ar')).toBe('rtl');
    });

    it('returns ltr for unknown languages', () => {
      expect(getDirection('xx')).toBe('ltr');
    });
  });

  describe('isRTL', () => {
    it('returns true for Arabic', () => {
      expect(isRTL('ar')).toBe(true);
    });

    it('returns false for English', () => {
      expect(isRTL('en')).toBe(false);
    });

    it('returns false for Chinese', () => {
      expect(isRTL('zh')).toBe(false);
    });
  });

  describe('RTL_LANGUAGES', () => {
    it('includes Arabic', () => {
      expect(RTL_LANGUAGES).toContain('ar');
    });

    it('includes Hebrew', () => {
      expect(RTL_LANGUAGES).toContain('he');
    });
  });

  describe('builtInLocales', () => {
    it('has 10 built-in language packs', () => {
      expect(Object.keys(builtInLocales).length).toBe(10);
    });

    it('all locales have the same top-level keys', () => {
      const enKeys = Object.keys(builtInLocales.en).sort();
      for (const [lang, locale] of Object.entries(builtInLocales)) {
        const keys = Object.keys(locale).sort();
        expect(keys).toEqual(enKeys);
      }
    });

    it('all locales have common section keys matching English', () => {
      const enCommonKeys = Object.keys(builtInLocales.en.common).sort();
      for (const [lang, locale] of Object.entries(builtInLocales)) {
        const keys = Object.keys(locale.common).sort();
        expect(keys).toEqual(enCommonKeys);
      }
    });
  });

  describe('formatDate', () => {
    it('formats a date with default options', () => {
      const result = formatDate(new Date(2026, 0, 15), { locale: 'en' });
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });

    it('formats a date with short style', () => {
      const result = formatDate(new Date(2026, 0, 15), { locale: 'en', style: 'short' });
      expect(result).toContain('15');
    });

    it('returns string for invalid dates', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD by default', () => {
      const result = formatCurrency(1234.56, { locale: 'en' });
      expect(result).toContain('1,234.56');
    });

    it('formats EUR', () => {
      const result = formatCurrency(1234.56, { locale: 'de', currency: 'EUR' });
      expect(result).toContain('1.234,56');
    });

    it('formats CNY', () => {
      const result = formatCurrency(1234.56, { locale: 'zh', currency: 'CNY' });
      expect(result).toContain('1,234.56');
    });
  });

  describe('formatNumber', () => {
    it('formats a number with default locale', () => {
      const result = formatNumber(1234567.89, { locale: 'en' });
      expect(result).toContain('1,234,567.89');
    });

    it('formats with compact notation', () => {
      const result = formatNumber(1234567, { locale: 'en', notation: 'compact' });
      expect(result).toContain('M'); // e.g. 1.2M
    });
  });

  // ── M2: dev-mode missing-key warnings (issue #1319) ────────────────────────
  describe('warnMissingKeys', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('warns once when a static key is missing', () => {
      const i18n = createI18n({ detectBrowserLanguage: false, warnMissingKeys: true });
      i18n.t('totally.missing.key');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('totally.missing.key');
    });

    it('dedupes repeated lookups of the same missing key', () => {
      const i18n = createI18n({ detectBrowserLanguage: false, warnMissingKeys: true });
      i18n.t('repeat.me');
      i18n.t('repeat.me');
      i18n.t('repeat.me');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('does not warn for resolved keys', () => {
      const i18n = createI18n({ detectBrowserLanguage: false, warnMissingKeys: true });
      i18n.t('common.save');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('stays silent for flagged convention-key probes', () => {
      const i18n = createI18n({ detectBrowserLanguage: false, warnMissingKeys: true });
      i18n.t('crm.objects.lead.label', { defaultValue: '', [I18N_PROBE_FLAG]: true });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn at all when disabled', () => {
      const i18n = createI18n({ detectBrowserLanguage: false, warnMissingKeys: false });
      i18n.t('another.missing.key');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
