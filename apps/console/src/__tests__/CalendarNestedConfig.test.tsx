import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectView } from '../components/ObjectView';
import { SchemaRendererProvider } from '@object-ui/react';
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-list';

vi.mock('@object-ui/components', async () => {
    const actual = await vi.importActual('@object-ui/components');
    return { ...actual };
});

vi.mock('@object-ui/react', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        useDataScope: () => undefined,
    };
});

const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', () => ({
    useParams: () => ({ objectName: 'event', viewId: 'calendar' }),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => vi.fn(),
}));

// Use dates in current month so events show on the visible calendar (month view shows all days 1-31)
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');

const mockDataSource = {
    find: vi.fn().mockResolvedValue([
        { _id: 'e1', subject: 'Weekly Standup', start: `${year}-${month}-05T09:00:00`, end: `${year}-${month}-05T10:00:00`, type: 'Meeting' },
        { _id: 'e2', subject: 'Client Call', start: `${year}-${month}-06T14:00:00`, end: `${year}-${month}-06T15:00:00`, type: 'Call' }
    ]),
    findOne: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    getObjectSchema: vi.fn().mockResolvedValue({
        name: 'event',
        label: 'Event',
        fields: {
            subject: { label: 'Subject', type: 'text' },
            start: { label: 'Start', type: 'datetime' },
            end: { label: 'End', type: 'datetime' },
            type: { label: 'Type', type: 'select' },
        }
    })
};

// CRM-style nested calendar config (same structure as objectstack.config.ts)
const mockObjects = [
    {
        name: 'event',
        label: 'Event',
        fields: {
            subject: { label: 'Subject', type: 'text' },
            start: { label: 'Start', type: 'datetime' },
            end: { label: 'End', type: 'datetime' },
            type: { label: 'Type', type: 'select' },
        },
        listViews: {
            all_events: {
                name: 'all_events',
                label: 'All Events',
                type: 'grid',
                columns: ['subject', 'start', 'end', 'type'],
            },
            calendar: {
                name: 'calendar',
                label: 'Calendar',
                type: 'calendar',
                columns: ['subject', 'start', 'end', 'type'],
                calendar: {
                    startDateField: 'start',
                    endDateField: 'end',
                    titleField: 'subject',
                },
            },
        },
    },
];

describe('CRM Calendar View with Nested Config', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();
    });

    it('renders calendar view with events using nested calendar config', async () => {
        render(
            <SchemaRendererProvider dataSource={mockDataSource}>
                <ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />
            </SchemaRendererProvider>
        );

        // Calendar region should render
        await waitFor(() => {
            const calendarRegion = document.querySelector('[aria-label="Calendar"]');
            expect(calendarRegion).toBeInTheDocument();
        }, { timeout: 5000 });

        // Event titles should display correctly using titleField: 'subject'
        await waitFor(() => {
            expect(screen.getByText('Weekly Standup')).toBeInTheDocument();
        }, { timeout: 5000 });
    });

    it('does not show "Untitled" events when nested calendar config provides titleField', async () => {
        render(
            <SchemaRendererProvider dataSource={mockDataSource}>
                <ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />
            </SchemaRendererProvider>
        );

        // Wait for calendar region to render and data to load
        await waitFor(() => {
            const calendarRegion = document.querySelector('[aria-label="Calendar"]');
            expect(calendarRegion).toBeInTheDocument();
        }, { timeout: 5000 });

        // Should NOT show "Untitled" - that would mean titleField defaulted to 'name'
        expect(screen.queryByText('Untitled')).not.toBeInTheDocument();
    });
});
