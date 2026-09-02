// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#7254 — the dashboard property panel was an all-English island
 * inside a Chinese Studio.
 *
 * The panel is spec-driven on purpose (`dashboardForm` from
 * `@objectstack/spec/ui` fed straight into SchemaForm), and the spec authors
 * its copy in English, so every section heading, field label and hint reached
 * the author untranslated — including "Grid gap (Tailwind units)", a unit only
 * a developer can act on.
 *
 * These pins assert the OVERLAY, and specifically the two things a hand-rolled
 * walker would have got wrong and a shape-only test would not have noticed:
 * the section key is the SLUGGED label (not the label text), and a `composite`
 * field's sub-rows are synthesized from the bundle — completely, or the ones
 * left out vanish from the form.
 */
import { describe, expect, it } from 'vitest';
import { dashboardForm } from '@objectstack/spec/ui';
import { localizeMetadataForm, hasMetadataFormOverlay } from './metadata-form-i18n';
import { getDashboardForm } from './dashboard-schema';

type Section = { label?: string; description?: string; fields?: any[] };

function sections(form: unknown): Section[] {
  return ((form as { sections?: Section[] })?.sections ?? []) as Section[];
}

function fieldByName(form: unknown, name: string): any {
  for (const s of sections(form)) {
    for (const f of s.fields ?? []) {
      if (f?.field === name) return f;
    }
  }
  return undefined;
}

describe('localizeMetadataForm — the spec form, in the author’s language', () => {
  it('has an overlay for `dashboard` at zh and none at en', () => {
    expect(hasMetadataFormOverlay('dashboard', 'zh-CN')).toBe(true);
    expect(hasMetadataFormOverlay('dashboard', 'en-US')).toBe(false);
  });

  it('leaves the form untouched (same object) outside zh', () => {
    const form = dashboardForm as unknown as Record<string, unknown>;
    expect(localizeMetadataForm(form, 'dashboard', 'en-US')).toBe(form);
  });

  it('leaves a type the overlay does not carry untouched', () => {
    const form = dashboardForm as unknown as Record<string, unknown>;
    expect(localizeMetadataForm(form, 'report', 'zh-CN')).toBe(form);
  });

  it('translates section headings — addressed by the SLUGGED label, not the label text', () => {
    const zh = localizeMetadataForm(
      dashboardForm as unknown as Record<string, unknown>,
      'dashboard',
      'zh-CN',
    );
    const labels = sections(zh).map((s) => s.label);
    expect(labels).toContain('布局'); // 'Layout' → section key `layout`
    expect(labels).toContain('筛选'); // 'Filters' → `filters`
    expect(labels).not.toContain('Layout');
    const layout = sections(zh).find((s) => s.label === '布局');
    expect(layout?.description).toBe('栅格尺寸与刷新频率。');
    expect(layout?.description).not.toMatch(/refresh cadence/);
  });

  it('translates the layout field labels and hints the card named', () => {
    const zh = localizeMetadataForm(
      dashboardForm as unknown as Record<string, unknown>,
      'dashboard',
      'zh-CN',
    );
    expect(fieldByName(zh, 'columns')).toMatchObject({ label: '列数', helpText: '栅格列数（默认 12）' });
    expect(fieldByName(zh, 'refreshInterval')?.label).toBe('自动刷新');
    expect(fieldByName(zh, 'header')?.label).toBe('页眉');
  });

  it('drops the "Tailwind units" developer vocabulary rather than transliterating it', () => {
    const zh = localizeMetadataForm(
      dashboardForm as unknown as Record<string, unknown>,
      'dashboard',
      'zh-CN',
    );
    const gap = fieldByName(zh, 'gap');
    expect(gap?.label).toBe('间距');
    expect(gap?.helpText).not.toMatch(/Tailwind/i);
    // The English source still says it — that copy is the spec's to fix, and
    // this overlay deliberately does not rewrite the producer's own text.
    expect(fieldByName(dashboardForm, 'gap')?.helpText).toMatch(/Tailwind/i);
  });

  it('synthesizes ALL of the `header` composite’s sub-rows — a partial list would hide the rest', () => {
    const zh = localizeMetadataForm(
      dashboardForm as unknown as Record<string, unknown>,
      'dashboard',
      'zh-CN',
    );
    const header = fieldByName(zh, 'header');
    expect(header?.type).toBe('composite');
    const children = (header?.fields ?? []).map((f: any) => f.field);
    // Exactly `DashboardHeaderSchema`'s three properties. SchemaForm prefers a
    // declared `fields` array over the schema-derived one, so anything absent
    // here would disappear from the panel.
    expect(children.sort()).toEqual(['actions', 'showDescription', 'showTitle']);
    const byName = Object.fromEntries((header.fields as any[]).map((f) => [f.field, f]));
    expect(byName.showTitle.label).toBe('显示标题');
    expect(byName.showTitle.helpText).toBe('在页眉中显示仪表板名称');
    expect(byName.showDescription.label).toBe('显示描述');
    expect(byName.actions.label).toBe('操作按钮');
  });
});

describe('getDashboardForm — the overlay reaches the panel, and caches per locale', () => {
  it('serves the spec’s English by default and Chinese to a zh console', () => {
    const en = getDashboardForm('en-US');
    const zh = getDashboardForm('zh-CN');
    expect(sections(en).map((s) => s.label)).toContain('Layout');
    expect(sections(zh).map((s) => s.label)).toContain('布局');
  });

  it('does not serve one locale’s copy to another (the single-slot cache bug)', () => {
    // Order matters: ask for zh first, then en. A single memo slot would hand
    // the Chinese form to the English console.
    expect(sections(getDashboardForm('zh-CN')).map((s) => s.label)).toContain('布局');
    expect(sections(getDashboardForm('en-US')).map((s) => s.label)).toContain('Layout');
    expect(sections(getDashboardForm('en-US')).map((s) => s.label)).not.toContain('布局');
  });

  it('is stable per locale', () => {
    expect(getDashboardForm('zh-CN')).toBe(getDashboardForm('zh-CN'));
  });

  it('still prunes the fields the curated inspector owns', () => {
    const zh = getDashboardForm('zh-CN');
    for (const owned of ['name', 'label', 'description', 'widgets']) {
      expect(fieldByName(zh, owned)).toBeUndefined();
    }
  });
});
