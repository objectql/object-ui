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
}));

const mockActiveView = {
    id: 'all',
    label: 'All Records',
    type: 'grid',
    columns: ['name', 'stage', 'amount'],
    filter: [{ field: 'stage', operator: '=', value: 'active' }],
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

    it('displays column count', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // 3 columns configured
        expect(screen.getByText('console.objectView.columnsConfigured'.replace('{{count}}', '3'))).toBeInTheDocument();
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

    it('shows "None" for empty filters and columns', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ id: 'empty', label: 'Empty View', type: 'grid' }}
                objectDef={mockObjectDef}
            />
        );

        // Should show "None" for columns, filters
        const noneTexts = screen.getAllByText('console.objectView.none');
        expect(noneTexts.length).toBeGreaterThanOrEqual(2);
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

    it('calls onOpenEditor when clicking columns row', () => {
        const onOpenEditor = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onOpenEditor={onOpenEditor}
            />
        );

        // Click the columns row — it's a button with the columns label
        const columnsRow = screen.getByText('console.objectView.columns').closest('button');
        expect(columnsRow).toBeTruthy();
        fireEvent.click(columnsRow!);

        expect(onOpenEditor).toHaveBeenCalledWith('columns');
    });

    it('calls onOpenEditor when clicking filters row', () => {
        const onOpenEditor = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onOpenEditor={onOpenEditor}
            />
        );

        const filterRow = screen.getByText('console.objectView.filterBy').closest('button');
        expect(filterRow).toBeTruthy();
        fireEvent.click(filterRow!);

        expect(onOpenEditor).toHaveBeenCalledWith('filters');
    });

    it('calls onOpenEditor when clicking sort row', () => {
        const onOpenEditor = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
                onOpenEditor={onOpenEditor}
            />
        );

        const sortRow = screen.getByText('console.objectView.sortBy').closest('button');
        expect(sortRow).toBeTruthy();
        fireEvent.click(sortRow!);

        expect(onOpenEditor).toHaveBeenCalledWith('sort');
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
});
