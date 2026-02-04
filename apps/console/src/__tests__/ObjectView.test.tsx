import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectView } from '../components/ObjectView';

// Mock child plugins to isolate ObjectView logic
vi.mock('@object-ui/plugin-grid', () => ({
  ObjectGrid: (props: any) => <div data-testid="object-grid">Grid View: {props.schema.objectName}</div>
}));

vi.mock('@object-ui/plugin-kanban', () => ({
  ObjectKanban: (props: any) => <div data-testid="object-kanban">Kanban View: {props.schema.groupBy}</div>
}));

vi.mock('@object-ui/plugin-calendar', () => ({
  ObjectCalendar: (props: any) => <div data-testid="object-calendar">Calendar View: {props.schema.dateField}</div>
}));

// Mock UI Components to allow interaction testing without Radix complexity
vi.mock('@object-ui/components', async () => {
    return {
        Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        Tabs: ({ value, onValueChange, children }: any) => (
            <div data-testid="tabs" data-value={value} onClick={(e: any) => {
                 // Simple event delegation for testing
                 const trigger = (e.target as HTMLElement).closest('[data-tab-value]');
                 if(trigger) {
                    const newValue = trigger.getAttribute('data-tab-value');
                    if (newValue) onValueChange(newValue);
                 }
            }}>
                {children}
            </div>
        ),
        TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
        TabsTrigger: ({ value, children }: any) => (
            <button data-testid="tabs-trigger" data-tab-value={value}>
                {children}
            </button>
        ),
        Empty: ({ children }: any) => <div data-testid="empty">{children}</div>,
        EmptyTitle: ({ children }: any) => <div data-testid="empty-title">{children}</div>,
        EmptyDescription: ({ children }: any) => <div data-testid="empty-description">{children}</div>
    };
});

// Mock React Router
const mockUseParams = vi.fn();
const mockSetSearchParams = vi.fn();
// Default mock implementation
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
    useParams: () => mockUseParams(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

describe('ObjectView Component', () => {
    
    const mockDataSource = {
        find: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true)
    };

    const mockObjects = [
        {
            name: 'opportunity',
            label: 'Opportunity',
            fields: { 
                name: { label: 'Name' }, 
                stage: { label: 'Stage' } 
            },
            list_views: {
                all: { label: 'All Opportunities', type: 'grid', columns: ['name', 'stage'] },
                pipeline: { label: 'Pipeline', type: 'kanban', groupBy: 'stage', columns: ['name'] }
            }
        },
        {
            name: 'todo_task',
            label: 'Task',
            fields: { subject: { label: 'Subject' }, due_date: { label: 'Due' } },
            list_views: {
                all: { label: 'All Tasks', type: 'grid', columns: ['subject'] },
                calendar: { label: 'My Calendar', type: 'calendar', dateField: 'due_date' }
            }
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams(); // Reset params
    });

    it('renders error when object is not found', () => {
        mockUseParams.mockReturnValue({ objectName: 'unknown_object' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        expect(screen.getByText('Object Not Found')).toBeInTheDocument();
    });

    it('renders default grid view for Opportunity', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Check Header
        expect(screen.getByText('Opportunity')).toBeInTheDocument();
        
        // Check Tabs exist
        expect(screen.getByText('All Opportunities')).toBeInTheDocument();
        expect(screen.getByText('Pipeline')).toBeInTheDocument();

        // Check Grid is rendered (default)
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();
        expect(screen.getByText('Grid View: opportunity')).toBeInTheDocument();
        expect(screen.queryByTestId('object-kanban')).not.toBeInTheDocument();
    });

    it('switches to Kanban view when tab is active', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        // Simulate "view=pipeline" in URL
        mockSearchParams.set('view', 'pipeline');
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Grid should be gone, Kanban should be present
        expect(screen.queryByTestId('object-grid')).not.toBeInTheDocument();
        expect(screen.getByTestId('object-kanban')).toBeInTheDocument();
        expect(screen.getByText('Kanban View: stage')).toBeInTheDocument();
    });

    it('fires search param update when tab is clicked', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Find and click the Pipeline tab
        const pipelineTab = screen.getByText('Pipeline');
        fireEvent.click(pipelineTab);
        
        // Should call setSearchParams with new view
        expect(mockSetSearchParams).toHaveBeenCalledWith({ view: 'pipeline' });
    });

    it('renders Calendar view correctly', () => {
        mockUseParams.mockReturnValue({ objectName: 'todo_task' });
        mockSearchParams.set('view', 'calendar');

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        expect(screen.getByTestId('object-calendar')).toBeInTheDocument();
        expect(screen.getByText('Calendar View: due_date')).toBeInTheDocument();
    });
});
