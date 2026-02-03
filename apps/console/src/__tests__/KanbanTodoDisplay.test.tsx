
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ObjectKanban } from '@object-ui/plugin-kanban';

// We perform Integration Testing on the REAL component to verify display.
// We do not mock KanbanImpl, so we test the full stack including DndContext.

describe('ObjectKanban Todo Example Display', () => {
    
    // Mock Data Source
    const mockDataSource = {
        find: vi.fn(),
        getObjectSchema: vi.fn(), 
        getObject: vi.fn() // Fallback if old code still exists
    };

    const todoSchema = {
        name: 'todo_task',
        titleFormat: '{subject}', // Added titleFormat
        fields: {
            priority: {
                type: 'rating',
                max: 3,
                label: 'Priority'
            },
            status: {
                type: 'select',
                options: [
                    { label: 'New', value: 'new' },
                    { label: 'Done', value: 'done' }
                ]
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockDataSource.getObjectSchema.mockResolvedValue(todoSchema);
    });

    it('Scenario 1: Priority Grouping with Data (Dynamic Columns 1, 2, 3)', async () => {
        const mockData = [
            { id: '1', subject: 'Task A', priority: 1 },
            { id: '2', subject: 'Task B', priority: 2 },
            { id: '4', subject: 'Task D', priority: 3 }
        ];
        mockDataSource.find.mockResolvedValue(mockData);

        render(
            <ObjectKanban 
                schema={{ 
                    type: 'kanban', 
                    objectName: 'todo_task', 
                    groupBy: 'priority'
                    // removed explicit cardTitle to test auto-detection
                } as any}
                dataSource={mockDataSource as any}
            />
        );

        // Wait for data to appear
        await waitFor(() => expect(screen.getByText('Task A')).toBeInTheDocument());

        // Verify Column Headers (H3 in real component)
        // We expect columns named "1", "2", "3"
        expect(screen.getByRole('heading', { name: '1' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '2' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: '3' })).toBeInTheDocument();
    });

    it('Scenario 2: Priority Grouping WITHOUT Data (Empty Board)', async () => {
        mockDataSource.find.mockResolvedValue([]);

        const { container } = render(
            <ObjectKanban 
                schema={{ type: 'kanban', objectName: 'todo_task', groupBy: 'priority' } as any}
                dataSource={mockDataSource as any}
            />
        );

        await waitFor(() => expect(mockDataSource.find).toHaveBeenCalled());

        // Should NOT find any generated numerical headings
        expect(screen.queryByRole('heading', { name: '1' })).toBeNull();
        
        // Use container query to ensure nothing substantial rendered
        // The real component renders a wrapper div. 
        // We check that NO columns exist.
        // Assuming .flex-shrink-0 matches the column wrapper style inside KanbanImpl
        const columns = container.querySelectorAll('.flex-shrink-0');
        expect(columns.length).toBe(0);
    });

    it('Scenario 3: Status Grouping (Select Field) WITHOUT Data (Shows Options)', async () => {
        mockDataSource.find.mockResolvedValue([]);

        render(
            <ObjectKanban 
                schema={{ type: 'kanban', objectName: 'todo_task', groupBy: 'status' } as any}
                dataSource={mockDataSource as any}
            />
        );

        // Wait for metadata options to render
        await waitFor(() => expect(screen.getByRole('heading', { name: /New/i })).toBeInTheDocument());
        expect(screen.getByRole('heading', { name: /Done/i })).toBeInTheDocument();
    });

    it('Scenario 4: Explicit Columns Override (Fix for Empty Data)', async () => {
        mockDataSource.find.mockResolvedValue([]);

        render(
            <ObjectKanban 
                schema={{
                    type: 'kanban',
                    objectName: 'todo_task',
                    groupBy: 'priority',
                    // User manually defines the columns (Lanes) they want
                    columns: [
                        { id: '1', title: 'High (1)' },
                        { id: '2', title: 'Medium (2)' },
                        { id: '3', title: 'Low (3)' }
                    ]
                } as any}
                dataSource={mockDataSource as any}
            />
        );

        await waitFor(() => expect(screen.getByRole('heading', { name: 'High (1)' })).toBeInTheDocument());

        // We should see the 3 explicit columns
        expect(screen.getByRole('heading', { name: 'Medium (2)' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Low (3)' })).toBeInTheDocument();
    });
});
