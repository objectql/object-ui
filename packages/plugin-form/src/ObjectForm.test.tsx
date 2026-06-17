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

    it('auto-derives sections from the object fieldGroups metadata', async () => {
        // Fields opt into groups via `field.group`; the object declares the
        // groups via top-level `fieldGroups`. Even without explicit
        // schema.sections, the form must render those groups as sections.
        const ds: any = {
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'test_object',
                fieldGroups: [
                    { key: 'contact', label: 'Contact Info' },
                    { key: 'billing', label: 'Billing' },
                ],
                fields: {
                    email: { type: 'email', label: 'Email', group: 'contact' },
                    phone: { type: 'phone', label: 'Phone', group: 'contact' },
                    amount: { type: 'currency', label: 'Amount', group: 'billing' },
                    notes: { type: 'textarea', label: 'Notes' },
                },
            }),
        };

        const { container } = render(
            <ObjectForm
                schema={{
                    type: 'object-form',
                    objectName: 'test_object',
                    mode: 'create',
                } as any}
                dataSource={ds}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Contact Info')).toBeTruthy();
        });
        expect(screen.getByText('Billing')).toBeTruthy();
        // All fields still render, including the ungrouped one.
        expect(container.querySelector('input[name="email"]')).toBeTruthy();
        expect(container.querySelector('input[name="amount"]')).toBeTruthy();
        expect(container.querySelector('[name="notes"]')).toBeTruthy();
    });

    it('collapses a collapsible fieldGroup section on header click, hiding its fields', async () => {
        // A group declared `collapsible: true` renders a clickable header; toggling
        // it hides that group's fields (while a single shared form preserves their
        // values) without affecting other groups or the ungrouped bucket.
        const ds: any = {
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'test_object',
                fieldGroups: [
                    { key: 'contact', label: 'Contact Info', collapsible: true },
                    { key: 'billing', label: 'Billing' },
                ],
                fields: {
                    email: { type: 'email', label: 'Email', group: 'contact' },
                    amount: { type: 'currency', label: 'Amount', group: 'billing' },
                    notes: { type: 'textarea', label: 'Notes' },
                },
            }),
        };

        const { container } = render(
            <ObjectForm
                schema={{ type: 'object-form', objectName: 'test_object', mode: 'create' } as any}
                dataSource={ds}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('input[name="email"]')).toBeTruthy();
        });

        // Collapse the Contact Info group → its email field leaves the DOM,
        // while the other group's field and the ungrouped field stay.
        fireEvent.click(screen.getByText('Contact Info'));
        await waitFor(() => {
            expect(container.querySelector('input[name="email"]')).toBeNull();
        });
        expect(container.querySelector('input[name="amount"]')).toBeTruthy();
        expect(container.querySelector('[name="notes"]')).toBeTruthy();

        // Expand again → the field returns.
        fireEvent.click(screen.getByText('Contact Info'));
        await waitFor(() => {
            expect(container.querySelector('input[name="email"]')).toBeTruthy();
        });
    });

    it('stays flat when the object declares no fieldGroups', async () => {
        const ds: any = {
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'test_object',
                fields: {
                    name: { type: 'text', label: 'Name' },
                    email: { type: 'email', label: 'Email' },
                },
            }),
        };

        render(
            <ObjectForm
                schema={{ type: 'object-form', objectName: 'test_object', mode: 'create' } as any}
                dataSource={ds}
            />,
        );

        await waitFor(() => {
            expect(screen.getByText('Name')).toBeTruthy();
        });
        // No section headers should appear for a flat form.
        expect(screen.queryByText('Contact Info')).toBeNull();
    });

    it('renders as a master-detail form when schema.subforms is set', async () => {
        // A plain object form becomes master-detail by config (no bespoke page):
        // parent fields on top + an editable child grid + a single Save action.
        const ds: any = {
            getObjectSchema: vi.fn().mockResolvedValue({
                name: 'test_object',
                fields: { name: { type: 'text', label: 'Name' } },
            }),
            batchTransaction: vi.fn(),
        };

        render(
            <ObjectForm
                schema={{
                    type: 'object-form',
                    objectName: 'test_object',
                    mode: 'create',
                    subforms: [
                        { childObject: 'test_line', relationshipField: 'parent', title: 'Lines',
                          columns: [{ field: 'qty', type: 'number' }] },
                    ],
                } as any}
                dataSource={ds}
            />,
        );

        // MasterDetailForm renders its single action bar (md-form-submit) and the
        // child section title — proof we delegated to the master-detail form.
        await waitFor(() => {
            expect(screen.getByTestId('md-form-submit')).toBeTruthy();
        });
        expect(screen.getByText('Lines')).toBeTruthy();
    });
});
