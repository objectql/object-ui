import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ObjectForm } from '@object-ui/plugin-form';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { SchemaRendererProvider } from '@object-ui/react';

// Create a mock DataSource that returns the expected data directly
// This bypasses the network layer (and MSW/Undici issues in test env)
// but fully verifies the Component <-> DataSource contract.
const mockDataSource = {
    getObjectSchema: async (name: string) => {
        if (name === 'contact') {
             return {
                name: "contact",
                fields: {
                    name: { type: "text", label: "Name" },
                    email: { type: "email", label: "Email" },
                    phone: { type: "text", label: "Phone" },
                    status: { type: "select", options: ["Active"] }
                }
             };
        }
        return null;
    },
    find: async (resource: string) => {
        if (resource === 'contact') {
            return {
                data: [
                    { id: '1', name: 'Alice Johnson', email: 'alice@example.com' },
                    { id: '2', name: 'Bob Smith', email: 'bob@example.com' }
                ],
                total: 2,
                page: 1
            };
        }
        return { data: [] };
    },
    // Implement other required methods with no-op
    findOne: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => true,
    bulk: async () => []
};

describe('CRM App Verification', () => {
    
    it('should render ObjectForm fields based on API metadata', async () => {
        // Render Form alone
        render(
            <SchemaRendererProvider dataSource={{}}>
                <ObjectForm 
                    schema={{ 
                        type: 'object-form', 
                        objectName: 'contact', 
                        mode: 'create' 
                    }} 
                    dataSource={mockDataSource as any} 
                />
            </SchemaRendererProvider>
        );
        
        // Wait for metadata fields to appear
        await waitFor(() => {
             expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
             expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        });
    });

    it('should render ObjectGrid headers and data from API', async () => {
        render(
            <SchemaRendererProvider dataSource={{}}>
                <ObjectGrid 
                    schema={{ 
                        type: 'object-grid', 
                        objectName: 'contact',
                        columns: ['name', 'email', 'status']
                    }} 
                    dataSource={mockDataSource as any} 
                />
            </SchemaRendererProvider>
        );

        // Grid usually shows headers
        await waitFor(() => {
            expect(screen.getByText("Name")).toBeInTheDocument(); 
            expect(screen.getByText("Email")).toBeInTheDocument();
        });

        // Grid should load data
        await waitFor(() => {
            expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        });
    });
});
