// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#3913 — the PROPERTIES panel renders in the session's language.
 * objectui#3963 — and so does the panel's OWN chrome (see the second describe).
 *
 * The sibling `previews/__tests__/block-config-i18n.test.ts` pins the TABLE
 * (every label is a key its position implies, and both locales define it). That
 * is a fact about data. This file pins the fact about the screen, and they are
 * different: `renderField` reaches `f.label` from eleven places — eight as a
 * `label=` prop, three as `<Label>` children — plus option lists handed to
 * `InspectorSelectField` / `ColorVariantPicker`, and each is a separate chance
 * to forward a raw key. A table full of correct keys still renders
 * `engine.inspector.pageBlock.field.…` on screen if one branch skips `t()`.
 *
 * So the assertions here are deliberately about visible strings, and they run
 * the same block twice — once per locale — because the defect was never "no
 * translation exists" but "this panel does not ask for one".
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PageSchema } from '@objectstack/spec/ui';
import { PageBlockInspector } from './PageBlockInspector';
import { t } from '../i18n';

afterEach(cleanup);

const BLOCK_PATH = 'regions[0].components[0]';

/** A record page carrying one block of `type`, with the given properties. */
function pageDraft(type: string, properties: Record<string, unknown> = {}): Record<string, unknown> {
  return PageSchema.parse({
    name: 'contact_record',
    label: 'Contact',
    type: 'record',
    object: 'contact',
    template: 'default',
    regions: [{ name: 'main', components: [{ type, id: 'b1', properties }] }],
  }) as unknown as Record<string, unknown>;
}

function renderInspector(draft: Record<string, unknown>, locale: 'en-US' | 'zh-CN') {
  render(
    <PageBlockInspector
      type="page"
      name="contact_record"
      draft={draft}
      selection={{ kind: 'block', id: BLOCK_PATH }}
      onPatch={() => {}}
      onClearSelection={() => {}}
      readOnly={false}
      locale={locale as never}
    />,
  );
}

/** No raw translation key may reach the DOM in any locale. */
function expectNoRawKeys() {
  expect(document.body.textContent ?? '').not.toContain('engine.inspector.pageBlock.');
}

describe('PageBlockInspector PROPERTIES labels follow the locale (#3913)', () => {
  it('renders curated field labels in Chinese under zh-CN', () => {
    renderInspector(pageDraft('object-grid'), 'zh-CN');

    // `object-grid`: object-picker + field-list + number + two booleans, i.e.
    // four different `renderField` branches in one panel.
    expect(screen.getByText('对象')).toBeTruthy();
    expect(screen.getByText('列')).toBeTruthy();
    expect(screen.getByText('每页条数')).toBeTruthy();
    expect(screen.getByText('斑马纹行')).toBeTruthy();
    expect(screen.getByText('显示边框')).toBeTruthy();
    // The English literals must be gone, not merely joined by Chinese ones.
    expect(screen.queryByText('Striped rows')).toBeNull();
    expect(screen.queryByText('Page size')).toBeNull();
    expectNoRawKeys();
  });

  it('renders the same panel in English under en-US, unchanged', () => {
    renderInspector(pageDraft('object-grid'), 'en-US');

    expect(screen.getByText('Object')).toBeTruthy();
    expect(screen.getByText('Columns')).toBeTruthy();
    expect(screen.getByText('Page size')).toBeTruthy();
    expect(screen.getByText('Striped rows')).toBeTruthy();
    expect(screen.getByText('Bordered')).toBeTruthy();
    expectNoRawKeys();
  });

  it('translates the array add button — the branch that had no key at all', () => {
    // `addLabel` was optional and the array branch fell back to a bare English
    // `'Add'`. It is now required, so that fallback is deleted rather than
    // translated — a new array field cannot compile without its key.
    renderInspector(pageDraft('record:details', { sections: [{ label: 'Contact info' }] }), 'zh-CN');

    expect(screen.getByText('分区')).toBeTruthy();
    expect(screen.getByText('添加分区')).toBeTruthy();
    expect(screen.queryByText('Add section')).toBeNull();
    expectNoRawKeys();
  });

  /**
   * The boundary this describe deliberately did NOT cover used to be pinned
   * here, as an assertion that the panel's own chrome was still English —
   * `<Plus /> Add`, the "Remove" / "Remove item" aria-labels, "Invalid JSON",
   * and two placeholders were literals in `PageBlockInspector.tsx` itself,
   * never `block-config` labels, so they were outside objectui#3913 and filed
   * as objectui#3963.
   *
   * That case did its job: objectui#3963 landing turned it red instead of the
   * two fixes silently overlapping. It is now the second describe below, which
   * asserts the same sites resolve THROUGH the catalog in both locales — the
   * boundary moved rather than disappeared.
   */

  it('translates nested array-item labels, not just the container', () => {
    // Item fields recurse through `renderField` with a different read/write
    // pair; a fix applied only to the top level would leave these English.
    renderInspector(pageDraft('record:details', { sections: [{ label: 'Contact info' }] }), 'zh-CN');

    expect(screen.getByText('名称（i18n 键）')).toBeTruthy();
    expect(screen.getByText('标签')).toBeTruthy();
    expect(screen.getByText('列数')).toBeTruthy();
    expect(screen.getByText('字段')).toBeTruthy();
    expect(screen.queryByText('Name (i18n key)')).toBeNull();
  });

  it('translates select OPTION labels, not only the field label', () => {
    // Options are a separate hop: they are passed as data to
    // `InspectorSelectField`, so translating `f.label` alone leaves the
    // dropdown's own text English. `severity` renders its current value.
    renderInspector(pageDraft('record:alert', { severity: 'warning' }), 'zh-CN');

    expect(screen.getByText('严重度')).toBeTruthy();
    expect(screen.getByText('警告')).toBeTruthy();
    expect(screen.queryByText('Warning')).toBeNull();
    expect(screen.getByText('可关闭')).toBeTruthy();
    expectNoRawKeys();
  });

  it('translates color-swatch option labels (the accessible name)', () => {
    // `ColorVariantPicker` renders option labels as `aria-label`/`title` only —
    // invisible to a text query, and exactly where an untranslated key hides.
    renderInspector(pageDraft('object-metric', { colorVariant: 'blue' }), 'zh-CN');

    expect(screen.getByLabelText('蓝色')).toBeTruthy();
    expect(screen.getByLabelText('成功')).toBeTruthy();
    expect(screen.queryByLabelText('Blue')).toBeNull();
  });

  it('keeps the panel chrome and its contents in ONE language', () => {
    // The bug in one assertion: the section heading was already translated
    // while everything under it was not.
    renderInspector(pageDraft('page:header'), 'zh-CN');

    expect(screen.getByText('属性')).toBeTruthy(); // chrome, already worked
    expect(screen.getByText('标题')).toBeTruthy(); // contents, the fix
    expect(screen.getByText('副标题')).toBeTruthy();
    expect(screen.getByText('显示面包屑')).toBeTruthy();
    expect(screen.queryByText('Subtitle')).toBeNull();
    expect(screen.queryByText('Show breadcrumb')).toBeNull();
  });
});

/**
 * objectui#3963 — the panel's OWN chrome follows the locale too.
 *
 * A different mechanism from the describe above: these strings were never
 * `block-config` data, they were literals inside `PageBlockInspector.tsx`'s
 * JSX. The visible symptom was one panel in two languages the other way round
 * — after #3913 a zh-CN admin read 「分区」/「字段」 with an English `Add`
 * underneath each list.
 *
 * Two of the sites are `aria-label`s and two are placeholders, i.e. invisible
 * to a text query and to a screenshot; that is why they survived #3913's
 * review and why the assertions below use `getByLabelText` /
 * `getByPlaceholderText` rather than reading the rendered text.
 */
describe("PageBlockInspector's own chrome follows the locale (#3963)", () => {
  /** `record:details` with one populated section: array card + field-list rows. */
  const detailsDraft = () =>
    pageDraft('record:details', { sections: [{ label: 'Contact info', fields: ['name'] }] });

  it('renders every chrome site in Chinese under zh-CN', () => {
    renderInspector(detailsDraft(), 'zh-CN');

    // Row adder of the `field-list` editor (was a bare `<Plus /> Add`).
    const adders = screen.getAllByRole('button').filter((b) => b.textContent?.trim() === '添加');
    expect(adders.length).toBeGreaterThan(0);
    // Per-row remove (aria-label only) and the array item card's remove.
    expect(screen.getAllByLabelText('删除').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('删除项').length).toBeGreaterThan(0);
    // The free-text fallback row of a `field-list` — a placeholder, invisible
    // to `getByText`.
    expect(screen.getAllByPlaceholderText('字段名').length).toBeGreaterThan(0);

    // The English literals are gone, not merely joined by Chinese ones.
    expect(screen.queryAllByRole('button').filter((b) => b.textContent?.trim() === 'Add')).toEqual([]);
    expect(screen.queryByLabelText('Remove')).toBeNull();
    expect(screen.queryByLabelText('Remove item')).toBeNull();
    expect(screen.queryByPlaceholderText('field name')).toBeNull();
    expectNoRawKeys();
  });

  it('renders the same chrome in English under en-US, unchanged', () => {
    // en-US is this repo's baseline language: the new keys carry exactly the
    // literals that used to be hardcoded, so this panel must not have moved.
    renderInspector(detailsDraft(), 'en-US');

    const adders = screen.getAllByRole('button').filter((b) => b.textContent?.trim() === 'Add');
    expect(adders.length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Remove').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Remove item').length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText('field name').length).toBeGreaterThan(0);
    expectNoRawKeys();
  });

  it('translates the string-list branch too, not only FieldListField', () => {
    // Two independent copies of the same adder/remove chrome: `FieldListField`
    // (a component) and `renderField`'s `string-list` case (inline JSX). A fix
    // applied to one only would leave the other English, and no fixture in the
    // describe above renders `string-list` at all.
    renderInspector(pageDraft('record:quick_actions', { actionNames: ['send_email'] }), 'zh-CN');

    const adders = screen.getAllByRole('button').filter((b) => b.textContent?.trim() === '添加');
    expect(adders.length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('删除').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Remove')).toBeNull();
    expectNoRawKeys();
  });

  it("translates the object picker's free-text placeholder", () => {
    // `ObjectPickerField` degrades to a free-text input when the object list is
    // unavailable — which is the state every offline session starts in.
    renderInspector(pageDraft('object-grid'), 'zh-CN');

    expect(screen.getByPlaceholderText('snake_case 对象名')).toBeTruthy();
    expect(screen.queryByPlaceholderText('snake_case object')).toBeNull();
  });

  it('reuses the catalog key for the JSON parse error instead of a literal', () => {
    // `engine.form.invalidJson` already existed and `translateValidationMessage()`
    // already mapped `'invalid json'` onto it — this site had bypassed it. Asserting
    // the RESOLVED value in both locales is what distinguishes "reused the key"
    // from "hardcoded the same English words".
    renderInspector(pageDraft('element:button'), 'zh-CN');
    const zhArea = document.querySelector('textarea');
    expect(zhArea).toBeTruthy();
    fireEvent.change(zhArea!, { target: { value: '{ not json' } });
    fireEvent.blur(zhArea!);
    expect(screen.getByText(t('engine.form.invalidJson', 'zh-CN'))).toBeTruthy();
    expect(screen.queryByText('Invalid JSON')).toBeNull();

    cleanup();
    renderInspector(pageDraft('element:button'), 'en-US');
    const enArea = document.querySelector('textarea');
    fireEvent.change(enArea!, { target: { value: '{ not json' } });
    fireEvent.blur(enArea!);
    expect(screen.getByText('Invalid JSON')).toBeTruthy();
  });
});

/**
 * Key completeness for the panel's own chrome — the same shape as the
 * structural pin `previews/__tests__/block-config-i18n.test.ts` uses for the
 * table, adapted to the one thing that differs: these keys have no position to
 * be derived from, they are `t('…')` call sites in one file. So the list is
 * read back OUT of that file instead of hand-copied here, and the day someone
 * adds a chrome key with only an en translation this is red without anybody
 * remembering to extend a list.
 *
 * Completeness is measured through `t()` — it returns the key unchanged on a
 * miss, so `t(key, locale) === key` is exactly "this locale has no entry".
 */
describe("PageBlockInspector's chrome keys resolve in both locales (#3963)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(here, 'PageBlockInspector.tsx'), 'utf8');
  /** Literal keys passed to `t()`. Dynamic `t(f.label)` sites are block-config's. */
  const KEYS = [...new Set([...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]))];

  /**
   * Keys whose two locales are deliberately identical, with the reason. A
   * ledger, not a rule — everything else staying red is the point.
   */
  const LOCALE_INVARIANT = new Set<string>([
    'engine.inspector.pageBlock.id', // 'ID' — an acronym, not translated in zh-CN
  ]);

  it('finds the call sites at all — the scan is not vacuous', () => {
    expect(KEYS.length).toBeGreaterThan(12);
    // The five keys #3963 added, plus the existing one it reuses rather than
    // duplicating. Named explicitly so a regex that silently stops matching
    // (e.g. after a reformat) fails here instead of passing over nothing.
    for (const key of [
      'engine.inspector.pageBlock.list.add',
      'engine.inspector.pageBlock.list.remove',
      'engine.inspector.pageBlock.list.removeItem',
      'engine.inspector.pageBlock.objectPlaceholder',
      'engine.inspector.pageBlock.fieldPlaceholder',
      'engine.form.invalidJson',
    ]) {
      expect(KEYS).toContain(key);
    }
  });

  it('every key resolves in en-US', () => {
    expect(KEYS.filter((k) => t(k, 'en-US') === k)).toEqual([]);
  });

  it('every key resolves in zh-CN', () => {
    expect(KEYS.filter((k) => t(k, 'zh-CN') === k)).toEqual([]);
  });

  it('zh-CN is actually translated, not a copy of en-US', () => {
    const untranslated = KEYS.filter(
      (k) => !LOCALE_INVARIANT.has(k) && t(k, 'zh-CN') === t(k, 'en-US'),
    ).map((k) => `${k} = '${t(k, 'en-US')}'`);
    // If a chrome string really is locale-invariant, add it to
    // LOCALE_INVARIANT above with its reason — do not weaken this assertion.
    expect(untranslated).toEqual([]);
  });
});
