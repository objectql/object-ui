/**
 * The `perm` and `home` namespaces — objectui#3546 slice six — resolve **from
 * the locale packs, with a provider mounted**.
 *
 * ## What was broken, precisely
 *
 * `scripts/check-i18n-call-site-keys.mjs` (#3530's gate) measured **14 distinct
 * keys at 14 call sites** under `perm.*` / `home.*` that a `t()` call site asks
 * for and that NO pack defined. 1:1, no multi-site key, and **no**
 * `missing-prefix` family belongs to these namespaces — the two that remain in
 * the ratchet (`gantt.linkEnd.`, `organization.invitations.status.`) are later
 * slices'. Measured, never hand-counted: slice two predicted 90 and the truth
 * was 93.
 *
 * Two files own all 14:
 *
 *   - `PermissionFacetLink.tsx` — the read-only summary + "Design in Studio →"
 *     deep-link a `sys_permission_set` record shows for its authorization facets
 *     (ADR-0056 P1). 9 keys.
 *   - `usePublishAllDrafts.ts` — the rest of the publish-everything toasts
 *     (ADR-0038 L3 probe health, seed health, the ADR-0066 ⑨ capability lint).
 *     5 keys, shared by Home's pending-drafts banner and the draft preview bar.
 *
 * All 14 carried an inline `t(key, { defaultValue: … })`, so with a provider
 * mounted this is the milder objectui#3517 class: English rendered and all ten
 * languages were stuck on it. Consequence for test design, as in slices two
 * through five: **`en` output was already correct before the change**, so an
 * `en` assertion cannot discriminate before from after. Every assertion that
 * pins the fix is a non-`en` one; the `en` cases prove reachability and prove
 * the wording did not move.
 *
 * ## The four plural families, and why the base key is not redundant
 *
 * Four of the nine `perm` call sites pluralise English INSIDE the template
 * literal, e.g. `` `${count} object${count === 1 ? '' : 's'}` ``. A byte compare
 * against that is structurally impossible (slice five hit the same wall on
 * `marketplace.org.installed`), and the equivalence pinned instead is stronger:
 * **the template's own output, count by count, equals what the pack renders.**
 *
 * That needs two English forms, so these four keys are i18next plural families.
 * The shape used is `key` + `key_one`, NOT the conventional `key_one` +
 * `key_other`, and the reason is measured behaviour rather than taste:
 *
 *   i18next asks `Intl.PluralRules` for the ONE suffix a language needs for that
 *   count, and if the pack lacks it, moves down the fallback chain to `en` —
 *   which renders ENGLISH. With `_one`/`_other` only, `ru` (few: 2-4, many:
 *   5-20) and `ar` (two, few: 3-10, many: 11-99) would show English at exactly
 *   the counts a user meets first. A pack that also defines the BASE key gets
 *   that key for every category it did not enumerate — in its own language.
 *
 * `detail.showEmptyRelated_one`/`_other` (the repo's one older plural family)
 * has no base key and therefore has that leak today; it is filed, not fixed
 * here — it belongs to the `detail` debt a later slice owns.
 *
 * ## Why a provider is mounted
 *
 * `usePublishAllDrafts` receives `t` from a bare `useObjectTranslation()` (Home
 * and the draft bar both pass it in), so i18next is the thing answering.
 * `PermissionFacetLink` binds `useDetailTranslation`, which is
 * `createSafeTranslation(DETAIL_DEFAULT_TRANSLATIONS, …)`: with a provider it
 * hands over i18next's `t`, and that is the console's path. Its defaults map has
 * no `perm.facet.*` entry, so the provider-LESS path returns the raw key —
 * `fallbackT` reads `defaults[key] || key` and never looks at the call site's
 * inline `defaultValue`. That is a separate defect from this slice's (measured:
 * 16 distinct keys reached through that hook are absent from its 146-entry map,
 * 4 of them keys the packs already resolve); it is filed, and the assertions
 * below deliberately describe the provider path, which is the one the console
 * mounts.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { I18nProvider, useObjectTranslation } from '../provider';
import { builtInLocales } from '../locales/index';

/** The 14 keys the guard measured. */
const MEASURED_KEYS = [
  // perm.facet — PermissionFacetLink (9)
  'perm.facet.none',
  'perm.facet.more',
  'perm.facet.objects',
  'perm.facet.fields',
  'perm.facet.rls',
  'perm.facet.tabs',
  'perm.facet.adminScope',
  'perm.facet.designInStudio',
  'perm.facet.designInStudioHint',
  // home.pendingDrafts — usePublishAllDrafts (5)
  'home.pendingDrafts.nothing',
  'home.pendingDrafts.probeWarn',
  'home.pendingDrafts.seedWarn',
  'home.pendingDrafts.publishedVerified',
  'home.pendingDrafts.capabilityWarn',
] as const;

/** The four keys whose call site pluralises English inside its template. */
const COUNT_KEYS = ['perm.facet.objects', 'perm.facet.fields', 'perm.facet.rls', 'perm.facet.tabs'] as const;

/** Every path this slice added: the 14 above plus one `_one` per plural family. */
const KEYS = [...MEASURED_KEYS, ...COUNT_KEYS.map((k) => `${k}_one`)];

const LANGS = Object.keys(builtInLocales);

const FACET = 'packages/plugin-detail/src/renderers/PermissionFacetLink.tsx';
const PUBLISH = 'packages/app-shell/src/preview/usePublishAllDrafts.ts';
const DETAIL_HOOK = 'packages/plugin-detail/src/useDetailTranslation.ts';

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

/**
 * Read a component's source. `import.meta.url` is not a file: URL in the dom
 * project, so resolve from the vitest root (which the invocation guard pins to
 * the repo root) — and prove the read landed, or every assertion on it is
 * vacuous.
 */
function sourceOf(rel: string): string {
  const path = join(process.cwd(), rel);
  expect(existsSync(path), `source not found at ${path}`).toBe(true);
  return readFileSync(path, 'utf8');
}

/**
 * Render one of the call sites' template literals for a given count, the way
 * JavaScript would. Only the two forms those four sites actually use are
 * handled — `${count}` and `${count === 1 ? 'a' : 'b'}` — so a template that
 * grows a third form fails loudly here instead of being silently mis-modelled.
 */
function renderTemplate(template: string, count: number): string {
  const rendered = template
    .replace(/\$\{count === 1 \? '([^']*)' : '([^']*)'\}/g, (_m, one, other) => (count === 1 ? one : other))
    .replace(/\$\{count\}/g, String(count));
  expect(rendered, `unmodelled substitution left in ${template}`).not.toContain('${');
  return rendered;
}

beforeEach(() => {
  // The provider persists the last language (objectstack#5406); without this a
  // stale locale leaks into the `en` cases.
  window.localStorage.clear();
});

describe('objectui#3546 slice six — the perm and home namespaces', () => {
  it('covers all ten packs and all eighteen paths (guards the loops from emptying)', () => {
    expect(LANGS).toHaveLength(10);
    expect(MEASURED_KEYS).toHaveLength(14);
    expect(KEYS).toHaveLength(18);
    expect(new Set(KEYS).size).toBe(18);
    // 14 measured + 4 `_one` companions. Splitting the two apart here is what
    // stops a later reader reading "18" off the ratchet, which held 14 lines.
    expect(COUNT_KEYS).toHaveLength(4);
    const perArea = MEASURED_KEYS.reduce<Record<string, number>>((acc, k) => {
      const area = k.split('.').slice(0, 2).join('.');
      acc[area] = (acc[area] ?? 0) + 1;
      return acc;
    }, {});
    expect(perArea).toEqual({ 'perm.facet': 9, 'home.pendingDrafts': 5 });
  });

  it.each(LANGS)('%s defines every path in this slice as a non-empty string', (lang) => {
    for (const key of KEYS) {
      const value = at(builtInLocales[lang], key);
      expect(typeof value, `${lang}.${key}`).toBe('string');
      expect((value as string).trim().length, `${lang}.${key} is empty`).toBeGreaterThan(0);
    }
  });

  it('the nine non-en packs carry real translations, not the English strings', () => {
    // The failure this catches is a backfill that copy-pastes `en` into the other
    // nine packs: full key parity, ten packs green, nine languages still reading
    // English. `all-locales-key-parity.test.ts` cannot see it — it compares key
    // sets and placeholder shape, never what a value SAYS.
    //
    // Set equality against the EMPTY set: 0 of 162 pairs is identical to `en`,
    // as in slice five and unlike slices two (12 cognates), three (18) and four
    // (1). A first identical pair fails here and must be justified on the line
    // below, the way those slices justified theirs.
    const identical: string[] = [];
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      for (const key of KEYS) {
        if (at(builtInLocales[lang], key) === at(builtInLocales.en, key)) identical.push(`${lang} :: ${key}`);
      }
    }
    expect(identical.sort()).toEqual([]);
  });

  it('the empty cognate set is not vacuous — the loanwords are there and still differ', () => {
    // An empty set-equality is green when the packs are green AND when they are
    // empty (slice two's B1 lesson). The presence assertion above covers
    // emptiness; this one covers the other way it could be empty for the wrong
    // reason — packs that dodged every English-looking token. `RLS`, `Studio`
    // and `Capability` are all carried through, and none of these is
    // byte-identical to `en`.
    expect(at(builtInLocales.de, 'perm.facet.rls')).toBe('{{count}} RLS-Richtlinien');
    expect(at(builtInLocales.fr, 'perm.facet.rls')).toBe('{{count}} politiques RLS');
    expect(at(builtInLocales.ja, 'perm.facet.designInStudio')).toBe('Studio でデザイン →');
    expect(at(builtInLocales.de, 'home.pendingDrafts.capabilityWarn')).toContain('Capability-Verweis(e)');
    for (const [lang, key] of [
      ['de', 'perm.facet.rls'],
      ['fr', 'perm.facet.rls'],
      ['ja', 'perm.facet.designInStudio'],
      ['de', 'home.pendingDrafts.capabilityWarn'],
    ] as const) {
      expect(at(builtInLocales[lang], key)).not.toBe(at(builtInLocales.en, key));
    }
  });

  it('exactly the counting paths interpolate, and every pack carries the same hole', () => {
    // A translator who drops `{{count}}` renders a sentence with the number
    // missing; one who invents a second hole renders braces verbatim.
    // `all-locales-key-parity` compares placeholder shape too — this states the
    // intended shape BY NAME so a wrong one is legible here.
    // Deliberately two regexes: a `/g` one is stateful, and reusing it for
    // `.test()` inside a `filter` silently skips every other match through
    // `lastIndex` (slice five's own bug).
    const HOLES = /\{\{\w+\}\}/g;
    const HAS_HOLE = /\{\{\w+\}\}/;
    const INTERPOLATED = [
      'perm.facet.more',
      ...COUNT_KEYS,
      ...COUNT_KEYS.map((k) => `${k}_one`),
      'home.pendingDrafts.publishedVerified',
      'home.pendingDrafts.capabilityWarn',
    ].sort();
    expect(KEYS.filter((k) => HAS_HOLE.test(at(builtInLocales.en, k) as string)).sort()).toEqual(INTERPOLATED);
    for (const lang of LANGS) {
      for (const key of KEYS) {
        const holes = ((at(builtInLocales[lang], key) as string).match(HOLES) ?? []).join(',');
        expect(holes, `${lang}.${key}`).toBe(INTERPOLATED.includes(key) ? '{{count}}' : '');
      }
    }
  });

  describe('the four plural families', () => {
    it('every pack defines the base key and its _one companion', () => {
      // The base key is the form every plural category the pack did NOT
      // enumerate resolves to. A pack that ships only `_one` would render the
      // singular for everything; one that ships only the base key would lose the
      // English singular. Both halves, all ten packs.
      for (const lang of LANGS) {
        for (const key of COUNT_KEYS) {
          expect(typeof at(builtInLocales[lang], key), `${lang}.${key}`).toBe('string');
          expect(typeof at(builtInLocales[lang], `${key}_one`), `${lang}.${key}_one`).toBe('string');
        }
      }
    });

    it("en renders exactly what the call site's template literal renders, count by count", () => {
      // The equivalence that replaces a byte compare. If the pack path ever
      // disagreed with the template, this slice would have CHANGED the English a
      // user sees — which is the one thing it must not do.
      const src = sourceOf(FACET);
      const TEMPLATES: Record<string, string> = {
        'perm.facet.objects': "${count} object${count === 1 ? '' : 's'}",
        'perm.facet.fields': "${count} field rule${count === 1 ? '' : 's'}",
        'perm.facet.rls': "${count} RLS polic${count === 1 ? 'y' : 'ies'}",
        'perm.facet.tabs': "${count} tab rule${count === 1 ? '' : 's'}",
      };
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('en') });
      for (const [key, template] of Object.entries(TEMPLATES)) {
        // the premise: that template really is still what the call site passes
        expect(src, `${key}'s defaultValue template moved`).toContain(`defaultValue: \`${template}\``);
        for (const count of [1, 2, 3, 5, 11, 21, 100]) {
          expect(result.current.t(key, { count }), `en ${key} at count=${count}`).toBe(
            renderTemplate(template, count),
          );
        }
      }
      // …including the one counting site with no morphology: `+N more` never
      // inflects, so it stays a single flat key even though `count` is passed.
      expect(src).toContain("t('perm.facet.more', { count: extra, defaultValue: `+${extra} more` })");
      for (const count of [1, 3, 11]) {
        expect(result.current.t('perm.facet.more', { count })).toBe(renderTemplate('+${count} more', count));
      }
    });

    it.each(LANGS)('%s stays in its own language at every plural category', (lang) => {
      // The assertion the base key exists for. `Intl.PluralRules` is the same
      // resolver i18next uses, so `select()` predicts which slot answers: `one`
      // takes `_one`, everything else falls to the base key. A pack missing the
      // base key would resolve NOTHING for few/many and i18next would walk the
      // fallback chain to `en` — English, silently, at counts 2-20 in `ru` and
      // 2-99 in `ar`.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      const rules = new Intl.PluralRules(lang);
      for (const key of COUNT_KEYS) {
        for (const count of [1, 2, 3, 5, 11, 21, 100]) {
          const slot = rules.select(count) === 'one' ? `${key}_one` : key;
          const expected = (at(builtInLocales[lang], slot) as string).replace('{{count}}', String(count));
          expect(result.current.t(key, { count }), `${lang} ${key} at count=${count}`).toBe(expected);
        }
      }
    });

    it('ru and ar render their own language at the categories they do not enumerate', () => {
      // Named, not just covered by the loop above, because this is the exact
      // regression the shape exists to prevent and the numbers matter: ru 3 is
      // `few`, ru 7 is `many`, ar 2 is `two`, ar 5 is `few`, ar 30 is `many` —
      // five slots no pack in this repo defines.
      expect(new Intl.PluralRules('ru').select(3)).toBe('few');
      expect(new Intl.PluralRules('ru').select(7)).toBe('many');
      expect(new Intl.PluralRules('ar').select(2)).toBe('two');
      expect(new Intl.PluralRules('ar').select(5)).toBe('few');
      expect(new Intl.PluralRules('ar').select(30)).toBe('many');

      const ru = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ru') });
      expect(ru.result.current.t('perm.facet.objects', { count: 3 })).toBe('Объектов: 3');
      expect(ru.result.current.t('perm.facet.rls', { count: 7 })).toBe('Политик RLS: 7');
      // and NOT the English the fallback chain would have produced
      expect(ru.result.current.t('perm.facet.objects', { count: 3 })).not.toBe('3 objects');

      window.localStorage.clear();
      const ar = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ar') });
      expect(ar.result.current.t('perm.facet.objects', { count: 2 })).toBe('2 كائن(كائنات)');
      expect(ar.result.current.t('perm.facet.fields', { count: 5 })).toBe('5 قاعدة(قواعد) حقول');
      expect(ar.result.current.t('perm.facet.tabs', { count: 30 })).not.toBe('30 tab rules');
    });

    it('the languages with no singular slot say so by repeating the base form', () => {
      // zh/ja/ko have ONE plural category (`other`), so `_one` is unreachable
      // there; ru is invariant under the phrasing chosen for it. Equal values are
      // therefore correct, not a copy-paste slip — pinned so review reads it that
      // way, and so a language that DOES inflect cannot quietly join the list.
      const collapsed = LANGS.filter((l) =>
        COUNT_KEYS.every((k) => at(builtInLocales[l], k) === at(builtInLocales[l], `${k}_one`)),
      );
      expect(collapsed.sort()).toEqual(['ja', 'ko', 'ru', 'zh']);
      for (const lang of ['zh', 'ja', 'ko'] as const) {
        expect(new Intl.PluralRules(lang).resolvedOptions().pluralCategories).toEqual(['other']);
      }
      // en/de/fr/es/pt/ar all inflect, and their two slots really do differ.
      for (const lang of ['en', 'de', 'fr', 'es', 'pt', 'ar'] as const) {
        expect(at(builtInLocales[lang], 'perm.facet.objects'), `${lang} objects`).not.toBe(
          at(builtInLocales[lang], 'perm.facet.objects_one'),
        );
      }
    });
  });

  it('the nine other en values are byte-identical to their inline defaultValue', () => {
    // The nine call sites whose `defaultValue` is a static literal. Two paths
    // must not diverge: with the pack present i18next answers, and before this
    // slice the inline default did — a user must not be able to tell which ran.
    const EXPECTED: Array<[key: string, source: string, value: string]> = [
      ['perm.facet.none', FACET, 'None'],
      ['perm.facet.adminScope', FACET, 'Delegated admin configured'],
      ['perm.facet.designInStudio', FACET, 'Design in Studio →'],
      ['perm.facet.designInStudioHint', FACET, 'Design in Studio'],
      ['home.pendingDrafts.nothing', PUBLISH, 'Nothing to publish.'],
      ['home.pendingDrafts.probeWarn', PUBLISH, 'Published, but verification found problems.'],
      ['home.pendingDrafts.seedWarn', PUBLISH, 'Published, but some sample data failed to load.'],
      ['home.pendingDrafts.publishedVerified', PUBLISH, 'Published & verified — {{count}} sample row(s) live.'],
      [
        'home.pendingDrafts.capabilityWarn',
        PUBLISH,
        'Authoring check: {{count}} capability reference(s) resolve nowhere.',
      ],
    ];
    expect(EXPECTED).toHaveLength(9);
    const sources = { [FACET]: sourceOf(FACET), [PUBLISH]: sourceOf(PUBLISH) };
    for (const [key, rel, value] of EXPECTED) {
      expect(at(builtInLocales.en, key), `en ${key}`).toBe(value);
      // the premise: the call site still passes exactly this defaultValue
      expect(sources[rel], `${key}'s defaultValue moved`).toContain(`defaultValue: '${value}'`);
    }
  });

  it('reused strings are the neighbours own translations, not second renderings', () => {
    // Where this slice's `en` string already existed verbatim elsewhere, the
    // existing row is reused rather than re-translated, so one English string
    // never renders as two different sentences in the same language. A drift on
    // either side fails here.
    const REUSED: Array<[newKey: string, neighbour: string]> = [
      ['perm.facet.none', 'list.none'],
      ['perm.facet.more', 'calendar.moreEvents'],
      ['perm.facet.designInStudioHint', 'topbar.designInStudio'],
      ['home.pendingDrafts.seedWarn', 'console.ai.seedWarn'],
    ];
    for (const [newKey, neighbour] of REUSED) {
      // the premise: the two really are the same English string
      expect(at(builtInLocales.en, newKey), `en ${newKey} vs ${neighbour}`).toBe(
        at(builtInLocales.en, neighbour),
      );
      for (const lang of LANGS) {
        expect(at(builtInLocales[lang], newKey), `${lang} ${newKey} diverged from ${neighbour}`).toBe(
          at(builtInLocales[lang], neighbour),
        );
      }
    }
    // `designInStudio` is the same sentence plus the arrow, so it reuses the same
    // row rather than re-translating the words in front of it.
    for (const lang of LANGS) {
      expect(at(builtInLocales[lang], 'perm.facet.designInStudio'), `${lang} designInStudio`).toBe(
        `${at(builtInLocales[lang], 'topbar.designInStudio')} →`,
      );
    }
    // NOT reused, deliberately: `console.ai.designBuiltApp` is also "Design in
    // Studio" in `en`, but zh/de/ru already render it differently on purpose
    // ("进入 Studio 继续完善" — keep refining what the agent just built). The
    // neighbour taken is the plain navigation label, which is what this link is.
    expect(at(builtInLocales.en, 'console.ai.designBuiltApp')).toBe(at(builtInLocales.en, 'topbar.designInStudio'));
    expect(at(builtInLocales.zh, 'console.ai.designBuiltApp')).not.toBe(
      at(builtInLocales.zh, 'topbar.designInStudio'),
    );
  });

  it('the count-plus-unit wording follows each pack own neighbours', () => {
    // Concept adjacency, not byte adjacency — slice five's blind spot was that a
    // neighbour expressing the SAME concept in different English is invisible to
    // a byte search. These were found by concept and the premise of each is
    // asserted alongside it, so a neighbour that moves takes this with it.
    //
    // zh: the permission-set designer's own suffix (metadata-admin's module-local
    // table, `perm.stat.objectsSuffix` = 个对象) — the very screen this chip
    // links to. Its 行级策略 / 标签页 / 委派管理范围 come from the same table.
    expect(at(builtInLocales.zh, 'perm.facet.objects')).toBe('{{count}} 个对象');
    const designer = sourceOf('packages/app-shell/src/views/metadata-admin/i18n.ts');
    expect(designer).toContain("'perm.stat.objectsSuffix': '个对象'");
    expect(designer).toContain("'perm.rls.empty': '暂无行级策略。'");
    expect(at(builtInLocales.zh, 'perm.facet.rls')).toContain('RLS 策略');

    // ja/ko: the same `{{count}} + unit` shape as appDesigner.objectManager.fieldCount.
    expect(at(builtInLocales.en, 'appDesigner.objectManager.fieldCount')).toBe('{{count}} fields');
    expect(at(builtInLocales.ja, 'appDesigner.objectManager.fieldCount')).toBe('{{count}} フィールド');
    expect(at(builtInLocales.ko, 'appDesigner.objectManager.fieldCount')).toBe('{{count}}개 필드');
    expect(at(builtInLocales.ja, 'perm.facet.fields')).toBe('{{count}} フィールドルール');
    expect(at(builtInLocales.ko, 'perm.facet.fields')).toBe('{{count}}개 필드 규칙');

    // ru: «Noun: {{count}}» — 25 values in this pack already write counts that
    // way (lookup.recordCount, notifications.groupCount, approvalsInbox.*), and
    // it is the only form that is correct for EVERY Russian count, which is what
    // lets the base key carry few/many.
    expect(at(builtInLocales.ru, 'lookup.recordCount')).toBe('Записей: {{count}}');
    expect(at(builtInLocales.ru, 'notifications.groupCount')).toBe('Уведомлений: {{count}}');
    for (const key of COUNT_KEYS) {
      expect(at(builtInLocales.ru, key), `ru ${key}`).toMatch(/: \{\{count\}\}$/);
    }

    // ar: «{{count}} singular(plural)», the marker this pack uses for exactly
    // this construction.
    expect(at(builtInLocales.ar, 'appDesigner.objectManager.fieldCount')).toBe('{{count}} حقل(حقول)');
    expect(at(builtInLocales.ar, 'perm.facet.objects')).toBe('{{count}} كائن(كائنات)');

    // de: in-app tabs are Registerkarten (console.objectView.ufTabs), and "Tab"
    // is reserved for the browser tab (detail.openInNewTab) — 4 occurrences each,
    // a real distinction rather than an inconsistency.
    expect(at(builtInLocales.de, 'console.objectView.ufTabs')).toBe('Registerkarten');
    expect(at(builtInLocales.de, 'detail.openInNewTab')).toBe('In neuem Tab öffnen');
    expect(at(builtInLocales.de, 'perm.facet.tabs')).toBe('{{count}} Registerkarten-Regeln');
  });

  it('the two counting home strings follow their own family on the (s) marker', () => {
    // `home.pendingDrafts.message` is the same family, the same banner and the
    // same `{{count}} … (s)` shape, so each pack's answer there is the answer
    // here: de/fr/es/pt keep a parenthesised marker, zh/ja/ko use a counter, and
    // ru/ar restructure. Copying `en`'s "(s)" into ru is the mistake this pins.
    expect(at(builtInLocales.en, 'home.pendingDrafts.message')).toContain('change(s)');
    const MARKER = /\([\p{L}]{1,4}\)/u;
    for (const lang of ['de', 'fr', 'es', 'pt'] as const) {
      expect(
        MARKER.test(at(builtInLocales[lang], 'home.pendingDrafts.message') as string),
        `${lang} message lost its marker`,
      ).toBe(true);
      expect(
        MARKER.test(at(builtInLocales[lang], 'home.pendingDrafts.publishedVerified') as string),
        `${lang} publishedVerified should carry the same marker`,
      ).toBe(true);
    }
    for (const lang of ['zh', 'ja', 'ko', 'ru'] as const) {
      expect(
        MARKER.test(at(builtInLocales[lang], 'home.pendingDrafts.publishedVerified') as string),
        `${lang} publishedVerified imported a "(s)" marker it does not use`,
      ).toBe(false);
    }
    // The regex is Unicode-aware on purpose: an ASCII `\w` cannot match
    // «поле(й)» or «صف(صفوف)», so it would pass vacuously on the four packs the
    // assertion is actually about.
    expect(MARKER.test('поле(й)')).toBe(true);
    expect(/\(\w{1,4}\)/.test('поле(й)')).toBe(false);
  });

  it('the arrow, the ampersand and the em dash follow en in every pack', () => {
    // `Design in Studio →` is a trailing action arrow, and this repo keeps those
    // as `→` in all ten packs including `ar` (marketplace.browseLink, 10/10) —
    // unlike the two `ar` values that mirror an inline left-to-right MAPPING to
    // `←` (aiModelStatus.summaryRouting, connectAgent.claude.body).
    for (const lang of LANGS) {
      expect(at(builtInLocales[lang], 'marketplace.browseLink'), `${lang} browseLink`).toContain('→');
      expect((at(builtInLocales[lang], 'perm.facet.designInStudio') as string).endsWith(' →'), `${lang}`).toBe(
        true,
      );
      expect(at(builtInLocales[lang], 'perm.facet.designInStudioHint')).not.toContain('→');
      // The em dash in `Published & verified — …` is U+2014 everywhere, except zh
      // which writes the doubled `——` its own pack uses (home.pendingDrafts.message).
      const verified = at(builtInLocales[lang], 'home.pendingDrafts.publishedVerified') as string;
      expect(verified.includes(lang === 'zh' ? '——' : '—'), `${lang} publishedVerified dash`).toBe(true);
      expect(verified.includes('&'), `${lang} kept en's ampersand`).toBe(lang === 'en');
    }
  });

  it('ja, zh and ko each answer the mid-sentence colon their own way', () => {
    // Three packs, three correct answers to one `en` colon
    // (`Authoring check: …`). ja is genuinely split mid-string — 24 halfwidth
    // against 28 fullwidth — and the split tracks what FOLLOWS: a single token
    // or value takes `: ` (console.ai.usage.ariaLabel `AI 使用状況: {{status}}`),
    // a Japanese sentence takes `：` (approvalsInbox.whyDisabled
    // `現在の承認待ち：{{who}}。`). This one is followed by a sentence.
    expect(at(builtInLocales.ja, 'console.ai.usage.ariaLabel')).toBe('AI 使用状況: {{status}}');
    expect(at(builtInLocales.ja, 'home.pendingDrafts.capabilityWarn')).toContain('作成時チェック：');
    // zh writes fullwidth punctuation throughout.
    expect(at(builtInLocales.zh, 'home.pendingDrafts.capabilityWarn')).toContain('编写检查：');
    // ko has no fullwidth colon anywhere in the pack.
    expect(at(builtInLocales.ko, 'home.pendingDrafts.capabilityWarn')).toContain('작성 검사: ');
    expect(at(builtInLocales.ko, 'home.pendingDrafts.capabilityWarn')).not.toContain('：');
    // fr puts a space before the colon (6:0 in this pack).
    expect(at(builtInLocales.fr, 'home.pendingDrafts.capabilityWarn')).toContain('conception : ');
  });

  it('fr keeps its straight apostrophe and ru keeps its ё', () => {
    // The two typographic habits a copy-paste from `en` or from a machine
    // translation breaks first. fr writes U+0027 (502 against 21 U+2019); ru
    // writes ё in 161 values.
    for (const key of KEYS) {
      expect(
        (at(builtInLocales.fr, key) as string).includes('’'),
        `fr ${key} used a curly apostrophe`,
      ).toBe(false);
    }
    expect(at(builtInLocales.fr, 'perm.facet.tabs')).toBe("{{count}} règles d'onglet");
    expect(at(builtInLocales.ru, 'perm.facet.more')).toBe('+{{count}} ещё');
    expect(at(builtInLocales.ru, 'calendar.moreEvents')).toBe('+{{count}} ещё');
  });

  it('the ratchet actually shrank — no perm/home key is still baselined', () => {
    // `scripts/i18n-call-site-key-baseline.json` fails the build both ways: an
    // unfixed key missing from it, AND a fixed key still listed. Pinning the
    // absence here means a revert of the packs cannot quietly restore the
    // entries and go green again.
    const baselinePath = join(process.cwd(), 'scripts/i18n-call-site-key-baseline.json');
    expect(existsSync(baselinePath), `baseline not found at ${baselinePath}`).toBe(true);
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
      missingKeys: Record<string, unknown>;
      missingPrefixes: Record<string, unknown>;
    };
    expect(
      Object.keys(baseline.missingKeys).filter((k) => k.startsWith('perm.') || k.startsWith('home.')),
    ).toEqual([]);
    // 31 before this slice, 14 removed, leaving 17 — which slice seven (the
    // residue: 17 keys plus both remaining prefix families) took to ZERO. The
    // counter moved once per slice and only downwards; at zero it stops being
    // "how much is left" and becomes "nothing may be added back".
    expect(Object.keys(baseline.missingKeys).length).toBe(0);
    // This slice owned NO prefix family — the two left belonged to slice seven,
    // which enumerated both, so the list is now empty.
    expect(Object.keys(baseline.missingPrefixes).sort()).toEqual([]);
  });

  describe('through the real binding — provider mounted', () => {
    /** One key per surface that owns a group of these keys. */
    const SAMPLE: Array<[key: string, owner: string]> = [
      ['perm.facet.none', 'PermissionFacetLink (empty facet)'],
      ['perm.facet.adminScope', 'PermissionFacetLink (admin_scope)'],
      ['perm.facet.designInStudio', 'PermissionFacetLink (deep-link)'],
      ['home.pendingDrafts.nothing', 'usePublishAllDrafts (no drafts)'],
      ['home.pendingDrafts.probeWarn', 'usePublishAllDrafts (L3 probes)'],
      ['home.pendingDrafts.seedWarn', 'usePublishAllDrafts (seed health)'],
    ];

    it('both owning files still bind t the way this suite assumes', () => {
      // The premise of mounting a provider. `usePublishAllDrafts` takes `t` as an
      // argument, so assert its two callers pass the pack-backed one, and that
      // PermissionFacetLink still goes through useDetailTranslation — which
      // hands over i18next's `t` once the pack resolves its probe key.
      const publish = sourceOf(PUBLISH);
      expect(publish).toContain('export function usePublishAllDrafts(t: TranslateFn)');
      for (const caller of [
        'packages/app-shell/src/console/home/HomePage.tsx',
        'packages/app-shell/src/preview/DraftPreviewBar.tsx',
      ]) {
        const src = sourceOf(caller);
        expect(src, `${caller} no longer binds the pack hook`).toContain(
          "import { useObjectTranslation } from '@object-ui/i18n'",
        );
        expect(src, `${caller} stopped passing t into usePublishAllDrafts`).toContain('usePublishAllDrafts(t)');
      }
      expect(sourceOf(FACET)).toContain("import { useDetailTranslation } from '../useDetailTranslation'");
      // …and the hook really is the hand-over kind, whose defaults map has no
      // perm entry (see the file header: the provider-less path is a filed
      // defect, not this slice's contract).
      const hook = sourceOf(DETAIL_HOOK);
      expect(hook).toContain('createSafeTranslationHook(');
      expect(hook).not.toContain("'perm.facet.");
    });

    it.each(['en', 'zh'])('%s resolves every sampled key from the pack', (lang) => {
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      for (const [key, owner] of SAMPLE) {
        const value = result.current.t(key);
        expect(value, `${lang} ${owner} rendered the raw key for ${key}`).not.toBe(key);
        expect(value, `${lang}.${key}`).toBe(at(builtInLocales[lang], key));
      }
    });

    it('zh is Chinese — the half that was red before the backfill', () => {
      // Pre-fix each of these returned the inline English `defaultValue` in a zh
      // session. That is the whole defect, and only a non-en assertion sees it.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('zh') });
      const { t } = result.current;
      expect(t('perm.facet.adminScope')).toBe('已配置委派管理范围');
      expect(t('perm.facet.designInStudio')).toBe('在 Studio 中设计 →');
      expect(t('perm.facet.objects', { count: 4 })).toBe('4 个对象');
      expect(t('home.pendingDrafts.nothing')).toBe('没有需要发布的内容。');
      expect(t('home.pendingDrafts.publishedVerified', { count: 12 })).toBe(
        '已发布并验证 —— 12 行示例数据已生效。',
      );
      expect(t('home.pendingDrafts.capabilityWarn', { count: 2 })).toBe('编写检查：2 个能力引用无法解析。');
    });

    it.each([
      ['de', 'perm.facet.adminScope', 'Delegierte Administration konfiguriert'],
      ['fr', 'home.pendingDrafts.nothing', 'Rien à publier.'],
      ['es', 'perm.facet.none', 'Ninguno'],
      ['pt', 'home.pendingDrafts.probeWarn', 'Publicado, mas a verificação encontrou problemas.'],
      ['ru', 'perm.facet.adminScope', 'Делегированное администрирование настроено'],
      ['ja', 'home.pendingDrafts.nothing', '公開するものはありません。'],
      ['ko', 'perm.facet.designInStudio', 'Studio에서 디자인 →'],
      ['ar', 'home.pendingDrafts.probeWarn', 'تم النشر، لكن التحقق وجد مشكلات.'],
    ])('%s renders a user-visible string from the pack', (lang, key, expected) => {
      // One pinned surface per remaining pack, across four writing systems, so a
      // pack that silently reverts to English is caught by name and not only by
      // the aggregate above.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      expect(result.current.t(key)).toBe(expected);
    });

    it('the ar pack does not open an RTL string with a Latin token', () => {
      // Same rule slices three through five applied. `RLS` and `Studio` are the
      // two Latin runs these strings cannot avoid, and both stay inside the
      // string instead of leading it.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ar') });
      for (const key of KEYS) {
        const value = result.current.t(key, { count: 3 });
        expect(/^[A-Za-z]/.test(value), `${key} starts with a Latin token: ${value}`).toBe(false);
      }
      expect(result.current.t('perm.facet.rls', { count: 3 })).toBe('3 سياسة(سياسات) RLS');
      expect(result.current.t('perm.facet.designInStudio')).toBe('التصميم في Studio →');
    });
  });
});
