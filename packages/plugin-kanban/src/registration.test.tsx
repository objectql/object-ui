import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ObjectKanbanRenderer } from './index';

// Partial mock — override ONLY what this test controls, keep every other real
// export. Same conversion `plugin-calendar/src/registration.test.tsx` already
// carries, for the same reason (objectui#3219): a whole-module replacement that
// listed just `useSchemaContext` + `SchemaRendererContext` made this file
// sensitive to which exports the renderer happens to use, so `ObjectKanbanRenderer`
// consuming one more of them (`ElementDataSourceGate`, objectstack#6953) failed
// the suite with `No "ElementDataSourceGate" export is defined on the mock`
// rather than telling us anything about the registration this file tests.
vi.mock(import('@object-ui/react'), async (importOriginal) => ({
  ...(await importOriginal()),
  // Only the piece this test drives:
  useSchemaContext: vi.fn(() => ({ dataSource: { type: 'mock-datasource' } })),
}));

// Mock the implementation
vi.mock('./ObjectKanban', () => ({
  ObjectKanban: ({ dataSource }: any) => (
    <div data-testid="kanban-mock">
        {dataSource ? `DataSource: ${dataSource.type}` : 'No DataSource'}
    </div>
  )
}));

describe('Plugin Kanban Registration', () => {
  it('renderer passes dataSource from context', () => {
    
    render(<ObjectKanbanRenderer schema={{ type: 'object-kanban' }} />);
    expect(screen.getByTestId('kanban-mock')).toHaveTextContent('DataSource: mock-datasource');
  });
});
