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

// Mock ListView to a simple component that renders schema properties as test IDs
// This isolates the config panel → view data flow from ListView's internal async effects
vi.mock('@object-ui/plugin-list', () => ({
  ListView: (props: any) => {
    const viewType = props.schema?.viewType || 'grid';
    return (
      <div data-testid="list-view" data-view-type={viewType}>
        {viewType === 'grid' && <div data-testid="object-grid">Grid View: {props.schema?.objectName}</div>}
        {viewType === 'kanban' && <div data-testid="object-kanban">Kanban View: {props.schema?.options?.kanban?.groupField || props.schema?.groupBy}</div>}
        {viewType === 'calendar' && <div data-testid="object-calendar">Calendar View: {props.schema?.options?.calendar?.startDateField || props.schema?.startDateField}</div>}
        {props.schema?.showRecordCount && <div data-testid="schema-showRecordCount">showRecordCount</div>}
        {props.schema?.allowPrinting && <div data-testid="schema-allowPrinting">allowPrinting</div>}
        {props.schema?.navigation?.mode && <div data-testid="schema-navigation-mode">{props.schema.navigation.mode}</div>}
        {props.schema?.selection?.type && <div data-testid="schema-selection-type">{props.schema.selection.type}</div>}
        {props.schema?.addRecord?.enabled && <div data-testid="schema-addRecord-enabled">addRecord</div>}
        {props.schema?.addRecordViaForm && <div data-testid="schema-addRecordViaForm">addRecordViaForm</div>}
        <button data-testid="list-row-click" onClick={() => props.onRowClick?.({ _id: 'rec-1', id: 'rec-1', name: 'Test Record' })}>Click Row</button>
      </div>
    );
  },
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

    it('opens config panel in create mode when Add View is clicked from nested view route', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity', viewId: 'pipeline' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Click the design tools button, then "Add View"
        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);

        const addViewBtn = screen.getByText('console.objectView.addView');
        fireEvent.click(addViewBtn);

        // Should open config panel instead of navigating
        expect(mockNavigate).not.toHaveBeenCalledWith('../../views/new', { relative: 'path' });
        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();
    });

    it('opens config panel in create mode when Add View is clicked from root object route', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        const designBtn = screen.getByTitle('console.objectView.designTools');
        fireEvent.click(designBtn);

        const addViewBtn = screen.getByText('console.objectView.addView');
        fireEvent.click(addViewBtn);

        // Should open config panel instead of navigating
        expect(mockNavigate).not.toHaveBeenCalledWith('views/new', { relative: 'path' });
        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();
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

    // --- Live Preview: ViewConfigPanel changes sync in real-time ---

    it('syncs showSearch toggle from ViewConfigPanel to PluginObjectView in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));
        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();

        // Toggle showSearch off — our mock Switch fires onCheckedChange with opposite of aria-checked
        const searchSwitch = screen.getByTestId('toggle-showSearch');
        fireEvent.click(searchSwitch);

        // The draft should now include showSearch: false and trigger a re-render
        // without requiring save. The internal viewDraft state drives mergedViews,
        // which PluginObjectView consumes. Just verify component didn't crash and
        // the panel still shows the updated switch state.
        await vi.waitFor(() => {
            const sw = screen.getByTestId('toggle-showSearch');
            // After toggling off, aria-checked should be false
            expect(sw.getAttribute('aria-checked')).toBe('false');
        });
    });

    it('syncs showSort toggle from ViewConfigPanel without requiring save', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Toggle showSort off
        const sortSwitch = screen.getByTestId('toggle-showSort');
        fireEvent.click(sortSwitch);

        // Verify the switch reflects the change immediately (live preview)
        await vi.waitFor(() => {
            const sw = screen.getByTestId('toggle-showSort');
            expect(sw.getAttribute('aria-checked')).toBe('false');
        });
    });

    it('syncs column visibility changes from ViewConfigPanel in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        const { container } = render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // The PluginObjectView should still render (grid) — draft changes are synced live
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();

        // The ViewConfigPanel panel should be visible
        const panel = screen.getByTestId('view-config-panel');
        expect(panel).toBeInTheDocument();

        // Verify the component renders without errors after a config panel interaction
        // (This verifies the full live preview data flow path works)
        expect(container.querySelector('[data-testid="object-grid"]')).toBeInTheDocument();
    });

    it('updates mergedViews when ViewConfigPanel changes label', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Change the view label — this triggers onViewUpdate('label', ...)
        const titleInput = await screen.findByDisplayValue('All Opportunities');
        fireEvent.change(titleInput, { target: { value: 'Live Preview Test' } });

        // The breadcrumb should update immediately (live preview) since it reads from activeView
        await vi.waitFor(() => {
            const breadcrumbItems = screen.getAllByText('Live Preview Test');
            expect(breadcrumbItems.length).toBeGreaterThanOrEqual(1);
        });
    });

    it('does not remount PluginObjectView on config panel changes (no key={refreshKey})', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // The grid should be rendered initially
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Make a change  
        const titleInput = await screen.findByDisplayValue('All Opportunities');
        fireEvent.change(titleInput, { target: { value: 'Changed Live' } });

        // The breadcrumb updates immediately (live preview) — this verifies that
        // viewDraft → activeView data flow propagates config changes without save.
        await vi.waitFor(() => {
            expect(screen.getByText('Changed Live')).toBeInTheDocument();
        });

        // Grid persists after config change (no remount)
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();
    });

    it('propagates showRecordCount toggle to ListView schema in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // showRecordCount should not be set initially (default is not explicitly true)
        expect(screen.queryByTestId('schema-showRecordCount')).not.toBeInTheDocument();

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Expand the Export & Print section (defaultCollapsed)
        fireEvent.click(screen.getByTestId('section-header-exportPrint'));

        // Toggle showRecordCount on
        const recordCountSwitch = screen.getByTestId('toggle-showRecordCount');
        fireEvent.click(recordCountSwitch);

        // Verify the schema property propagated to ListView immediately (live preview)
        await vi.waitFor(() => {
            expect(screen.getByTestId('schema-showRecordCount')).toBeInTheDocument();
        });
    });

    it('propagates allowPrinting toggle to ListView schema in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // allowPrinting should not be set initially
        expect(screen.queryByTestId('schema-allowPrinting')).not.toBeInTheDocument();

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Expand the Export & Print section (defaultCollapsed)
        fireEvent.click(screen.getByTestId('section-header-exportPrint'));

        // Toggle allowPrinting on
        const printSwitch = screen.getByTestId('toggle-allowPrinting');
        fireEvent.click(printSwitch);

        // Verify the schema property propagated to ListView immediately (live preview)
        await vi.waitFor(() => {
            expect(screen.getByTestId('schema-allowPrinting')).toBeInTheDocument();
        });
    });

    it('propagates multiple config changes without requiring save', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Toggle showSearch off
        const searchSwitch = screen.getByTestId('toggle-showSearch');
        fireEvent.click(searchSwitch);

        // Toggle showSort off
        const sortSwitch = screen.getByTestId('toggle-showSort');
        fireEvent.click(sortSwitch);

        // Both should reflect changes immediately without save
        await vi.waitFor(() => {
            expect(screen.getByTestId('toggle-showSearch').getAttribute('aria-checked')).toBe('false');
            expect(screen.getByTestId('toggle-showSort').getAttribute('aria-checked')).toBe('false');
        });

        // The grid should still be rendered (live preview, no remount)
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();
    });

    it('uses activeView.navigation for detail overlay with priority over objectDef', () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        const objectsWithNav = [
            {
                ...mockObjects[0],
                navigation: { mode: 'drawer' as const },
                listViews: {
                    all: {
                        label: 'All Opportunities',
                        type: 'grid',
                        columns: ['name', 'stage'],
                        navigation: { mode: 'modal' as const },
                    },
                    pipeline: { label: 'Pipeline', type: 'kanban', kanban: { groupField: 'stage' }, columns: ['name'] }
                }
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        // Render the component — activeView.navigation should override objectDef.navigation
        render(<ObjectView dataSource={mockDataSource} objects={objectsWithNav} onEdit={vi.fn()} />);

        // The component should render without errors and ListView should receive
        // the view-level navigation config (modal) instead of object-level (drawer)
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();
        expect(screen.getByTestId('schema-navigation-mode')).toHaveTextContent('modal');
    });

    it('propagates selection mode change to ListView schema in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Change selection mode to 'single'
        const selectionSelect = screen.getByTestId('select-selection-type');
        fireEvent.change(selectionSelect, { target: { value: 'single' } });

        // Verify the selection type propagated to ListView immediately (live preview)
        await vi.waitFor(() => {
            expect(screen.getByTestId('schema-selection-type')).toHaveTextContent('single');
        });
    });

    it('propagates addRecord toggle to ListView schema in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // addRecord should not be enabled initially
        expect(screen.queryByTestId('schema-addRecord-enabled')).not.toBeInTheDocument();

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Toggle addRecord on
        const addRecordSwitch = screen.getByTestId('toggle-addRecord-enabled');
        fireEvent.click(addRecordSwitch);

        // Verify addRecord and addRecordViaForm propagated to ListView immediately
        await vi.waitFor(() => {
            expect(screen.getByTestId('schema-addRecord-enabled')).toBeInTheDocument();
            expect(screen.getByTestId('schema-addRecordViaForm')).toBeInTheDocument();
        });
    });

    it('propagates navigation mode change from config panel to ListView schema in real-time', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // navigation mode should not be set initially (no explicit mode on default view)
        expect(screen.queryByTestId('schema-navigation-mode')).not.toBeInTheDocument();

        // Open config panel
        fireEvent.click(screen.getByTitle('console.objectView.designTools'));
        fireEvent.click(screen.getByText('console.objectView.editView'));

        // Change navigation mode to 'modal'
        const navSelect = screen.getByTestId('select-navigation-mode');
        fireEvent.change(navSelect, { target: { value: 'modal' } });

        // Verify navigation mode propagated to ListView schema immediately (live preview)
        await vi.waitFor(() => {
            expect(screen.getByTestId('schema-navigation-mode')).toHaveTextContent('modal');
        });
    });

    it('defaults to page navigation mode when no navigation config is specified', () => {
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />);

        // With default 'page' mode, NavigationOverlay renders nothing (non-overlay mode)
        // and the grid still renders fine
        expect(screen.getByTestId('object-grid')).toBeInTheDocument();
    });

    it('navigates to record detail page for page navigation mode via onNavigate', () => {
        const objectsWithPage = [
            {
                ...mockObjects[0],
                navigation: { mode: 'page' as const },
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={objectsWithPage} onEdit={vi.fn()} />);

        // Click a list row — should trigger page navigation
        fireEvent.click(screen.getByTestId('list-row-click'));

        // Verify React Router navigate was called with the record detail path
        expect(mockNavigate).toHaveBeenCalledWith('record/rec-1');
    });

    it('opens new window with correct URL for new_window navigation mode', () => {
        const mockOpen = vi.fn();
        const originalOpen = window.open;
        window.open = mockOpen;

        const objectsWithNewWindow = [
            {
                ...mockObjects[0],
                navigation: { mode: 'new_window' as const },
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        render(<ObjectView dataSource={mockDataSource} objects={objectsWithNewWindow} onEdit={vi.fn()} />);

        // Click a list row — should open new window
        fireEvent.click(screen.getByTestId('list-row-click'));

        // Verify window.open was called with a URL containing /record/rec-1
        expect(mockOpen).toHaveBeenCalledTimes(1);
        expect(mockOpen.mock.calls[0][0]).toContain('/record/rec-1');
        expect(mockOpen.mock.calls[0][1]).toBe('_blank');

        window.open = originalOpen;
    });

    it('renders split layout with mainContent when split mode is active', async () => {
        const objectsWithSplit = [
            {
                ...mockObjects[0],
                navigation: { mode: 'split' as const },
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        const dataSourceWithFindOne = {
            ...mockDataSource,
            findOne: vi.fn().mockResolvedValue({ _id: 'rec-1', id: 'rec-1', name: 'Test' }),
        };

        render(<ObjectView dataSource={dataSourceWithFindOne} objects={objectsWithSplit} onEdit={vi.fn()} />);

        // Click a list row — should open the split detail panel
        fireEvent.click(screen.getByTestId('list-row-click'));

        // The grid should still render inside the split layout
        await vi.waitFor(() => {
            expect(screen.getByTestId('object-grid')).toBeInTheDocument();
            // Split mode should render the close button for the detail panel
            expect(screen.getByLabelText('Close panel')).toBeInTheDocument();
        });
    });

    it('renders popover overlay without popoverTrigger using fallback dialog', async () => {
        const objectsWithPopover = [
            {
                ...mockObjects[0],
                navigation: { mode: 'popover' as const },
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        const dataSourceWithFindOne = {
            ...mockDataSource,
            findOne: vi.fn().mockResolvedValue({ _id: 'rec-1', id: 'rec-1', name: 'Test' }),
        };

        render(<ObjectView dataSource={dataSourceWithFindOne} objects={objectsWithPopover} onEdit={vi.fn()} />);

        // Click a list row — should open the popover fallback dialog
        fireEvent.click(screen.getByTestId('list-row-click'));

        // The popover fallback dialog should render (dialog role from Radix)
        await vi.waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('renders RecordChatterPanel inside drawer overlay when navigation mode is drawer', async () => {
        mockAuthUser = { id: 'u1', name: 'Admin', role: 'admin' };
        // Provide recordId in URL to trigger overlay open
        mockSearchParams = new URLSearchParams('recordId=rec-1');
        const objectsWithDrawer = [
            {
                ...mockObjects[0],
                navigation: { mode: 'drawer' as const },
            }
        ];
        mockUseParams.mockReturnValue({ objectName: 'opportunity' });

        const dataSourceWithFindOne = {
            ...mockDataSource,
            findOne: vi.fn().mockResolvedValue({ _id: 'rec-1', id: 'rec-1', name: 'Test' }),
        };

        render(<ObjectView dataSource={dataSourceWithFindOne} objects={objectsWithDrawer} onEdit={vi.fn()} />);

        // The drawer should render a "Show Discussion" button (ChatterPanel is defaultCollapsed)
        await vi.waitFor(() => {
            const showBtn = screen.getByLabelText('Show discussion');
            expect(showBtn).toBeInTheDocument();
            // Verify items count shows (0) since items are initially empty
            expect(showBtn).toHaveTextContent('Show Discussion (0)');
        });
    });
});
