/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DetailSection } from '../DetailSection';
import type { DetailViewSection } from '@object-ui/types';

/**
 * #2401 — inline editing is entered by double-clicking a field (or its hover
 * pencil), replacing the standalone "Edit fields" toggle. The affordance must:
 *   - fire `onEnterInlineEdit(fieldName)` on double-click of an EDITABLE field,
 *   - be inert on computed (formula/summary/rollup/auto_number) and `readonly`
 *     fields,
 *   - be gated by the presence of `onEnterInlineEdit` (the parent supplies it
 *     only when the record is inline-editable — object lifecycle + permission),
 *   - never turn a computed / read-only field into an input, even in global
 *     inline-edit mode.
 *
 * Assertions are behavioural (not tied to the localized tooltip text) so they
 * hold whether or not an I18nProvider is mounted in the test env.
 */
describe('DetailSection double-click inline-edit affordance', () => {
  // useIsMobile() keys off window.innerWidth (< 768 == mobile). Pin a desktop
  // width so the read-mode desktop row (which carries the affordance) renders.
  beforeAll(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  });

  const objectSchema = {
    fields: {
      title: { type: 'text' },
      budget: { type: 'currency' },
      score: { type: 'formula' },       // computed → never editable
      code: { type: 'auto_number' },    // computed → never editable
    },
  };

  const section: DetailViewSection = {
    fields: [
      { name: 'title', label: 'Title' },
      { name: 'score', label: 'Score' },
      { name: 'code', label: 'Code' },
      { name: 'locked', label: 'Locked', readonly: true },
    ],
  } as DetailViewSection;

  const data = { title: 'Hello', score: 42, code: 'A-001', locked: 'x' };

  it('enters inline edit on double-click of an editable field', () => {
    const onEnter = vi.fn();
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        onEnterInlineEdit={onEnter}
      />,
    );
    fireEvent.doubleClick(screen.getByText('Hello'));
    expect(onEnter).toHaveBeenCalledWith('title');
  });

  it('is inert on computed (formula / auto_number) and readonly fields', () => {
    const onEnter = vi.fn();
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        onEnterInlineEdit={onEnter}
      />,
    );
    fireEvent.doubleClick(screen.getByText('42'));      // formula
    fireEvent.doubleClick(screen.getByText('A-001'));   // auto_number
    fireEvent.doubleClick(screen.getByText('x'));       // readonly
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('offers no inline-edit entry when onEnterInlineEdit is absent', () => {
    render(
      <DetailSection section={section} data={data} objectSchema={objectSchema} />,
    );
    // Double-click is a no-op and the field stays in read mode (no input).
    fireEvent.doubleClick(screen.getByText('Hello'));
    expect(screen.queryByDisplayValue('Hello')).toBeNull();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('keeps computed and readonly fields read-only even in global inline-edit mode', () => {
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        isEditing
        onEnterInlineEdit={vi.fn()}
      />,
    );
    // Editable field → input …
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
    // … computed (formula 42, auto_number A-001) and readonly (x) → NOT inputs.
    expect(screen.queryByDisplayValue('42')).toBeNull();
    expect(screen.queryByDisplayValue('A-001')).toBeNull();
    expect(screen.queryByDisplayValue('x')).toBeNull();
  });

  it('auto-focuses the field named by autoFocusField in edit mode', () => {
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        isEditing
        autoFocusField="title"
        onEnterInlineEdit={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Hello')).toHaveFocus();
  });
});
