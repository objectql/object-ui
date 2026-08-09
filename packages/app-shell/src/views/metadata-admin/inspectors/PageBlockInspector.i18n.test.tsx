// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#3913 — the PROPERTIES panel renders in the session's language.
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
import { render, screen, cleanup } from '@testing-library/react';
import { PageSchema } from '@objectstack/spec/ui';
import { PageBlockInspector } from './PageBlockInspector';

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
   * NOT asserted anywhere above, deliberately: that this panel contains no
   * English at all. It still does, and the boundary is worth pinning.
   *
   * `FieldListField` and the `string-list` branch render their row-adder as a
   * hardcoded `<Plus /> Add`, and `aria-label`s ("Remove", "Remove item"), the
   * JSON parse error ("Invalid JSON") and two placeholders ("field name",
   * "snake_case object") are literals in `PageBlockInspector.tsx` itself. None
   * of them was ever a `block-config` label — different mechanism, different
   * surface — so they are outside objectui#3913 and filed as objectui#3963.
   *
   * Asserting their PRESENCE (rather than quietly not mentioning them) means the
   * day objectui#3963 lands, this case fails and has to be tightened, instead of
   * the two fixes silently overlapping and leaving nobody sure what is covered.
   */
  it('leaves only the known non-block-config chrome in English (objectui#3963)', () => {
    renderInspector(pageDraft('record:details', { sections: [{ label: 'Contact info' }] }), 'zh-CN');

    // The section's `fields` item editor is a `field-list`; its adder is chrome.
    const adders = screen.getAllByRole('button').filter((b) => b.textContent?.trim() === 'Add');
    expect(adders.length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Remove item').length).toBeGreaterThan(0);
  });

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
