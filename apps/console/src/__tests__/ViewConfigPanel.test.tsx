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
vi.mock('@object-ui/components', () => {
    const React = require('react') as typeof import('react');

    // useConfigDraft mock — mirrors real implementation
    function useConfigDraft(source: any, options?: any) {
        const maxHistory = options?.maxHistory ?? 50;
        const [draft, setDraft] = React.useState({ ...source });
        const [isDirty, setIsDirty] = React.useState(options?.mode === 'create');
        const pastRef = React.useRef<any[]>([]);
        const futureRef = React.useRef<any[]>([]);
        const [, forceRender] = React.useState(0);

        React.useEffect(() => {
            setDraft({ ...source });
            setIsDirty(options?.mode === 'create');
            pastRef.current = [];
            futureRef.current = [];
        }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

        const updateField = React.useCallback((field: string, value: any) => {
            setDraft((prev: any) => {
                pastRef.current = [...pastRef.current.slice(-(maxHistory - 1)), prev];
                futureRef.current = [];
                return { ...prev, [field]: value };
            });
            setIsDirty(true);
            forceRender((n: number) => n + 1);
            options?.onUpdate?.(field, value);
        }, [options?.onUpdate]);

        const undo = React.useCallback(() => {
            if (pastRef.current.length === 0) return;
            setDraft((prev: any) => {
                const past = [...pastRef.current];
                const previous = past.pop()!;
                pastRef.current = past;
                futureRef.current = [prev, ...futureRef.current];
                return previous;
            });
            forceRender((n: number) => n + 1);
        }, []);

        const redo = React.useCallback(() => {
            if (futureRef.current.length === 0) return;
            setDraft((prev: any) => {
                const future = [...futureRef.current];
                const next = future.shift()!;
                futureRef.current = future;
                pastRef.current = [...pastRef.current, prev];
                return next;
            });
            forceRender((n: number) => n + 1);
        }, []);

        const discard = React.useCallback(() => {
            setDraft({ ...source });
            setIsDirty(false);
            pastRef.current = [];
            futureRef.current = [];
            forceRender((n: number) => n + 1);
        }, [source]);

        return { draft, isDirty, updateField, discard, setDraft, undo, redo, canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 };
    }

    // ConfigPanelRenderer mock — renders schema sections with proper collapse/visibility
    function ConfigPanelRenderer({ open, onClose, schema, draft, isDirty, onFieldChange, onSave, onDiscard, panelRef, role, ariaLabel, tabIndex, testId, saveLabel, discardLabel, className }: any) {
        const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
        if (!open) return null;

        return React.createElement('div', {
            ref: panelRef,
            'data-testid': testId || 'config-panel',
            role,
            'aria-label': ariaLabel,
            tabIndex,
            className: `absolute inset-y-0 right-0 w-full sm:w-72 lg:w-80 sm:relative sm:inset-auto border-l bg-background flex flex-col shrink-0 z-20 ${className || ''}`,
        },
            // Header with breadcrumb
            React.createElement('div', { className: 'px-4 py-3 border-b flex items-center justify-between shrink-0' },
                React.createElement('div', { 'data-testid': 'panel-breadcrumb', className: 'flex items-center gap-1 text-sm truncate' },
                    ...schema.breadcrumb.map((seg: string, i: number) => [
                        i > 0 && React.createElement('span', { key: `sep-${i}`, className: 'text-muted-foreground' }, '›'),
                        React.createElement('span', {
                            key: `seg-${i}`,
                            className: i === schema.breadcrumb.length - 1 ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        }, seg),
                    ]).flat().filter(Boolean),
                ),
                React.createElement('button', {
                    onClick: onClose,
                    title: 'console.objectView.closePanel',
                    className: 'h-7 w-7 p-0',
                }, '×'),
            ),
            // Scrollable sections
            React.createElement('div', { className: 'flex-1 overflow-auto px-4 pb-4' },
                ...schema.sections.map((section: any) => {
                    if (section.visibleWhen && !section.visibleWhen(draft)) return null;
                    const isCollapsed = collapsed[section.key] ?? section.defaultCollapsed ?? false;

                    return React.createElement('div', { key: section.key },
                        // Section header
                        section.collapsible
                            ? React.createElement('button', {
                                'data-testid': `section-${section.key}`,
                                onClick: () => setCollapsed((prev: any) => ({ ...prev, [section.key]: !isCollapsed })),
                                type: 'button',
                                'aria-expanded': !isCollapsed,
                            }, React.createElement('h3', null, section.title))
                            : React.createElement('div', null, React.createElement('h3', null, section.title)),
                        // Section hint
                        section.hint && React.createElement('p', { className: 'text-[10px] text-muted-foreground mb-1' }, section.hint),
                        // Section fields
                        !isCollapsed && React.createElement('div', { className: 'space-y-0.5' },
                            ...section.fields.map((field: any) => {
                                if (field.visibleWhen && !field.visibleWhen(draft)) return null;
                                if (field.type === 'custom' && field.render) {
                                    return React.createElement(React.Fragment, { key: field.key },
                                        field.render(draft[field.key], (v: any) => onFieldChange(field.key, v), draft),
                                    );
                                }
                                return null;
                            }),
                        ),
                    );
                }),
            ),
            // Footer
            isDirty && React.createElement('div', {
                'data-testid': 'view-config-footer',
                className: 'px-4 py-3 border-t flex items-center justify-end gap-2 shrink-0 bg-background',
            },
                React.createElement('button', { 'data-testid': 'view-config-discard', onClick: onDiscard }, discardLabel),
                React.createElement('button', { 'data-testid': 'view-config-save', onClick: onSave }, saveLabel),
            ),
        );
    }

    return {
        useConfigDraft,
        ConfigPanelRenderer,
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
        ConfigRow: ({ label, value, onClick, children, className }: any) => {
            const Wrapper = onClick ? 'button' : 'div';
            return (
                <Wrapper className={className} onClick={onClick} type={onClick ? 'button' : undefined}>
                    <span>{label}</span>
                    {children || <span>{value}</span>}
                </Wrapper>
            );
        },
        SectionHeader: ({ title, collapsible, collapsed, onToggle, testId }: any) => {
            if (collapsible) {
                return (
                    <button data-testid={testId} onClick={onToggle} type="button" aria-expanded={!collapsed}>
                        <h3>{title}</h3>
                    </button>
                );
            }
            return <div data-testid={testId}><h3>{title}</h3></div>;
        },
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
    };
});

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

        // Check section headers (page appears in both breadcrumb and section)
        expect(screen.getAllByText('console.objectView.page').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('console.objectView.data')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.appearance')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.userActions')).toBeInTheDocument();
        // Breadcrumb shows view type label
        expect(screen.getByTestId('panel-breadcrumb')).toBeInTheDocument();
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

    it('displays description as editable input with placeholder from objectDef', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const descInput = screen.getByTestId('view-description-input');
        expect(descInput).toBeInTheDocument();
        expect(descInput).toHaveAttribute('placeholder', 'Track sales pipeline and deals');
    });

    it('shows "no description" placeholder when object has no description', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={{ ...mockObjectDef, description: undefined }}
            />
        );

        const descInput = screen.getByTestId('view-description-input');
        expect(descInput).toHaveAttribute('placeholder', 'console.objectView.noDescription');
    });

    it('updates draft when description is edited', () => {
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

        const descInput = screen.getByTestId('view-description-input');
        fireEvent.change(descInput, { target: { value: 'My custom description' } });
        expect(descInput).toHaveValue('My custom description');
        expect(onViewUpdate).toHaveBeenCalledWith('description', 'My custom description');
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

        // Expand the Fields sub-section by clicking the summary row
        const fieldsRow = screen.getByText('console.objectView.fields');
        fireEvent.click(fieldsRow);

        // 3 fields → 3 checkboxes
        expect(screen.getByTestId('column-selector')).toBeInTheDocument();
        expect(screen.getByTestId('col-eye-name')).toBeInTheDocument();
        expect(screen.getByTestId('col-eye-stage')).toBeInTheDocument();
        expect(screen.getByTestId('col-eye-amount')).toBeInTheDocument();
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

        // Expand sort and filter sub-sections
        fireEvent.click(screen.getByText('console.objectView.sortBy'));
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        const exportSwitch = screen.getByTestId('toggle-allowExport');
        fireEvent.click(exportSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('allowExport', true);
    });

    it('toggles addRecord enabled via Switch', () => {
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

        const formSwitch = screen.getByTestId('toggle-addRecord-enabled');
        fireEvent.click(formSwitch);
        expect(onViewUpdate).toHaveBeenCalledWith('addRecordViaForm', true);
        expect(onViewUpdate).toHaveBeenCalledWith('addRecord', expect.objectContaining({ enabled: true }));
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

        // Expand filter sub-section
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

        // Expand sort sub-section
        fireEvent.click(screen.getByText('console.objectView.sortBy'));

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

        // Expand filter sub-section
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

        // Expand sort sub-section
        fireEvent.click(screen.getByText('console.objectView.sortBy'));

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

        // Expand the Fields sub-section
        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Uncheck the 'stage' column
        fireEvent.click(screen.getByTestId('col-eye-stage'));
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
                activeView={{ ...mockActiveView, showSearch: false, showFilters: true, showSort: false, allowExport: false, addRecordViaForm: true, addRecord: { enabled: true } }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('toggle-showSearch')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('toggle-showFilters')).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByTestId('toggle-showSort')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByTestId('toggle-addRecord-enabled')).toHaveAttribute('aria-checked', 'true');
        fireEvent.click(screen.getByTestId('section-exportPrint'));
        expect(screen.getByTestId('toggle-allowExport')).toHaveAttribute('aria-checked', 'false');
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

        // Expand filter sub-section
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

        // Expand filter sub-section
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

        // Expand filter sub-section
        fireEvent.click(screen.getByText('console.objectView.filterBy'));

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

    // ── Breadcrumb header tests ──

    it('renders breadcrumb header with Page > ViewType', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const breadcrumb = screen.getByTestId('panel-breadcrumb');
        expect(breadcrumb).toBeInTheDocument();
        expect(breadcrumb).toHaveTextContent('Grid');
    });

    it('breadcrumb updates when view type changes', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'kanban' }}
                objectDef={mockObjectDef}
            />
        );

        const breadcrumb = screen.getByTestId('panel-breadcrumb');
        expect(breadcrumb).toHaveTextContent('Kanban');
    });

    // ── Collapsible section tests ──

    it('collapses and expands Data section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Data section is expanded by default — source row visible
        expect(screen.getByText('Opportunity')).toBeInTheDocument();

        // Click section header to collapse
        const sectionBtn = screen.getByTestId('section-data');
        fireEvent.click(sectionBtn);

        // Source row should be hidden
        expect(screen.queryByText('Opportunity')).not.toBeInTheDocument();

        // Click again to expand
        fireEvent.click(sectionBtn);
        expect(screen.getByText('Opportunity')).toBeInTheDocument();
    });

    it('collapses and expands Appearance section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Appearance section is expanded by default
        expect(screen.getByTestId('toggle-showDescription')).toBeInTheDocument();

        // Click section header to collapse
        fireEvent.click(screen.getByTestId('section-appearance'));

        // Toggle should be hidden
        expect(screen.queryByTestId('toggle-showDescription')).not.toBeInTheDocument();
    });

    // ── Appearance fields tests ──

    it('renders new appearance fields: color, rowHeight, wrapHeaders', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, groupBy: 'stage' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('appearance-color')).toBeInTheDocument();
        expect(screen.getByTestId('appearance-rowHeight')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-wrapHeaders')).toBeInTheDocument();
    });

    it('changes row height via icon buttons', () => {
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

        const mediumBtn = screen.getByTestId('row-height-medium');
        fireEvent.click(mediumBtn);
        expect(onViewUpdate).toHaveBeenCalledWith('rowHeight', 'medium');
    });

    it('toggles wrapHeaders via Switch', () => {
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

        fireEvent.click(screen.getByTestId('toggle-wrapHeaders'));
        expect(onViewUpdate).toHaveBeenCalledWith('wrapHeaders', true);
    });

    // ── User actions fields tests ──

    it('renders new user action fields: inlineEdit, addDeleteRecordsInline, and navigation mode select', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Expand defaultCollapsed userActions section
        fireEvent.click(screen.getByTestId('section-userActions'));
        expect(screen.getByTestId('toggle-inlineEdit')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-addDeleteRecordsInline')).toBeInTheDocument();
        expect(screen.getByTestId('select-navigation-mode')).toBeInTheDocument();
    });

    it('toggles inlineEdit via Switch', () => {
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

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByTestId('toggle-inlineEdit'));
        expect(onViewUpdate).toHaveBeenCalledWith('inlineEdit', false);
    });

    // ── Data section: Group by and Prefix field tests ──

    it('renders Group by and Prefix field selectors in Data section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('data-groupBy')).toBeInTheDocument();
    });

    it('changes groupBy for grid view', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'grid' }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        const groupBySelect = screen.getByTestId('data-groupBy');
        fireEvent.change(groupBySelect, { target: { value: 'stage' } });

        expect(onViewUpdate).toHaveBeenCalledWith('groupBy', 'stage');
    });

    // ── Calendar endDateField test ──

    it('shows calendar endDateField when view type is calendar', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, type: 'calendar' }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('type-opt-calendar-startDateField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-calendar-endDateField')).toBeInTheDocument();
        expect(screen.getByTestId('type-opt-calendar-titleField')).toBeInTheDocument();
    });

    // ── Data sub-section expand/collapse tests ──

    it('expands and collapses sort/filter/fields sub-sections in Data', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Sort sub-section starts collapsed
        expect(screen.queryByTestId('inline-sort-builder')).not.toBeInTheDocument();

        // Click to expand
        fireEvent.click(screen.getByText('console.objectView.sortBy'));
        expect(screen.getByTestId('inline-sort-builder')).toBeInTheDocument();

        // Click again to collapse
        fireEvent.click(screen.getByText('console.objectView.sortBy'));
        expect(screen.queryByTestId('inline-sort-builder')).not.toBeInTheDocument();
    });

    // ── Column selector sub-panel tests ──

    it('shows selected columns in order with move up/down buttons', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Expand the Fields sub-section
        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Selected columns section should appear
        expect(screen.getByTestId('selected-columns')).toBeInTheDocument();

        // Move buttons should exist for selected columns
        expect(screen.getByTestId('col-move-up-name')).toBeInTheDocument();
        expect(screen.getByTestId('col-move-down-name')).toBeInTheDocument();
        expect(screen.getByTestId('col-move-up-stage')).toBeInTheDocument();
        expect(screen.getByTestId('col-move-down-stage')).toBeInTheDocument();
        expect(screen.getByTestId('col-move-up-amount')).toBeInTheDocument();
        expect(screen.getByTestId('col-move-down-amount')).toBeInTheDocument();
    });

    it('disables move-up for first column and move-down for last column', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // First column (name) — move up disabled
        expect(screen.getByTestId('col-move-up-name')).toBeDisabled();
        expect(screen.getByTestId('col-move-down-name')).not.toBeDisabled();

        // Last column (amount) — move down disabled
        expect(screen.getByTestId('col-move-up-amount')).not.toBeDisabled();
        expect(screen.getByTestId('col-move-down-amount')).toBeDisabled();
    });

    it('moves column down and updates draft.columns order', () => {
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

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Move "name" down — should swap with "stage"
        fireEvent.click(screen.getByTestId('col-move-down-name'));
        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['stage', 'name', 'amount']);
    });

    it('moves column up and updates draft.columns order', () => {
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

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Move "amount" up — should swap with "stage"
        fireEvent.click(screen.getByTestId('col-move-up-amount'));
        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['name', 'amount', 'stage']);
    });

    it('saves reordered columns via onSave', () => {
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

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Move "name" down
        fireEvent.click(screen.getByTestId('col-move-down-name'));

        // Footer should appear
        expect(screen.getByTestId('view-config-footer')).toBeInTheDocument();

        // Save
        fireEvent.click(screen.getByTestId('view-config-save'));
        expect(onSave).toHaveBeenCalledOnce();
        expect(onSave.mock.calls[0][0].columns).toEqual(['stage', 'name', 'amount']);
    });

    it('shows unselected fields below selected columns', () => {
        // Only 'name' and 'stage' are selected, 'amount' is not
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, columns: ['name', 'stage'] }}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // 'amount' should have a checkbox but no move buttons
        expect(screen.getByTestId('col-eye-amount')).toBeInTheDocument();
        expect(screen.queryByTestId('col-move-up-amount')).not.toBeInTheDocument();
        expect(screen.queryByTestId('col-move-down-amount')).not.toBeInTheDocument();
    });

    it('adding unselected field appends to columns and shows move buttons', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, columns: ['name', 'stage'] }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Click checkbox for 'amount' to add it
        fireEvent.click(screen.getByTestId('col-eye-amount'));
        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['name', 'stage', 'amount']);
    });

    it('reorder triggers onViewUpdate for real-time preview', () => {
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

        fireEvent.click(screen.getByText('console.objectView.fields'));

        // Move "stage" up
        fireEvent.click(screen.getByTestId('col-move-up-stage'));
        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['stage', 'name', 'amount']);

        // Move "stage" down (now at index 0)
        fireEvent.click(screen.getByTestId('col-move-down-stage'));
        // After the first move, state has stage at index 0
        // The second move should operate on the updated state
        expect(onViewUpdate).toHaveBeenCalledTimes(2);
    });

    it('renders column search input and show/hide all buttons', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.fields'));

        expect(screen.getByTestId('column-search-input')).toBeInTheDocument();
        expect(screen.getByTestId('column-show-all')).toBeInTheDocument();
        expect(screen.getByTestId('column-hide-all')).toBeInTheDocument();
    });

    it('clicking Show All selects all fields and calls onViewUpdate', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, columns: ['name'] }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.fields'));
        fireEvent.click(screen.getByTestId('column-show-all'));

        expect(onViewUpdate).toHaveBeenCalledWith('columns', ['name', 'stage', 'amount']);
    });

    it('clicking Hide All removes all fields and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByText('console.objectView.fields'));
        fireEvent.click(screen.getByTestId('column-hide-all'));

        expect(onViewUpdate).toHaveBeenCalledWith('columns', []);
    });

    // ── Section Layout Tests: Page vs ListView Config ──

    it('renders page-level config items in the Page section (showSearch, showFilters, showSort, navigation, addRecord, allowExport)', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Page section should contain toolbar toggles
        const panel = screen.getByTestId('view-config-panel');
        expect(panel).toBeInTheDocument();

        // These toggles should be rendered in the page section (always visible, not behind a collapsible)
        expect(screen.getByTestId('toggle-showSearch')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-showFilters')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-showSort')).toBeInTheDocument();
        expect(screen.getByTestId('select-navigation-mode')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-addRecord-enabled')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('section-exportPrint'));
        expect(screen.getByTestId('toggle-allowExport')).toBeInTheDocument();
    });

    it('renders section description hints for Page and ListView config', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByText('console.objectView.generalHint')).toBeInTheDocument();
        expect(screen.getByText('console.objectView.listConfigHint')).toBeInTheDocument();
    });

    it('renders list-level inline action items in the User Actions section (inlineEdit, addDeleteRecordsInline)', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Expand defaultCollapsed userActions section
        fireEvent.click(screen.getByTestId('section-userActions'));
        // List-level inline actions should be in the User Actions collapsible section
        expect(screen.getByTestId('toggle-inlineEdit')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-addDeleteRecordsInline')).toBeInTheDocument();
    });

    it('page-level toggles call onViewUpdate correctly for live preview', () => {
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

        // Toggle showSearch off
        fireEvent.click(screen.getByTestId('toggle-showSearch'));
        expect(onViewUpdate).toHaveBeenCalledWith('showSearch', false);

        // Toggle showFilters off
        fireEvent.click(screen.getByTestId('toggle-showFilters'));
        expect(onViewUpdate).toHaveBeenCalledWith('showFilters', false);

        // Toggle showSort off
        fireEvent.click(screen.getByTestId('toggle-showSort'));
        expect(onViewUpdate).toHaveBeenCalledWith('showSort', false);

        // Change navigation mode
        fireEvent.change(screen.getByTestId('select-navigation-mode'), { target: { value: 'none' } });
        expect(onViewUpdate).toHaveBeenCalledWith('navigation', expect.objectContaining({ mode: 'none' }));

        // Toggle addRecord enabled on
        fireEvent.click(screen.getByTestId('toggle-addRecord-enabled'));
        expect(onViewUpdate).toHaveBeenCalledWith('addRecordViaForm', true);

        // Toggle allowExport on (starts unchecked by default)
        fireEvent.click(screen.getByTestId('section-exportPrint'));
        fireEvent.click(screen.getByTestId('toggle-allowExport'));
        expect(onViewUpdate).toHaveBeenCalledWith('allowExport', true);
    });

    it('new toolbar toggles (showHideFields, showGroup, showColor, showDensity) call onViewUpdate correctly', () => {
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

        // Toggle showHideFields off
        fireEvent.click(screen.getByTestId('toggle-showHideFields'));
        expect(onViewUpdate).toHaveBeenCalledWith('showHideFields', false);

        // Toggle showGroup off
        fireEvent.click(screen.getByTestId('toggle-showGroup'));
        expect(onViewUpdate).toHaveBeenCalledWith('showGroup', false);

        // Toggle showColor off
        fireEvent.click(screen.getByTestId('toggle-showColor'));
        expect(onViewUpdate).toHaveBeenCalledWith('showColor', false);

        // Toggle showDensity off
        fireEvent.click(screen.getByTestId('toggle-showDensity'));
        expect(onViewUpdate).toHaveBeenCalledWith('showDensity', false);
    });

    it('hasExport should be false when allowExport is undefined and no exportOptions', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, allowExport: undefined, exportOptions: undefined }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        // allowExport toggle should be unchecked (false) when allowExport is undefined
        fireEvent.click(screen.getByTestId('section-exportPrint'));
        const exportSwitch = screen.getByTestId('toggle-allowExport');
        expect(exportSwitch).toHaveAttribute('aria-checked', 'false');
    });

    it('striped and bordered toggles call onViewUpdate correctly', () => {
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

        // Expand appearance section if collapsed
        const appearanceSection = screen.getByTestId('section-appearance');
        if (appearanceSection.getAttribute('aria-expanded') === 'false') {
            fireEvent.click(appearanceSection);
        }

        // Toggle striped on
        fireEvent.click(screen.getByTestId('toggle-striped'));
        expect(onViewUpdate).toHaveBeenCalledWith('striped', true);

        // Toggle bordered on
        fireEvent.click(screen.getByTestId('toggle-bordered'));
        expect(onViewUpdate).toHaveBeenCalledWith('bordered', true);
    });

    // ── New spec controls tests (P0/P1/P2) ──

    it('renders navigation mode select with default value "page"', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        const navSelect = screen.getByTestId('select-navigation-mode');
        expect(navSelect).toBeInTheDocument();
        expect(navSelect).toHaveValue('page');
    });

    it('shows navigation width input when mode is drawer', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, navigation: { mode: 'drawer' } }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        expect(screen.getByTestId('input-navigation-width')).toBeInTheDocument();
    });

    it('shows openNewTab toggle when navigation mode is page', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, navigation: { mode: 'page' } }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('toggle-navigation-openNewTab')).toBeInTheDocument();
    });

    it('changes navigation mode and syncs clickIntoRecordDetails', () => {
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

        fireEvent.change(screen.getByTestId('select-navigation-mode'), { target: { value: 'none' } });
        expect(onViewUpdate).toHaveBeenCalledWith('navigation', expect.objectContaining({ mode: 'none' }));
        expect(onViewUpdate).toHaveBeenCalledWith('clickIntoRecordDetails', false);
    });

    it('renders selection type select', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('select-selection-type')).toBeInTheDocument();
    });

    it('changes selection type and calls onViewUpdate', () => {
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

        fireEvent.change(screen.getByTestId('select-selection-type'), { target: { value: 'single' } });
        expect(onViewUpdate).toHaveBeenCalledWith('selection', { type: 'single' });
    });

    it('renders pagination pageSize input', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('input-pagination-pageSize')).toBeInTheDocument();
    });

    it('updates pagination pageSize via input', () => {
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

        fireEvent.change(screen.getByTestId('input-pagination-pageSize'), { target: { value: '50' } });
        expect(onViewUpdate).toHaveBeenCalledWith('pagination', expect.objectContaining({ pageSize: 50 }));
    });

    it('shows export sub-config when allowExport is true', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, allowExport: true }}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        expect(screen.getByTestId('export-formats')).toBeInTheDocument();
        expect(screen.getByTestId('input-export-maxRecords')).toBeInTheDocument();
        expect(screen.getByTestId('toggle-export-includeHeaders')).toBeInTheDocument();
        expect(screen.getByTestId('input-export-fileNamePrefix')).toBeInTheDocument();
    });

    it('renders showRecordCount toggle', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        expect(screen.getByTestId('toggle-showRecordCount')).toBeInTheDocument();
    });

    it('renders allowPrinting toggle', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        expect(screen.getByTestId('toggle-allowPrinting')).toBeInTheDocument();
    });

    it('renders searchable fields selector when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        // Click to expand searchable fields
        fireEvent.click(screen.getByText('console.objectView.searchableFields'));
        expect(screen.getByTestId('searchable-fields-selector')).toBeInTheDocument();
        expect(screen.getByTestId('searchable-field-name')).toBeInTheDocument();
    });

    it('updates searchableFields when field checkbox is toggled', () => {
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

        fireEvent.click(screen.getByText('console.objectView.searchableFields'));
        fireEvent.click(screen.getByTestId('searchable-field-name'));
        expect(onViewUpdate).toHaveBeenCalledWith('searchableFields', ['name']);
    });

    it('renders filterable fields selector when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.filterableFields'));
        expect(screen.getByTestId('filterable-fields-selector')).toBeInTheDocument();
    });

    it('renders hidden fields selector when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.hiddenFields'));
        expect(screen.getByTestId('hidden-fields-selector')).toBeInTheDocument();
    });

    it('renders virtualScroll toggle in data section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('toggle-virtualScroll')).toBeInTheDocument();
    });

    it('renders resizable toggle in appearance section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('toggle-resizable')).toBeInTheDocument();
    });

    it('toggles resizable and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('toggle-resizable'));
        expect(onViewUpdate).toHaveBeenCalledWith('resizable', true);
    });

    // densityMode tests removed — densityMode field was removed (redundant with rowHeight)

    it('renders conditional formatting editor when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.conditionalFormatting'));
        expect(screen.getByTestId('conditional-formatting-editor')).toBeInTheDocument();
        expect(screen.getByTestId('add-conditional-rule')).toBeInTheDocument();
    });

    it('adds a conditional formatting rule', () => {
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

        fireEvent.click(screen.getByText('console.objectView.conditionalFormatting'));
        fireEvent.click(screen.getByTestId('add-conditional-rule'));
        expect(onViewUpdate).toHaveBeenCalledWith('conditionalFormatting', expect.arrayContaining([
            expect.objectContaining({ field: '', operator: 'equals', value: '' }),
        ]));
    });

    it('renders quick filters editor when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByText('console.objectView.quickFilters'));
        expect(screen.getByTestId('quick-filters-editor')).toBeInTheDocument();
        expect(screen.getByTestId('add-quick-filter')).toBeInTheDocument();
    });

    it('adds a quick filter', () => {
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

        fireEvent.click(screen.getByText('console.objectView.quickFilters'));
        fireEvent.click(screen.getByTestId('add-quick-filter'));
        expect(onViewUpdate).toHaveBeenCalledWith('quickFilters', expect.arrayContaining([
            expect.objectContaining({ label: '', filters: [], defaultActive: false }),
        ]));
    });

    it('renders empty state inputs in appearance section', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('input-emptyState-title')).toBeInTheDocument();
        expect(screen.getByTestId('input-emptyState-message')).toBeInTheDocument();
        expect(screen.getByTestId('input-emptyState-icon')).toBeInTheDocument();
    });

    it('renders sharing section with enabled toggle', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-sharing'));
        expect(screen.getByTestId('toggle-sharing-enabled')).toBeInTheDocument();
    });

    it('shows sharing visibility select when sharing is enabled', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, sharing: { enabled: true, visibility: 'team' } }}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-sharing'));
        expect(screen.getByTestId('select-sharing-visibility')).toBeInTheDocument();
        expect(screen.getByTestId('select-sharing-visibility')).toHaveValue('team');
    });

    it('toggles sharing enabled and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-sharing'));
        fireEvent.click(screen.getByTestId('toggle-sharing-enabled'));
        expect(onViewUpdate).toHaveBeenCalledWith('sharing', expect.objectContaining({ enabled: true }));
    });

    it('renders accessibility section with ARIA inputs', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-accessibility'));
        expect(screen.getByTestId('input-aria-label')).toBeInTheDocument();
        expect(screen.getByTestId('input-aria-describedBy')).toBeInTheDocument();
        expect(screen.getByTestId('select-aria-live')).toBeInTheDocument();
    });

    it('renders addRecord sub-editor when enabled', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, addRecordViaForm: true, addRecord: { enabled: true } }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.getByTestId('select-addRecord-position')).toBeInTheDocument();
        expect(screen.getByTestId('select-addRecord-mode')).toBeInTheDocument();
        expect(screen.getByTestId('input-addRecord-formView')).toBeInTheDocument();
    });

    it('renders row actions selector when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.rowActions'));
        expect(screen.getByTestId('row-actions-selector')).toBeInTheDocument();
    });

    it('renders bulk actions selector when expanded', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.bulkActions'));
        expect(screen.getByTestId('bulk-actions-selector')).toBeInTheDocument();
    });

    it('renders row height buttons with all 5 spec-aligned values', () => {
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

        expect(screen.getByTestId('row-height-compact')).toBeInTheDocument();
        expect(screen.getByTestId('row-height-short')).toBeInTheDocument();
        expect(screen.getByTestId('row-height-medium')).toBeInTheDocument();
        expect(screen.getByTestId('row-height-tall')).toBeInTheDocument();
        expect(screen.getByTestId('row-height-extra_tall')).toBeInTheDocument();

        // Click compact and verify update
        fireEvent.click(screen.getByTestId('row-height-compact'));
        expect(onViewUpdate).toHaveBeenCalledWith('rowHeight', 'compact');

        // Click tall and verify update
        fireEvent.click(screen.getByTestId('row-height-tall'));
        expect(onViewUpdate).toHaveBeenCalledWith('rowHeight', 'tall');
    });

    // ── Interaction tests for emptyState, ARIA, rowActions, bulkActions, showRecordCount, allowPrinting, virtualScroll ──

    it('updates emptyState title via input and calls onViewUpdate', () => {
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

        fireEvent.change(screen.getByTestId('input-emptyState-title'), { target: { value: 'No data' } });
        expect(onViewUpdate).toHaveBeenCalledWith('emptyState', expect.objectContaining({ title: 'No data' }));
    });

    it('updates emptyState message via input and calls onViewUpdate', () => {
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

        fireEvent.change(screen.getByTestId('input-emptyState-message'), { target: { value: 'Try adding records' } });
        expect(onViewUpdate).toHaveBeenCalledWith('emptyState', expect.objectContaining({ message: 'Try adding records' }));
    });

    it('updates emptyState icon via input and calls onViewUpdate', () => {
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

        fireEvent.change(screen.getByTestId('input-emptyState-icon'), { target: { value: 'inbox' } });
        expect(onViewUpdate).toHaveBeenCalledWith('emptyState', expect.objectContaining({ icon: 'inbox' }));
    });

    it('updates ARIA label via input and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-accessibility'));
        fireEvent.change(screen.getByTestId('input-aria-label'), { target: { value: 'Contacts table' } });
        expect(onViewUpdate).toHaveBeenCalledWith('aria', expect.objectContaining({ label: 'Contacts table' }));
    });

    it('updates ARIA describedBy via input and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-accessibility'));
        fireEvent.change(screen.getByTestId('input-aria-describedBy'), { target: { value: 'table-desc' } });
        expect(onViewUpdate).toHaveBeenCalledWith('aria', expect.objectContaining({ describedBy: 'table-desc' }));
    });

    it('changes ARIA live region and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-accessibility'));
        fireEvent.change(screen.getByTestId('select-aria-live'), { target: { value: 'polite' } });
        expect(onViewUpdate).toHaveBeenCalledWith('aria', expect.objectContaining({ live: 'polite' }));
    });

    it('updates rowActions via input and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.rowActions'));
        fireEvent.change(screen.getByTestId('input-rowActions'), { target: { value: 'edit, delete' } });
        expect(onViewUpdate).toHaveBeenCalledWith('rowActions', ['edit', 'delete']);
    });

    it('updates bulkActions via input and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.bulkActions'));
        fireEvent.change(screen.getByTestId('input-bulkActions'), { target: { value: 'delete, export' } });
        expect(onViewUpdate).toHaveBeenCalledWith('bulkActions', ['delete', 'export']);
    });

    it('toggles showRecordCount and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        fireEvent.click(screen.getByTestId('toggle-showRecordCount'));
        expect(onViewUpdate).toHaveBeenCalledWith('showRecordCount', true);
    });

    it('toggles allowPrinting and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-exportPrint'));
        fireEvent.click(screen.getByTestId('toggle-allowPrinting'));
        expect(onViewUpdate).toHaveBeenCalledWith('allowPrinting', true);
    });

    it('toggles virtualScroll and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('toggle-virtualScroll'));
        expect(onViewUpdate).toHaveBeenCalledWith('virtualScroll', true);
    });

    // ── Spec alignment: toggle interaction tests for all switch fields ──

    it('toggles showDescription and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('toggle-showDescription'));
        expect(onViewUpdate).toHaveBeenCalledWith('showDescription', false);
    });

    it('toggles addDeleteRecordsInline and calls onViewUpdate', () => {
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

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByTestId('toggle-addDeleteRecordsInline'));
        expect(onViewUpdate).toHaveBeenCalledWith('addDeleteRecordsInline', false);
    });

    // ── Conditional rendering: sharing visibility hidden when disabled ──

    it('hides sharing visibility select when sharing is not enabled', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, sharing: { enabled: false } }}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-sharing'));
        expect(screen.getByTestId('toggle-sharing-enabled')).toBeInTheDocument();
        expect(screen.queryByTestId('select-sharing-visibility')).not.toBeInTheDocument();
    });

    it('hides sharing visibility select when sharing is undefined', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={mockActiveView}
                objectDef={mockObjectDef}
            />
        );

        fireEvent.click(screen.getByTestId('section-sharing'));
        expect(screen.queryByTestId('select-sharing-visibility')).not.toBeInTheDocument();
    });

    // ── Conditional rendering: navigation width hidden when mode is page ──

    it('hides navigation width when mode is page', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, navigation: { mode: 'page' } }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.queryByTestId('input-navigation-width')).not.toBeInTheDocument();
    });

    it('hides navigation openNewTab when mode is drawer', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, navigation: { mode: 'drawer' } }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.queryByTestId('toggle-navigation-openNewTab')).not.toBeInTheDocument();
    });

    // ── All 5 rowHeight buttons: click each value ──

    it('clicks all 5 rowHeight buttons and verifies onViewUpdate for each', () => {
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

        const heights = ['compact', 'short', 'medium', 'tall', 'extra_tall'];
        heights.forEach((h) => {
            fireEvent.click(screen.getByTestId(`row-height-${h}`));
            expect(onViewUpdate).toHaveBeenCalledWith('rowHeight', h);
        });
        expect(onViewUpdate).toHaveBeenCalledTimes(heights.length);
    });

    // ── Boundary: empty actions input ──

    it('handles empty bulkActions input gracefully', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, bulkActions: ['delete'] }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.bulkActions'));
        fireEvent.change(screen.getByTestId('input-bulkActions'), { target: { value: '' } });
        expect(onViewUpdate).toHaveBeenCalledWith('bulkActions', []);
    });

    it('handles empty rowActions input gracefully', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, rowActions: ['edit'] }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('section-userActions'));
        fireEvent.click(screen.getByText('console.objectView.rowActions'));
        fireEvent.change(screen.getByTestId('input-rowActions'), { target: { value: '' } });
        expect(onViewUpdate).toHaveBeenCalledWith('rowActions', []);
    });

    // ── Boundary: long label in title input ──

    it('handles long label value in view title input', () => {
        const longLabel = 'A'.repeat(200);
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, label: longLabel }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        expect(screen.getByTestId('view-title-input')).toHaveValue(longLabel);
    });

    // ── Boundary: special characters in emptyState fields ──

    it('handles special characters in emptyState fields', () => {
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

        fireEvent.change(screen.getByTestId('input-emptyState-title'), { target: { value: '<script>alert("xss")</script>' } });
        expect(onViewUpdate).toHaveBeenCalledWith('emptyState', expect.objectContaining({
            title: '<script>alert("xss")</script>',
        }));
    });

    // ── pageSizeOptions input interaction ──

    it('updates pageSizeOptions via input', () => {
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

        const input = screen.getByTestId('input-pagination-pageSizeOptions');
        fireEvent.change(input, { target: { value: '10, 25, 50, 100' } });
        expect(onViewUpdate).toHaveBeenCalledWith('pagination', expect.objectContaining({
            pageSizeOptions: [10, 25, 50, 100],
        }));
    });

    it('filters invalid pageSizeOptions values (non-positive, NaN)', () => {
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

        const input = screen.getByTestId('input-pagination-pageSizeOptions');
        fireEvent.change(input, { target: { value: 'abc, 50, -10, 0' } });
        expect(onViewUpdate).toHaveBeenCalledWith('pagination', expect.objectContaining({
            pageSizeOptions: [50],
        }));
    });

    // densityMode enum test removed — densityMode field was removed (redundant with rowHeight)

    // ── Conditional rendering: addRecord sub-editor hidden when not enabled ──

    it('hides addRecord sub-editor when addRecordViaForm is false', () => {
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, addRecordViaForm: false }}
                objectDef={mockObjectDef}
            />
        );

        expect(screen.queryByTestId('select-addRecord-position')).not.toBeInTheDocument();
    });

    // ── Sharing visibility select changes value ──

    it('changes sharing visibility and calls onViewUpdate', () => {
        const onViewUpdate = vi.fn();
        render(
            <ViewConfigPanel
                open={true}
                onClose={vi.fn()}
                activeView={{ ...mockActiveView, sharing: { enabled: true, visibility: 'private' } }}
                objectDef={mockObjectDef}
                onViewUpdate={onViewUpdate}
            />
        );

        fireEvent.click(screen.getByTestId('section-sharing'));
        fireEvent.change(screen.getByTestId('select-sharing-visibility'), { target: { value: 'organization' } });
        expect(onViewUpdate).toHaveBeenCalledWith('sharing', expect.objectContaining({
            enabled: true,
            visibility: 'organization',
        }));
    });

    // ── ARIA live select enum ──

    it('changes ARIA live to all enum values', () => {
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

        fireEvent.click(screen.getByTestId('section-accessibility'));
        const select = screen.getByTestId('select-aria-live');
        ['polite', 'assertive', 'off'].forEach((mode) => {
            fireEvent.change(select, { target: { value: mode } });
            expect(onViewUpdate).toHaveBeenCalledWith('aria', expect.objectContaining({ live: mode }));
        });
    });
});
