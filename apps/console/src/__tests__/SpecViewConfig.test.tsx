import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectView } from '../components/ObjectView';
import { ComponentRegistry } from '@object-ui/core';

/**
 * Spec View Config Tests
 *
 * These tests verify that console ObjectView strictly reads view-specific
 * properties from nested config (e.g., viewDef.calendar.startDateField)
 * per @objectstack/spec protocol, and does NOT fall back to flat properties
 * (e.g., viewDef.startDateField).
 */

// Mock child plugins to capture schema props

vi.mock('@object-ui/plugin-grid', () => ({
    ObjectGrid: (_props: any) => <div data-testid="object-grid">Grid</div>,
}));

vi.mock('@object-ui/plugin-kanban', () => ({
    ObjectKanban: (props: any) => {
        return <div data-testid="object-kanban">Kanban: {props.schema.groupField}</div>;
    },
}));

vi.mock('@object-ui/plugin-calendar', () => ({
    ObjectCalendar: (props: any) => {
        return <div data-testid="object-calendar">Calendar: {props.schema.startDateField}</div>;
    },
}));

vi.mock('@object-ui/components', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
        Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
        Empty: ({ children }: any) => <div data-testid="empty">{children}</div>,
        EmptyTitle: ({ children }: any) => <div>{children}</div>,
        EmptyDescription: ({ children }: any) => <div>{children}</div>,
    };
});

const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams();
const mockUseParams = vi.fn();

vi.mock('react-router-dom', () => ({
    useParams: () => mockUseParams(),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => vi.fn(),
}));

describe('Spec Protocol: Nested View Config Enforcement', () => {
    const mockDataSource = {
        find: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();

        ComponentRegistry.register('object-grid', (_props: any) => <div data-testid="object-grid">Grid</div>);
        ComponentRegistry.register('object-kanban', (props: any) => {
            return <div data-testid="object-kanban">Kanban: {props.schema.groupField}</div>;
        });
        ComponentRegistry.register('object-calendar', (props: any) => {
            return <div data-testid="object-calendar">Calendar: {props.schema.startDateField}</div>;
        });
        ComponentRegistry.register('list-view', (_props: any) => <div data-testid="list-view">List View</div>);
    });

    it('reads kanban groupField from nested viewDef.kanban, not flat viewDef.groupBy', () => {
        mockUseParams.mockReturnValue({ objectName: 'deal' });
        mockSearchParams.set('view', 'pipeline');

        const objects = [{
            name: 'deal',
            label: 'Deal',
            fields: { name: { label: 'Name' }, stage: { label: 'Stage' } },
            listViews: {
                all: { label: 'All', type: 'grid' },
                pipeline: {
                    label: 'Pipeline',
                    type: 'kanban',
                    kanban: { groupField: 'stage' },
                },
            },
        }];

        render(<ObjectView dataSource={mockDataSource} objects={objects} onEdit={vi.fn()} />);

        expect(screen.getByTestId('object-kanban')).toBeInTheDocument();
        expect(screen.getByText('Kanban: stage')).toBeInTheDocument();
    });

    it('does NOT read flat groupBy property — falls back to default', () => {
        mockUseParams.mockReturnValue({ objectName: 'deal' });
        mockSearchParams.set('view', 'pipeline');

        // Legacy flat config — should NOT be picked up
        const objects = [{
            name: 'deal',
            label: 'Deal',
            fields: { name: { label: 'Name' }, stage: { label: 'Stage' } },
            listViews: {
                all: { label: 'All', type: 'grid' },
                pipeline: {
                    label: 'Pipeline',
                    type: 'kanban',
                    groupBy: 'stage', // ❌ flat — should be ignored
                },
            },
        }];

        render(<ObjectView dataSource={mockDataSource} objects={objects} onEdit={vi.fn()} />);

        // Should fall back to default 'status', not pick up flat 'stage'
        expect(screen.getByText('Kanban: status')).toBeInTheDocument();
    });

    it('reads calendar startDateField from nested viewDef.calendar', () => {
        mockUseParams.mockReturnValue({ objectName: 'event' });
        mockSearchParams.set('view', 'cal');

        const objects = [{
            name: 'event',
            label: 'Event',
            fields: { subject: { label: 'Subject' }, start: { label: 'Start' } },
            listViews: {
                all: { label: 'All', type: 'grid' },
                cal: {
                    label: 'Calendar',
                    type: 'calendar',
                    calendar: { startDateField: 'start', titleField: 'subject' },
                },
            },
        }];

        render(<ObjectView dataSource={mockDataSource} objects={objects} onEdit={vi.fn()} />);

        expect(screen.getByText('Calendar: start')).toBeInTheDocument();
    });

    it('does NOT read flat dateField for calendar — falls back to default', () => {
        mockUseParams.mockReturnValue({ objectName: 'event' });
        mockSearchParams.set('view', 'cal');

        // Legacy flat config
        const objects = [{
            name: 'event',
            label: 'Event',
            fields: { subject: { label: 'Subject' }, start: { label: 'Start' } },
            listViews: {
                all: { label: 'All', type: 'grid' },
                cal: {
                    label: 'Calendar',
                    type: 'calendar',
                    dateField: 'start', // ❌ flat — should be ignored
                },
            },
        }];

        render(<ObjectView dataSource={mockDataSource} objects={objects} onEdit={vi.fn()} />);

        // Should fall back to default 'due_date', not pick up flat 'start'
        expect(screen.getByText('Calendar: due_date')).toBeInTheDocument();
    });
});
