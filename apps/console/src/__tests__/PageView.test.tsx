
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PageView } from '../components/PageView';

// Mock MetadataProvider to return static page metadata
vi.mock('../context/MetadataProvider', () => ({
  useMetadata: () => ({
    apps: [],
    objects: [],
    dashboards: [],
    reports: [],
    pages: [
      {
        name: 'help_page',
        type: 'app', 
        label: 'Help Guide',
        regions: [
            {
                name: 'main',
                components: [
                    { type: 'text', value: 'Content for Help Page' }
                ]
            }
        ]
      },
      {
        name: 'standard_page',
        type: 'page',
        children: [
            { type: 'text', value: 'Standard Page Content' }
        ]
      }
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

// Mock SchemaRenderer to avoid complex component tree rendering
// We just want to ensure PageView passes the correct schema to it
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: { schema: any }) => (
    <div data-testid="schema-renderer">
      Rendered {schema.type}: {schema.name || 'unnamed'}
      {/* Render simple children for text check */}
      {schema.regions?.[0]?.components?.[0]?.value}
      {schema.children?.[0]?.value}
    </div>
  )
}));

describe('PageView Integration', () => {
  it('should render a page with type="app"', () => {
    render(
      <MemoryRouter initialEntries={['/page/help_page']}>
        <Routes>
          <Route path="/page/:pageName" element={<PageView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('schema-renderer')).toHaveTextContent('Rendered app: help_page');
    expect(screen.getByText(/Content for Help Page/)).toBeInTheDocument();
  });

  it('should render a page with type="page"', () => {
    render(
      <MemoryRouter initialEntries={['/page/standard_page']}>
        <Routes>
          <Route path="/page/:pageName" element={<PageView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('schema-renderer')).toHaveTextContent('Rendered page: standard_page');
    expect(screen.getByText(/Standard Page Content/)).toBeInTheDocument();
  });

  it('should show 404 for unknown pages', () => {
    render(
      <MemoryRouter initialEntries={['/page/unknown_page']}>
        <Routes>
          <Route path="/page/:pageName" element={<PageView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
