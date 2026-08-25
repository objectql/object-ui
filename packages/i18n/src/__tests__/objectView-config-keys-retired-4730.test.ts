// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The `console.objectView.*` config-panel vocabulary is retired, and must stay
 * that way (objectui#4730, ruled 2026-08-19).
 *
 * ## What was removed and why
 *
 * The namespace held 209 keys in each of the ten packs. 116 of them labelled a
 * view-configuration settings panel that does not exist: appearance and density
 * toggles, accessibility attributes, conditional-formatting rules, row-action
 * and inline-edit switches, quick-filter builders, an advanced-settings tier.
 * They had no reader anywhere in the repo — no `t()` call site, no dynamic
 * template form reaching them, and no textual occurrence of the dotted key
 * outside the packs that define it.
 *
 * The plausible consumer confirms the story rather than contradicting it:
 * `packages/app-shell/src/views/ViewConfigPanel.tsx` was migrated off the legacy
 * `buildViewConfigSchema` engine onto `ViewVariantInspector`, a spec-driven
 * inspector whose field labels come from `@objectstack/spec` metadata (through
 * `useMetadataLocale`) rather than from this namespace. The panel these 116 keys
 * were written for was replaced; the keys were not cleaned up with it.
 *
 * ## The part that looks like a mistake and is not
 *
 * Four retired keys name `ListViewSchema` properties that are very much still
 * active — `rowActions`, `inlineEdit`, `hiddenFields`, `filterableFields`. They
 * are retired anyway, by explicit maintainer ruling: **a live schema property is
 * not a consumer of a locale string; only a labelled UI control is.** Nothing
 * renders a label for these properties, so nothing reads their label. If a
 * settings panel is ever specified, its keys are re-authored alongside it.
 *
 * ## Why this pin is NEGATIVE, and why it is needed at all
 *
 * Every i18n gate in this repo runs **call site → key**, never key → call site
 * (the same argument `report-editor-retired-4145.test.ts` sets out next door):
 * `check-i18n-call-site-keys.mjs` never visits a key with no call site,
 * `all-locales-key-parity` is fully satisfied by 116 dead keys present in all
 * ten packs, and `check-i18n-en-drift.mjs` only fires when an `en` value
 * CHANGES. `check-i18n-dead-keys.mjs` is the sweep that FOUND these, and it is
 * report-only by design — it enforces nothing and is wired into no workflow. So
 * the packs can re-accumulate this namespace with every gate green, which is
 * exactly how it grew. The guard has to be written down by name.
 *
 * Reverse-verified: restoring one retired key to one pack turns this pin red
 * (naming the pack and the key) and `all-locales-key-parity` red alongside it;
 * deleting one LIVE key instead turns this file's live-subset assertion red
 * while the retired-key assertions stay green, which is what makes this a
 * classifier rather than a rubber stamp.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { builtInLocales } from '../locales/index';

// Derived from the map rather than left as `string[]`: `Object.keys` erases
// which keys it enumerated, so `builtInLocales[lang]` below would be an
// implicit-`any` index into a `const` map (TS7053). Same convention as
// `report-editor-retired-4145.test.ts` next door.
type LocaleCode = keyof typeof builtInLocales;
const LANGS = Object.keys(builtInLocales) as LocaleCode[];

const at = (pack: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], pack);

/**
 * The 116 retired keys, listed BY NAME in the packs' own order rather than
 * counted. A count passes when one key returns and another leaves; the names do
 * not. 209 keys existed in the namespace; 116 were retired; 93 survived — 94
 * since objectui#5232 added `viewConfigPermissionDenied`, the refusal shown when
 * a session without `manage_metadata` tries to change ORG-WIDE view config
 * (objectstack#7494's ruling). An ADDITION to a live namespace is not a
 * regression of the retirement this file pins: none of the 116 retired keys
 * came back, which is what the `it` below actually asserts.
 */
const RETIRED_OBJECT_VIEW_KEYS = [
  'accessibility',
  'addDeleteRecordsInline',
  'addQuickFilter',
  'addRecordEnabled',
  'addRecordFormView',
  'addRecordMode',
  'addRecordPosition',
  'addRecordViaForm',
  'addRule',
  'addView',
  'advanced',
  'allowExport',
  'allowPrinting',
  'appearance',
  'ariaDescribedBy',
  'ariaLabel',
  'ariaLive',
  'bulkActions',
  'clickIntoRecordDetails',
  'closePanel',
  'collapseAllByDefault',
  'color',
  'columns',
  'columnsConfigured',
  'conditionalFormatting',
  'data',
  'dateField',
  'densityComfortable',
  'densityCompact',
  'densityMode',
  'densitySpacious',
  'description',
  'designTools',
  'editView',
  'emptyStateIcon',
  'emptyStateMessage',
  'emptyStateTitle',
  'enableColor',
  'enableDensity',
  'enableFilter',
  'enableGroup',
  'enableHideFields',
  'enableSearch',
  'enableSort',
  'enterDesignMode',
  'exitDesignMode',
  'exportFileNamePrefix',
  'exportFormats',
  'exportIncludeHeaders',
  'exportMaxRecords',
  'exportPrint',
  'exportPrintHint',
  'fieldTextColor',
  'fields',
  'fieldsVisible',
  'filterBy',
  'filterableFields',
  'filtersCount',
  'general',
  'generalHint',
  'gridOptionsHint',
  'hiddenFields',
  'hideAllFields',
  'inlineEdit',
  'listConfigHint',
  'metadataInspector',
  'navigationHint',
  'navigationMode',
  'navigationSection',
  'navigationWidth',
  'navigationWidthHint',
  'noDescription',
  'none',
  'openNewTab',
  'openNewTabHint',
  'page',
  'pageConfigHint',
  'pageSize',
  'pageSizeOptions',
  'prefixField',
  'quickFilters',
  'records',
  'recordsHint',
  'resizableColumns',
  'rowActions',
  'rowHeight',
  'searchableFields',
  'selectionMode',
  'selectionMultiple',
  'selectionNone',
  'selectionSingle',
  'sharing',
  'sharingEnabled',
  'sharingVisibility',
  'showAdvancedSettings',
  'showAllFields',
  'showDescription',
  'showFewerSettings',
  'showFieldDescriptions',
  'showRecordCount',
  'sortBy',
  'sortsCount',
  'source',
  'toolbarHint',
  'typeOptions',
  'ufAddTab',
  'ufAllowAddTab',
  'ufDropdown',
  'ufElements',
  'ufNoFields',
  'ufTabLabel',
  'ufToggle',
  'userActions',
  'userFilters',
  'viewTabs',
  'wrapHeaders',
] as const;

/** How many keys the namespace keeps — the live + indirect-reference remainder. */
const SURVIVING_KEY_COUNT = 94;

describe('console.objectView config-panel keys are retired (objectui#4730)', () => {
  it('the retired list is the measured set', () => {
    // Guards the premise the rest of the file rests on. If this arithmetic ever
    // stops holding, the assertions below are checking a set nobody chose.
    expect(RETIRED_OBJECT_VIEW_KEYS).toHaveLength(116);
    expect(new Set(RETIRED_OBJECT_VIEW_KEYS).size).toBe(116);
    // 209 at objectui#4730's landing; 210 since objectui#5232 added
    // `viewConfigPermissionDenied`. The RETIRED half is the ratchet that must
    // never move — it is pinned twice above — while the surviving half is a
    // live namespace that legitimately grows. Splitting them is the point:
    // folding a new key into the total would be indistinguishable from a
    // retired key coming back.
    expect(RETIRED_OBJECT_VIEW_KEYS.length + SURVIVING_KEY_COUNT).toBe(210);
    expect(LANGS).toHaveLength(10);
  });

  it('no pack defines any retired key, in any of the ten packs', () => {
    const revived: string[] = [];
    for (const lang of LANGS) {
      for (const key of RETIRED_OBJECT_VIEW_KEYS) {
        if (at(builtInLocales[lang], `console.objectView.${key}`) !== undefined) {
          revived.push(`${lang} :: console.objectView.${key}`);
        }
      }
    }
    // Named, not counted: the failure message has to say WHICH pack and WHICH
    // key, because the repair for a half-reverted namespace differs per key.
    expect(revived).toEqual([]);
  });

  it('the namespace root survives, with the same 94-key shape in every pack', () => {
    // Deliberately NOT "the root is gone": most of this namespace is live. The
    // shape to pin is the surviving key SET, identical across packs — a root
    // that regrows a retired key is the regression this file exists for, and a
    // root that vanishes takes the live create-view dialog with it.
    const enKeys = Object.keys(at(builtInLocales.en, 'console.objectView') as Record<string, unknown>);
    expect(enKeys).toHaveLength(SURVIVING_KEY_COUNT);
    for (const lang of LANGS) {
      const ns = at(builtInLocales[lang], 'console.objectView');
      expect(ns, `${lang} lost the console.objectView root`).toBeDefined();
      expect(Object.keys(ns as Record<string, unknown>).sort(), lang).toEqual([...enKeys].sort());
    }
  });

  it('the live subset is still a real translation in all ten packs, not English by fallback', () => {
    // The deletion swept AROUND these; this asserts that no single pack had a
    // live key swept up with its retired neighbours. A live key lost that way is
    // the one unrecoverable failure mode of this retirement — it ships a missing
    // label to ten locales, and no other gate here would say so.
    const LIVE_SAMPLE = ['new', 'save', 'configureView', 'viewTypeGrid'] as const;
    for (const lang of LANGS) {
      for (const key of LIVE_SAMPLE) {
        const value = at(builtInLocales[lang], `console.objectView.${key}`);
        expect(typeof value, `${lang}.console.objectView.${key}`).toBe('string');
        expect(
          (value as string).trim().length,
          `${lang}.console.objectView.${key} is empty`,
        ).toBeGreaterThan(0);
      }
    }
    // A sample across writing systems, so "all ten packs kept the key" cannot be
    // satisfied by ten copies of the English string.
    expect(at(builtInLocales.en, 'console.objectView.save')).toBe('Save');
    expect(at(builtInLocales.zh, 'console.objectView.save')).toBe('保存');
    expect(at(builtInLocales.ru, 'console.objectView.save')).toBe('Сохранить');
    expect(at(builtInLocales.ar, 'console.objectView.save')).toBe('حفظ');
  });

  it('no consuming package asks t() for a retired key', () => {
    // Scoped to the trees that render the object-view surface: app-shell (the
    // config panel, the create-view dialog, the runtime ObjectView) and
    // plugin-view (the Studio grid toolbar that borrows this namespace).
    //
    // Why pin the READER when `check:i18n-keys` already fails on a `t()` key no
    // pack defines: that gate reports it as "key missing from `en`", and the
    // obvious repair for a missing key is to backfill it — exactly the move that
    // rebuilds the dead namespace. This assertion is where the reason lives, so
    // the next author reads "this namespace is retired" instead of "one pack is
    // behind".
    //
    // Call-SHAPED and key-SPECIFIC, the same trade `report-editor-retired-4145`
    // makes next door: a bare substring scan would score prose that NAMES a
    // retired key as the offence, and the 93 live keys in this same namespace
    // are exactly what must keep working. No dynamic-template check here, and
    // that is the one place this file diverges from its neighbour — a dynamic
    // read into this namespace can legitimately be reaching for one of the 93
    // survivors, so it is not evidence of a revival.
    const roots = ['packages/app-shell/src', 'packages/plugin-view/src'];
    const retired = new Set<string>(RETIRED_OBJECT_VIEW_KEYS);
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === 'dist') continue;
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        const text = readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\bt?t\(\s*['"`]console\.objectView\.([A-Za-z0-9_]*)/g)) {
          if (retired.has(m[1])) offenders.push(`${full} :: console.objectView.${m[1]}`);
        }
      }
    };

    for (const root of roots) {
      // Root-form Vitest only (`scripts/vitest-invocation-guard.mjs` rejects a
      // package-cwd run), so `process.cwd()` is the repo root. Asserted rather
      // than assumed: a scan root that silently does not exist walks nothing and
      // passes, which is the one direction a revival gate must not fail in.
      const abs = join(process.cwd(), root);
      expect(existsSync(abs), `scan root missing: ${abs}`).toBe(true);
      walk(abs);
    }

    expect(
      offenders,
      'A retired console.objectView.* key is being read again. The namespace is ' +
        'retired (objectui#4730, ruled 2026-08-19) — do NOT backfill the key ' +
        'into the packs. If a view-configuration settings panel is being built, ' +
        'its keys are re-authored alongside it.',
    ).toEqual([]);
  });
});
