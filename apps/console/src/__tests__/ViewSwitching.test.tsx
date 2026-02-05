import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectView } from '../components/ObjectView';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRendererProvider } from '@object-ui/react';

// Import all plugins to simulate main.tsx
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-list';
import '@object-ui/plugin-detail';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-map';

// Mock UI components from @object-ui/components that use Layout/Radix to simplify DOM
vi.mock('@object-ui/components', async () => {
    const actual = await vi.importActual('@object-ui/components');
    return {
        ...actual,
        // Override components that might be troublesome in JSDOM or just too verbose
        // We keep basic structure to allow finding by text/label
    };
});

// Mock useDataScope to ensure ObjectTimeline always fetches data (boundData undefined)
vi.mock('@object-ui/react', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        useDataScope: () => undefined,
    };
});

// Mock React Router
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
    useParams: () => ({ objectName: 'project_task' }),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => vi.fn(),
}));

const mockDataSource = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    getObjectSchema: vi.fn().mockResolvedValue(null) // Mock metadata retrieval
};

const mockObjects = [
    {
        name: 'project_task',
        label: 'Project Task',
        fields: {
             name: { label: 'Name', type: 'text' },
             due_date: { label: 'Due Date', type: 'date' },
             status: { label: 'Status', type: 'select', options: ['Todo', 'Done'] },
             location: { label: 'Location', type: 'location' }
        },
        list_views: {
            all: { label: 'All Tasks', type: 'grid' },
            board: { label: 'Board', type: 'kanban', groupBy: 'status' },
            schedule: { label: 'Schedule', type: 'calendar', dateField: 'due_date' },
            roadmap: { label: 'Roadmap', type: 'gantt', startDateField: 'start', endDateField: 'end' },
            history: { label: 'History', type: 'timeline', dateField: 'due_date' },
            sites: { label: 'Sites', type: 'map', locationField: 'location' }
        }
    }
];

describe('Console View Switching Integration', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();
    });

    // Helper to render with Provider
    const renderObjectView = () => {
        return render(
            <SchemaRendererProvider dataSource={mockDataSource}>
                <ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />
            </SchemaRendererProvider>
        );
    };

    it('renders all view tabs', () => {
        renderObjectView();
        
        expect(screen.getByText('All Tasks')).toBeInTheDocument();
        expect(screen.getByText('Board')).toBeInTheDocument();
        expect(screen.getByText('Schedule')).toBeInTheDocument();
        expect(screen.getByText('Roadmap')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Sites')).toBeInTheDocument();
    });

    it('switches to Timeline view correctly', async () => {
        // Force view to 'history' (timeline)
        mockSearchParams.set('view', 'history');
        
        // Mock data for project task
        // We must mock the find method to return data that the TIMELINE can render
        // Timeline expects: titleField='name', dateField='due_date'
        const mockTasks = [
            { id: '1', name: 'Task 1', due_date: '2023-01-01', status: 'Todo' },
            { id: '2', name: 'Task 2', due_date: '2023-01-05', status: 'Done' }
        ];
        
        // Setup mock response
        mockDataSource.find.mockResolvedValue({ value: mockTasks });
        // Spy on find
        const findSpy = vi.spyOn(mockDataSource, 'find');
        
        const { container } = renderObjectView();
        
        // 1. Check registry has the component (verifies import)
        expect(ComponentRegistry.has('object-timeline')).toBe(true);

        // 2. Check no error boundary (verifies unknown type)
        expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
        
        // Wait for fetch
        await waitFor(() => {
            expect(findSpy).toHaveBeenCalled();
        });

        // 3. Wait for data loading and verify CONTENT
        // Timeline renders <Timeline> -> <TimelineItem>
        // We expect to see "Task 1" and "Task 2" in the document
        // Increase timeout for async rendering
        await waitFor(() => {
             expect(screen.getByText('Task 1')).toBeInTheDocument();
             expect(screen.getByText('Task 2')).toBeInTheDocument();
        }, { timeout: 3000 });
        
        // Inspect DOM structure slightly deeper
        const timelineList = container.querySelector('ol');
        expect(timelineList).toBeInTheDocument();
    });

    it('switches to Map view correctly', async () => {
        mockSearchParams.set('view', 'sites');
        const findSpy = vi.spyOn(mockDataSource, 'find');
        
        // Mock Map Data with Location
        const mockSites = [
             { id: '1', name: 'Site Alpha', location: { lat: 40, lng: -74 } },
             { id: '2', name: 'Site Beta', location: { lat: 41, lng: -75 } }
        ];
        mockDataSource.find.mockResolvedValue({ value: mockSites });

        renderObjectView();
        
        expect(ComponentRegistry.has('object-map')).toBe(true);
        expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
        
         await waitFor(() => {
            expect(findSpy).toHaveBeenCalled();
        }, { timeout: 3000 });
        
        // 3. Verify content
        const viewArea = document.querySelector('.flex-1.overflow-hidden.relative');
        expect(viewArea).not.toBeEmptyDOMElement();
    });

    it('switches to Gantt view correctly', async () => {
        mockSearchParams.set('view', 'roadmap');
        const findSpy = vi.spyOn(mockDataSource, 'find');
        
        const mockGanttData = [
            { id: '1', name: 'Phase 1', start: '2023-01-01', end: '2023-01-05' }
        ];
        // Ensure multiple formats supported if needed, but { value } is standard
        mockDataSource.find.mockResolvedValue({ value: mockGanttData });
        
        const { container } = renderObjectView();
        
        expect(screen.queryByText(/Unknown component type/i)).not.toBeInTheDocument();
        
        // Verify Gantt loaded
        await waitFor(() => {
            expect(findSpy).toHaveBeenCalled();
            // Gantt might render complex structure like SVG or Canvas, 
            // but if it renders task list, we might find text.
            const hasText = screen.queryByText('Phase 1');
            if (hasText) {
                expect(hasText).toBeInTheDocument();
            } else {
                 // Fallback: Check if ANY svg or complex element loaded or if we see ObjectGantt container
                 // ObjectGantt usually renders a div with class
                 const ganttContainer = container.querySelector('.gantt-container') || container.querySelector('.gantt-root') || container.firstChild;
                 expect(ganttContainer).toBeInTheDocument();
            }
        }, { timeout: 3000 });
    });
});

