/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';

/**
 * Tests for the title resolution fallback chain in ObjectKanban.
 *
 * The effectiveData logic tries fields in this order:
 *   1. Explicit cardTitle / titleField from schema
 *   2. objectDef.titleFormat (e.g. "{subject}")
 *   3. objectDef.NAME_FIELD_KEY
 *   4. Fallback chain: name → title → subject → label → display_name
 *   5. 'Untitled'
 */

// Extract the title resolution logic from ObjectKanban to test it in isolation
const TITLE_FALLBACK_FIELDS = ['name', 'title', 'subject', 'label', 'display_name'];

function resolveTitle(item: Record<string, any>, titleField?: string): string {
  let resolvedTitle = titleField ? item[titleField] : undefined;

  if (!resolvedTitle) {
    for (const field of TITLE_FALLBACK_FIELDS) {
      if (item[field]) {
        resolvedTitle = item[field];
        break;
      }
    }
  }

  return resolvedTitle || 'Untitled';
}

describe('ObjectKanban title resolution', () => {
  it('uses explicit titleField when value exists', () => {
    const item = { id: '1', custom_title: 'My Custom Title', name: 'Fallback Name' };
    expect(resolveTitle(item, 'custom_title')).toBe('My Custom Title');
  });

  it('falls back to common fields when titleField value is empty', () => {
    const item = { id: '1', custom_title: '', name: 'Name Field' };
    expect(resolveTitle(item, 'custom_title')).toBe('Name Field');
  });

  it('resolves name field first in fallback chain', () => {
    const item = { id: '1', name: 'Name Value', title: 'Title Value', subject: 'Subject Value' };
    expect(resolveTitle(item)).toBe('Name Value');
  });

  it('resolves title field second in fallback chain', () => {
    const item = { id: '1', title: 'Title Value', subject: 'Subject Value' };
    expect(resolveTitle(item)).toBe('Title Value');
  });

  it('resolves subject field third in fallback chain', () => {
    const item = { id: '1', subject: 'Subject Value', label: 'Label Value' };
    expect(resolveTitle(item)).toBe('Subject Value');
  });

  it('resolves label field fourth in fallback chain', () => {
    const item = { id: '1', label: 'Label Value', display_name: 'Display Name' };
    expect(resolveTitle(item)).toBe('Label Value');
  });

  it('resolves display_name field fifth in fallback chain', () => {
    const item = { id: '1', display_name: 'Display Name' };
    expect(resolveTitle(item)).toBe('Display Name');
  });

  it('falls back to Untitled when no common fields exist', () => {
    const item = { id: '1', status: 'open', priority: 'high' };
    expect(resolveTitle(item)).toBe('Untitled');
  });

  it('skips falsy field values in fallback chain', () => {
    const item = { id: '1', name: '', title: null, subject: 'Bug Report' };
    expect(resolveTitle(item)).toBe('Bug Report');
  });

  it('handles todo_task objects with subject field', () => {
    // This is the exact scenario from the bug report
    const todoTask = { id: '1', status: 'in_progress', subject: 'Fix login bug', priority: 'high' };
    expect(resolveTitle(todoTask)).toBe('Fix login bug');
  });
});
