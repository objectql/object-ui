import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectCalendar } from '@object-ui/plugin-calendar';
import { ObjectKanban } from '@object-ui/plugin-kanban';

// Mock KanbanImpl to avoid dnd-kit issues in test environment
vi.mock('@object-ui/plugin-kanban', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as any),
        // Overwrite the lazy loaded component (if exposed) or mock the whole module logic related to it
        // Since ObjectKanban uses KanbanRenderer which lazy loads KanbanImpl, 
        // we essentially need to mock KanbanRenderer or ensure KanbanImpl is mockable.
        // But KanbanImpl is NOT exported by the package main entry point usually.
        // So we mock the KanbanRenderer component directly which is simpler.
        KanbanRenderer: ({ schema }: any) => {
            // Replicate the mapping logic approximately for visual test
            const { columns = [], data, groupBy } = schema;
             // If we have flat data and a grouping key, distribute items into columns
            let displayColumns = columns;
            if (data && groupBy && Array.isArray(data)) {
                 const groups = data.reduce((acc: any, item: any) => {
                    const key = item[groupBy];
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(item);
                    return acc;
                  }, {});
                  displayColumns = columns.map((col: any) => ({
                    ...col,
                    cards: [
                       ...(col.cards || []),
                       ...(groups[col.id] || [])
                    ]
                  }));
            }
        
            return (
                <div data-testid="kanban-impl">
                    {displayColumns.map((col: any) => (
                        <div key={col.id} data-testid={`column-${col.id}`}>
                            <h3>{col.title}</h3>
                            <div data-testid={`cards-${col.id}`}>
                                {col.cards.map((card: any) => (
                                    <div key={card.id}>{card.title || card.name}</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
    };
});

describe('Plugins Integration Test', () => {
    
    // Mock DataSource
    const mockSchema = {
        name: 'todo_task',
        fields: {
            status: {
                type: 'select',
                options: [
                    { label: 'Not Started', value: 'new' },
                    { label: 'In Progress', value: 'working' },
                    { label: 'Done', value: 'done' }
                ]
            }
        }
    };

    const mockData = [
        { id: '1', name: 'Task 1', status: 'new', due_date: '2026-02-15T12:00:00' },
        { id: '2', name: 'Task 2', status: 'working', due_date: '2026-02-16T12:00:00' },
        { id: '3', name: 'Task 3', status: 'done', due_date: '2026-02-17T12:00:00' }
    ];

    const mockDataSource = {
        find: vi.fn().mockResolvedValue(mockData),
        getObject: vi.fn().mockResolvedValue(mockSchema),
        getObjectSchema: vi.fn().mockResolvedValue(mockSchema)
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ObjectCalendar', () => {
        it('renders events using flat schema properties (ObjectView style)', async () => {
            render(
                <ObjectCalendar 
                    schema={{
                        type: 'calendar',
                        objectName: 'todo_task',
                        dateField: 'due_date',
                        titleField: 'name'
                    } as any}
                    dataSource={mockDataSource as any}
                />
            );

            // Expect mockData items to be rendered text
            // ObjectCalendar renders events. If generic implementation works, we should see 'Task 1'
            await waitFor(() => {
                expect(screen.getByText('Task 1')).toBeInTheDocument();
            }, { timeout: 5000 });
            expect(screen.getByText('Task 2')).toBeInTheDocument();
        });

        it('does not re-fetch data on stable schema re-renders', async () => {
            const schema = {
                type: 'calendar',
                objectName: 'todo_task',
                dateField: 'due_date',
                titleField: 'name'
            };

            const { rerender } = render(
                <ObjectCalendar 
                    schema={schema as any}
                    dataSource={mockDataSource as any}
                />
            );

            // Wait for initial fetch
            await waitFor(() => {
                expect(mockDataSource.find).toHaveBeenCalledTimes(1);
            }, { timeout: 5000 });

            // Re-render with a NEW schema object but IDENTICAL content
            // This tests if useMemo/useEffect are correctly handling deep equality or specific property dependencies
            // instead of just object reference equality.
            rerender(
                <ObjectCalendar 
                    schema={{ ...schema } as any}
                    dataSource={mockDataSource as any}
                />
            );

            // Wait a bit to ensure no extra calls happen immediately
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should still only have called find once
            expect(mockDataSource.find).toHaveBeenCalledTimes(1);
        });
    });

    describe('ObjectKanban', () => {
        it('automatically generates columns from picklist metadata', async () => {
            render(
                <ObjectKanban
                    schema={{
                        type: 'kanban',
                        objectName: 'todo_task',
                        groupBy: 'status'
                    } as any}
                    dataSource={mockDataSource as any}
                />
            );

            // Wait for schema fetch and rendering
            await waitFor(() => {
                expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('todo_task');
            }, { timeout: 5000 });

            // Expect columns to be generated from schema options
            await waitFor(() => {
                expect(screen.getByText('Not Started')).toBeInTheDocument();
            }, { timeout: 5000 });
            expect(screen.getByText('In Progress')).toBeInTheDocument();
            expect(screen.getByText('Done')).toBeInTheDocument();

            // Expect cards to be distributed
            expect(screen.getByText('Task 1')).toBeInTheDocument(); // in 'new' column
        });
    });
});
