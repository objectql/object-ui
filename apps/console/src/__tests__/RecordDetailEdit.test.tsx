/**
 * RecordDetailView — Edit recordId stripping tests
 *
 * Validates that when editing from the detail page, the objectName prefix
 * is stripped from the URL-based recordId before passing to the onEdit callback.
 *
 * Related: objectstack-ai/objectui — "Record not found" bug
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecordDetailView } from '../components/RecordDetailView';
import type { DataSource } from '@object-ui/types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

function createMockDataSource(): DataSource {
  return {
    async getObjectSchema() {
      return {
        name: 'contact',
        label: 'Contact',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
          email: { name: 'email', label: 'Email', type: 'email' },
        },
      };
    },
    findOne: vi.fn().mockResolvedValue({ id: '1772350253615-4', name: 'Alice' }),
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(true),
  } as any;
}

const mockObjects = [
  {
    name: 'contact',
    label: 'Contact',
    fields: {
      name: { name: 'name', label: 'Name', type: 'text' },
      email: { name: 'email', label: 'Email', type: 'email' },
    },
  },
];

function renderDetailView(
  urlRecordId: string,
  objectName: string,
  onEdit: (record: any) => void,
  ds?: DataSource,
) {
  const dataSource = ds ?? createMockDataSource();
  return render(
    <MemoryRouter initialEntries={[`/${objectName}/record/${urlRecordId}`]}>
      <Routes>
        <Route
          path="/:objectName/record/:recordId"
          element={
            <RecordDetailView
              dataSource={dataSource}
              objects={mockObjects}
              onEdit={onEdit}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RecordDetailView — onEdit recordId stripping', () => {
  it('strips objectName prefix from recordId when editing', async () => {
    const onEdit = vi.fn();

    renderDetailView('contact-1772350253615-4', 'contact', onEdit);

    // Wait for the detail view to load
    await waitFor(() => {
      expect(screen.getByText('Contact')).toBeInTheDocument();
    });

    // Click the Edit button
    const editButton = await screen.findByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    // The onEdit callback should receive the STRIPPED recordId (no objectName prefix)
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1772350253615-4',
        _id: '1772350253615-4',
      }),
    );
  });

  it('passes recordId as-is when no objectName prefix', async () => {
    const onEdit = vi.fn();

    renderDetailView('plain-id-12345', 'contact', onEdit);

    await waitFor(() => {
      expect(screen.getByText('Contact')).toBeInTheDocument();
    });

    const editButton = await screen.findByRole('button', { name: /edit/i });
    await userEvent.click(editButton);

    // No prefix to strip — should pass the original recordId unchanged
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'plain-id-12345',
        _id: 'plain-id-12345',
      }),
    );
  });
});
