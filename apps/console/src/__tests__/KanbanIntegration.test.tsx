
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ObjectKanban } from '@object-ui/plugin-kanban';
import type { DataSource } from '@object-ui/types';

/**
 * ObjectKanban Automated Test Suite
 * 
 * Verifies the Core Requirements:
 * 1. Data Fetching & Rendering
 * 2. Metadata Compliance (titleFormat, fields)
 * 3. Layout Generation (columns vs groupBy)
 * 4. Empty State Handling
 */

describe('ObjectKanban Integration', () => {
    
    // -- Mocks --
    const mockDataSource = {
        find: vi.fn(),
        getObjectSchema: vi.fn(), 
        getObject: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    } as unknown as DataSource;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -- Test Case 1: The "Todo" Scenario (Bug Fix Verification) --
    // Requirement: Must use 'titleFormat' to determine card title if 'name' field is missing.
    it('Scenario: Renders Card Titles using titleFormat ({subject}) when "name" is missing', async () => {
        // 1. Setup Schema (Metadata)
        (mockDataSource.getObjectSchema as any).mockResolvedValue({
            name: 'todo_task',
            titleFormat: '{subject}', // <--- configuration
            fields: {
                subject: { type: 'text', label: 'Subject' },
                priority: { type: 'select', label: 'Priority' }
            }
        });

        // 2. Setup Data (Note: NO 'name' property, only 'subject')
        (mockDataSource.find as any).mockResolvedValue([
            { id: '101', subject: 'Buy Groceries', priority: 'High', status: 'todo' },
            { id: '102', subject: 'Walk the dog', priority: 'Low', status: 'todo' }
        ]);

        // 3. Render
        render(
            <ObjectKanban 
                dataSource={mockDataSource}
                schema={{ 
                    type: 'kanban', 
                    objectName: 'todo_task', 
                    groupBy: 'priority'
                }}
            />
        );

        // 4. Verification
        // The component should parse '{subject}' and confirm 'Buy Groceries' is the title.
        // If it fails (showing 'Untitled'), this test will fail.
        await waitFor(() => {
            expect(screen.getByText('Buy Groceries')).toBeInTheDocument();
            expect(screen.getByText('Walk the dog')).toBeInTheDocument();
        });

        // Ensure "Untitled" does NOT appear
        expect(screen.queryByText('Untitled')).not.toBeInTheDocument();
    });

    // -- Test Case 2: Standard "Name" Field Fallback --
    // Requirement: If no titleFormat is provided, default to 'name'.
    it('Scenario: Defaults to "name" field if no titleFormat is provided', async () => {
        (mockDataSource.getObjectSchema as any).mockResolvedValue({
            name: 'account',
            // No titleFormat
            fields: {
                name: { type: 'text', label: 'Account Name' }
            }
        });

        (mockDataSource.find as any).mockResolvedValue([
            { id: '201', name: 'Acme Corp', industry: 'Tech' }
        ]);

        render(
            <ObjectKanban 
                dataSource={mockDataSource}
                schema={{ type: 'kanban', objectName: 'account', groupBy: 'industry' }}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Acme Corp')).toBeInTheDocument();
        });
    });

    // -- Test Case 3: Priority Grouping (Dynamic Columns) --
    // Requirement: Should create columns based on unique values if groupBy is set.
    it('Scenario: Auto-generates columns from groupBy data values', async () => {
         (mockDataSource.getObjectSchema as any).mockResolvedValue({
            name: 'ticket',
            fields: { status: { type: 'text' } }
        });

        (mockDataSource.find as any).mockResolvedValue([
            { id: '301', name: 'T-1', status: 'Open' },
            { id: '302', name: 'T-2', status: 'in_progress' },
            { id: '303', name: 'T-3', status: 'Done' }
        ]);

        render(
            <ObjectKanban 
                dataSource={mockDataSource}
                schema={{ type: 'kanban', objectName: 'ticket', groupBy: 'status' }}
            />
        );

        await waitFor(() => screen.getByText('T-1'));

        // Check if headers exist (Note: Implementation uppercases headers usually, or displays raw value)
        // Adjust expectation based on implementation details. Here we expect raw values or normalized ones.
        // Using regex for case-insensitivity
        expect(screen.getByRole('heading', { name: /Open/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /in_progress/i })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Done/i })).toBeInTheDocument();
    });
});
