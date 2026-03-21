/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
let mockViewId = 'calendar';

vi.mock('react-router-dom', () => ({
    useParams: () => ({ objectName: 'todo_task', viewId: mockViewId }),
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useNavigate: () => vi.fn(),
}));

// Use dates in current month so events show on the visible calendar
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');

const records = [
    { id: 't1', name: 'Set up CI/CD pipeline', due_date: `${year}-${month}-16T09:00:00`, status: 'todo' },
    { id: 't2', name: 'Design dashboard', due_date: `${year}-${month}-18T10:00:00`, status: 'in_progress' },
    { id: 't3', name: 'Fix mobile responsive', due_date: `${year}-${month}-20T14:00:00`, status: 'done' },
];

let mockDataSource: any;

const mockObjects = [
    {
        name: 'todo_task',
        label: 'Task',
        fields: {
            name: { label: 'Name', type: 'text' },
            due_date: { label: 'Due Date', type: 'datetime' },
            status: {
                label: 'Status', type: 'select',
                options: [
                    { value: 'todo', label: 'To Do' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'done', label: 'Done' },
                ],
            },
        },
        listViews: {
            all: {
                name: 'all',
                label: 'All Tasks',
                type: 'grid',
                columns: ['name', 'due_date', 'status'],
            },
            calendar: {
                name: 'calendar',
                label: 'Calendar',
                type: 'calendar',
                columns: ['name', 'due_date', 'status'],
                calendar: {
                    startDateField: 'due_date',
                    titleField: 'name',
                },
            },
            board: {
                name: 'board',
                label: 'Board',
                type: 'kanban',
                columns: ['name', 'due_date', 'status'],
                kanban: {
                    groupField: 'status',
                    titleField: 'name',
                },
            },
        },
    },
];

describe('Duplicate Data Prevention', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchParams = new URLSearchParams();
        mockDataSource = {
            find: vi.fn().mockResolvedValue(records),
            findOne: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({}),
            update: vi.fn().mockResolvedValue({}),
            delete: vi.fn().mockResolvedValue(true),
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'todo_task',
                label: 'Task',
                fields: mockObjects[0].fields,
            }),
        };
    });

    describe('Calendar view', () => {
        beforeEach(() => {
            mockViewId = 'calendar';
        });

        it('should not show duplicate events in calendar view', async () => {
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

            // Wait for events to appear
            await waitFor(() => {
                expect(screen.getByText('Set up CI/CD pipeline')).toBeInTheDocument();
            }, { timeout: 5000 });

            // Each event should appear exactly ONCE (no duplicates)
            expect(screen.getAllByText('Set up CI/CD pipeline')).toHaveLength(1);
            expect(screen.getAllByText('Design dashboard')).toHaveLength(1);
            expect(screen.getAllByText('Fix mobile responsive')).toHaveLength(1);
        });

        it('should not show duplicate events with wrapped response format', async () => {
            // Test with ObjectStack response format: { data: [...], total, page, pageSize }
            mockDataSource.find.mockResolvedValue({
                data: records,
                total: records.length,
                page: 1,
                pageSize: 100,
                hasMore: false,
            });

            render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />
                </SchemaRendererProvider>
            );

            await waitFor(() => {
                expect(screen.getByText('Set up CI/CD pipeline')).toBeInTheDocument();
            }, { timeout: 5000 });

            expect(screen.getAllByText('Set up CI/CD pipeline')).toHaveLength(1);
            expect(screen.getAllByText('Design dashboard')).toHaveLength(1);
        });
    });

    describe('Kanban view', () => {
        beforeEach(() => {
            mockViewId = 'board';
        });

        it('should not show duplicate cards in kanban view', async () => {
            render(
                <SchemaRendererProvider dataSource={mockDataSource}>
                    <ObjectView dataSource={mockDataSource} objects={mockObjects} onEdit={vi.fn()} />
                </SchemaRendererProvider>
            );

            // Wait for kanban cards to render
            await waitFor(() => {
                expect(screen.getByText('Set up CI/CD pipeline')).toBeInTheDocument();
            }, { timeout: 5000 });

            // Each card should appear exactly ONCE (no duplicates)
            expect(screen.getAllByText('Set up CI/CD pipeline')).toHaveLength(1);
            expect(screen.getAllByText('Design dashboard')).toHaveLength(1);
            expect(screen.getAllByText('Fix mobile responsive')).toHaveLength(1);
        });
    });
});
