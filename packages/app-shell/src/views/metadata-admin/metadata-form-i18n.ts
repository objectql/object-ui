// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Locale overlay for the SPEC-DRIVEN property panels (objectui#7254).
 *
 * ## The gap
 *
 * A curated default inspector renders its config fields by feeding
 * `@objectstack/spec`'s canonical authoring form (`dashboardForm`, …) straight
 * into {@link SchemaForm} — deliberately, so a new prop added to the spec shows
 * up with zero code changes here. Those forms are authored in English
 * (`label: 'Layout'`, `helpText: 'Grid gap (Tailwind units)'`), and nothing on
 * this side translated them. Result: a Chinese author editing a dashboard read
 * a fully Chinese Studio with one all-English panel inside it — section
 * headings, every field label, every hint, including developer vocabulary
 * ("Tailwind units") that means nothing to the person the panel is for.
 *
 * ## Why the platform's own resolver, not a second convention
 *
 * The strings belong to the spec, and the platform already declares how they
 * are translated: `metadataForms.<type>.{label,description}`,
 * `.sections.<section>.{label,description}`,
 * `.fields.<dot.path>.{label,helpText,placeholder}` — resolved by
 * `resolveMetadataFormLabels` from `@objectstack/spec/system`, which the
 * framework's own `/meta/types` handler calls to localize the very same forms
 * before serving them. This module supplies a bundle to THAT function rather
 * than inventing a parallel key scheme, so:
 *
 *  - the section-name derivation, the dot-path field addressing and the
 *    composite sub-field synthesis all come from the producer's implementation
 *    (a hand-rolled walker would have had to re-derive `header.showTitle` and
 *    would have got the section names wrong — they are slugged labels, not the
 *    `label` text);
 *  - when the environment's own translation bundle reaches this surface, it
 *    drops in as a higher-precedence source with no call-site change.
 *
 * ## Scope: `en` + `zh`, matching this console's carve-out
 *
 * These entries live beside `./i18n.ts`'s `engine.*` table and share its
 * documented posture (see that file's header and `packages/i18n/README.md`,
 * "Scope — the `engine.*` carve-out"): the metadata designer ships `en` and
 * `zh`, and the other eight shipped locales render the producer's English.
 * `en` is deliberately ABSENT rather than a copy of the spec's sentences — an
 * English console falls through to the producer's own text instead of reading
 * a duplicate this repo would then have to keep in step by hand (the same rule
 * `tOptional` exists for). So this bundle carries `zh-CN` only.
 *
 * ⚠️ It is an OVERLAY, not a fork: a type the bundle does not name, or a field
 * it does not name, is returned untouched.
 *
 * ⛔ One sharp edge, load-bearing for anyone adding a type here: for a
 * `composite` / `repeater` / `record` field the spec resolver SYNTHESIZES the
 * sub-field list from the bundle's direct children of that path, and
 * `SchemaForm` prefers a declared `fields` array over the schema-derived one.
 * Enumerate ALL of a composite's children or none — naming two of three makes
 * the third disappear from the form.
 */

import { resolveMetadataFormLabels } from '@objectstack/spec/system';
import type { TranslationBundle } from '@objectstack/spec/system';
import { isZhLocale, type SupportedLocale } from './i18n.js';

/**
 * zh-CN strings for the spec authoring forms this console renders.
 *
 * Keys follow the platform convention exactly — a section is addressed by its
 * SLUGGED label (`'Grid sizing…'` section labelled `Layout` → `layout`), a
 * field by its dot path from the form root.
 */
const METADATA_FORM_BUNDLE: TranslationBundle = {
  'zh-CN': {
    metadataForms: {
      dashboard: {
        label: '仪表板',
        sections: {
          basics: { label: '基本信息', description: '仪表板的名称与描述。' },
          layout: { label: '布局', description: '栅格尺寸与刷新频率。' },
          widgets: { label: '组件', description: '放在栅格上的卡片与图表。' },
          filters: { label: '筛选', description: '应用到全部组件的默认筛选与全局筛选。' },
          advanced: { label: '高级', description: '无障碍与性能调优。' },
        },
        fields: {
          name: { label: '名称', helpText: 'snake_case 唯一标识' },
          label: { label: '显示名称', helpText: '展示给使用者的名称' },
          description: { label: '描述' },
          columns: { label: '列数', helpText: '栅格列数（默认 12）' },
          // The spec's own hint here is `Grid gap (Tailwind units)` — a unit
          // only a developer can act on. Reported upstream rather than
          // "translated" literally; this says what the author can decide.
          gap: { label: '间距', helpText: '组件之间的间距，数值越大越松' },
          refreshInterval: { label: '自动刷新', helpText: '自动刷新间隔（秒），0 表示不自动刷新' },
          header: { label: '页眉', helpText: '页眉设置：标题、描述与操作按钮' },
          // All three children of the `header` composite — see the ⛔ note above.
          'header.showTitle': { label: '显示标题', helpText: '在页眉中显示仪表板名称' },
          'header.showDescription': { label: '显示描述', helpText: '在页眉中显示仪表板描述' },
          'header.actions': { label: '操作按钮', helpText: '显示在页眉里的操作按钮' },
          widgets: { label: '组件', helpText: '仪表板组件，含位置与尺寸' },
          dateRange: { label: '日期范围', helpText: '默认的日期范围选择器' },
          globalFilters: { label: '全局筛选', helpText: '应用到全部组件的筛选条件' },
        },
      },
    },
  },
};

/**
 * The bundle locale an active console locale resolves to, or `undefined` when
 * this overlay has nothing to say (every locale but `zh`), in which case the
 * caller must hand the form through unchanged.
 */
function bundleLocale(locale?: SupportedLocale | string): string | undefined {
  return isZhLocale(locale) ? 'zh-CN' : undefined;
}

/**
 * Overlay `metadataForms.<type>` strings onto a spec authoring form.
 *
 * Returns the SAME object when there is nothing to apply, so a caller can
 * keep memoising on identity.
 */
export function localizeMetadataForm<T extends Record<string, unknown>>(
  form: T | undefined,
  type: string,
  locale?: SupportedLocale | string,
): T | undefined {
  if (!form) return form;
  const target = bundleLocale(locale);
  if (!target) return form;
  return resolveMetadataFormLabels(form, type, METADATA_FORM_BUNDLE, { locale: target });
}

/** Whether this overlay carries anything for `type` at `locale`. Exported for tests. */
export function hasMetadataFormOverlay(type: string, locale?: SupportedLocale | string): boolean {
  const target = bundleLocale(locale);
  if (!target) return false;
  return Boolean(METADATA_FORM_BUNDLE[target]?.metadataForms?.[type]);
}
