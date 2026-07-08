/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ObjectFormDesigner } from './ObjectFormDesigner';

/** Build an array-shape `draft.fields` with `n` plain text fields. */
function textFields(n: number): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({
    name: `field_${i + 1}`,
    type: 'text',
    label: `Field ${i + 1}`,
  }));
}

const noop = () => {};

/** All descendant <div>s whose class list contains `cls` (raw substring match
 *  — Tailwind's `@`/`:` make CSS-selector escaping fiddly, so match strings). */
function divsWithClass(container: HTMLElement, cls: string): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter((d) =>
    d.className.split(/\s+/).includes(cls),
  );
}

describe('ObjectFormDesigner — responsive field grid (parity with the runtime form)', () => {
  it('spreads to 4 columns on wide screens for a field-heavy object', () => {
    // 16 editable fields → inferColumns() caps at 4, exactly like the real
    // ObjectForm. The section grid must carry the same container-query class,
    // so a wide container renders 4 fields per row.
    const { container } = render(
      <ObjectFormDesigner
        draft={{ fields: textFields(16) }}
        systemFieldNames={new Set()}
        onChange={noop}
        onSelectField={noop}
      />,
    );
    expect(divsWithClass(container, '@4xl:grid-cols-4').length).toBeGreaterThan(0);
    expect(divsWithClass(container, '@md:grid-cols-2').length).toBeGreaterThan(0);
    // Never a hard-coded 2-column grid anymore (the old fixed `grid-cols-2`).
    expect(divsWithClass(container, 'grid-cols-2')).toHaveLength(0);
  });

  it('stays single-column for a light object (no thin multi-column spread)', () => {
    // inferColumns(3) === 1 → containerGridColsFor(1) falls back to a plain
    // single-column grid, matching the runtime form's behaviour for tiny forms.
    const { container } = render(
      <ObjectFormDesigner
        draft={{ fields: textFields(3) }}
        systemFieldNames={new Set()}
        onChange={noop}
        onSelectField={noop}
      />,
    );
    expect(divsWithClass(container, '@4xl:grid-cols-4')).toHaveLength(0);
    expect(divsWithClass(container, '@2xl:grid-cols-3')).toHaveLength(0);
  });

  it('excludes system fields from the density count (parity with the form)', () => {
    // 16 declared fields but 14 are system/audit → only 2 editable, so the
    // designer must infer 1 column (inferColumns(2) === 1), not 4.
    const systemNames = Array.from({ length: 14 }, (_, i) => `field_${i + 1}`);
    const { container } = render(
      <ObjectFormDesigner
        draft={{ fields: textFields(16) }}
        systemFieldNames={new Set(systemNames)}
        onChange={noop}
        onSelectField={noop}
      />,
    );
    expect(divsWithClass(container, '@4xl:grid-cols-4')).toHaveLength(0);
  });

  it('lays wide widgets (textarea/markdown/…) across the full row like the runtime form', () => {
    render(
      <ObjectFormDesigner
        draft={{ fields: [...textFields(15), { name: 'notes', type: 'textarea', label: 'Notes' }] }}
        systemFieldNames={new Set()}
        onChange={noop}
        onSelectField={noop}
      />,
    );
    const notesCard = screen.getByText('Notes').closest('.cursor-grab') as HTMLElement;
    expect(notesCard).toBeTruthy();
    expect(notesCard.className).toContain('col-span-full');

    // A normal field occupies a single cell (no full-row span).
    const plainCard = screen.getByText('Field 1').closest('.cursor-grab') as HTMLElement;
    expect(plainCard.className).not.toContain('col-span-full');
  });
});

describe('ObjectFormDesigner — group selection', () => {
  const draft = {
    fields: [{ name: 'email', type: 'text', label: 'Email', group: 'contact' }],
    fieldGroups: [{ key: 'contact', label: 'Contact' }],
  };

  it('exposes a group-settings affordance that selects the group by key', () => {
    const onSelectGroup = vi.fn();
    render(
      <ObjectFormDesigner
        draft={draft}
        systemFieldNames={new Set()}
        onChange={noop}
        onSelectField={noop}
        onSelectGroup={onSelectGroup}
      />,
    );
    fireEvent.click(screen.getByLabelText('Group settings'));
    expect(onSelectGroup).toHaveBeenCalledWith('contact');
  });

  it('hides the group-settings affordance when no handler is provided', () => {
    render(
      <ObjectFormDesigner
        draft={draft}
        systemFieldNames={new Set()}
        onChange={noop}
        onSelectField={noop}
      />,
    );
    expect(screen.queryByLabelText('Group settings')).toBeNull();
  });
});
