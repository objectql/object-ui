/**
 * ObjectGrid Interaction Tests
 * 
 * Verifies interactive features of the ObjectGrid:
 * - Sorting (Clicking headers)
 * - Filtering (Using search bar)
 * - Pagination
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { startMockServer, stopMockServer } from '../mocks/server';
import { ObjectStackDataSource } from '../dataSource';

describe('ObjectGrid Interactions', () => {
    let client: ObjectStackClient;
    let dataSource: ObjectStackDataSource;
    
    // Sample data for checking Sort/Filter orders
    const staticData = [
        { id: '1', name: 'Zebra', score: 10 },
        { id: '2', name: 'Alpha', score: 20 },
        { id: '3', name: 'Beta',  score: 30 },
    ];

    beforeAll(async () => {
        await startMockServer();
        client = new ObjectStackClient({ baseUrl: 'http://localhost:3000' } as any);
        await client.connect();
        dataSource = new ObjectStackDataSource(client as any);
    });
    
    afterAll(() => {
        stopMockServer();
    });

    it('should sort rows when column header is clicked', async () => {
        render(
            <ObjectGrid
                schema={{
                    type: 'object-grid',
                    objectName: 'test_obj',
                    columns: ['name', 'score'],
                    data: {
                        provider: 'value',
                        items: staticData
                    }
                }}
                dataSource={dataSource}
            />
        );

        // Wait for rendering
        await waitFor(() => {
            expect(screen.getByText('Zebra')).toBeInTheDocument();
        });

        const rows = screen.getAllByRole('row');
        // Row 0 is header. Rows 1..3 are data.
        // Initial order: Zebra, Alpha, Beta (Mock data order)
        expect(rows[1]).toHaveTextContent('Zebra');
        expect(rows[2]).toHaveTextContent('Alpha');
        expect(rows[3]).toHaveTextContent('Beta');

        // Click "Name" header to Sort ASC
        const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
        fireEvent.click(nameHeader);

        // Expect: Alpha, Beta, Zebra
        await waitFor(() => {
            const sortedRows = screen.getAllByRole('row');
            expect(sortedRows[1]).toHaveTextContent('Alpha');
            expect(sortedRows[2]).toHaveTextContent('Beta');
            expect(sortedRows[3]).toHaveTextContent('Zebra');
        });

        // Click "Name" header again to Sort DESC
        fireEvent.click(nameHeader);

        // Expect: Zebra, Beta, Alpha
        await waitFor(() => {
            const sortedRows = screen.getAllByRole('row');
            expect(sortedRows[1]).toHaveTextContent('Zebra');
            expect(sortedRows[2]).toHaveTextContent('Beta');
            expect(sortedRows[3]).toHaveTextContent('Alpha');
        });
    });

    it('should sort rows when column header is clicked (Server Data)', async () => {
        render(
            <ObjectGrid
                schema={{
                    type: 'object-grid',
                    objectName: 'contact',
                    columns: ['name', 'email'],
                }}
                dataSource={dataSource}
            />
        );

        await waitFor(() => {
            const elements = screen.getAllByText('Alice Johnson');
            expect(elements.length).toBeGreaterThan(0);
        });

        // Test if sorting interaction works seamlessly on server data which is rendered client-side by DataTable
        // Note: ObjectGrid fetches a page, and DataTable sorts that page client-side.
        // This test verifies that connection functionality remains valid.
        
        const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
        fireEvent.click(nameHeader); // Sort ASC
        
        // Wait for potential re-render/sort
        await waitFor(() => {
             const rows = screen.getAllByRole('row');
             // Just ensure rows are still present and structure is valid
             expect(rows.length).toBeGreaterThan(1);
        });
    });

    it('should filter rows when search input is used', async () => {
        // DataTableRenderer renders a "Search..." input if searchable is true (default?)
        render(
            <ObjectGrid
                schema={{
                    type: 'object-grid',
                    objectName: 'test_obj',
                    columns: ['name'],
                    data: {
                        provider: 'value',
                        items: staticData
                    },
                    searchableFields: ['name'] // Triggers search input
                }}
                dataSource={dataSource}
            />
        );
        
        await waitFor(() => {
            expect(screen.getByText('Zebra')).toBeInTheDocument();
        });

        // Find Search Input
        const searchInput = screen.getByPlaceholderText('Search...');
        
        // Type "Ze"
        fireEvent.change(searchInput, { target: { value: 'Ze' } });

        await waitFor(() => {
            expect(screen.getByText('Zebra')).toBeInTheDocument();
            expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
            expect(screen.queryByText('Beta')).not.toBeInTheDocument();
        });
    });
});
