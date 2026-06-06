import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ObjectForm } from './ObjectForm';
import { registerAllFields } from '@object-ui/fields';
import React from 'react';

// Ensure fields are registered
registerAllFields();

describe('ObjectForm Integration', () => {
    const objectSchema = {
        name: 'test_object',
        fields: {
            name: {
                type: 'text',
                label: 'Name'
            },
            price: {
                type: 'currency',
                label: 'Price',
                scale: 2
            }
        }
    };

    const mockDataSource: any = {
        getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
        createRecord: vi.fn(),
        updateRecord: vi.fn(),
        getRecord: vi.fn(),
        query: vi.fn()
    };

    it('renders fields using specialized components', async () => {
        render(
            <ObjectForm 
                schema={{
                    type: 'object-form',
                    objectName: 'test_object',
                    mode: 'create'
                }}
                dataSource={mockDataSource}
            />
        );

        // Wait for schema to load (useEffect)
        await waitFor(() => {
            expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('test_object');
        });

        // Check if labels are present
        await waitFor(() => {
            expect(screen.queryByText('Name')).toBeTruthy();
        });
        expect(screen.getByText('Price')).toBeTruthy();
        
        // Assert input exists
        // Since we don't have getByLabelText working reliably without full accessibility tree in happy-dom sometimes,
        // we can try looking for inputs.
    });

    it('delegates persistence to submitHandler instead of dataSource.create', async () => {
        // When a host (e.g. MasterDetailForm batching parent+children into one
        // atomic transaction) supplies a `submitHandler`, the form must validate
        // and hand the values over WITHOUT creating/updating on its own.
        const submitHandler = vi.fn().mockResolvedValue({ id: 'p1' });
        const onSuccess = vi.fn();
        const ds: any = {
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'test_object',
                fields: { name: { type: 'text', label: 'Name' } },
            }),
            create: vi.fn(),
            update: vi.fn(),
        };

        const { container } = render(
            <ObjectForm
                schema={{
                    type: 'object-form',
                    objectName: 'test_object',
                    mode: 'create',
                    submitHandler,
                    onSuccess,
                } as any}
                dataSource={ds}
            />,
        );

        await waitFor(() => {
            expect(ds.getObjectSchema).toHaveBeenCalledWith('test_object');
        });

        const input = await waitFor(() => {
            const el = container.querySelector('input[name="name"]') as HTMLInputElement | null;
            if (!el) throw new Error('name input not yet rendered');
            return el;
        });
        fireEvent.change(input, { target: { value: 'Atomic demo' } });

        const form = container.querySelector('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => {
            expect(submitHandler).toHaveBeenCalledTimes(1);
        });
        expect(submitHandler).toHaveBeenCalledWith(expect.objectContaining({ name: 'Atomic demo' }));
        // The form must NOT persist on its own when a submitHandler is present.
        expect(ds.create).not.toHaveBeenCalled();
        expect(ds.update).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });
});
