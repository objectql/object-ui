/**
 * ViewConfigPanel
 *
 * Airtable-style right-side configuration panel for inline view editing.
 * Supports full interactive editing: inline text fields, toggle switches,
 * view type selection, and clickable rows for opening sub-editors.
 *
 * All changes are buffered in a local draft state. Clicking Save commits
 * the draft via onSave; Discard resets to the original activeView.
 *
 * Designed to be rendered inline (no overlay/Sheet) alongside the main content,
 * following the same pattern as MetadataPanel.
 */

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { Button, Switch, Input, Checkbox, FilterBuilder, SortBuilder } from '@object-ui/components';
import type { FilterGroup, SortItem } from '@object-ui/components';
import { X, Save, RotateCcw, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';

// ---------------------------------------------------------------------------
// Operator mapping: @objectstack/spec ↔ FilterBuilder
// ---------------------------------------------------------------------------
const SPEC_TO_BUILDER_OP: Record<string, string> = {
    '=': 'equals',
    '==': 'equals',
    '!=': 'notEquals',
    '<>': 'notEquals',
    '>': 'greaterThan',
    '<': 'lessThan',
    '>=': 'greaterOrEqual',
    '<=': 'lessOrEqual',
    'contains': 'contains',
    'not_contains': 'notContains',
    'is_empty': 'isEmpty',
    'is_not_empty': 'isNotEmpty',
    'in': 'in',
    'not_in': 'notIn',
    'not in': 'notIn',
    'before': 'before',
    'after': 'after',
    'between': 'between',
    // Pass-through for already-normalized IDs
    'equals': 'equals',
    'notEquals': 'notEquals',
    'greaterThan': 'greaterThan',
    'lessThan': 'lessThan',
    'greaterOrEqual': 'greaterOrEqual',
    'lessOrEqual': 'lessOrEqual',
    'notContains': 'notContains',
    'isEmpty': 'isEmpty',
    'isNotEmpty': 'isNotEmpty',
    'notIn': 'notIn',
};

const BUILDER_TO_SPEC_OP: Record<string, string> = {
    'equals': '=',
    'notEquals': '!=',
    'greaterThan': '>',
    'lessThan': '<',
    'greaterOrEqual': '>=',
    'lessOrEqual': '<=',
    'contains': 'contains',
    'notContains': 'not_contains',
    'isEmpty': 'is_empty',
    'isNotEmpty': 'is_not_empty',
    'in': 'in',
    'notIn': 'not in',
    'before': 'before',
    'after': 'after',
    'between': 'between',
};

// ---------------------------------------------------------------------------
// Field type normalization: ObjectUI → FilterBuilder
// ---------------------------------------------------------------------------
function normalizeFieldType(rawType?: string): 'text' | 'number' | 'boolean' | 'date' | 'select' {
    const t = (rawType || '').toLowerCase();
    if (['integer', 'int', 'float', 'double', 'number', 'currency', 'money', 'percent', 'rating'].includes(t)) return 'number';
    if (['date', 'datetime', 'datetime_tz', 'timestamp'].includes(t)) return 'date';
    if (['boolean', 'bool', 'checkbox', 'switch'].includes(t)) return 'boolean';
    if (['select', 'picklist', 'single_select', 'multi_select', 'enum'].includes(t)) return 'select';
    return 'text';
}

// ---------------------------------------------------------------------------
// Spec-style filter bridge: parse any supported format → FilterGroup conditions
// Formats: ['field','=',val], [['f','=',v],['f2','!=',v2]], ['and'|'or', ...]
// Also supports object-style: { field, operator, value }
// ---------------------------------------------------------------------------
function parseSpecFilter(raw: any): { logic: 'and' | 'or'; conditions: Array<{ id: string; field: string; operator: string; value: any }> } {
    if (!Array.isArray(raw) || raw.length === 0) {
        return { logic: 'and', conditions: [] };
    }

    // Detect ['and', ...conditions] or ['or', ...conditions]
    if (typeof raw[0] === 'string' && (raw[0] === 'and' || raw[0] === 'or')) {
        const logic = raw[0] as 'and' | 'or';
        const rest = raw.slice(1);
        const conditions = rest.flatMap((item: any) => parseSingleOrNested(item));
        return { logic, conditions };
    }

    // Detect single triplet: ['field', '=', value] (all primitives at top level)
    if (raw.length >= 2 && raw.length <= 3 && typeof raw[0] === 'string' && typeof raw[1] === 'string' && !Array.isArray(raw[0])) {
        // Check it's not an array of arrays
        if (!Array.isArray(raw[2])) {
            const cond = parseTriplet(raw);
            return { logic: 'and', conditions: cond ? [cond] : [] };
        }
    }

    // Detect array of conditions: [[...], [...]] or [{...}, {...}]
    if (Array.isArray(raw[0]) || (typeof raw[0] === 'object' && raw[0] !== null && !Array.isArray(raw[0]))) {
        const conditions = raw.flatMap((item: any) => parseSingleOrNested(item));
        return { logic: 'and', conditions };
    }

    // Fallback: try as single triplet
    const cond = parseTriplet(raw);
    return { logic: 'and', conditions: cond ? [cond] : [] };
}

function parseTriplet(arr: any[]): { id: string; field: string; operator: string; value: any } | null {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    const [field, op, value] = arr;
    if (typeof field !== 'string' || typeof op !== 'string') return null;
    return {
        id: crypto.randomUUID(),
        field,
        operator: SPEC_TO_BUILDER_OP[op] || op,
        value: value ?? '',
    };
}

function parseSingleOrNested(item: any): Array<{ id: string; field: string; operator: string; value: any }> {
    if (Array.isArray(item)) {
        const triplet = parseTriplet(item);
        return triplet ? [triplet] : [];
    }
    if (typeof item === 'object' && item !== null && item.field) {
        return [{
            id: item.id || crypto.randomUUID(),
            field: item.field,
            operator: SPEC_TO_BUILDER_OP[item.operator] || item.operator || 'equals',
            value: item.value ?? '',
        }];
    }
    return [];
}

/**
 * Convert FilterGroup conditions back to spec-style filter array.
 * Produces [['field','op',value], ...] for multiple conditions,
 * or ['field','op',value] for single condition,
 * or ['and'|'or', ...] when logic is 'or'.
 */
function toSpecFilter(logic: 'and' | 'or', conditions: Array<{ field: string; operator: string; value: any }>): any[] {
    const triplets = conditions
        .filter(c => c.field) // skip empty
        .map(c => [c.field, BUILDER_TO_SPEC_OP[c.operator] || c.operator, c.value]);

    if (triplets.length === 0) return [];
    if (triplets.length === 1 && logic === 'and') return triplets[0];
    if (logic === 'or') return ['or', ...triplets];
    return triplets;
}

/** View type labels for display */
const VIEW_TYPE_LABELS: Record<string, string> = {
    grid: 'Grid',
    kanban: 'Kanban',
    calendar: 'Calendar',
    gallery: 'Gallery',
    timeline: 'Timeline',
    gantt: 'Gantt',
    map: 'Map',
    chart: 'Chart',
};

/** All available view type keys */
const VIEW_TYPE_OPTIONS = Object.keys(VIEW_TYPE_LABELS);

/** Row height options with Tailwind gap classes for visual icons */
const ROW_HEIGHT_OPTIONS = [
    { value: 'short', gapClass: 'gap-0' },
    { value: 'medium', gapClass: 'gap-0.5' },
    { value: 'tall', gapClass: 'gap-1' },
    { value: 'extraTall', gapClass: 'gap-1.5' },
];

/** Editor panel types that can be opened from clickable rows */
export type EditorPanelType = 'columns' | 'filter' | 'sort';

export interface ViewConfigPanelProps {
    /** Whether the panel is open */
    open: boolean;
    /** Close callback */
    onClose: () => void;
    /** Panel mode: "edit" for existing views, "create" for new views */
    mode?: 'create' | 'edit';
    /** The active view definition */
    activeView: {
        id: string;
        label?: string;
        type?: string;
        columns?: string[];
        filter?: any[];
        sort?: any[];
        description?: string;
        showSearch?: boolean;
        showFilters?: boolean;
        showSort?: boolean;
        allowExport?: boolean;
        showDescription?: boolean;
        addRecordViaForm?: boolean;
        exportOptions?: any;
        [key: string]: any;
    };
    /** The object definition */
    objectDef: {
        name: string;
        label?: string;
        description?: string;
        fields?: Record<string, any>;
        [key: string]: any;
    };
    /** Optional record count to display */
    recordCount?: number;
    /** Called when any view config field changes (local draft update) */
    onViewUpdate?: (field: string, value: any) => void;
    /** Called to persist all draft changes */
    onSave?: (draft: Record<string, any>) => void;
    /** Called when create-mode view is created */
    onCreate?: (config: Record<string, any>) => void;
}

/** A single labeled row in the config panel */
function ConfigRow({ label, value, onClick, children }: { label: string; value?: string; onClick?: () => void; children?: React.ReactNode }) {
    const Wrapper = onClick ? 'button' : 'div';
    return (
        <Wrapper
            className={`flex items-center justify-between py-1.5 min-h-[32px] w-full text-left ${onClick ? 'cursor-pointer hover:bg-accent/50 rounded-sm -mx-1 px-1' : ''}`}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
        >
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            {children || (
                <span className="text-xs text-foreground truncate ml-4 text-right">{value}</span>
            )}
        </Wrapper>
    );
}

/** Section heading with optional collapse/expand support */
function SectionHeader({ title, collapsible, collapsed, onToggle, testId }: { title: string; collapsible?: boolean; collapsed?: boolean; onToggle?: () => void; testId?: string }) {
    if (collapsible) {
        return (
            <button
                data-testid={testId}
                className="flex items-center justify-between pt-4 pb-1.5 first:pt-0 w-full text-left"
                onClick={onToggle}
                type="button"
                aria-expanded={!collapsed}
            >
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
                {collapsed ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
            </button>
        );
    }
    return (
        <div className="pt-4 pb-1.5 first:pt-0" data-testid={testId}>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        </div>
    );
}

export function ViewConfigPanel({ open, onClose, mode = 'edit', activeView, objectDef, onViewUpdate, onSave, onCreate }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Default empty view for create mode
    const defaultNewView = useMemo(() => ({
        id: `view_${Date.now()}`,
        label: t('console.objectView.newView'),
        type: 'grid',
        columns: [],
        filter: [],
        sort: [],
        showSearch: true,
        showFilters: true,
        showSort: true,
    }), []);

    const effectiveActiveView = mode === 'create' ? defaultNewView : activeView;

    // Local draft state — clone of activeView, mutated by UI interactions
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [isDirty, setIsDirty] = useState(false);
    // Collapsible section state
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
    const toggleSection = useCallback((section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }, []);
    // Expandable sub-rows within Data section (sort, filter, fields)
    const [expandedDataSubs, setExpandedDataSubs] = useState<Record<string, boolean>>({});
    const toggleDataSub = useCallback((key: string) => {
        setExpandedDataSubs(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // Reset draft when switching to a different view (by ID change only).
    // We intentionally depend on activeView.id rather than the full activeView
    // object so that real-time draft propagation (via onViewUpdate → parent
    // setViewDraft → merged activeView) does not reset isDirty to false.
    useEffect(() => {
        setDraft({ ...effectiveActiveView });
        setIsDirty(mode === 'create');
    }, [mode, activeView.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Focus the panel when it opens for keyboard accessibility
    useEffect(() => {
        if (open && panelRef.current) {
            panelRef.current.focus();
        }
    }, [open]);

    /** Update a single field in the draft */
    const updateDraft = useCallback((field: string, value: any) => {
        setDraft(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
        onViewUpdate?.(field, value);
    }, [onViewUpdate]);

    /** Discard all draft changes */
    const handleDiscard = useCallback(() => {
        if (mode === 'create') {
            onClose();
            return;
        }
        setDraft({ ...activeView });
        setIsDirty(false);
    }, [activeView, mode, onClose]);

    /** Save draft via parent callback */
    const handleSave = useCallback(() => {
        if (mode === 'create') {
            onCreate?.(draft);
        } else {
            onSave?.(draft);
        }
        setIsDirty(false);
    }, [draft, onSave, onCreate, mode]);

    const panelTitle = mode === 'create'
        ? t('console.objectView.createView')
        : t('console.objectView.configureView');
    const viewLabel = draft.label || draft.id || activeView.id;
    const viewType = draft.type || 'grid';

    const hasSearch = draft.showSearch !== false;
    const hasFilter = draft.showFilters !== false;
    const hasSort = draft.showSort !== false;
    const hasExport = draft.exportOptions !== undefined || draft.allowExport !== false;
    const hasAddForm = draft.addRecordViaForm === true;
    const hasShowDescription = draft.showDescription !== false;

    // Derive field options from objectDef for FilterBuilder/SortBuilder
    const fieldOptions = useMemo(() => {
        if (!objectDef.fields) return [];
        return Object.entries(objectDef.fields).map(([key, field]: [string, any]) => ({
            value: key,
            label: field.label || key,
            type: normalizeFieldType(field.type),
            options: field.options,
        }));
    }, [objectDef.fields]);

    // Bridge: view filter (any spec format) → FilterGroup
    const filterGroupValue = useMemo<FilterGroup>(() => {
        const parsed = parseSpecFilter(draft.filter);
        return { id: 'root', logic: parsed.logic, conditions: parsed.conditions };
    }, [draft.filter]);

    // Bridge: view sort array → SortItem[]
    const sortItemsValue = useMemo<SortItem[]>(() => {
        return (Array.isArray(draft.sort) ? draft.sort : []).map((s: any) => ({
            id: s.id || crypto.randomUUID(),
            field: s.field || '',
            order: (s.order || s.direction || 'asc') as 'asc' | 'desc',
        }));
    }, [draft.sort]);

    /** Handle FilterBuilder changes → update draft.filter in spec format */
    const handleFilterChange = useCallback((group: FilterGroup) => {
        const specFilter = toSpecFilter(
            group.logic,
            group.conditions.map(c => ({
                field: c.field,
                operator: c.operator,
                value: c.value,
            }))
        );
        updateDraft('filter', specFilter);
    }, [updateDraft]);

    /** Handle SortBuilder changes → update draft.sort */
    const handleSortChange = useCallback((items: SortItem[]) => {
        const sortArr = items.map(s => ({
            id: s.id,
            field: s.field,
            order: s.order,
        }));
        updateDraft('sort', sortArr);
    }, [updateDraft]);

    /** Handle column checkbox toggle */
    const handleColumnToggle = useCallback((fieldName: string, checked: boolean) => {
        const currentCols: string[] = Array.isArray(draft.columns) ? [...draft.columns] : [];
        if (checked && !currentCols.includes(fieldName)) {
            currentCols.push(fieldName);
        } else if (!checked) {
            const idx = currentCols.indexOf(fieldName);
            if (idx >= 0) currentCols.splice(idx, 1);
        }
        updateDraft('columns', currentCols);
    }, [draft.columns, updateDraft]);

    /** Move a column up or down in the columns array */
    const handleColumnMove = useCallback((fieldName: string, direction: 'up' | 'down') => {
        const currentCols: string[] = Array.isArray(draft.columns) ? [...draft.columns] : [];
        const idx = currentCols.indexOf(fieldName);
        if (idx < 0) return;
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= currentCols.length) return;
        // Swap
        [currentCols[idx], currentCols[targetIdx]] = [currentCols[targetIdx], currentCols[idx]];
        updateDraft('columns', currentCols);
    }, [draft.columns, updateDraft]);

    /** Handle type-specific option change (e.g., kanban.groupByField, calendar.startDateField) */
    const handleTypeOptionChange = useCallback((typeKey: string, optionKey: string, value: any) => {
        const current = draft[typeKey] || {};
        updateDraft(typeKey, { ...current, [optionKey]: value });
    }, [draft, updateDraft]);

    if (!open) return null;

    // Summary values for compact Data section ConfigRows
    const sortCount = Array.isArray(draft.sort) ? draft.sort.filter((s: any) => s.field).length : 0;
    const filterCount = filterGroupValue.conditions.length;
    const visibleColumnsCount = Array.isArray(draft.columns) ? draft.columns.length : 0;
    const sortSummary = sortCount > 0
        ? t('console.objectView.sortsCount', { count: sortCount })
        : t('console.objectView.none');
    const filterSummary = filterCount > 0
        ? t('console.objectView.filtersCount', { count: filterCount })
        : t('console.objectView.none');
    const fieldsSummary = visibleColumnsCount > 0
        ? t('console.objectView.fieldsVisible', { count: visibleColumnsCount })
        : t('console.objectView.none');
    const groupByValue = draft.kanban?.groupByField || draft.kanban?.groupField || draft.groupBy || '';

    return (
        <div
            ref={panelRef}
            data-testid="view-config-panel"
            role="complementary"
            aria-label={panelTitle}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 w-full sm:w-72 lg:w-80 sm:relative sm:inset-auto border-l bg-background flex flex-col shrink-0 z-20 transition-all overflow-hidden"
        >
            {/* Panel Header — breadcrumb hierarchy: Page > ViewType */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1 text-sm truncate" data-testid="panel-breadcrumb">
                    <span className="text-muted-foreground">{t('console.objectView.page')}</span>
                    <span className="text-muted-foreground">›</span>
                    <span className="text-foreground font-semibold">{VIEW_TYPE_LABELS[viewType] || viewType}</span>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={onClose}
                    title={t('console.objectView.closePanel')}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-auto px-4 pb-4">
                {/* Page Section — title, description, view type */}
                <SectionHeader title={t('console.objectView.page')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.title')}>
                        <Input
                            data-testid="view-title-input"
                            className="h-7 text-xs w-32 text-right"
                            value={viewLabel}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDraft('label', e.target.value)}
                        />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.description')}>
                        <Input
                            data-testid="view-description-input"
                            className="h-7 text-xs w-32 text-right"
                            value={draft.description ?? ''}
                            placeholder={objectDef.description || t('console.objectView.noDescription')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateDraft('description', e.target.value)}
                        />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.viewType')}>
                        <select
                            data-testid="view-type-select"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground"
                            value={viewType}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft('type', e.target.value)}
                        >
                            {VIEW_TYPE_OPTIONS.map(vt => (
                                <option key={vt} value={vt}>{VIEW_TYPE_LABELS[vt]}</option>
                            ))}
                        </select>
                    </ConfigRow>
                </div>

                {/* Data Section — collapsible */}
                <SectionHeader
                    title={t('console.objectView.data')}
                    collapsible
                    collapsed={collapsedSections.data}
                    onToggle={() => toggleSection('data')}
                    testId="section-data"
                />
                {!collapsedSections.data && (
                    <div className="space-y-0.5">
                        <ConfigRow label={t('console.objectView.source')} value={objectDef.label || objectDef.name} />

                        {/* Sort by — compact summary row, click to expand */}
                        <ConfigRow
                            label={t('console.objectView.sortBy')}
                            value={sortSummary}
                            onClick={() => toggleDataSub('sort')}
                        />
                        {expandedDataSubs.sort && (
                            <div data-testid="inline-sort-builder" className="pb-2">
                                <SortBuilder
                                    fields={fieldOptions.map(f => ({ value: f.value, label: f.label }))}
                                    value={sortItemsValue}
                                    onChange={handleSortChange}
                                    className="[&_button]:h-7 [&_button]:text-xs"
                                />
                            </div>
                        )}

                        {/* Group by — universal field selector */}
                        <ConfigRow label={t('console.objectView.groupBy')}>
                            <select
                                data-testid="data-groupBy"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={groupByValue}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    updateDraft('groupBy', e.target.value);
                                    if (viewType === 'kanban') {
                                        handleTypeOptionChange('kanban', 'groupByField', e.target.value);
                                    }
                                }}
                            >
                                <option value="">{t('console.objectView.none')}</option>
                                {fieldOptions.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </ConfigRow>

                        {/* Prefix field */}
                        <ConfigRow label={t('console.objectView.prefixField')}>
                            <select
                                data-testid="data-prefixField"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={draft.prefixField || ''}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft('prefixField', e.target.value)}
                            >
                                <option value="">{t('console.objectView.none')}</option>
                                {fieldOptions.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </ConfigRow>

                        {/* Fields — compact summary, click to expand column selector */}
                        <ConfigRow
                            label={t('console.objectView.fields')}
                            value={fieldsSummary}
                            onClick={() => toggleDataSub('fields')}
                        />
                        {expandedDataSubs.fields && (
                            <div data-testid="column-selector" className="pb-2 space-y-0.5 max-h-48 overflow-auto">
                                {/* Selected columns — shown in draft order with reorder buttons */}
                                {Array.isArray(draft.columns) && draft.columns.length > 0 && (
                                    <div data-testid="selected-columns" className="space-y-0.5 pb-1 mb-1 border-b border-border/50">
                                        {draft.columns.map((colName: string, idx: number) => {
                                            const field = fieldOptions.find(f => f.value === colName);
                                            return (
                                                <div key={colName} className="flex items-center gap-1 text-xs hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                                    <Checkbox
                                                        data-testid={`col-checkbox-${colName}`}
                                                        checked={true}
                                                        onCheckedChange={() => handleColumnToggle(colName, false)}
                                                        className="h-3.5 w-3.5 shrink-0"
                                                    />
                                                    <span className="truncate flex-1">{field?.label || colName}</span>
                                                    <button
                                                        type="button"
                                                        data-testid={`col-move-up-${colName}`}
                                                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 shrink-0"
                                                        disabled={idx === 0}
                                                        onClick={() => handleColumnMove(colName, 'up')}
                                                        aria-label={`Move ${field?.label || colName} up`}
                                                    >
                                                        <ArrowUp className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        data-testid={`col-move-down-${colName}`}
                                                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 shrink-0"
                                                        disabled={idx === draft.columns.length - 1}
                                                        onClick={() => handleColumnMove(colName, 'down')}
                                                        aria-label={`Move ${field?.label || colName} down`}
                                                    >
                                                        <ArrowDown className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {/* Unselected fields — available to add */}
                                {fieldOptions
                                    .filter(f => !Array.isArray(draft.columns) || !draft.columns.includes(f.value))
                                    .map((f) => (
                                        <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                            <Checkbox
                                                data-testid={`col-checkbox-${f.value}`}
                                                checked={false}
                                                onCheckedChange={() => handleColumnToggle(f.value, true)}
                                                className="h-3.5 w-3.5"
                                            />
                                            <span className="truncate">{f.label}</span>
                                        </label>
                                    ))
                                }
                            </div>
                        )}

                        {/* Filter by — compact summary, click to expand */}
                        <ConfigRow
                            label={t('console.objectView.filterBy')}
                            value={filterSummary}
                            onClick={() => toggleDataSub('filter')}
                        />
                        {expandedDataSubs.filter && (
                            <div data-testid="inline-filter-builder" className="pb-2">
                                <FilterBuilder
                                    fields={fieldOptions}
                                    value={filterGroupValue}
                                    onChange={handleFilterChange}
                                    className="[&_button]:h-7 [&_button]:text-xs [&_input]:h-7 [&_input]:text-xs"
                                    showClearAll
                                />
                            </div>
                        )}

                        {/* Type-Specific Data Fields */}
                        {viewType !== 'grid' && (
                            <div data-testid="type-options-section" className="pt-1 space-y-2">
                                {viewType === 'kanban' && (
                                    <div>
                                        <span className="text-xs text-muted-foreground">{t('console.objectView.groupByField')}</span>
                                        <select
                                            data-testid="type-opt-kanban-groupByField"
                                            className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                            value={draft.kanban?.groupByField || draft.kanban?.groupField || ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('kanban', 'groupByField', e.target.value)}
                                        >
                                            <option value="">{t('console.objectView.selectField')}</option>
                                            {fieldOptions.map(f => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {viewType === 'calendar' && (
                                    <>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.startDateField')}</span>
                                            <select
                                                data-testid="type-opt-calendar-startDateField"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft.calendar?.startDateField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('calendar', 'startDateField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.endDateField')}</span>
                                            <select
                                                data-testid="type-opt-calendar-endDateField"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft.calendar?.endDateField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('calendar', 'endDateField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.titleField')}</span>
                                            <select
                                                data-testid="type-opt-calendar-titleField"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft.calendar?.titleField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('calendar', 'titleField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                                {viewType === 'map' && (
                                    <>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.latitudeField')}</span>
                                            <select
                                                data-testid="type-opt-map-latitudeField"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft.map?.latitudeField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('map', 'latitudeField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.longitudeField')}</span>
                                            <select
                                                data-testid="type-opt-map-longitudeField"
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft.map?.longitudeField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('map', 'longitudeField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                                {viewType === 'gallery' && (
                                    <div>
                                        <span className="text-xs text-muted-foreground">{t('console.objectView.imageField')}</span>
                                        <select
                                            data-testid="type-opt-gallery-imageField"
                                            className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                            value={draft.gallery?.imageField || ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange('gallery', 'imageField', e.target.value)}
                                        >
                                            <option value="">{t('console.objectView.selectField')}</option>
                                            {fieldOptions.map(f => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {(viewType === 'timeline' || viewType === 'gantt') && (
                                    <>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.dateField')}</span>
                                            <select
                                                data-testid={`type-opt-${viewType}-dateField`}
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft[viewType]?.dateField || draft[viewType]?.startDateField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange(viewType, 'dateField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-xs text-muted-foreground">{t('console.objectView.titleField')}</span>
                                            <select
                                                data-testid={`type-opt-${viewType}-titleField`}
                                                className="w-full text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground mt-1"
                                                value={draft[viewType]?.titleField || ''}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleTypeOptionChange(viewType, 'titleField', e.target.value)}
                                            >
                                                <option value="">{t('console.objectView.selectField')}</option>
                                                {fieldOptions.map(f => (
                                                    <option key={f.value} value={f.value}>{f.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {viewType === 'grid' && (
                            <div data-testid="type-options-section" className="hidden" />
                        )}

                        {/* Data options — search/filter/sort enables */}
                        <div className="pt-1 space-y-0.5">
                            <ConfigRow label={t('console.objectView.enableSearch')}>
                                <Switch
                                    data-testid="toggle-showSearch"
                                    checked={hasSearch}
                                    onCheckedChange={(checked: boolean) => updateDraft('showSearch', checked)}
                                    className="scale-75"
                                />
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.enableFilter')}>
                                <Switch
                                    data-testid="toggle-showFilters"
                                    checked={hasFilter}
                                    onCheckedChange={(checked: boolean) => updateDraft('showFilters', checked)}
                                    className="scale-75"
                                />
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.enableSort')}>
                                <Switch
                                    data-testid="toggle-showSort"
                                    checked={hasSort}
                                    onCheckedChange={(checked: boolean) => updateDraft('showSort', checked)}
                                    className="scale-75"
                                />
                            </ConfigRow>
                        </div>
                    </div>
                )}

                {/* Appearance Section — collapsible */}
                <SectionHeader
                    title={t('console.objectView.appearance')}
                    collapsible
                    collapsed={collapsedSections.appearance}
                    onToggle={() => toggleSection('appearance')}
                    testId="section-appearance"
                />
                {!collapsedSections.appearance && (
                    <div className="space-y-0.5">
                        <ConfigRow label={t('console.objectView.color')}>
                            <select
                                data-testid="appearance-color"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={draft.color || ''}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft('color', e.target.value)}
                            >
                                <option value="">{t('console.objectView.none')}</option>
                                {fieldOptions.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.fieldTextColor')}>
                            <select
                                data-testid="appearance-fieldTextColor"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={draft.fieldTextColor || ''}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft('fieldTextColor', e.target.value)}
                            >
                                <option value="">{t('console.objectView.none')}</option>
                                {fieldOptions.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.rowHeight')}>
                            <div className="flex gap-0.5" data-testid="appearance-rowHeight" role="radiogroup" aria-label={t('console.objectView.rowHeight')}>
                                {ROW_HEIGHT_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={(draft.rowHeight || 'short') === opt.value}
                                        aria-label={opt.value}
                                        data-testid={`row-height-${opt.value}`}
                                        className={`h-7 w-7 rounded border flex items-center justify-center ${
                                            (draft.rowHeight || 'short') === opt.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-input text-muted-foreground hover:bg-accent/50'
                                        }`}
                                        onClick={() => updateDraft('rowHeight', opt.value)}
                                        title={opt.value}
                                    >
                                        <div className={`flex flex-col items-center justify-center w-4 h-4 ${opt.gapClass}`}>
                                            <div className="w-3.5 h-px bg-current rounded-full" />
                                            <div className="w-3.5 h-px bg-current rounded-full" />
                                            <div className="w-3.5 h-px bg-current rounded-full" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.wrapHeaders')}>
                            <Switch
                                data-testid="toggle-wrapHeaders"
                                checked={draft.wrapHeaders === true}
                                onCheckedChange={(checked: boolean) => updateDraft('wrapHeaders', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.showFieldDescriptions')}>
                            <Switch
                                data-testid="toggle-showDescription"
                                checked={hasShowDescription}
                                onCheckedChange={(checked: boolean) => updateDraft('showDescription', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.collapseAllByDefault')}>
                            <Switch
                                data-testid="toggle-collapseAllByDefault"
                                checked={draft.collapseAllByDefault === true}
                                onCheckedChange={(checked: boolean) => updateDraft('collapseAllByDefault', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                    </div>
                )}

                {/* User Actions Section — collapsible */}
                <SectionHeader
                    title={t('console.objectView.userActions')}
                    collapsible
                    collapsed={collapsedSections.userActions}
                    onToggle={() => toggleSection('userActions')}
                    testId="section-userActions"
                />
                {!collapsedSections.userActions && (
                    <div className="space-y-0.5">
                        <ConfigRow label={t('console.objectView.editRecordsInline')}>
                            <Switch
                                data-testid="toggle-editRecordsInline"
                                checked={draft.editRecordsInline !== false}
                                onCheckedChange={(checked: boolean) => updateDraft('editRecordsInline', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.addDeleteRecordsInline')}>
                            <Switch
                                data-testid="toggle-addDeleteRecordsInline"
                                checked={draft.addDeleteRecordsInline !== false}
                                onCheckedChange={(checked: boolean) => updateDraft('addDeleteRecordsInline', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.clickIntoRecordDetails')}>
                            <Switch
                                data-testid="toggle-clickIntoRecordDetails"
                                checked={draft.clickIntoRecordDetails !== false}
                                onCheckedChange={(checked: boolean) => updateDraft('clickIntoRecordDetails', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.addRecordViaForm')}>
                            <Switch
                                data-testid="toggle-addRecordViaForm"
                                checked={hasAddForm}
                                onCheckedChange={(checked: boolean) => updateDraft('addRecordViaForm', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.allowExport')}>
                            <Switch
                                data-testid="toggle-allowExport"
                                checked={hasExport}
                                onCheckedChange={(checked: boolean) => updateDraft('allowExport', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                    </div>
                )}
            </div>

            {/* Footer — Save / Discard buttons */}
            {isDirty && (
                <div data-testid="view-config-footer" className="px-4 py-3 border-t flex items-center justify-end gap-2 shrink-0 bg-background">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={handleDiscard}
                        data-testid="view-config-discard"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('console.objectView.discard')}
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={handleSave}
                        data-testid="view-config-save"
                    >
                        <Save className="h-3.5 w-3.5" />
                        {t('console.objectView.save')}
                    </Button>
                </div>
            )}
        </div>
    );
}
