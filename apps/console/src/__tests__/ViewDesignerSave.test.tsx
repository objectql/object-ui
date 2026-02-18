/**
 * ViewDesignerPage Save Persistence Tests
 *
 * Tests that ViewDesignerPage persists view config via dataSource API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mockCreate = vi.fn().mockResolvedValue({ id: 'v-1' });
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: mockCreate,
    update: mockUpdate,
    delete: vi.fn(),
    findOne: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock ViewDesigner to expose the onSave callback
let capturedOnSave: ((config: any) => void) | null = null;
vi.mock('@object-ui/plugin-designer', () => ({
  ViewDesigner: (props: any) => {
    capturedOnSave = props.onSave;
    return <div data-testid="view-designer">ViewDesigner Mock</div>;
  },
}));

import { ViewDesignerPage } from '../components/ViewDesignerPage';

const mockObjects = [
  {
    name: 'contact',
    label: 'Contact',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnSave = null;
});

describe('ViewDesignerPage', () => {
  it('should render ViewDesigner for a valid object', () => {
    render(
      <MemoryRouter initialEntries={['/contact/views/new']}>
        <Routes>
          <Route path=":objectName/views/:viewId" element={<ViewDesignerPage objects={mockObjects} />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('view-designer')).toBeInTheDocument();
  });

  it('should call dataSource.create on save for new view', async () => {
    render(
      <MemoryRouter initialEntries={['/contact/views/new']}>
        <Routes>
          <Route path=":objectName/views/:viewId" element={<ViewDesignerPage objects={mockObjects} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(capturedOnSave).toBeTruthy();
    // Simulate save
    capturedOnSave!({ viewLabel: 'All Contacts', viewType: 'grid', columns: [] });

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('sys_view', expect.objectContaining({ viewLabel: 'All Contacts' }));
    });
  });
});
