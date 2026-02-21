/**
 * ViewConfigPanel Tests
 *
 * Tests for the Airtable-style inline view configuration panel.
 * Covers: read-only display, interactive editing (Switch, Input, Select),
 * draft state, save/discard, open editor callbacks, and ARIA accessibility.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ViewConfigPanel } from '../components/ViewConfigPanel';

// Mock i18n — return keys as-is for test assertions
vi.mock('@object-ui/i18n', () => ({
    useObjectTranslation: () => ({
        t: (key: string, params?: Record<string, any>) => {
            if (params?.count !== undefined) return key.replace('{{count}}', String(params.count));
            return key;
        },
    }),
}));

// Mock components to simple HTML elements
vi.mock('@object-ui/components', () => ({
    Button: ({ children, onClick, title, ...props }: any) => (
        <button onClick={onClick} title={title} {...props}>{children}</button>
    ),
    Switch: ({ checked, onCheckedChange, ...props }: any) => (
        <button
            role="switch"
            aria-checked={checked}
            onClick={() => onCheckedChange?.(!checked)}
            {...props}
        />
    ),
    Input: ({ value, onChange, readOnly, placeholder, ...props }: any) => (
        <input
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            {...props}
        />
    ),
    Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
        <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onCheckedChange?.(!checked)}
            {...props}
        />
    ),
    FilterBuilder: ({ fields, value, onChange }: any) => {
        let counter = 0;
        return (
        <div data-testid="mock-filter-builder" data-field-count={fields?.length || 0} data-condition-count={value?.conditions?.length || 0}>
            <button data-testid="filter-builder-add" onClick={() => {
                const newConditions = [...(value?.conditions || []), { id: `mock-filter-${Date.now()}-${++counter}`, field: fields?.[0]?.value || '', operator: 'equals', value: '' }];
                onChange?.({ ...value, conditions: newConditions });
            }}>Add filter</button>
            {value?.conditions?.map((c: any, i: number) => (
                <span key={c.id || i} data-testid={`filter-condition-${i}`}>{c.field} {c.operator} {String(c.value)}</span>
            ))}
        </div>
        );
    },
    SortBuilder: ({ fields, value, onChange }: any) => {
        let counter = 0;
        return (
        <div data-testid="mock-sort-builder" data-field-count={fields?.length || 0} data-sort-count={value?.length || 0}>
            <button data-testid="sort-builder-add" onClick={() => {
                const newItems = [...(value || []), { id: `mock-sort-${Date.now()}-${++counter}`, field: fields?.[0]?.value || '', order: 'asc' }];
                onChange?.(newItems);
            }}>Add sort</button>
            {value?.map((s: any, i: number) => (
                <span key={s.id || i} data-testid={`sort-item-${i}`}>{s.field} {s.order}</span>
            ))}
        </div>
        );
    },
}));

const mockActiveView = {
    id: 'all',
    label: 'All Records',
    type: 'grid',
    columns: ['name', 'stage', 'amount'],
    filter: ['stage', '=', 'active'],  // spec-style single triplet
    sort: [{ field: 'name', order: 'asc' }],
};

const mockObjectDef = {
    name: 'opportunity',
    label: 'Opportunity',
    description: 'Track sales pipeline and deals',
    fields: {
        name: { label: 'Name', type: 'text' },
        stage: { label: 'Stage', type: 'select' },
        amount: { label: 'Amount', type: 'currency' },
    },
};

describe('ViewConfigPanel', () => {
    it('renders nothing when closed', () => {
        render(
            <ViewConfigPanel
                open={false}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.queryByTestId('view-config-panel')).not.toBeInTheDocument();
    });

    it('renders panel with all sections when open', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('view-config-panel')).toBeInTheDocument();

        // Check section headers
        expect(screen.getByText('console.objectView.page')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.data')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.appearance')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.userFilters')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.userActions')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.advanced')).toBeInTheDocument();
    });

    it('displays view title in editable input', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const titleInput = screen.getByTestId('view-title-input');
        expect(titleInput).toHaveValue('All Records');
    });

    it('displays object description as plain text', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Track sales pipeline and deals')).toBeInTheDocument();
    });

    it('shows "no description" when object has no description', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={{ ...mockObjectDef, description: undefined }}
            />
        );

        expect(screen.getByText('console.objectView.noDescription')).toBeInTheDocument();
    });

    it('displays column checkboxes for each field', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // 3 fields → 3 checkboxes
        expect(screen.getByTestId('column-selector')).toBeInTheDocument();
        expect(screen.getByTestId('col-checkbox-name')).toBeInTheDocument();
        expect(screen.getByTestId('col-checkbox-stage')).toBeInTheDocument();
        expect(screen.getByTestId('col-checkbox-amount')).toBeInTheDocument();
        // Columns in activeView should be checked
        expect(screen.getByTestId('col-checkbox-name')).toBeChecked();
        expect(screen.getByTestId('col-checkbox-stage')).toBeChecked();
        expect(screen.getByTestId('col-checkbox-amount')).toBeChecked();
    });

    it('displays object source name', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('Opportunity')).toBeInTheDocument();
    });

    it('displays view type in select element', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const select = screen.getByTestId('view-type-select');
        expect(select).toHaveValue('grid');
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={onClose}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const closeBtn = screen.getByTitle('console.objectView.closePanel');
        fireEvent.click(closeBtn);

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('updates content when activeView changes', () => {
        const { rerender } = render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('view-title-input')).toHaveValue('All Records');
        expect(screen.getByTestId('view-type-select')).toHaveValue('grid');

        // Switch to kanban view
        rerender(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'pipeline', label: 'Pipeline', type: 'kanban', columns: ['name'] }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('view-title-input')).toHaveValue('Pipeline');
        expect(screen.getByTestId('view-type-select')).toHaveValue('kanban');
    });

    it('shows inline builders with zero items for empty view', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'empty', label: 'Empty View', type: 'grid' }}
                objectDef={mockObjectDef}
            />
        );

        // FilterBuilder should have 0 conditions
        expect(screen.getByTestId('mock-filter-builder')).toHaveAttribute('data-condition-count', '0');
        // SortBuilder should have 0 items
        expect(screen.getByTestId('mock-sort-builder')).toHaveAttribute('data-sort-count', '0');
    });

    it('has correct ARIA attributes when open', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const panel = screen.getByTestId('view-config-panel');
        expect(panel).toHaveAttribute('role', 'complementary');
        expect(panel).toHaveAttribute('aria-label', 'console.objectView.configureView');
    });

    it('is full-width on mobile via CSS classes', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const panel = screen.getByTestId('view-config-panel');
        // On mobile: absolute full-width overlay; on desktop: relative w-72
        expect(panel.className).toContain('w-full');
        expect(panel.className).toContain('sm:w-72');
        expect(panel.className).toContain('absolute');
        expect(panel.className).toContain('sm:relative');
    });

    // ── Interactive editing tests ──

    it('toggles showSearch via Switch and shows save/discard footer', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Initially no footer (not dirty)
        expect(screen.queryByTestId('view-config-footer')).not.toBeInTheDocument();

        // Toggle showSearch switch (default is on → turn off)
        const searchSwitch = screen.getByTestId('toggle-showSearch');
        fireEvent.click(searchSwitch);

        expect(onViewUpdate).toHaveBeenCalledWith('showSearch', false);
        // Footer should appear after modification
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();
    });

    it('toggles showFilters via Switch', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const filterSwitch = screen.getByTestId('toggle-showFilters');
        fireEvent.click(filterSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('showFilters', false);
    });

    it('toggles showSort via Switch', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const sortSwitch = screen.getByTestId('toggle-showSort');
        fireEvent.click(sortSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('showSort', false);
    });

    it('toggles allowExport via Switch', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const exportSwitch = screen.getByTestId('toggle-allowExport');
        fireEvent.click(exportSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('allowExport', false);
    });

    it('toggles addRecordViaForm via Switch', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const formSwitch = screen.getByTestId('toggle-addRecordViaForm');
        fireEvent.click(formSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('addRecordViaForm', true);
    });

    it('edits view title via inline input', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const titleInput = screen.getByTestId('view-title-input');
        fireEvent.change(titleInput, { target: { value: 'My Custom View' } });

        expect(onViewUpdate).toHaveBeenCalledWith('label', 'My Custom View');
    });

    it('changes view type via select', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const typeSelect = screen.getByTestId('view-type-select');
        fireEvent.change(typeSelect, { target: { value: 'kanban' } });

        expect(onViewUpdate).toHaveBeenCalledWith('type', 'kanban');
    });

    it('renders inline FilterBuilder with correct conditions from activeView', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const fb = screen.getByTestId('mock-filter-builder');
        expect(fb).toHaveAttribute('data-condition-count', '1');
        expect(fb).toHaveAttribute('data-field-count', '3');
        expect(screen.getByTestId('filter-condition-0')).toHaveTextContent('stage equals active');
    });

    it('renders inline SortBuilder with correct items from activeView', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const sb = screen.getByTestId('mock-sort-builder');
        expect(sb).toHaveAttribute('data-sort-count', '1');
        expect(sb).toHaveAttribute('data-field-count', '3');
        expect(screen.getByTestId('sort-item-0')).toHaveTextContent('name asc');
    });

    it('updates draft when adding a filter via FilterBuilder', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'empty', label: 'Empty', type: 'grid' }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('filter-builder-add'));
        expect(onViewUpdate).toHaveBeenCalledWith('filter', expect.any(Array));
    });

    it('updates draft when adding a sort via SortBuilder', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'empty', label: 'Empty', type: 'grid' }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('sort-builder-add'));
        expect(onViewUpdate).toHaveBeenCalledWith('sort', expect.any(Array));
    });

    it('toggles column checkbox and calls onViewUpdate with updated columns', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Uncheck the 'stage' column
        fireEvent.click(screen.getByTestId('col-checkbox-stage'));
        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['name', 'amount']);
    });

    it('saves draft via onSave when Save button is clicked', () => {
        const onSave = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onSave={onSave}
            />
        );

        // Make a change to trigger dirty state
        const titleInput = screen.getByTestId('view-title-input');
        fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

        // Footer should be visible
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Click save
        const saveBtn = screen.getByTestId('view-config-save');
        fireEvent.click(saveBtn);

        expect(onSave).toHaveBeenCalledOnce();
        expect(onSave.mock.calls[0][0]).toMatchObject({ label: 'Updated Title' });
    });

    it('discards draft changes when Discard button is clicked', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Make a change
        const titleInput = screen.getByTestId('view-title-input');
        fireEvent.change(titleInput, { target: { value: 'Changed Title' } });

        // Footer should be visible
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Click discard
        const discardBtn = screen.getByTestId('view-config-discard');
        fireEvent.click(discardBtn);

        // Title should revert to original
        expect(screen.getByTestId('view-title-input')).toHaveValue('All Records');
        // Footer should disappear (no longer dirty)
        expect(screen.queryByTestId('view-config-footer')).not.toBeInTheDocument();
    });

    it('hides save/discard footer after save completes', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onSave={vi.fn()}
            />
        );

        // Make a change
        fireEvent.change(screen.getByTestId('view-title-input'), { target: { value: 'Tmp' } });
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Save — footer should disappear
        fireEvent.click(screen.getByTestId('view-config-save'));
        expect(screen.queryByTestId('view-config-footer')).not.toBeInTheDocument();
    });

    it('renders all Switch toggles with correct initial state', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, showSearch: false, showFilters: true, showSort: false, allowExport: false, addRecordViaForm: true }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('toggle-showSearch')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('toggle-showFilters')).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByTestId('toggle-showSort')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('toggle-allowExport')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('toggle-addRecordViaForm')).toHaveAttribute('aria-checked', 'true');
    });

    // ── Real-time draft propagation tests (issue fix) ──

    it('keeps dirty state when re-rendered with same view ID but updated activeView', () => {
        const onViewUpdate = vi.fn();
        const { rerender } = render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Toggle showSearch — panel becomes dirty
        fireEvent.click(screen.getByTestId('toggle-showSearch'));
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Simulate parent re-rendering with the same view ID but merged draft
        // (this happens when onViewUpdate propagates to parent viewDraft → activeView)
        rerender(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, showSearch: false }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Draft footer should still be visible (isDirty should NOT reset for same view ID)
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();
    });

    it('resets dirty state when activeView changes to a different view ID', () => {
        const { rerender } = render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Make the panel dirty
        fireEvent.click(screen.getByTestId('toggle-showSearch'));
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Switch to a completely different view
        rerender(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'pipeline', label: 'Pipeline', type: 'kanban', columns: ['name'] }}
                objectDef={mockObjectDef}
            />
        );

        // Draft should reset — footer should be gone
        expect(screen.queryByTestId('view-config-footer')).not.toBeInTheDocument();
    });

    it('calls onViewUpdate for each real-time field change to enable live preview', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Toggle multiple switches
        fireEvent.click(screen.getByTestId('toggle-showSearch'));
        fireEvent.click(screen.getByTestId('toggle-showFilters'));

        expect(onViewUpdate).toHaveBeenCalledTimes(2);
        expect(onViewUpdate).toHaveBeenCalledWith('showSearch', false);
        expect(onViewUpdate).toHaveBeenCalledWith('showFilters', false);
    });

    // ── Spec-style filter bridge tests ──

    it('parses nested spec-style filter array [[field,op,val],[field,op,val]]', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{
                    ...mockActiveView,
                    filter: [['stage', '=', 'active'], ['name', '!=', 'Test']],
                }}
                objectDef={mockObjectDef}
            />
        );

        const fb = screen.getByTestId('mock-filter-builder');
        expect(fb).toHaveAttribute('data-condition-count', '2');
        expect(screen.getByTestId('filter-condition-0')).toHaveTextContent('stage equals active');
        expect(screen.getByTestId('filter-condition-1')).toHaveTextContent('name notEquals Test');
    });

    it('parses and/or logic prefix: ["or", [...], [...]]', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{
                    ...mockActiveView,
                    filter: ['or', ['stage', '=', 'active'], ['stage', '=', 'pending']],
                }}
                objectDef={mockObjectDef}
            />
        );

        const fb = screen.getByTestId('mock-filter-builder');
        expect(fb).toHaveAttribute('data-condition-count', '2');
    });

    it('normalizes field types for FilterBuilder (currency→number)', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={{
                    ...mockObjectDef,
                    fields: {
                        name: { label: 'Name', type: 'text' },
                        revenue: { label: 'Revenue', type: 'currency' },
                        created: { label: 'Created', type: 'datetime' },
                        active: { label: 'Active', type: 'boolean' },
                        status: { label: 'Status', type: 'picklist' },
                    },
                }}
            />
        );

        // The mock FilterBuilder receives normalized fields via data-field-count
        const fb = screen.getByTestId('mock-filter-builder');
        expect(fb).toHaveAttribute('data-field-count', '5');
    });

    // ── Create mode (mode="create") tests ──

    it('renders in create mode with "Create View" title', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                mode="create"
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const panel = screen.getByTestId('view-config-panel');
        expect(panel).toHaveAttribute('aria-label', 'console.objectView.createView');
    });

    it('shows save/discard footer immediately in create mode', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                mode="create"
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();
    });

    it('calls onCreate (not onSave) when saving in create mode', () => {
        const onCreate = vi.fn();
        const onSave = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                mode="create"
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onSave={onSave}
                onCreate={onCreate}
            />
        );

        // Change title first
        const titleInput = screen.getByTestId('view-title-input');
        fireEvent.change(titleInput, { target: { value: 'New Kanban' } });

        fireEvent.click(screen.getByTestId('view-config-save'));

        expect(onCreate).toHaveBeenCalledOnce();
        expect(onCreate.mock.calls[0][0]).toMatchObject({ label: 'New Kanban' });
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onClose when discarding in create mode', () => {
        const onClose = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={onClose}
                mode="create"
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('view-config-discard'));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('starts with default label in create mode', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                mode="create"
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const titleInput = screen.getByTestId('view-title-input');
        // In create mode, draft starts with the "New View" i18n key
        expect(titleInput).toHaveValue('console.objectView.newView');
    });

    // ── Type-specific options tests ──

    it('shows kanban groupByField when view type is kanban', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'kanban' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-options-section')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-kanban-groupByField')).toBeInTheDocument();
    });

    it('shows calendar fields when view type is calendar', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'calendar' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-calendar-startDateField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-calendar-titleField')).toBeInTheDocument();
    });

    it('shows map fields when view type is map', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'map' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-map-latitudeField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-map-longitudeField')).toBeInTheDocument();
    });

    it('shows gallery imageField when view type is gallery', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'gallery' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-gallery-imageField')).toBeInTheDocument();
    });

    it('shows timeline dateField and titleField when view type is timeline', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'timeline' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-timeline-dateField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-timeline-titleField')).toBeInTheDocument();
    });

    it('shows gantt dateField and titleField when view type is gantt', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'gantt' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-gantt-dateField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-gantt-titleField')).toBeInTheDocument();
    });

    it('does not show type options section for grid view', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'grid' }}
                objectDef={mockObjectDef}
            />
        );

        // Grid type options section is a hidden placeholder
        const section = screen.getByTestId('type-options-section');
        expect(section.className).toContain('hidden');
    });

    it('updates kanban groupByField via type option select', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'kanban' }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const select = screen.getByTestId('type-opt-kanban-groupByField');
        fireEvent.change(select, { target: { value: 'stage' } });

        expect(onViewUpdate).toHaveBeenCalledWith('kanban', expect.objectContaining({ groupByField: 'stage' }));
    });

    it('shows type options when view type changes from grid to kanban', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // Initially grid — type options hidden
        expect(screen.getByTestId('type-options-section').className).toContain('hidden');

        // Change to kanban
        fireEvent.change(screen.getByTestId('view-type-select'), { target: { value: 'kanban' } });

        // Now kanban groupBy should appear
        expect(screen.getByTestId('type-opt-kanban-groupByField')).toBeInTheDocument();
    });
});
