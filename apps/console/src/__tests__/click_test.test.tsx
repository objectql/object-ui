/**
 * Quick diagnostic test: verify clicking primary-field-link navigates to detail
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ObjectManagerPage } from '../pages/system/ObjectManagerPage';

vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    objects: [
      {
        name: 'account',
        label: 'Accounts',
        fields: [
          { name: 'id', type: 'text', label: 'ID', readonly: true },
          { name: 'name', type: 'text', label: 'Account Name' },
        ],
      },
    ],
    refresh: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

describe('click-to-navigate diagnostic', () => {
  it('should show primary-field-link buttons after data loads', async () => {
    render(
      <MemoryRouter initialEntries={['/system/objects']}>
        <Routes>
          <Route path="/system/objects" element={<><ObjectManagerPage /><LocationDisplay /></>} />
          <Route path="/system/objects/:objectName" element={<><ObjectManagerPage /><LocationDisplay /></>} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for ObjectGrid async data to load
    let links: HTMLElement[] = [];
    await waitFor(() => {
      links = screen.queryAllByTestId('primary-field-link');
      expect(links.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    console.log('Found primary-field-link buttons:', links.length);
    console.log('Current location:', screen.getByTestId('location-display').textContent);
    
    // Click the first primary field link
    await act(async () => {
      fireEvent.click(links[0]);
    });

    console.log('After click location:', screen.getByTestId('location-display').textContent);
    
    // Should navigate to detail view
    await waitFor(() => {
      const loc = screen.getByTestId('location-display').textContent;
      console.log('Final location:', loc);
      expect(loc).toBe('/system/objects/account');
    }, { timeout: 5000 });
  });
});
