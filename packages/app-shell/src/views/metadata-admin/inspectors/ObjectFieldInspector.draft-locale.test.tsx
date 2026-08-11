// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

// A draft object AND a published one, so the assertions can tell the two
// label shapes apart. The sibling test file stubs both surfaces empty; this
// one needs a draft to exist at all.
vi.mock('../useMetadata', () => ({
  useMetadataClient: () => ({
    list: vi.fn().mockResolvedValue([{ name: 'crm_account', label: 'Account' }]),
    listDrafts: vi.fn().mockResolvedValue([{ name: 'crm_quote' }]),
  }),
}));

vi.mock('../previews/useObjectFields', () => ({
  useObjectFields: () => ({ fields: [], loading: false, error: null }),
}));

import { ObjectFieldInspector } from './ObjectFieldInspector';
// The inspector's `locale` prop is the closed `'en-US' | 'zh-CN'` union, not a
// bare string — the loop below iterates exactly those two, so annotating the
// helper keeps the array's element type from widening back to `string`.
import type { SupportedLocale } from '../i18n';

afterEach(cleanup);

/** The lookup branch is the only one that renders the object picker. */
function renderLookup(locale: SupportedLocale) {
  return render(
    <ObjectFieldInspector
      type="object"
      name="account"
      draft={{ name: 'account', fields: { owner: { type: 'lookup', label: 'Owner' } } }}
      selection={{ kind: 'field', id: 'owner' }}
      onPatch={vi.fn()}
      onClearSelection={vi.fn()}
      onSelectionChange={vi.fn()}
      readOnly={false}
      locale={locale}
    />,
  );
}

async function draftOptionLabel(container: HTMLElement): Promise<string> {
  const opt = await waitFor(() => {
    const found = [...container.querySelectorAll('option')].find(
      (o) => o.getAttribute('value') === 'crm_quote',
    );
    expect(found).toBeTruthy();
    return found!;
  });
  return opt.textContent ?? '';
}

const CJK = /[一-鿿]/;

describe('ObjectFieldInspector — draft-object suffix is localized', () => {
  it('renders no CJK in the draft label under an English locale', async () => {
    const { container } = renderLookup('en-US');
    const label = await draftOptionLabel(container);

    expect(label).toBe('crm_quote (draft)');
    // The regression this pins: the suffix used to be a bare `(草稿)`
    // literal, so an English user saw `crm_quote (草稿)`.
    expect(label).not.toMatch(CJK);
  });

  it('still renders the Chinese suffix under a zh locale', async () => {
    const { container } = renderLookup('zh-CN');
    expect(await draftOptionLabel(container)).toBe('crm_quote (草稿)');
  });

  it('leaves published objects unsuffixed in both locales', async () => {
    for (const locale of ['en-US', 'zh-CN'] as const) {
      const { container, unmount } = renderLookup(locale);
      const opt = await waitFor(() => {
        const found = [...container.querySelectorAll('option')].find(
          (o) => o.getAttribute('value') === 'crm_account',
        );
        expect(found).toBeTruthy();
        return found!;
      });
      expect(opt.textContent).toBe('Account (crm_account)');
      unmount();
    }
  });
});
