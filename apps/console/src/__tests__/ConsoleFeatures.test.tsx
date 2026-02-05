import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectView } from '../components/ObjectView';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock child plugins to focus on ObjectView logic
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: (props: any) => <div data-testid="object-grid">Grid View: {props.schema.objectName} (Filter: {JSON.stringify(props.schema.filter)})</div>
}));

vi.mock('@object-ui/plugin-kanban', () => ({
  ObjectKanban: () => <div data-testid="object-kanban">Kanban View</div>
}));

vi.mock('@object-ui/plugin-calendar', () => ({
  ObjectCalendar: () => <div data-testid="object-calendar">Calendar View</div>
}));

vi.mock('@object-ui/plugin-list', () => ({
  ListView: (props: any) => (
    <div data-testid="list-view">
      ListView for {props.schema.objectName}
      <button onClick={() => console.log('Filter clicked')}>Filter</button>
    </div>
  )
}));

// Mock UI Components
vi.mock('@object-ui/components', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        Button: ({ children, onClick, className }: any) => (
            <button onClick={onClick} className={className} data-testid="ui-button">
                {children}
            </button>
        ),
        Empty: ({ children }: any) => <div>{children}</div>,
        EmptyTitle: ({ children }: any) => <div>{children}</div>,
        EmptyDescription: ({ children }: any) => <div>{children}</div>,
        Sheet: ({ children }: any) => <div>{children}</div>,
        SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
        SheetHeader: ({ children }: any) => <div>{children}</div>,
        SheetTitle: ({ children }: any) => <div>{children}</div>,
    };
});

// Mock Icons
vi.mock('lucide-react', () => ({
    Plus: () => <span>+</span>,
    Calendar: () => <span>Cal</span>,
    Kanban: () => <span>Kan</span>,
    Table: () => <span>Tab</span>,
    AlignLeft: () => <span>Gantt</span>,
    Filter: () => <span>FilterIcon</span>,
    X: () => <span>X</span>
}));

describe('ObjectView Console Features', () => {
    
    const mockObjects = [
        {
            name: 'todo_task',
            label: 'Todo Task',
            fields: { name: { type: 'text' }, status: { type: 'select' } },
            list_views: {
                all: { label: 'All Tasks', type: 'grid' }
            }
        }
    ];

    const mockDataSource = {
        find: vi.fn(),
        findOne: vi.fn(),
        create: vi.fn(),
        update: vi.fn(), 
        delete: vi.fn()
    };
    
    const renderObjectView = (objectName = 'todo_task') => {
        return render(
            <MemoryRouter initialEntries={[`/${objectName}`]}>
                <Routes>
                    <Route path="/:objectName" element={
                        <ObjectView 
                            dataSource={mockDataSource} 
                            objects={mockObjects} 
                            onEdit={vi.fn()} 
                        />
                    } />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders ListView', () => {
        renderObjectView();
        
        expect(screen.getByText('Todo Task')).toBeInTheDocument();
        // Verify ListView is rendered instead of direct Filter button
        expect(screen.getByTestId('list-view')).toBeInTheDocument();
        expect(screen.getByText('ListView for todo_task')).toBeInTheDocument();
    });

    // Removed Filter button test as functionality moved to ListView plugin
});
