import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectView } from '../components/ObjectView';
import { ComponentRegistry } from '@object-ui/core';

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

vi.mock('@object-ui/components', async (importOriginal) => {
    const React = await import('react');
    const MockTabsContext = React.createContext({ onValueChange: (v: any) => {} });
    const actual = await importOriginal<any>();
    return {
        ...actual,
        cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
        Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        Input: (props: any) => <input {...props} data-testid="mock-input" />,
        ToggleGroup: ({ children, value, onValueChange }: any) => <div data-value={value} onChange={onValueChange}>{children}</div>,
        ToggleGroupItem: ({ children, value }: any) => <button data-value={value}>{children}</button>,
        Tabs: ({ value, onValueChange, children }: any) => (
            <MockTabsContext.Provider value={{ onValueChange }}>
                <div data-testid="tabs" data-value={value}>
                    {children}
                </div>
            </MockTabsContext.Provider>
        ),
        TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
        TabsTrigger: ({ value, children }: any) => {
            const { onValueChange } = React.useContext(MockTabsContext);
            return (
                <button 
                    data-testid="tabs-trigger" 
                    data-tab-value={value} 
                    onClick={() => onValueChange(value)}
                >
                    {children}
                </button>
            );
        },
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
    useNavigate: () => vi.fn(),
}));

describe('ObjectView Component', () => {
    
    beforeEach(() => {
        // Register mock components for SchemaRenderer to find
        ComponentRegistry.register('object-grid', (props: any) => <div data-testid="object-grid">Grid View: {props.schema.objectName}</div>);
        ComponentRegistry.register('object-kanban', (props: any) => <div data-testid="object-kanban">Kanban View: {props.schema.groupField}</div>);
        ComponentRegistry.register('object-calendar', (props: any) => <div data-testid="object-calendar">Calendar View: {props.schema.startDateField}</div>);
        ComponentRegistry.register('list-view', (_props: any) => <div data-testid="list-view">List View</div>); 
    });

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

    it.skip('fires search param update when tab is clicked', () => {
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
