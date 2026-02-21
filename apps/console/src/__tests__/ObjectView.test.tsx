import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const MockTabsContext = React.createContext({ onValueChange: ( _v: any) => {} });
    const actual = await importOriginal<any>();
    return {
        ...actual,
        cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
        Button: ({ children, onClick, title, ...rest }: any) => <button onClick={onClick} title={title} {...rest}>{children}</button>,
        Input: (props: any) => <input {...props} />,
        Switch: ({ checked, onCheckedChange, ...props }: any) => (
            <button
                role="switch"
                aria-checked={checked}
                onClick={() => onCheckedChange?.(!checked)}
                {...props}
            />
        ),
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
        EmptyDescription: ({ children }: any) => <div data-testid="empty-description">{children}</div>,
        // Simple dropdown mocks — render children directly (no Radix portal)
        DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
        DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
        DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
        DropdownMenuItem: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        DropdownMenuSeparator: () => <hr />,
    };
});

// Mock React Router
const mockUseParams = vi.fn();
const mockSetSearchParams = vi.fn();
const mockNavigate = vi.fn();
// Default mock implementation
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
    useParams: () => mockUseParams(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => mockNavigate,
}));

// Mock auth — default to non-admin; tests can override via mockAuthUser
let mockAuthUser: { id: string; name: string; role: string } | null = null;
vi.mock('@object-ui/auth', () => ({
    useAuth: () => ({ user: mockAuthUser }),
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
            listViews: {
                all: { label: 'All Opportunities', type: 'grid', columns: ['name', 'stage'] },
                pipeline: { label: 'Pipeline', type: 'kanban', kanban: { groupField: 'stage' }, columns: ['name'] }
            }
        },
        {
            name: 'todo_task',
            label: 'Task',
            fields: { subject: { label: 'Subject' }, due_date: { label: 'Due' } },
            listViews: {
                all: { label: 'All Tasks', type: 'grid', columns: ['subject'] },
                calendar: { label: 'My Calendar', type: 'calendar', calendar: { startDateField: 'due_date' } }
            }
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams(); // Reset params
        mockAuthUser = null; // Default to non-admin
    });

    it('renders error when object is not found', () => {
        mockUseParams.mockReturnValue({ objectName: 'unknown_object' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        expect(screen.getByText('console.objectView.objectNotFound')).toBeInTheDocument();
    });

    it('renders default grid view for Opportunity', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Check Header (appears in breadcrumb and h1)
        const headers = screen.getAllByText('Opportunity');
        expect(headers.length).toBeGreaterThanOrEqual(1);
        
        // Check Tabs exist (also appears in breadcrumb)
        const allOppTexts = screen.getAllByText('All Opportunities');
        expect(allOppTexts.length).toBeGreaterThanOrEqual(1);
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

    it('shows design tools for admin users without toggle', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Design tools (wrench button) should be visible directly for admin
        expect(screen.getByTitle('console.objectView.designTools')).toBeInTheDocument();
        // No "Enter Design Mode" toggle should exist
        expect(screen.queryByText('console.objectView.enterDesignMode')).not.toBeInTheDocument();
    });

    it('hides design tools for non-admin users', () => {
        mockAuthUser = { id: 'u2', name: 'Viewer', role: 'viewer' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Design tools button should not be visible
        expect(screen.queryByTitle('console.objectView.designTools')).not.toBeInTheDocument();
    });

    it('hides design tools when user is not authenticated', () => {
        mockAuthUser = null;
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        expect(screen.queryByTitle('console.objectView.designTools')).not.toBeInTheDocument();
    });

    it('navigates to view designer with relative path from nested view route', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity', viewId: 'pipeline' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Click the design tools button, then "Add View"
        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);

        const addViewBtn = screen.getByText('console.objectView.addView');
        fireEvent.click(addViewBtn);

        expect(mockNavigate).toHaveBeenCalledWith('../../views/new', { relative: 'path' });
    });

    it('navigates to view designer with relative path from root object route', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);

        const addViewBtn = screen.getByText('console.objectView.addView');
        fireEvent.click(addViewBtn);

        expect(mockNavigate).toHaveBeenCalledWith('views/new', { relative: 'path' });
    });

    it('shows breadcrumb with object and view name', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Breadcrumb should show object label and active view label (may appear in tabs too)
        const allOppTexts = screen.getAllByText('All Opportunities');
        expect(allOppTexts.length).toBeGreaterThanOrEqual(2); // breadcrumb + tab
    });

    it('shows object description when present', () => {
        const objectsWithDesc = [
            {
                ...mockObjects[0],
                description: 'Track sales pipeline and deals',
            },
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDataSource} objects={objectsWithDesc} onEdit={vi.fn()} />);
        
        expect(screen.getByText('Track sales pipeline and deals')).toBeInTheDocument();
    });

    it('toggles ViewConfigPanel when "Edit View" is clicked by admin', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Panel should not be visible initially
        expect(screen.queryByTestId('view-config-panel')).not.toBeInTheDocument();

        // Click design tools > Edit View
        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);

        const editViewBtn = screen.getByText('console.objectView.editView');
        fireEvent.click(editViewBtn);

        // Panel should now be visible
        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();
    });

    it('closes ViewConfigPanel when close button is clicked', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open the panel
        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);
        const editViewBtn = screen.getByText('console.objectView.editView');
        fireEvent.click(editViewBtn);

        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();

        // Close the panel
        const closeBtn = screen.getByTitle('console.objectView.closePanel');
        fireEvent.click(closeBtn);

        expect(screen.queryByTestId('view-config-panel')).not.toBeInTheDocument();
    });

    it('does not show ViewConfigPanel for non-admin users', () => {
        mockAuthUser = { id: 'u2', name: 'Viewer', role: 'viewer' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Design tools are not available for non-admin users
        expect(screen.queryByTestId('view-config-panel')).not.toBeInTheDocument();
    });

    it('shows record count footer when data is available', async () => {
        const mockDsWithTotal = {
            ...mockDataSource,
            find: vi.fn().mockResolvedValue({ data: [], total: 42 }),
        };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });
        
        render(<ObjectView dataSource={mockDsWithTotal} objects={mockObjects} onEdit={vi.fn()} />);
        
        // Wait for the record count to appear
        const footer = await screen.findByTestId('record-count-footer');
        expect(footer).toBeInTheDocument();
    });

    it('calls dataSource.updateViewConfig when saving view config', async () => {
        const mockUpdateViewConfig = vi.fn().mockResolvedValue({});
        const dsWithUpdate = {
            ...mockDataSource,
            updateViewConfig: mockUpdateViewConfig,
        };
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={dsWithUpdate} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));
        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();

        // Wait for draft to be initialized from activeView, then modify
        const titleInput = await screen.findByDisplayValue('All Opportunities');
        fireEvent.change(titleInput, { target: { value: 'My Custom View' } });

        // Save button should appear after dirty state
        const saveBtn = await screen.findByTestId('view-config-save');
        fireEvent.click(saveBtn);

        expect(mockUpdateViewConfig).toHaveBeenCalledOnce();
        expect(mockUpdateViewConfig).toHaveBeenCalledWith(
            'opportunity',
            'all',
            expect.objectContaining({ label: 'My Custom View' }),
        );
    });

    it('logs warning when dataSource.updateViewConfig is not available', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Make a change and save
        const titleInput = await screen.findByDisplayValue('All Opportunities');
        fireEvent.change(titleInput, { target: { value: 'Changed' } });
        const saveBtn = await screen.findByTestId('view-config-save');
        fireEvent.click(saveBtn);

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('updateViewConfig is not available'),
        );
        warnSpy.mockRestore();
    });

    it('logs error when dataSource.updateViewConfig rejects', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const dsWithFailingUpdate = {
            ...mockDataSource,
            updateViewConfig: vi.fn().mockRejectedValue(new Error('Network error')),
        };
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={dsWithFailingUpdate} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Make a change and save
        const titleInput = await screen.findByDisplayValue('All Opportunities');
        fireEvent.change(titleInput, { target: { value: 'Failed' } });
        const saveBtn = await screen.findByTestId('view-config-save');
        fireEvent.click(saveBtn);

        // Wait for the promise rejection to be caught
        await vi.waitFor(() => {
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to persist view config'),
                expect.any(Error),
            );
        });
        errorSpy.mockRestore();
    });
});
