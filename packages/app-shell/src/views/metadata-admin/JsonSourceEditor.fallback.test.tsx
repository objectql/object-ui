/**
 * F5 (objectui#1926): when Monaco can't paint — offline / air-gapped / CSP /
 * blocked web workers — the Source tab must NOT be a blank panel. It falls back
 * to a plain, editable textarea showing the JSON source. We simulate the
 * "Monaco renders nothing" condition by mocking the editor to render null, so
 * no `.view-line` ever appears and the fallback engages.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@monaco-editor/react', () => ({ default: () => null }));

import { JsonSourceEditor } from './JsonSourceEditor';

describe('JsonSourceEditor — F5 textarea fallback', () => {
  it('shows an editable textarea with the JSON source when Monaco does not paint', async () => {
    const draft = { name: 'work_order', fields: { title: { type: 'text' } } };
    render(<JsonSourceEditor value={draft} onChange={() => {}} fallbackDelayMs={20} />);

    const ta = (await screen.findByLabelText(
      'JSON source',
      {},
      { timeout: 2000 },
    )) as HTMLTextAreaElement;

    expect(ta.value).toContain('work_order');
    expect(ta.value).toContain('title');
  });
});
