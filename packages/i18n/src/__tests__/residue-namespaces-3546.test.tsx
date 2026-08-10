/**
 * The last of objectui#3546 — slice seven, the **residue**: every entry that was
 * still in `scripts/i18n-call-site-key-baseline.json`. After this slice both of
 * the ratchet's lists are empty and `check-i18n-call-site-keys.mjs` reports
 * **2320/2320** literal call-site keys resolving against `en`.
 *
 * ## What was left, precisely (measured, never hand-counted)
 *
 * `analyze()` from #3530's gate, run on the branch point:
 *
 *   - **17 distinct keys at 23 call sites** — the first slice in this series
 *     where the two numbers differ by more than a rounding error. Five keys are
 *     shared: `common.retry` (3 sites), `common.record`, `common.editInStudio`,
 *     `detail.add` and `layout.systemNav.datasources` (2 each). Slice two
 *     predicted 90 and the truth was 93; the lesson is applied here by taking
 *     the call-site list from the script, not from the ratchet's line count.
 *   - **both remaining `missing-prefix` families**, 3 call sites:
 *     `gantt.linkEnd.` (1) and `organization.invitations.status.` (2).
 *
 * Nine namespaces, ten owning surfaces, spread across `app-shell`,
 * `plugin-detail`, `plugin-dashboard`, `plugin-kanban` and `plugin-gantt` — the
 * long tail that was never big enough to be its own slice.
 *
 * ## Severity: all English-visible, zero raw keys — and three different ways
 *
 * The 8 raw-key sites the issue's body named were slice one's (PR #3583), and
 * `detail.viewSource` / `wizard.missingRequired` / `gantt.toolbar.refresh` have
 * resolved in `en` ever since. Everything in THIS slice is the milder
 * objectui#3517 class, but the inline English default takes three shapes, which
 * is why the byte-equality test below is split three ways:
 *
 *   1. **22 sites / 16 keys** pass `t(key, { defaultValue: 'English' })`.
 *   2. **1 site** (`dashboard.loading`) uses `useSafeTranslate`'s positional
 *      form, `tt(key, 'Loading…')` — a fallback, not a `defaultValue` property.
 *      A test that greps only for `defaultValue:` would call this site
 *      unprotected and be wrong about it.
 *   3. **the two families' defaults are not literals at all**:
 *      `organization.invitations.status.` passes `{ defaultValue: tab }` — the
 *      enum member itself, CSS-capitalised by the element — and
 *      `gantt.linkEnd.` passes no default, relying on
 *      `useGanttTranslation`'s PER-KEY fallback map, which does contain both
 *      members. So a byte compare is structurally impossible for all seven, and
 *      what is pinned instead is the equivalence each one actually needs.
 *
 * Consequence for test design, as in slices two through six: **`en` output was
 * already correct before the change**, so an `en` assertion cannot discriminate
 * before from after. Every assertion that pins the fix is a non-`en` one; the
 * `en` ones prove reachability and prove the wording did not move.
 *
 * ## The provider-less path is a different, filed defect
 *
 * Four of the owning files bind `createSafeTranslation` hooks
 * (`useDetailTranslation`, `useKanbanT`) whose defaults maps do NOT list these
 * keys, and `useSafeTranslate`/`useGanttTranslation` are per-call/per-key. With
 * a provider mounted — the console — i18next answers, which is the path these
 * assertions describe. Without one, `createSafeTranslation`'s `fallbackT` reads
 * `defaults[key] || key` and never looks at the call site's inline
 * `defaultValue`, so it renders the raw key: that is objectui#3865, filed by
 * slice six, and it is not what this slice repairs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { I18nProvider, useObjectTranslation } from '../provider';
import { builtInLocales } from '../locales/index';

/** The 17 keys the guard measured as missing, in the ratchet's own order. */
const MEASURED_KEYS = [
  'common.done',
  'common.editInStudio',
  'common.record',
  'common.retry',
  'dashboard.loading',
  'detail.add',
  'detail.concurrentUpdateRecordLabel',
  'detail.deleted',
  'detail.historyEmpty',
  'empty.appNotAvailable',
  'empty.appNotAvailableDescription',
  'empty.interfacePageSourceMissing',
  'kanban.columns',
  'layout.systemNav.administration',
  'layout.systemNav.datasources',
  'layout.systemNav.documentation',
  'workspace.multiOrgDisabled',
] as const;

/**
 * `gantt.linkEnd.` — the value domain is the closed union `'start' | 'end'`,
 * declared in GanttView itself (the `linkDrag` state type and the `endLabel`
 * parameter). Same situation as slice four's `console.ai.group.`
 * (`ConversationGroupKey` in the same file), and unlike slice five's
 * `marketplace.disclosure.runtime.`, whose authority lives in the sibling repo's
 * `packages/spec`.
 */
const LINK_END_MEMBERS = ['start', 'end'] as const;

/**
 * `organization.invitations.status.` — the value domain is `StatusFilter`,
 * declared at the top of InvitationsPage. `all` is the filter tab's extra
 * member; the other four are also `AuthInvitation.status` values.
 */
const STATUS_MEMBERS = ['all', 'pending', 'accepted', 'rejected', 'canceled'] as const;

/** Every path this slice adds: 17 leaves + 2 + 5 family members = 24. */
const KEYS = [
  ...MEASURED_KEYS,
  ...LINK_END_MEMBERS.map((m) => `gantt.linkEnd.${m}`),
  ...STATUS_MEMBERS.map((m) => `organization.invitations.status.${m}`),
];

const LANGS = Object.keys(builtInLocales);

// ── the owning surfaces ──────────────────────────────────────────────────────
const INVITE_DIALOG = 'packages/app-shell/src/console/organizations/manage/InviteMemberDialog.tsx';
const PAGE_VIEW = 'packages/app-shell/src/views/PageView.tsx';
const APP_CONTENT = 'packages/app-shell/src/console/AppContent.tsx';
const INVITATIONS = 'packages/app-shell/src/console/organizations/manage/InvitationsPage.tsx';
const MEMBERS = 'packages/app-shell/src/console/organizations/manage/MembersPage.tsx';
const DATASET_WIDGET = 'packages/plugin-dashboard/src/DatasetWidget.tsx';
const RELATED_LIST = 'packages/plugin-detail/src/RelatedList.tsx';
const SAVE_BAR = 'packages/plugin-detail/src/InlineEditSaveBar.tsx';
const RECORD_DETAIL = 'packages/app-shell/src/views/RecordDetailView.tsx';
const DETAIL_VIEW = 'packages/plugin-detail/src/DetailView.tsx';
const INTERFACE_LIST = 'packages/app-shell/src/views/InterfaceListPage.tsx';
const KANBAN = 'packages/plugin-kanban/src/KanbanImpl.tsx';
const UNIFIED_SIDEBAR = 'packages/app-shell/src/layout/UnifiedSidebar.tsx';
const APP_SIDEBAR = 'packages/app-shell/src/layout/AppSidebar.tsx';
const CREATE_WORKSPACE = 'packages/app-shell/src/console/organizations/CreateWorkspaceDialog.tsx';
const GANTT_VIEW = 'packages/plugin-gantt/src/GanttView.tsx';
const GANTT_HOOK = 'packages/plugin-gantt/src/useGanttTranslation.ts';
const OCC_DIALOG = 'packages/plugin-detail/src/ConcurrentUpdateDialog.tsx';

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

/** What CSS `text-transform: capitalize` does to a single lowercase word. */
const cssCapitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

beforeEach(() => {
  // The provider persists the last language (objectstack#5406); without this a
  // stale locale leaks into the `en` cases.
  window.localStorage.clear();
});

describe('objectui#3546 slice seven — the ratchet residue', () => {
  it('covers all ten packs and all twenty-four paths (guards the loops from emptying)', () => {
    expect(LANGS).toHaveLength(10);
    expect(MEASURED_KEYS).toHaveLength(17);
    expect(LINK_END_MEMBERS).toHaveLength(2);
    expect(STATUS_MEMBERS).toHaveLength(5);
    expect(KEYS).toHaveLength(24);
    expect(new Set(KEYS).size).toBe(24);
    // 17 measured leaves + 7 family members. Keeping the two counts apart here
    // is what stops a later reader reading "24" off the ratchet, which held 17
    // key lines and 2 prefix lines.
    const perNamespace = MEASURED_KEYS.reduce<Record<string, number>>((acc, k) => {
      const ns = k.split('.')[0];
      acc[ns] = (acc[ns] ?? 0) + 1;
      return acc;
    }, {});
    expect(perNamespace).toEqual({
      common: 4,
      dashboard: 1,
      detail: 4,
      empty: 3,
      kanban: 1,
      layout: 3,
      workspace: 1,
    });
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
    // Exact set, not "few enough": 2 of 216 pairs. Both are `fr`, both are words
    // French and English genuinely spell the same, and both sit in the system
    // navigation next to `layout.systemNav.configuration`, which `fr` has spelled
    // "Configuration" since before this slice. A third entry fails here and must
    // be justified on this list the way slices two (12), three (18) and four (1)
    // justified theirs.
    const identical: string[] = [];
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      for (const key of KEYS) {
        if (at(builtInLocales[lang], key) === at(builtInLocales.en, key)) identical.push(`${lang} :: ${key}`);
      }
    }
    expect(identical.sort()).toEqual([
      'fr :: layout.systemNav.administration',
      'fr :: layout.systemNav.documentation',
    ]);
    // …and the neighbour that makes them ordinary rather than a slip.
    expect(at(builtInLocales.fr, 'layout.systemNav.configuration')).toBe('Configuration');
    expect(at(builtInLocales.en, 'layout.systemNav.configuration')).toBe('Configuration');
  });

  it('the two-entry cognate set is not vacuous — other packs did translate those two', () => {
    // A set-equality assertion is also green when the packs are EMPTY (slice
    // two's B1 lesson). The presence assertion above covers emptiness; this one
    // covers the other way the set could be right for the wrong reason: if the
    // two `fr` rows were a copy-paste of `en`, the same copy-paste would show up
    // in the packs that CAN translate them, and it does not.
    expect(at(builtInLocales.de, 'layout.systemNav.administration')).toBe('Verwaltung');
    expect(at(builtInLocales.ru, 'layout.systemNav.administration')).toBe('Администрирование');
    expect(at(builtInLocales.de, 'layout.systemNav.documentation')).toBe('Dokumentation');
    expect(at(builtInLocales.ar, 'layout.systemNav.documentation')).toBe('الوثائق');
    // Loanwords that are carried through and still differ from `en`, so "no more
    // cognates" is a real zero rather than a pack dodging every English-looking
    // token: `Studio` and `Datenquellen`/`データソース` all survive.
    expect(at(builtInLocales.ja, 'common.editInStudio')).toBe('Studio で編集');
    expect(at(builtInLocales.ko, 'common.editInStudio')).toBe('Studio에서 편집');
    expect(at(builtInLocales.de, 'layout.systemNav.datasources')).toBe('Datenquellen');
    for (const [lang, key] of [
      ['ja', 'common.editInStudio'],
      ['ko', 'common.editInStudio'],
      ['de', 'layout.systemNav.datasources'],
    ] as const) {
      expect(at(builtInLocales[lang], key)).not.toBe(at(builtInLocales.en, key));
    }
  });

  it('exactly one path interpolates, and every pack carries the same hole', () => {
    // A translator who drops `{{name}}` renders a sentence with the source name
    // missing; one who invents a second hole renders braces verbatim.
    // `all-locales-key-parity` compares placeholder shape too — this states the
    // intended shape BY NAME so a wrong one is legible here.
    // Deliberately two regexes: a `/g` one is stateful, and reusing it for
    // `.test()` inside a `filter` silently skips every other match through
    // `lastIndex` (slice five's own bug).
    const HOLES = /\{\{\w+\}\}/g;
    const HAS_HOLE = /\{\{\w+\}\}/;
    const INTERPOLATED = ['empty.interfacePageSourceMissing'];
    expect(KEYS.filter((k) => HAS_HOLE.test(at(builtInLocales.en, k) as string)).sort()).toEqual(INTERPOLATED);
    for (const lang of LANGS) {
      for (const key of KEYS) {
        const holes = ((at(builtInLocales[lang], key) as string).match(HOLES) ?? []).join(',');
        expect(holes, `${lang}.${key}`).toBe(INTERPOLATED.includes(key) ? '{{name}}' : '');
      }
    }
  });

  it('the sixteen literal en values are byte-identical to their inline defaultValue', () => {
    // Two paths must not diverge: with the pack present i18next answers, and
    // before this slice the inline default did — a user must not be able to tell
    // which ran. 16 keys here; `dashboard.loading` and the two families are the
    // three shapes a byte compare cannot reach, each pinned in its own case.
    const EXPECTED: Array<[key: string, source: string, value: string]> = [
      ['common.done', INVITE_DIALOG, 'Done'],
      ['common.editInStudio', PAGE_VIEW, 'Edit in studio'],
      ['common.record', APP_CONTENT, 'Record'],
      ['common.retry', APP_CONTENT, 'Retry'],
      ['detail.add', RELATED_LIST, 'Add'],
      ['detail.concurrentUpdateRecordLabel', SAVE_BAR, 'this record'],
      ['detail.deleted', RECORD_DETAIL, 'Record deleted'],
      ['detail.historyEmpty', DETAIL_VIEW, 'No history yet'],
      ['empty.appNotAvailable', APP_CONTENT, 'App not available'],
      [
        'empty.appNotAvailableDescription',
        APP_CONTENT,
        'This app is not available yet — it may still be publishing. Try again in a moment.',
      ],
      [
        'empty.interfacePageSourceMissing',
        INTERFACE_LIST,
        'This interface page references "{{name}}", which is not available.',
      ],
      ['kanban.columns', KANBAN, 'columns'],
      ['layout.systemNav.administration', UNIFIED_SIDEBAR, 'Administration'],
      ['layout.systemNav.datasources', APP_SIDEBAR, 'Datasources'],
      ['layout.systemNav.documentation', UNIFIED_SIDEBAR, 'Documentation'],
      ['workspace.multiOrgDisabled', CREATE_WORKSPACE, 'Creating new organizations is disabled on this instance.'],
    ];
    expect(EXPECTED).toHaveLength(16);
    const cache = new Map<string, string>();
    for (const [key, rel, value] of EXPECTED) {
      if (!cache.has(rel)) cache.set(rel, sourceOf(rel));
      expect(at(builtInLocales.en, key), `en ${key}`).toBe(value);
      // the premise: the call site still passes exactly this defaultValue
      expect(cache.get(rel), `${key}'s defaultValue moved`).toContain(`defaultValue: '${value}'`);
    }
  });

  it('the five multi-site keys really are one string at every one of their sites', () => {
    // 17 keys, 23 call sites. A key used twice with two different inline defaults
    // would make the byte-equality above true at one site and false at the other,
    // and no single-site check could see it. Both spellings are asserted at both
    // files, so a divergence introduced later fails here.
    const MULTI: Array<[key: string, value: string, files: string[]]> = [
      ['common.editInStudio', 'Edit in studio', [PAGE_VIEW]],
      ['common.record', 'Record', [APP_CONTENT]],
      ['common.retry', 'Retry', [APP_CONTENT, INVITATIONS, MEMBERS]],
      ['detail.add', 'Add', [RELATED_LIST]],
      ['layout.systemNav.datasources', 'Datasources', [APP_SIDEBAR, UNIFIED_SIDEBAR]],
    ];
    for (const [key, value, files] of MULTI) {
      for (const rel of files) {
        const src = sourceOf(rel);
        const occurrences = src.split(`t('${key}', { defaultValue: '${value}' })`).length - 1;
        expect(occurrences, `${key} in ${rel}`).toBeGreaterThan(0);
      }
    }
    // PageView uses it twice on the same button (title + aria-label) and
    // RelatedList twice in two different affordances — the counts are pinned so a
    // silent drop of one of them is visible.
    expect(sourceOf(PAGE_VIEW).split("t('common.editInStudio', { defaultValue: 'Edit in studio' })").length - 1).toBe(2);
    expect(sourceOf(RELATED_LIST).split("t('detail.add', { defaultValue: 'Add' })").length - 1).toBe(2);
    expect(sourceOf(APP_CONTENT).split("t('common.record', { defaultValue: 'Record' })").length - 1).toBe(2);
  });

  it('dashboard.loading matches useSafeTranslate positional fallback, not a defaultValue', () => {
    // Shape two. `useSafeTranslate()` returns `t(keyOrKeys, fallback)` — the
    // English default is the SECOND POSITIONAL ARGUMENT, so a sweep that greps
    // for `defaultValue:` would report this site as having no fallback and be
    // wrong. The equivalence is the same one: pack value === the fallback the
    // call site would otherwise have rendered.
    const src = sourceOf(DATASET_WIDGET);
    expect(src, 'the sr-only loading announcement moved').toContain("tt('dashboard.loading', 'Loading…')");
    expect(src).toContain('const tt = useSafeTranslate();');
    expect(at(builtInLocales.en, 'dashboard.loading')).toBe('Loading…');
    // …and the hook really does return the fallback per key, not per provider.
    const hook = sourceOf('packages/i18n/src/useSafeTranslation.ts');
    expect(hook).toContain('export function useSafeTranslate()');
    expect(hook).toContain('if (v && v !== key) return v;');
    // U+2026, not three ASCII dots. `common.loading` is the older `'Loading...'`
    // spelling and is a DIFFERENT string, so it is deliberately not reused here.
    expect(at(builtInLocales.en, 'dashboard.loading')).not.toBe(at(builtInLocales.en, 'common.loading'));
    expect(at(builtInLocales.en, 'common.loading')).toBe('Loading...');
  });

  describe('gantt.linkEnd. — the first prefix family', () => {
    it('the key surface is exactly the closed union declared in GanttView', () => {
      // Key reachability, asserted on the KEY set — not on a value verdict. A
      // fourth endpoint kind added to `linkDrag` fails here, which is exactly the
      // job the ratchet's prefix entry used to do, moved into a test.
      const family = at(builtInLocales.en, 'gantt.linkEnd') as Record<string, string>;
      expect(Object.keys(family).sort()).toEqual([...LINK_END_MEMBERS].sort());
      const src = sourceOf(GANTT_VIEW);
      // the premise: both the state type and the label helper still say start|end
      expect(src, 'the linkDrag endpoint union moved').toContain("sourceEnd: 'start' | 'end';");
      expect(src).toContain("targetEnd: 'start' | 'end' | null;");
      expect(src, 'the template call moved').toContain(
        "const endLabel = (e: 'start' | 'end') => t(`gantt.linkEnd.${e}`);",
      );
      // `targetEnd` is nullable and the call site collapses null to 'start', so
      // the union really is two members at the call site too.
      expect(src).toContain("endLabel(linkDrag.targetEnd ?? 'start')");
      for (const lang of LANGS) {
        expect(Object.keys(at(builtInLocales[lang], 'gantt.linkEnd') as object).sort(), `${lang}`).toEqual([
          ...LINK_END_MEMBERS,
        ].sort());
      }
    });

    it('the en values are byte-identical to the hook per-key fallback map', () => {
      // Value verdict, asserted separately from the key surface (PR #3546 slice
      // five wrote this distinction down). This call site passes NO
      // `defaultValue`: `useGanttTranslation` asks the host first and falls back
      // to its own map PER KEY, so the map is what rendered before this slice and
      // i18next is what renders now. If the two disagreed, the drag hint would
      // change wording for English users, which this slice must not do.
      const hook = sourceOf(GANTT_HOOK);
      expect(hook).toContain("'gantt.linkEnd.start': 'start',");
      expect(hook).toContain("'gantt.linkEnd.end': 'end',");
      expect(at(builtInLocales.en, 'gantt.linkEnd.start')).toBe('start');
      expect(at(builtInLocales.en, 'gantt.linkEnd.end')).toBe('end');
      // the premise for "the map is what rendered": per-key, host-first.
      expect(hook).toContain('const hostValue = result.t(key, options as never) as unknown;');
      expect(hook).toContain("if (typeof hostValue === 'string' && hostValue !== key) return hostValue;");
    });

    it('the nine packs take their endpoint words from gantt own link vocabulary', () => {
      // Concept adjacency: `gantt.linkType.*` names the same two endpoints
      // ("Finish → Start"), and `de` deliberately says Anfang there rather than
      // the `gantt.column.start` label "Start" — so the link family, not the
      // column family, is the neighbour. `en` is lowercase because the words land
      // inside parentheses mid-hint; German capitalises nouns regardless, which
      // is correct German and not a copy of `en`.
      expect(at(builtInLocales.de, 'gantt.linkType.fs')).toBe('Ende → Anfang');
      expect(at(builtInLocales.de, 'gantt.linkEnd.start')).toBe('Anfang');
      expect(at(builtInLocales.de, 'gantt.linkEnd.end')).toBe('Ende');
      expect(at(builtInLocales.zh, 'gantt.linkType.fs')).toBe('完成 → 开始');
      expect(at(builtInLocales.zh, 'gantt.linkEnd.start')).toBe('开始');
      expect(at(builtInLocales.ar, 'gantt.linkType.fs')).toBe('نهاية → بداية');
      expect(at(builtInLocales.ar, 'gantt.linkEnd.start')).toBe('بداية');
      expect(at(builtInLocales.ar, 'gantt.linkEnd.end')).toBe('نهاية');
    });
  });

  describe('organization.invitations.status. — the second prefix family', () => {
    it('the key surface is exactly StatusFilter', () => {
      const family = at(builtInLocales.en, 'organization.invitations.status') as Record<string, string>;
      expect(Object.keys(family).sort()).toEqual([...STATUS_MEMBERS].sort());
      const src = sourceOf(INVITATIONS);
      // the premise: the union and the tab list still spell these five
      expect(src, 'StatusFilter moved').toContain(
        "type StatusFilter = 'all' | 'pending' | 'accepted' | 'rejected' | 'canceled';",
      );
      expect(src).toContain(
        "const tabs: StatusFilter[] = ['all', 'pending', 'accepted', 'rejected', 'canceled'];",
      );
      expect(src, 'the tab template call moved').toContain(
        "t(`organization.invitations.status.${tab}`, { defaultValue: tab })",
      );
      expect(src, 'the badge template call moved').toContain(
        "t(`organization.invitations.status.${inv.status}`, { defaultValue: inv.status })",
      );
      for (const lang of LANGS) {
        expect(
          Object.keys(at(builtInLocales[lang], 'organization.invitations.status') as object).sort(),
          `${lang}`,
        ).toEqual([...STATUS_MEMBERS].sort());
      }
    });

    it('en renders exactly what the CSS-capitalised wire value rendered', () => {
      // The equivalence that replaces a byte compare for shape three. The
      // `defaultValue` here is the enum member itself, and BOTH call sites put
      // `capitalize` on the element, so what a user saw was `Pending`, not
      // `pending`. `en` therefore has to be the capitalised member, exactly — one
      // letter of drift and this slice would have changed the English.
      for (const member of STATUS_MEMBERS) {
        expect(
          at(builtInLocales.en, `organization.invitations.status.${member}`),
          `en status.${member}`,
        ).toBe(cssCapitalize(member));
      }
      // the premise: both elements still carry `capitalize`
      const src = sourceOf(INVITATIONS);
      expect(src, 'the filter tab lost its capitalize class').toContain('transition-colors capitalize');
      expect(src, 'the status badge lost its capitalize class').toContain('className="shrink-0 capitalize"');
      // Single words, so `text-transform: capitalize` is exactly "upcase the
      // first letter" — pinned, because the CSS rule capitalises EVERY word and a
      // future two-word status would not round-trip through this model.
      for (const member of STATUS_MEMBERS) expect(member).not.toContain(' ');
    });

    it('the four invitation adjectives agree with each pack own word for "invitation"', () => {
      // Deliberately NOT reused from the `approvals*` family even though `en` has
      // byte-identical rows there, and the reason is grammatical rather than
      // stylistic: those rows agree with each pack's word for "request", and this
      // family describes an INVITATION. `ru` is the clearest case —
      // `approvalsInbox.statusRejected` is the masculine `Отклонён` (запрос),
      // while приглашение is neuter and needs `Отклонено`. Reusing would have
      // shipped a grammar error that key parity and the cognate set both pass.
      expect(at(builtInLocales.en, 'approvalsInbox.statusRejected')).toBe('Rejected');
      expect(at(builtInLocales.ru, 'approvalsInbox.statusRejected')).toBe('Отклонён');
      expect(at(builtInLocales.ru, 'organization.invitations.status.rejected')).toBe('Отклонено');
      expect(at(builtInLocales.ru, 'organization.accept.declined')).toBe('Приглашение отклонено');
      // fr/es inflect feminine (invitation / invitación), pt masculine (convite) —
      // taken from the same-namespace toasts, which is where each pack already
      // committed to a gender.
      expect(at(builtInLocales.fr, 'organization.accept.accepted')).toBe('Invitation acceptée');
      expect(at(builtInLocales.fr, 'organization.invitations.status.accepted')).toBe('Acceptée');
      expect(at(builtInLocales.es, 'organization.accept.accepted')).toBe('Invitación aceptada');
      expect(at(builtInLocales.es, 'organization.invitations.status.accepted')).toBe('Aceptada');
      expect(at(builtInLocales.pt, 'organization.accept.accepted')).toBe('Convite aceito');
      expect(at(builtInLocales.pt, 'organization.invitations.status.accepted')).toBe('Aceito');
      // …and `all`, the filter tab's own member, follows the same gender: the
      // noun it quantifies is "invitations".
      expect(at(builtInLocales.fr, 'organization.invitations.status.all')).toBe('Toutes');
      expect(at(builtInLocales.es, 'organization.invitations.status.all')).toBe('Todas');
      expect(at(builtInLocales.pt, 'organization.invitations.status.all')).toBe('Todos');
      // `canceled` is the ORG withdrawing the invitation, not the invitee
      // declining it, so de takes `zurückgezogen` from its own cancel toast
      // rather than the generic `Abgebrochen`.
      expect(at(builtInLocales.de, 'organization.invitations.canceled')).toBe('Einladung zurückgezogen');
      expect(at(builtInLocales.de, 'organization.invitations.status.canceled')).toBe('Zurückgezogen');
    });
  });

  it('reused strings are the neighbours own translations, not second renderings', () => {
    // Where this slice's `en` string already existed verbatim elsewhere AND the
    // neighbour's translation is grammatically usable here, the existing row is
    // reused rather than re-translated, so one English string never renders as
    // two different sentences in the same language. A drift on either side fails
    // here.
    const REUSED: Array<[newKey: string, neighbour: string]> = [
      ['common.done', 'view.done'],
      ['common.record', 'home.recentApps.itemType.record'],
      ['common.retry', 'lookup.retry'],
      ['dashboard.loading', 'lookup.loading'],
      ['detail.add', 'report.editor.fieldPickerAdd'],
      // The one family member that IS reused: `Pending` is rendered by a verb or
      // an invariant adjective in every pack (`ru` "Ожидает"), so unlike the
      // other four it carries no gender to disagree with.
      ['organization.invitations.status.pending', 'grid.import.jobStatus.pending'],
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
    // Recorded because it looks like an omission and is not: two other rows also
    // say `Done`/`Pending` in `en` and already disagree with the chosen neighbour
    // in one pack each — `grid.bulk.done` is es "Hecho" against "Listo", and
    // `approvalsInbox.statusPending` is zh 待审批 ("awaiting approval"), which is
    // wrong for an invitation. So the repo ALREADY renders these English strings
    // more than one way, on purpose, and picking a neighbour is a choice that has
    // to be made rather than derived.
    expect(at(builtInLocales.en, 'grid.bulk.done')).toBe('Done');
    expect(at(builtInLocales.es, 'grid.bulk.done')).toBe('Hecho');
    expect(at(builtInLocales.es, 'view.done')).toBe('Listo');
    expect(at(builtInLocales.zh, 'approvalsInbox.statusPending')).toBe('待审批');
    expect(at(builtInLocales.zh, 'organization.invitations.status.pending')).toBe('等待中');
  });

  it('the concept neighbours are the ones this slice claims, and they still say so', () => {
    // "Find the neighbour by CONCEPT, not by bytes" (slice five's blind spot,
    // slice six's rule). Each premise is asserted next to the value it justified,
    // so a neighbour that moves takes this with it.

    // `Administration` — the strongest neighbour in the whole slice: a sibling
    // key NAMES this very menu, per pack, in a sentence.
    expect(at(builtInLocales.en, 'home.welcomeAdminDescriptionNoAi')).toBe(
      'Set up your first application from the Administration menu on the left.',
    );
    expect(at(builtInLocales.zh, 'home.welcomeAdminDescriptionNoAi')).toContain('「管理」菜单');
    expect(at(builtInLocales.zh, 'layout.systemNav.administration')).toBe('管理');
    expect(at(builtInLocales.de, 'home.welcomeAdminDescriptionNoAi')).toContain('Verwaltungsmenü');
    expect(at(builtInLocales.de, 'layout.systemNav.administration')).toBe('Verwaltung');
    expect(at(builtInLocales.ru, 'home.welcomeAdminDescriptionNoAi')).toContain('«Администрирование»');
    expect(at(builtInLocales.ru, 'layout.systemNav.administration')).toBe('Администрирование');

    // `Datasources` — the plural nav label; the singular concept is already
    // translated as a field label, and the sibling nav entries are plural.
    expect(at(builtInLocales.en, 'report.editor.objectName')).toBe('Data source');
    expect(at(builtInLocales.ru, 'report.editor.objectName')).toBe('Источник данных');
    expect(at(builtInLocales.ru, 'layout.systemNav.datasources')).toBe('Источники данных');
    expect(at(builtInLocales.ru, 'layout.systemNav.organizations')).toBe('Организации');

    // `Documentation` — the help menu already has it, twice.
    expect(at(builtInLocales.en, 'help.onlineDocs')).toBe('Online documentation');
    expect(at(builtInLocales.ja, 'help.onlineDocs')).toBe('オンラインドキュメント');
    expect(at(builtInLocales.ja, 'layout.systemNav.documentation')).toBe('ドキュメント');

    // `Record deleted` — structural twin: "<Noun> deleted" as a success toast.
    expect(at(builtInLocales.en, 'organization.settings.deleted')).toBe('Organization deleted');
    expect(at(builtInLocales.ja, 'organization.settings.deleted')).toBe('組織を削除しました');
    expect(at(builtInLocales.ja, 'detail.deleted')).toBe('レコードを削除しました');
    expect(at(builtInLocales.ru, 'organization.settings.deleted')).toBe('Организация удалена');
    expect(at(builtInLocales.ru, 'detail.deleted')).toBe('Запись удалена');

    // `No history yet` — the "No X yet" empty-state family, plus each pack's own
    // word for History (ko says 기록, not 히스토리).
    expect(at(builtInLocales.en, 'detail.noCommentsYet')).toBe('No comments yet');
    expect(at(builtInLocales.ko, 'detail.noCommentsYet')).toBe('아직 댓글이 없습니다');
    expect(at(builtInLocales.ko, 'detail.history')).toBe('기록');
    expect(at(builtInLocales.ko, 'detail.historyEmpty')).toBe('아직 기록이 없습니다');

    // `Edit in studio` — "<verb> in Studio", with each pack's own Edit verb. The
    // product name stays Latin in all ten, which is why `Studio` shows up in the
    // loanword check above.
    expect(at(builtInLocales.en, 'topbar.designInStudio')).toBe('Design in Studio');
    expect(at(builtInLocales.zh, 'topbar.designInStudio')).toBe('在 Studio 中设计');
    expect(at(builtInLocales.zh, 'common.edit')).toBe('编辑');
    expect(at(builtInLocales.zh, 'common.editInStudio')).toBe('在 Studio 中编辑');

    // `on this instance` — ru and ar both render instance/deployment with their
    // own environment word, and have done so consistently.
    expect(at(builtInLocales.en, 'auth.login.devAdminHint.title')).toBe('Development instance');
    expect(at(builtInLocales.ru, 'approvalsInbox.recallUnavailable')).toBe('Отзыв недоступен в этой среде.');
    expect(at(builtInLocales.ru, 'workspace.multiOrgDisabled')).toContain('в этой среде');
    expect(at(builtInLocales.ar, 'connectAgent.disabled.title')).toBe('MCP معطّل في هذا النشر');
    expect(at(builtInLocales.ar, 'workspace.multiOrgDisabled')).toContain('في هذا النشر');
    // …and the "X ist disabled" sentence shape comes from the pack's own
    // `gantt.readOnlyHint`, not from a fresh construction.
    expect(at(builtInLocales.de, 'gantt.readOnlyHint')).toBe('Die Bearbeitung ist in dieser Ansicht deaktiviert.');
    expect(at(builtInLocales.de, 'workspace.multiOrgDisabled')).toContain('ist auf dieser Instanz deaktiviert');
  });

  it('kanban.columns is a bare unit word and follows the repo one precedent for that', () => {
    // The call site concatenates: `` `${boardColumns.length} ${t('kanban.columns')}` ``, so
    // the pack supplies a UNIT, not a sentence — the same structure as
    // `preview.history.items` (slice five, which had to be corrected once for
    // exactly this reason). `en` is plural-only and that is safe here: the empty
    // state only renders when `boardColumns.length > 1`, so the count is never 1
    // and no plural family is needed.
    const src = sourceOf(KANBAN);
    expect(src, 'the columns count label moved').toContain(
      "description={`${boardColumns.length} ${t('kanban.columns', { defaultValue: 'columns' })}`}",
    );
    expect(src, 'the >1 guard moved — a plural family would now be required').toContain(
      'const isBoardEmpty = totalCardCount === 0 && boardColumns.length > 1;',
    );
    // The precedent's shape, per pack: unit word only, no counter particle, since
    // the call site already inserts the space and the number.
    expect(at(builtInLocales.en, 'preview.history.items')).toBe('item(s)');
    expect(at(builtInLocales.ko, 'preview.history.items')).toBe('항목');
    expect(at(builtInLocales.ru, 'preview.history.items')).toBe('элементов');
    // …and the WORD comes from kanban's own column vocabulary, which is not the
    // table's: ja says カラム here and 列 in `table.columns`, ru колонка against
    // столбец.
    expect(at(builtInLocales.ja, 'kanban.addColumn')).toBe('カラムを追加');
    expect(at(builtInLocales.ja, 'table.columns')).toBe('列');
    expect(at(builtInLocales.ja, 'kanban.columns')).toBe('カラム');
    expect(at(builtInLocales.ru, 'kanban.addColumn')).toBe('Добавить колонку');
    expect(at(builtInLocales.ru, 'kanban.columns')).toBe('колонок');
    expect(at(builtInLocales.ko, 'kanban.columns')).toBe('열');
  });

  it('detail.concurrentUpdateRecordLabel is grammatical in the sentence that embeds it', () => {
    // This value is not a label on its own: `ConcurrentUpdateDialog` splits
    // `detail.concurrentUpdateDescription` on `{{field}}` and renders it bolded in
    // the gap, so the pack value has to fit whatever case/preposition precedes
    // the hole. `de` needs the DATIVE (…Version **von** {{field}}) where its
    // sibling `detail.deleteConfirmation` uses the accusative, and `ru` needs the
    // GENITIVE (…версию {{field}}). This is why the value is not simply the
    // pack's word for "record".
    const dialog = sourceOf(OCC_DIALOG);
    expect(dialog).toContain("const descriptionTemplate = t('detail.concurrentUpdateDescription', { field: '{{field}}' });");
    expect(dialog).toContain("const [beforeField, afterField] = descriptionTemplate.split('{{field}}');");
    expect(dialog).toContain("const fieldLabel = conflict?.label || conflict?.field || '';");
    expect(sourceOf(SAVE_BAR)).toContain("label: t('detail.concurrentUpdateRecordLabel', { defaultValue: 'this record' }),");

    const composed = (lang: string) =>
      (at(builtInLocales[lang], 'detail.concurrentUpdateDescription') as string).replace(
        '{{field}}',
        at(builtInLocales[lang], 'detail.concurrentUpdateRecordLabel') as string,
      );
    expect(composed('de')).toContain('eine neuere Version von diesem Datensatz gespeichert');
    expect(at(builtInLocales.de, 'detail.deleteConfirmation')).toContain('diesen Datensatz');
    expect(composed('ru')).toContain('более новую версию этой записи');
    expect(composed('fr')).toContain("une version plus récente de cet enregistrement");
    // `pt` is the one pack where the embedded phrase is NOT idiomatic and cannot
    // be fixed from this leaf: Portuguese contracts de + este into "deste", but
    // the "de " lives in the surrounding sentence, which is an EXISTING pack value
    // this slice does not touch. Pinned as the current truth rather than left for
    // the next reader to mistake for an oversight; filed separately, and the fix
    // is to rephrase pt's `concurrentUpdateDescription` so the hole is not
    // preceded by a bare preposition.
    expect(composed('pt')).toContain('mais recente de este registro');
    expect(at(builtInLocales.pt, 'detail.concurrentUpdateDescription')).toContain('mais recente de {{field}}');
  });

  it('each pack keeps its own typography in the one long sentence of this slice', () => {
    // The habits a copy-paste from `en` or a machine translation breaks first,
    // checked on the only multi-clause value here plus across all 24 paths where
    // the rule is pack-wide.
    const KEY = 'empty.appNotAvailableDescription';
    // en's em dash is U+2014; zh writes the doubled `——` its own pack prefers
    // (45 values against 25 single), everyone else mirrors en.
    for (const lang of LANGS) {
      const value = at(builtInLocales[lang], KEY) as string;
      expect(value.includes(lang === 'zh' ? '——' : '—'), `${lang} ${KEY} dash`).toBe(true);
    }
    // fr writes the straight apostrophe U+0027 (502 values against 21 curly) —
    // across every path, not just this one.
    for (const key of KEYS) {
      expect((at(builtInLocales.fr, key) as string).includes('’'), `fr ${key} used a curly apostrophe`).toBe(false);
    }
    expect(at(builtInLocales.fr, KEY)).toContain("n'est pas encore disponible");
    // ru writes ё (163 values in the pack).
    expect(at(builtInLocales.ru, KEY)).toContain('ещё');
    // The quote style around `{{name}}` follows the sibling empty-state value in
    // the SAME pack: zh curly, ja corner brackets, the rest ASCII.
    expect(at(builtInLocales.zh, 'empty.objectNotFoundDescription')).toContain('“{{name}}”');
    expect(at(builtInLocales.zh, 'empty.interfacePageSourceMissing')).toContain('“{{name}}”');
    expect(at(builtInLocales.ja, 'empty.objectNotFoundDescription')).toContain('「{{name}}」');
    expect(at(builtInLocales.ja, 'empty.interfacePageSourceMissing')).toContain('「{{name}}」');
    for (const lang of ['ko', 'fr', 'es', 'pt', 'ru', 'ar'] as const) {
      expect(at(builtInLocales[lang], 'empty.interfacePageSourceMissing'), `${lang} quotes`).toContain('"{{name}}"');
    }
    // de WAS the deliberate divergence: at slice-seven time its sibling values
    // paired the German opening low quote with an ASCII straight quote (20 keys /
    // 22 spans, measured), which was a typo rather than a convention, so this
    // slice wrote the correctly paired „…“ and filed the mismatch instead of
    // copying it. objectui#3876 then fixed the 20 siblings, and this assertion is
    // the one the card named as "the place to look back at when that lands" — so
    // it now pins the *convergence*: both values carry the same paired „…“. The
    // durable pack-wide invariant lives in `de-quote-pairing-3876.test.ts`.
    expect(at(builtInLocales.de, 'empty.objectNotFoundDescription')).toContain('„{{name}}“');
    expect(at(builtInLocales.de, 'empty.interfacePageSourceMissing')).toContain('„{{name}}“');
  });

  it('the ratchet is empty — this is the terminal state, not a partial one', () => {
    // `scripts/i18n-call-site-key-baseline.json` fails the build both ways: an
    // unfixed key missing from it, AND a fixed key still listed. With both lists
    // empty, any NEW unresolved call-site key is `unexpected` and fails — which
    // is what makes the empty file load-bearing rather than dead weight.
    const baselinePath = join(process.cwd(), 'scripts/i18n-call-site-key-baseline.json');
    expect(existsSync(baselinePath), `baseline not found at ${baselinePath}`).toBe(true);
    const raw = readFileSync(baselinePath, 'utf8');
    const baseline = JSON.parse(raw) as {
      note: string[];
      missingKeys: Record<string, unknown>;
      missingPrefixes: Record<string, unknown>;
    };
    // 258 keys and 4 prefix families at the start (main@a2c8f2a29), across seven
    // slices: 253 → 163 → 109 → 68 → 31 → 17 → 0, and 4 → 4 → 3 → 2 → 2 → 0.
    expect(Object.keys(baseline.missingKeys)).toEqual([]);
    expect(Object.keys(baseline.missingPrefixes)).toEqual([]);
    // Not deleted, and the file says why — a reader who finds two empty objects
    // must not conclude the ratchet is obsolete.
    expect(baseline.note.join(' ')).toContain('BOTH LISTS ARE NOW EMPTY');
    expect(baseline.note.join(' ')).toContain('fails the build');
    // Every key this slice removed now resolves, which is the other half of the
    // same statement: the entries went because the defect went.
    for (const key of KEYS) expect(typeof at(builtInLocales.en, key), `en ${key}`).toBe('string');
  });

  describe('through the real binding — provider mounted', () => {
    /** One key per owning surface. */
    const SAMPLE: Array<[key: string, owner: string]> = [
      ['common.done', 'InviteMemberDialog (invitation created footer)'],
      ['common.editInStudio', 'PageView (edit affordance title/aria-label)'],
      ['empty.appNotAvailable', 'AppContent (requested app missing)'],
      ['detail.historyEmpty', 'DetailView (history tab)'],
      ['kanban.columns', 'KanbanImpl (empty board)'],
      ['layout.systemNav.administration', 'UnifiedSidebar (admin cluster)'],
      ['workspace.multiOrgDisabled', 'CreateWorkspaceDialog (submit guard)'],
      ['gantt.linkEnd.start', 'GanttView (link drag hint)'],
      ['organization.invitations.status.pending', 'InvitationsPage (filter tab + badge)'],
    ];

    it('every owning file still binds t the way this suite assumes', () => {
      // The premise of mounting a provider, per family of binding — asserted, not
      // assumed. Nine files take i18next directly; four go through a
      // `createSafeTranslation` hook that hands i18next's `t` over once its probe
      // key resolves (which it does, since the probe keys are in the packs); one
      // uses the per-call `useSafeTranslate`; one uses gantt's per-key wrapper.
      for (const rel of [
        INVITE_DIALOG,
        PAGE_VIEW,
        APP_CONTENT,
        INVITATIONS,
        MEMBERS,
        INTERFACE_LIST,
        UNIFIED_SIDEBAR,
        APP_SIDEBAR,
        CREATE_WORKSPACE,
      ]) {
        expect(sourceOf(rel), `${rel} no longer binds the pack hook`).toContain('useObjectTranslation');
        // `t` must come out of the hook's destructuring — but it need not be the
        // ONLY thing destructured. The literal `const { t } = …` this used to
        // match broke the moment a file legitimately also took `language`, which
        // both sidebars now do to resolve the spec's inline per-locale
        // `I18nLabel` (widened in @objectstack/spec 17.0.0-rc.6). What this
        // suite actually depends on is that `t` is i18next's, bound from this
        // hook, so the pattern asserts exactly that and stays blind to which
        // siblings ride along.
        expect(
          /const \{[^}]*\bt\b[^}]*\} = useObjectTranslation\(/.test(sourceOf(rel)),
          `${rel} stopped destructuring t from useObjectTranslation()`,
        ).toBe(true);
      }
      // RecordDetailView takes it from @object-ui/react's re-export, with language.
      expect(sourceOf(RECORD_DETAIL)).toContain('const { t, language } = useObjectTranslation();');
      // plugin-detail's three go through useDetailTranslation…
      for (const rel of [RELATED_LIST, SAVE_BAR, DETAIL_VIEW]) {
        expect(sourceOf(rel), `${rel}`).toContain("import { useDetailTranslation } from './useDetailTranslation'");
        expect(sourceOf(rel), `${rel}`).toContain('const { t } = useDetailTranslation();');
      }
      // …and kanban through its own createSafeTranslation, whose probe key IS in
      // the packs, so the provider path wins. Its defaults map does not list
      // `kanban.columns`, which is the provider-LESS defect objectui#3865 owns.
      const kanban = sourceOf(KANBAN);
      expect(kanban).toContain('const useKanbanT = createSafeTranslation(');
      expect(kanban).toContain("'kanban.noCards',");
      expect(kanban).not.toContain("'kanban.columns':");
      expect(typeof at(builtInLocales.en, 'kanban.noCards')).toBe('string');
      // gantt's wrapper is per-key rather than probe-based (see its own header).
      expect(sourceOf(GANTT_VIEW)).toContain('const { t, language } = useGanttTranslation();');
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
      // Pre-fix each of these returned the inline English default in a zh session.
      // That is the whole defect, and only a non-en assertion sees it.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('zh') });
      const { t } = result.current;
      expect(t('common.editInStudio')).toBe('在 Studio 中编辑');
      expect(t('empty.appNotAvailable')).toBe('应用不可用');
      expect(t('empty.appNotAvailableDescription')).toBe('此应用尚不可用 —— 可能仍在发布中。请稍后重试。');
      expect(t('empty.interfacePageSourceMissing', { name: 'crm_lead' })).toBe(
        '此界面页引用了 “crm_lead”，但该来源不可用。',
      );
      expect(t('layout.systemNav.administration')).toBe('管理');
      expect(t('workspace.multiOrgDisabled')).toBe('此实例已禁用创建新组织。');
      expect(t('kanban.columns')).toBe('列');
      expect(t('detail.deleted')).toBe('记录已删除');
    });

    it('both template families render every member, in en and in zh', () => {
      // Exercised the way the call sites build the key, so a family that resolves
      // in the abstract but not through the template would still fail.
      for (const lang of ['en', 'zh'] as const) {
        window.localStorage.clear();
        const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
        for (const member of LINK_END_MEMBERS) {
          const key = `gantt.linkEnd.${member}`;
          expect(result.current.t(key), `${lang} ${key}`).toBe(at(builtInLocales[lang], key));
          expect(result.current.t(key)).not.toBe(key);
        }
        for (const member of STATUS_MEMBERS) {
          const key = `organization.invitations.status.${member}`;
          expect(result.current.t(key), `${lang} ${key}`).toBe(at(builtInLocales[lang], key));
          expect(result.current.t(key)).not.toBe(key);
        }
      }
      // The gantt drag hint, composed the way GanttView composes it.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('zh') });
      const endLabel = (e: 'start' | 'end') => result.current.t(`gantt.linkEnd.${e}`);
      expect(`设计评审 (${endLabel('end')}) → 上线 (${endLabel('start')})`).toBe('设计评审 (结束) → 上线 (开始)');
    });

    it.each([
      ['de', 'workspace.multiOrgDisabled', 'Das Erstellen neuer Organisationen ist auf dieser Instanz deaktiviert.'],
      ['fr', 'detail.historyEmpty', 'Aucun historique pour le moment'],
      ['es', 'organization.invitations.status.canceled', 'Cancelada'],
      ['pt', 'empty.appNotAvailable', 'Aplicativo indisponível'],
      ['ru', 'layout.systemNav.datasources', 'Источники данных'],
      ['ja', 'detail.deleted', 'レコードを削除しました'],
      ['ko', 'common.editInStudio', 'Studio에서 편집'],
      ['ar', 'layout.systemNav.documentation', 'الوثائق'],
    ])('%s renders a user-visible string from the pack', (lang, key, expected) => {
      // One pinned surface per remaining pack, across four writing systems, so a
      // pack that silently reverts to English is caught by name and not only by
      // the aggregate above.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor(lang) });
      expect(result.current.t(key)).toBe(expected);
    });

    it('the ar pack does not open an RTL string with a Latin token', () => {
      // Same rule slices three through six applied. `MCP`/`Studio`-style Latin
      // runs are allowed inside a string, never at its head, and the one
      // interpolated path is checked after substitution too — a hole at position
      // zero would put the caller's Latin value first.
      const { result } = renderHook(() => useObjectTranslation(), { wrapper: wrapperFor('ar') });
      for (const key of KEYS) {
        const value = result.current.t(key, { name: 'crm_lead' });
        expect(/^[A-Za-z]/.test(value), `${key} starts with a Latin token: ${value}`).toBe(false);
      }
      expect(result.current.t('common.editInStudio')).toBe('التعديل في Studio');
      expect(result.current.t('empty.interfacePageSourceMissing', { name: 'crm_lead' })).toContain('"crm_lead"');
    });
  });
});
