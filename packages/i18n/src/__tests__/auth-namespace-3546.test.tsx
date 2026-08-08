/**
 * The auth family — `auth` / `oauth` / `acceptInvitation`, objectui#3546 slice
 * three — resolves **from the locale packs, with a provider mounted**.
 *
 * ## What was broken, precisely
 *
 * `scripts/check-i18n-call-site-keys.mjs` measured 54 keys under these three
 * namespaces that a `t()` call site asks for and that NO pack defined — 54
 * distinct keys at 54 call sites (this slice happens to be 1:1; slice two was
 * 90 keys at 93 sites, so the denominator is measured, never counted by hand).
 * All 54 carried an inline `t(key, { defaultValue: 'English' })`, so this is the
 * milder objectui#3517 class: English rendered correctly at every call site and
 * **all ten languages were stuck on it**. Nothing rendered a raw key here —
 * slice one (PR #3583) held the sites that did, and an AST sweep of all 122
 * call sites in these namespaces found **zero** dead `t(key) || 'English'`
 * fallbacks, which is why this slice touches no component file.
 *
 * Consequence for test design, same as slice two: `en` output was already
 * correct before the change, so **an `en` assertion cannot discriminate before
 * from after**. Every assertion that pins the fix is a non-`en` one; the `en`
 * cases only prove the key is reachable through the real binding.
 *
 * ## Why a provider is mounted
 *
 * All six components behind these keys — `LoginPage`, `ForgotPasswordPage`,
 * `VerifyEmailPromptPage`, `DeviceAuthPage`, `OAuthConsentPage` and the
 * console's `AcceptInvitationPage` — bind `t` from a bare
 * `useObjectTranslation()`. None sits behind a `createSafeTranslation` defaults
 * map, so there is no provider-less path to be green on: without
 * `I18nProvider`, i18next is not the thing answering and the test would
 * describe a binding the console never uses.
 *
 * ## Two holes that are NOT i18next's
 *
 * `resendOtpCountdownText` carries `{seconds}` in SINGLE braces because
 * `packages/auth/src/LoginForm.tsx:429` and `ForgotPasswordForm.tsx:367` do a
 * literal `.replace('{seconds}', …)`. i18next must leave it alone, and every
 * pack must keep the token — asserted below in both directions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { I18nProvider, useObjectTranslation } from '../provider';
import { builtInLocales } from '../locales/index';

/** The 54 keys this slice backfilled, grouped as the packs group them. */
const KEYS = [
  // auth.login — the phone/OTP branch of the sign-in form (10)
  'auth.login.emailOrPhoneLabel',
  'auth.login.emailOrPhonePlaceholder',
  'auth.login.phoneLabel',
  'auth.login.phonePlaceholder',
  'auth.login.otpCodeLabel',
  'auth.login.otpCodePlaceholder',
  'auth.login.sendOtpButton',
  'auth.login.resendOtpCountdownText',
  'auth.login.usePhoneOtpText',
  'auth.login.usePasswordSignInText',
  // auth.forgotPassword — the SMS reset branch (13)
  'auth.forgotPassword.phoneLabel',
  'auth.forgotPassword.phonePlaceholder',
  'auth.forgotPassword.otpCodeLabel',
  'auth.forgotPassword.otpCodePlaceholder',
  'auth.forgotPassword.sendOtpButton',
  'auth.forgotPassword.resendOtpCountdownText',
  'auth.forgotPassword.newPasswordLabel',
  'auth.forgotPassword.newPasswordPlaceholder',
  'auth.forgotPassword.resetButton',
  'auth.forgotPassword.usePhoneResetText',
  'auth.forgotPassword.useEmailResetText',
  'auth.forgotPassword.phoneSuccessTitle',
  'auth.forgotPassword.phoneSuccessDescription',
  // auth.device — the plugin-disabled dead end (2)
  'auth.device.disabledTitle',
  'auth.device.disabledDescription',
  // auth.verifyEmail (1)
  'auth.verifyEmail.resendUnavailable',
  // oauth.consent — the whole namespace is new (16)
  'oauth.consent.title',
  'oauth.consent.request',
  'oauth.consent.unknownApp',
  'oauth.consent.willAllow',
  'oauth.consent.scope.openid',
  'oauth.consent.scope.profile',
  'oauth.consent.scope.email',
  'oauth.consent.scope.offlineAccess',
  'oauth.consent.deny',
  'oauth.consent.authorize',
  'oauth.consent.submitting',
  'oauth.consent.granted',
  'oauth.consent.denied',
  'oauth.consent.noRedirect',
  'oauth.consent.failed',
  'oauth.consent.footer',
  // acceptInvitation — the whole namespace is new (12)
  'acceptInvitation.title',
  'acceptInvitation.description',
  'acceptInvitation.accept',
  'acceptInvitation.accepting',
  'acceptInvitation.accepted',
  'acceptInvitation.acceptFailed',
  'acceptInvitation.decline',
  'acceptInvitation.declining',
  'acceptInvitation.declined',
  'acceptInvitation.declineFailed',
  'acceptInvitation.invalidTitle',
  'acceptInvitation.invalidDescription',
] as const;

const LANGS = Object.keys(builtInLocales);

/**
 * `lang :: key` pairs whose value is legitimately byte-identical to `en`.
 *
 * Exactly one string is in this class, and for one reason: `phonePlaceholder`
 * is the E.164 EXAMPLE number `+1 555 000 0000`, the same kind of token as
 * `emailPlaceholder: 'name@example.com'`, which all ten packs already carry
 * untranslated at `auth.login.emailPlaceholder` and `auth.setup.emailPlaceholder`.
 * Inventing nine locale-specific example numbers would be a formatting claim
 * about nine dialling plans that nothing in this repo can check, so the packs
 * keep the one placeholder and translate the sentence around it (which is why
 * `emailOrPhonePlaceholder`, containing the same number plus a translated
 * conjunction, is NOT in this list in any pack).
 *
 * The comparison below is exact set equality, not a subset: a nineteenth
 * identical value fails, and localising one of these fails too and forces the
 * line out. `18 = 2 keys x 9 packs` is the whole permitted set.
 */
const UNTRANSLATED_TOKENS = [
  'ar :: auth.forgotPassword.phonePlaceholder',
  'ar :: auth.login.phonePlaceholder',
  'de :: auth.forgotPassword.phonePlaceholder',
  'de :: auth.login.phonePlaceholder',
  'es :: auth.forgotPassword.phonePlaceholder',
  'es :: auth.login.phonePlaceholder',
  'fr :: auth.forgotPassword.phonePlaceholder',
  'fr :: auth.login.phonePlaceholder',
  'ja :: auth.forgotPassword.phonePlaceholder',
  'ja :: auth.login.phonePlaceholder',
  'ko :: auth.forgotPassword.phonePlaceholder',
  'ko :: auth.login.phonePlaceholder',
  'pt :: auth.forgotPassword.phonePlaceholder',
  'pt :: auth.login.phonePlaceholder',
  'ru :: auth.forgotPassword.phonePlaceholder',
  'ru :: auth.login.phonePlaceholder',
  'zh :: auth.forgotPassword.phonePlaceholder',
  'zh :: auth.login.phonePlaceholder',
].sort();

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

const wrapperFor = (lang: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <I18nProvider config={{ defaultLanguage: lang, detectBrowserLanguage: false }}>
        {children}
      </I18nProvider>
    );
  };

beforeEach(() => {
  // The provider persists the last language (objectstack#5406); without this a
  // stale locale leaks into the `en` cases.
  window.localStorage.clear();
});

describe('objectui#3546 slice three — the auth / oauth / acceptInvitation namespaces', () => {
  it('covers all ten packs and all fifty-four keys (guards the loops from emptying)', () => {
    expect(LANGS).toHaveLength(10);
    expect(KEYS).toHaveLength(54);
    expect(new Set(KEYS).size).toBe(54);
    // The measured split, so a later slice cannot quietly absorb keys from this one.
    const perNamespace = KEYS.reduce<Record<string, number>>((acc, k) => {
      const ns = k.split('.')[0];
      acc[ns] = (acc[ns] ?? 0) + 1;
      return acc;
    }, {});
    expect(perNamespace).toEqual({ auth: 26, oauth: 16, acceptInvitation: 12 });
  });

  it.each(LANGS)('%s defines every auth-family key as a non-empty string', (lang) => {
    for (const key of KEYS) {
      const value = at(builtInLocales[lang], key);
      expect(typeof value, `${lang}.${key}`).toBe('string');
      expect((value as string).trim().length, `${lang}.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('the nine non-en packs carry real translations, not the English strings', () => {
    // The failure this catches is a backfill that copy-pastes `en` into the
    // other nine packs: full key parity, ten packs green, nine languages still
    // reading English. `all-locales-key-parity.test.ts` cannot see it, because
    // it compares key sets and never looks at a value.
    const identical: string[] = [];
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      for (const key of KEYS) {
        if (at(builtInLocales[lang], key) === at(builtInLocales.en, key)) identical.push(`${lang} :: ${key}`);
      }
    }
    expect(identical.sort()).toEqual(UNTRANSLATED_TOKENS);
    // 18 permitted pairs out of 486 — i.e. 52 of the 54 keys are translated in
    // every single pack. The set equality above is vacuous if the packs were
    // empty, so pin the two facts it rests on separately: the exempt value is
    // really the shared token, and a neighbour that embeds it is really not.
    expect(UNTRANSLATED_TOKENS).toHaveLength(18);
    expect(at(builtInLocales.ja, 'auth.login.phonePlaceholder')).toBe('+1 555 000 0000');
    expect(at(builtInLocales.ja, 'auth.login.emailOrPhonePlaceholder')).not.toBe(
      at(builtInLocales.en, 'auth.login.emailOrPhonePlaceholder'),
    );
  });

  it('interpolation placeholders survive translation in every pack — both brace forms', () => {
    // Two shapes live here, and confusing them is the bug: `{{appName}}` is
    // i18next's, `{seconds}` is the auth form's own `.replace()`. A translator
    // dropping either produces a sentence that reads fine and silently loses
    // the only variable part.
    const DOUBLE = /\{\{\w+\}\}/g;
    const SINGLE = /(?<!\{)\{\w+\}(?!\})/g;
    const shape = (s: string) =>
      [...(s.match(DOUBLE) ?? []), ...(s.match(SINGLE) ?? [])].sort().join(',');
    const interpolating = KEYS.filter((k) => shape(at(builtInLocales.en, k) as string) !== '');
    expect(interpolating).toEqual([
      'auth.login.resendOtpCountdownText',
      'auth.forgotPassword.resendOtpCountdownText',
      'oauth.consent.title',
      'oauth.consent.request',
    ]);
    for (const lang of LANGS) {
      for (const key of interpolating) {
        expect(shape(at(builtInLocales[lang], key) as string), `${lang}.${key}`).toBe(
          shape(at(builtInLocales.en, key) as string),
        );
      }
    }
  });

  it('the ratchet actually shrank — no auth-family key is still baselined', () => {
    // `scripts/i18n-call-site-key-baseline.json` fails the build both ways: an
    // unfixed key missing from it, AND a fixed key still listed. Pinning the
    // absence here means a revert of the packs cannot quietly restore the
    // entries and go green again.
    // `import.meta.url` is not a file: URL in the dom project, so resolve from
    // the vitest root instead — and prove the read landed before asserting on
    // it, or a moved file would make every assertion below vacuous.
    const baselinePath = join(process.cwd(), 'scripts/i18n-call-site-key-baseline.json');
    expect(existsSync(baselinePath), `baseline not found at ${baselinePath}`).toBe(true);
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      missingKeys: Record<string, unknown>;
      missingPrefixes: Record<string, unknown>;
    };
    const stillBaselined = Object.keys(baseline.missingKeys).filter((k) =>
      ['auth.', 'oauth.', 'acceptInvitation.'].some((ns) => k.startsWith(ns)),
    );
    expect(stillBaselined).toEqual([]);
    // 163 before this slice, 54 removed — then slice four (console, 41 keys) took
    // it to 68. The other namespaces' debt is not this slice's to spend, and this
    // number is what catches a slice that overreaches; it moves once per slice,
    // and only downwards.
    expect(Object.keys(baseline.missingKeys).length).toBe(68);
    // None of the template-key FAMILIES belonged to the auth family, so this slice
    // left all four. Slice four then took `console.ai.group.` (it is a `console`
    // key), leaving three. This assertion is what stops a later slice from
    // thinking one of the remaining three was already handled.
    expect(Object.keys(baseline.missingPrefixes).sort()).toEqual([
      'gantt.linkEnd.',
      'marketplace.disclosure.runtime.',
      'organization.invitations.status.',
    ]);
  });

  describe('through the real binding — bare useObjectTranslation, provider mounted', () => {
    /** One key per component that owns a group of these keys. */
    const SAMPLE: Array<[key: string, owner: string]> = [
      ['auth.login.usePhoneOtpText', 'LoginPage'],
      ['auth.forgotPassword.resetButton', 'ForgotPasswordPage'],
      ['auth.verifyEmail.resendUnavailable', 'VerifyEmailPromptPage'],
      ['auth.device.disabledTitle', 'DeviceAuthPage'],
      ['oauth.consent.authorize', 'OAuthConsentPage'],
      ['acceptInvitation.accept', 'AcceptInvitationPage'],
    ];

    it.each(['en', 'zh'])('%s resolves every sampled key from the pack', (lang) => {
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      for (const [key, owner] of SAMPLE) {
        const value = result.current.t(key);
        expect(value, `${lang} ${owner} rendered the raw key for ${key}`).not.toBe(key);
        expect(value, `${lang}.${key}`).toBe(at(builtInLocales[lang], key));
      }
    });

    it('zh is Chinese — the half that was red before the backfill', () => {
      // Pre-fix each of these returned the inline English `defaultValue`, in a
      // zh session. That is the whole defect, and only a non-en assertion sees it.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('zh') });
      const { t } = result.current;
      expect(t('auth.login.usePhoneOtpText')).toBe('使用验证码登录');
      expect(t('auth.forgotPassword.resetButton')).toBe('重置密码');
      expect(t('auth.device.disabledTitle')).toBe('未启用设备授权');
      expect(t('oauth.consent.authorize')).toBe('授权');
      expect(t('oauth.consent.willAllow')).toBe('此应用将能够：');
      expect(t('acceptInvitation.accept')).toBe('接受邀请');
    });

    it('the other eight packs answer in their own language on the user-facing buttons', () => {
      // Spread across the four writing systems the packs cover, so a single
      // pack silently reverting to English cannot hide behind zh.
      const cases: Array<[lang: string, key: string, expected: string]> = [
        ['fr', 'acceptInvitation.accept', "Accepter l'invitation"],
        ['de', 'auth.login.usePhoneOtpText', 'Mit Bestätigungscode anmelden'],
        ['es', 'oauth.consent.footer', 'Puede revocar el acceso en cualquier momento desde la configuración de su cuenta.'],
        ['pt', 'auth.forgotPassword.usePhoneResetText', 'Redefinir com código por SMS'],
        ['ru', 'auth.forgotPassword.resetButton', 'Сбросить пароль'],
        ['ja', 'oauth.consent.scope.profile', '基本プロフィール（名前、画像）を読み取る'],
        ['ko', 'acceptInvitation.declining', '거절 중…'],
        ['ar', 'auth.device.disabledTitle', 'تفويض الأجهزة غير مُمكَّن'],
      ];
      for (const [lang, key, expected] of cases) {
        const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
        expect(result.current.t(key), `${lang}.${key}`).toBe(expected);
      }
    });
  });

  describe('the two interpolating consent strings render their values', () => {
    it('en fills both holes, and `suffix` stays glued to the sentence', () => {
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('en') });
      const { t } = result.current;
      expect(t('oauth.consent.title', { appName: 'Acme CLI' })).toBe(
        'Acme CLI wants to access your account',
      );
      expect(t('oauth.consent.request', { appName: 'Acme CLI', suffix: ' (ada@example.com)' })).toBe(
        'Acme CLI is requesting permission (ada@example.com).',
      );
      // OAuthConsentPage passes `suffix: ''` when no user is loaded, and the
      // sentence must still end in a single period.
      expect(t('oauth.consent.request', { appName: 'Acme CLI', suffix: '' })).toBe(
        'Acme CLI is requesting permission.',
      );
    });

    it('zh keeps full-width punctuation around the holes', () => {
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('zh') });
      const { t } = result.current;
      expect(t('oauth.consent.title', { appName: 'Acme CLI' })).toBe('Acme CLI 请求访问您的账户');
      expect(t('oauth.consent.request', { appName: 'Acme CLI', suffix: ' (ada@example.com)' })).toBe(
        'Acme CLI 正在请求授权 (ada@example.com)。',
      );
    });

    it('ar puts the verb first so the sentence does not open on a Latin token', () => {
      // Every other interpolated ar string in this pack (`auth.login.ssoHandoff`,
      // `auth.device.subtitle`, `organization.accept.description`) keeps the
      // placeholder away from position zero. Opening an RTL paragraph with an
      // LTR client name is the bidi trap this avoids.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ar') });
      const rendered = result.current.t('oauth.consent.title', { appName: 'Acme CLI' }) as string;
      expect(rendered).toBe('يطلب Acme CLI الوصول إلى حسابك');
      expect(rendered.startsWith('Acme CLI')).toBe(false);
    });
  });

  describe('`{seconds}` is the auth form\'s hole, not i18next\'s', () => {
    const COUNTDOWN = ['auth.login.resendOtpCountdownText', 'auth.forgotPassword.resendOtpCountdownText'];

    it.each(LANGS)('%s keeps the literal token, and i18next does not touch it', (lang) => {
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      for (const key of COUNTDOWN) {
        const value = result.current.t(key, { seconds: 30 }) as string;
        // Passing `seconds` is deliberate: even then i18next must leave single
        // braces alone, because LoginForm.tsx:429 is what substitutes them.
        expect(value, `${lang}.${key} lost {seconds}`).toContain('{seconds}');
        expect(value.replace('{seconds}', '30'), `${lang}.${key} after the component's replace`).not.toContain(
          '{seconds}',
        );
      }
    });
  });

  it('`acceptInvitation` and `organization.accept` stay separate namespaces', () => {
    // Two components serve `/accept-invitation/:invitationId`: the console's own
    // thin page (this namespace) and app-shell's richer one exported as
    // `DefaultAcceptInvitationPage` (`organization.accept.*`, backfilled by
    // slice two). Merging them would silently repoint whichever page a
    // consumer actually routes. Same-English keys share the same translation on
    // purpose; the keys do not.
    expect(at(builtInLocales.en, 'acceptInvitation.accept')).toBe('Accept invitation');
    expect(at(builtInLocales.en, 'organization.accept.accept')).toBe('Accept invitation');
    expect(at(builtInLocales.fr, 'acceptInvitation.accept')).toBe(
      at(builtInLocales.fr, 'organization.accept.accept'),
    );
    // …and the two pages' own copy differs, which is why both namespaces exist.
    expect(at(builtInLocales.en, 'acceptInvitation.acceptFailed')).toBe('Could not accept');
    expect(at(builtInLocales.en, 'organization.accept.acceptFailed')).toBe('Failed to accept invitation');
    expect(at(builtInLocales.en, 'acceptInvitation.expiresAt')).toBeUndefined();
  });

  it('`oauth` is its own namespace, not a branch of `auth`', () => {
    // The call sites spell `oauth.consent.*`; a well-meaning tidy-up into
    // `auth.oauth.*` would leave 16 keys unreachable and the gate green,
    // because the gate reads `en` and the call site would then miss together.
    expect(at(builtInLocales.en, 'oauth.consent.title')).toBe('{{appName}} wants to access your account');
    expect(at(builtInLocales.en, 'auth.oauth')).toBeUndefined();
    // Distinct from the SSO error already under auth.login.errors.
    expect(at(builtInLocales.en, 'auth.login.errors.oauthCallbackFailed')).toBeDefined();
  });
});
