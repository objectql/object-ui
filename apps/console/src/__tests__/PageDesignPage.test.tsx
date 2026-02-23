/**
 * PageDesignPage Tests
 *
 * Tests the Page Design route integration (/design/page/:pageName)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PageDesignPage } from '../pages/PageDesignPage';

// Mock MetadataProvider
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [
      {
        name: 'test-page',
        type: 'page',
        title: 'Test Page',
        children: [
          { type: 'grid', id: 'grid-1', title: 'Orders Grid' },
        ],
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock AdapterProvider
const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn().mockResolvedValue({}) }));
vi.mock('../context/AdapterProvider', () => ({
  useAdapter: () => ({
    update: mockUpdate,
    create: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock plugin-designer to avoid complex component tree
vi.mock('@object-ui/plugin-designer', () => ({
  PageCanvasEditor: ({ schema, onChange, readOnly }: any) => (
    <div data-testid="page-canvas-editor">
      <span>PageCanvasEditor: {schema.title || schema.name}</span>
      <button data-testid="trigger-change" onClick={() => onChange({ ...schema, title: 'Updated' })}>
        Change
      </button>
      {readOnly && <span>read-only</span>}
    </div>
  ),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const renderWithRouter = (pageName: string) =>
  render(
    <MemoryRouter initialEntries={[`/design/page/${pageName}`]}>
      <Routes>
        <Route path="/design/page/:pageName" element={<PageDesignPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('PageDesignPage', () => {
  it('should render the page canvas editor for a known page', () => {
    renderWithRouter('test-page');

    expect(screen.getByTestId('page-design-page')).toBeInTheDocument();
    expect(screen.getByText(/Edit Page/)).toBeInTheDocument();
    expect(screen.getByTestId('page-canvas-editor')).toBeInTheDocument();
  });

  it('should show 404 for unknown page', () => {
    renderWithRouter('unknown-page');

    expect(screen.getByText(/Page.*not found/i)).toBeInTheDocument();
  });

  it('should render back button', () => {
    renderWithRouter('test-page');

    expect(screen.getByTestId('page-design-back')).toBeInTheDocument();
  });

  it('should pass schema to the editor', () => {
    renderWithRouter('test-page');

    expect(screen.getByText(/PageCanvasEditor: Test Page/)).toBeInTheDocument();
  });

  it('should call onChange when editor triggers a change', () => {
    renderWithRouter('test-page');

    fireEvent.click(screen.getByTestId('trigger-change'));
    // After change, editor should reflect updated schema
    expect(screen.getByText(/PageCanvasEditor: Updated/)).toBeInTheDocument();
  });

  it('should save via Ctrl+S keyboard shortcut', async () => {
    renderWithRouter('test-page');

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    });

    // Should call dataSource.update with the page schema
    expect(mockUpdate).toHaveBeenCalledWith('sys_page', 'test-page', expect.objectContaining({ type: 'page' }));
  });
});
