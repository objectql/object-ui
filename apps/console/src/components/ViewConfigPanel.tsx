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
import { Button, Switch, Input, Checkbox, FilterBuilder, SortBuilder, ConfigRow, SectionHeader } from '@object-ui/components';
import type { FilterGroup, SortItem } from '@object-ui/components';
import { X, Save, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';
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

/** Row height options with Tailwind gap classes for visual icons — aligned with spec: compact/medium/tall */
const ROW_HEIGHT_OPTIONS = [
    { value: 'compact', gapClass: 'gap-0' },
    { value: 'medium', gapClass: 'gap-0.5' },
    { value: 'tall', gapClass: 'gap-1' },
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
    const hasHideFields = draft.showHideFields !== false;
    const hasGroup = draft.showGroup !== false;
    const hasColor = draft.showColor !== false;
    const hasDensity = draft.showDensity !== false;
    const hasExport = draft.exportOptions != null || draft.allowExport === true;
    const hasAddForm = draft.addRecordViaForm === true || draft.addRecord?.enabled === true;
    const hasShowDescription = draft.showDescription !== false;
    const navigationMode = draft.navigation?.mode || 'page';

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
                {/* ── Page Config — toolbar, navigation, view shell ── */}
                <SectionHeader title={t('console.objectView.page')} />
                <p className="text-[10px] text-muted-foreground mb-1">{t('console.objectView.pageConfigHint')}</p>
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
                    {/* Page-level toolbar toggles */}
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
                    <ConfigRow label={t('console.objectView.enableHideFields')}>
                        <Switch
                            data-testid="toggle-showHideFields"
                            checked={hasHideFields}
                            onCheckedChange={(checked: boolean) => updateDraft('showHideFields', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.enableGroup')}>
                        <Switch
                            data-testid="toggle-showGroup"
                            checked={hasGroup}
                            onCheckedChange={(checked: boolean) => updateDraft('showGroup', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.enableColor')}>
                        <Switch
                            data-testid="toggle-showColor"
                            checked={hasColor}
                            onCheckedChange={(checked: boolean) => updateDraft('showColor', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.enableDensity')}>
                        <Switch
                            data-testid="toggle-showDensity"
                            checked={hasDensity}
                            onCheckedChange={(checked: boolean) => updateDraft('showDensity', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    {/* Navigation mode — replaces clickIntoRecordDetails toggle */}
                    <ConfigRow label={t('console.objectView.navigationMode')}>
                        <select
                            data-testid="select-navigation-mode"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                            value={navigationMode}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                const mode = e.target.value;
                                updateDraft('navigation', { ...(draft.navigation || {}), mode });
                                // Sync clickIntoRecordDetails for backward compatibility
                                updateDraft('clickIntoRecordDetails', mode !== 'none');
                            }}
                        >
                            <option value="page">Page</option>
                            <option value="drawer">Drawer</option>
                            <option value="modal">Modal</option>
                            <option value="split">Split</option>
                            <option value="popover">Popover</option>
                            <option value="new_window">New Window</option>
                            <option value="none">None</option>
                        </select>
                    </ConfigRow>
                    {/* navigation.width — shown for drawer/modal/split */}
                    {['drawer', 'modal', 'split'].includes(navigationMode) && (
                        <ConfigRow label={t('console.objectView.navigationWidth')}>
                            <Input
                                data-testid="input-navigation-width"
                                className="h-7 text-xs w-24 text-right"
                                value={draft.navigation?.width ?? ''}
                                placeholder="600px"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('navigation', { ...(draft.navigation || {}), mode: navigationMode, width: e.target.value })
                                }
                            />
                        </ConfigRow>
                    )}
                    {/* navigation.openNewTab — shown for page/new_window */}
                    {['page', 'new_window'].includes(navigationMode) && (
                        <ConfigRow label={t('console.objectView.openNewTab')}>
                            <Switch
                                data-testid="toggle-navigation-openNewTab"
                                checked={draft.navigation?.openNewTab === true}
                                onCheckedChange={(checked: boolean) =>
                                    updateDraft('navigation', { ...(draft.navigation || {}), mode: navigationMode, openNewTab: checked })
                                }
                                className="scale-75"
                            />
                        </ConfigRow>
                    )}
                    {/* Selection mode (P0-2) */}
                    <ConfigRow label={t('console.objectView.selectionMode')}>
                        <select
                            data-testid="select-selection-type"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                            value={draft.selection?.type || 'multiple'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                updateDraft('selection', { type: e.target.value })
                            }
                        >
                            <option value="none">{t('console.objectView.selectionNone')}</option>
                            <option value="single">{t('console.objectView.selectionSingle')}</option>
                            <option value="multiple">{t('console.objectView.selectionMultiple')}</option>
                        </select>
                    </ConfigRow>
                    {/* Add Record config (P1-12) — upgraded from simple toggle */}
                    <ConfigRow label={t('console.objectView.addRecordEnabled')}>
                        <Switch
                            data-testid="toggle-addRecord-enabled"
                            checked={hasAddForm}
                            onCheckedChange={(checked: boolean) => {
                                updateDraft('addRecordViaForm', checked);
                                updateDraft('addRecord', { ...(draft.addRecord || {}), enabled: checked });
                            }}
                            className="scale-75"
                        />
                    </ConfigRow>
                    {hasAddForm && (
                        <>
                            <ConfigRow label={t('console.objectView.addRecordPosition')}>
                                <select
                                    data-testid="select-addRecord-position"
                                    className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[100px]"
                                    value={draft.addRecord?.position || 'top'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        updateDraft('addRecord', { ...(draft.addRecord || {}), enabled: true, position: e.target.value })
                                    }
                                >
                                    <option value="top">Top</option>
                                    <option value="bottom">Bottom</option>
                                </select>
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.addRecordMode')}>
                                <select
                                    data-testid="select-addRecord-mode"
                                    className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[100px]"
                                    value={draft.addRecord?.mode || 'form'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        updateDraft('addRecord', { ...(draft.addRecord || {}), enabled: true, mode: e.target.value })
                                    }
                                >
                                    <option value="inline">Inline</option>
                                    <option value="form">Form</option>
                                    <option value="modal">Modal</option>
                                </select>
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.addRecordFormView')}>
                                <Input
                                    data-testid="input-addRecord-formView"
                                    className="h-7 text-xs w-24 text-right"
                                    value={draft.addRecord?.formView ?? ''}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateDraft('addRecord', { ...(draft.addRecord || {}), enabled: true, formView: e.target.value })
                                    }
                                />
                            </ConfigRow>
                        </>
                    )}
                    <ConfigRow label={t('console.objectView.allowExport')}>
                        <Switch
                            data-testid="toggle-allowExport"
                            checked={hasExport}
                            onCheckedChange={(checked: boolean) => updateDraft('allowExport', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    {/* Export options sub-config (P1-4) */}
                    {hasExport && (
                        <>
                            <ConfigRow label={t('console.objectView.exportFormats')}>
                                <div data-testid="export-formats" className="flex flex-wrap gap-1">
                                    {(['csv', 'xlsx', 'json', 'pdf'] as const).map(fmt => (
                                        <label key={fmt} className="flex items-center gap-1 text-xs cursor-pointer">
                                            <Checkbox
                                                data-testid={`export-format-${fmt}`}
                                                checked={(draft.exportOptions?.formats || []).includes(fmt)}
                                                onCheckedChange={(checked: boolean) => {
                                                    const current: string[] = draft.exportOptions?.formats || [];
                                                    const formats = checked
                                                        ? [...current, fmt]
                                                        : current.filter((f: string) => f !== fmt);
                                                    updateDraft('exportOptions', { ...(draft.exportOptions || {}), formats });
                                                }}
                                                className="h-3.5 w-3.5"
                                            />
                                            {fmt}
                                        </label>
                                    ))}
                                </div>
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.exportMaxRecords')}>
                                <Input
                                    data-testid="input-export-maxRecords"
                                    className="h-7 text-xs w-20 text-right"
                                    type="number"
                                    value={draft.exportOptions?.maxRecords ?? ''}
                                    placeholder="0"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateDraft('exportOptions', { ...(draft.exportOptions || {}), maxRecords: Number(e.target.value) || undefined })
                                    }
                                />
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.exportIncludeHeaders')}>
                                <Switch
                                    data-testid="toggle-export-includeHeaders"
                                    checked={draft.exportOptions?.includeHeaders !== false}
                                    onCheckedChange={(checked: boolean) =>
                                        updateDraft('exportOptions', { ...(draft.exportOptions || {}), includeHeaders: checked })
                                    }
                                    className="scale-75"
                                />
                            </ConfigRow>
                            <ConfigRow label={t('console.objectView.exportFileNamePrefix')}>
                                <Input
                                    data-testid="input-export-fileNamePrefix"
                                    className="h-7 text-xs w-24 text-right"
                                    value={draft.exportOptions?.fileNamePrefix ?? ''}
                                    placeholder="export"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        updateDraft('exportOptions', { ...(draft.exportOptions || {}), fileNamePrefix: e.target.value })
                                    }
                                />
                            </ConfigRow>
                        </>
                    )}
                    {/* Show record count (P2-15) */}
                    <ConfigRow label={t('console.objectView.showRecordCount')}>
                        <Switch
                            data-testid="toggle-showRecordCount"
                            checked={draft.showRecordCount === true}
                            onCheckedChange={(checked: boolean) => updateDraft('showRecordCount', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                    {/* Allow printing (P2-16) */}
                    <ConfigRow label={t('console.objectView.allowPrinting')}>
                        <Switch
                            data-testid="toggle-allowPrinting"
                            checked={draft.allowPrinting === true}
                            onCheckedChange={(checked: boolean) => updateDraft('allowPrinting', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                </div>

                {/* ── Data Section — list-level data, filtering, sorting ── */}
                <SectionHeader
                    title={t('console.objectView.data')}
                    collapsible
                    collapsed={collapsedSections.data}
                    onToggle={() => toggleSection('data')}
                    testId="section-data"
                />
                <p className="text-[10px] text-muted-foreground mb-1">{t('console.objectView.listConfigHint')}</p>
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

                        {/* Pagination (P0-3) */}
                        <ConfigRow label={t('console.objectView.pageSize')}>
                            <Input
                                data-testid="input-pagination-pageSize"
                                className="h-7 text-xs w-20 text-right"
                                type="number"
                                value={draft.pagination?.pageSize ?? ''}
                                placeholder="25"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = Number(e.target.value) || undefined;
                                    updateDraft('pagination', { ...(draft.pagination || {}), pageSize: val });
                                }}
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.pageSizeOptions')}>
                            <Input
                                data-testid="input-pagination-pageSizeOptions"
                                className="h-7 text-xs w-28 text-right"
                                value={(draft.pagination?.pageSizeOptions || []).join(', ')}
                                placeholder="10, 25, 50, 100"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const opts = e.target.value.split(',').map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
                                    updateDraft('pagination', { ...(draft.pagination || {}), pageSizeOptions: opts.length ? opts : undefined });
                                }}
                            />
                        </ConfigRow>

                        {/* Searchable fields (P1-5) */}
                        <ConfigRow
                            label={t('console.objectView.searchableFields')}
                            value={`${(draft.searchableFields || []).length} selected`}
                            onClick={() => toggleDataSub('searchableFields')}
                        />
                        {expandedDataSubs.searchableFields && (
                            <div data-testid="searchable-fields-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                {fieldOptions.map(f => (
                                    <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                        <Checkbox
                                            data-testid={`searchable-field-${f.value}`}
                                            checked={(draft.searchableFields || []).includes(f.value)}
                                            onCheckedChange={(checked: boolean) => {
                                                const current: string[] = draft.searchableFields || [];
                                                const updated = checked
                                                    ? [...current, f.value]
                                                    : current.filter((v: string) => v !== f.value);
                                                updateDraft('searchableFields', updated);
                                            }}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">{f.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Filterable fields (P1-6) */}
                        <ConfigRow
                            label={t('console.objectView.filterableFields')}
                            value={`${(draft.filterableFields || []).length} selected`}
                            onClick={() => toggleDataSub('filterableFields')}
                        />
                        {expandedDataSubs.filterableFields && (
                            <div data-testid="filterable-fields-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                {fieldOptions.map(f => (
                                    <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                        <Checkbox
                                            data-testid={`filterable-field-${f.value}`}
                                            checked={(draft.filterableFields || []).includes(f.value)}
                                            onCheckedChange={(checked: boolean) => {
                                                const current: string[] = draft.filterableFields || [];
                                                const updated = checked
                                                    ? [...current, f.value]
                                                    : current.filter((v: string) => v !== f.value);
                                                updateDraft('filterableFields', updated);
                                            }}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">{f.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Hidden fields (P1-9) */}
                        <ConfigRow
                            label={t('console.objectView.hiddenFields')}
                            value={`${(draft.hiddenFields || []).length} hidden`}
                            onClick={() => toggleDataSub('hiddenFields')}
                        />
                        {expandedDataSubs.hiddenFields && (
                            <div data-testid="hidden-fields-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                {fieldOptions.map(f => (
                                    <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                        <Checkbox
                                            data-testid={`hidden-field-${f.value}`}
                                            checked={(draft.hiddenFields || []).includes(f.value)}
                                            onCheckedChange={(checked: boolean) => {
                                                const current: string[] = draft.hiddenFields || [];
                                                const updated = checked
                                                    ? [...current, f.value]
                                                    : current.filter((v: string) => v !== f.value);
                                                updateDraft('hiddenFields', updated);
                                            }}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">{f.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {/* Quick filters (P1-14) */}
                        <ConfigRow
                            label={t('console.objectView.quickFilters')}
                            value={`${(draft.quickFilters || []).length} filters`}
                            onClick={() => toggleDataSub('quickFilters')}
                        />
                        {expandedDataSubs.quickFilters && (
                            <div data-testid="quick-filters-editor" className="pb-2 space-y-1">
                                {(draft.quickFilters || []).map((qf: any, idx: number) => (
                                    <div key={qf.id || idx} className="flex items-center gap-1 text-xs">
                                        <Input
                                            data-testid={`quick-filter-label-${idx}`}
                                            className="h-6 text-xs flex-1"
                                            value={qf.label || ''}
                                            placeholder="Label"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const updated = [...(draft.quickFilters || [])];
                                                updated[idx] = { ...updated[idx], label: e.target.value };
                                                updateDraft('quickFilters', updated);
                                            }}
                                        />
                                        <Checkbox
                                            data-testid={`quick-filter-default-${idx}`}
                                            checked={qf.defaultActive === true}
                                            onCheckedChange={(checked: boolean) => {
                                                const updated = [...(draft.quickFilters || [])];
                                                updated[idx] = { ...updated[idx], defaultActive: checked };
                                                updateDraft('quickFilters', updated);
                                            }}
                                            className="h-3.5 w-3.5"
                                        />
                                        <button
                                            type="button"
                                            className="text-destructive hover:text-destructive/80 text-xs"
                                            onClick={() => {
                                                const updated = (draft.quickFilters || []).filter((_: any, i: number) => i !== idx);
                                                updateDraft('quickFilters', updated);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    data-testid="add-quick-filter"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => {
                                        const newFilter = { id: `qf_${Date.now()}`, label: '', filters: [], defaultActive: false };
                                        updateDraft('quickFilters', [...(draft.quickFilters || []), newFilter]);
                                    }}
                                >
                                    + {t('console.objectView.addQuickFilter')}
                                </button>
                            </div>
                        )}

                        {/* Virtual scroll (P2-17) */}
                        <ConfigRow label={t('console.objectView.virtualScroll')}>
                            <Switch
                                data-testid="toggle-virtualScroll"
                                checked={draft.virtualScroll === true}
                                onCheckedChange={(checked: boolean) => updateDraft('virtualScroll', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>

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
                    </div>
                )}

                {/* Appearance Section — collapsible (list-level) */}
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
                                        aria-checked={(draft.rowHeight || 'compact') === opt.value}
                                        aria-label={opt.value}
                                        data-testid={`row-height-${opt.value}`}
                                        className={`h-7 w-7 rounded border flex items-center justify-center ${
                                            (draft.rowHeight || 'compact') === opt.value
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
                        <ConfigRow label={t('console.objectView.striped')}>
                            <Switch
                                data-testid="toggle-striped"
                                checked={draft.striped === true}
                                onCheckedChange={(checked: boolean) => updateDraft('striped', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.bordered')}>
                            <Switch
                                data-testid="toggle-bordered"
                                checked={draft.bordered === true}
                                onCheckedChange={(checked: boolean) => updateDraft('bordered', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        {/* Resizable columns (P1-7) */}
                        <ConfigRow label={t('console.objectView.resizableColumns')}>
                            <Switch
                                data-testid="toggle-resizable"
                                checked={draft.resizable === true}
                                onCheckedChange={(checked: boolean) => updateDraft('resizable', checked)}
                                className="scale-75"
                            />
                        </ConfigRow>
                        {/* Density mode (P1-8) */}
                        <ConfigRow label={t('console.objectView.densityMode')}>
                            <select
                                data-testid="select-densityMode"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={draft.densityMode || 'comfortable'}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateDraft('densityMode', e.target.value)}
                            >
                                <option value="compact">{t('console.objectView.densityCompact')}</option>
                                <option value="comfortable">{t('console.objectView.densityComfortable')}</option>
                                <option value="spacious">{t('console.objectView.densitySpacious')}</option>
                            </select>
                        </ConfigRow>
                        {/* Conditional formatting (P1-13) */}
                        <ConfigRow
                            label={t('console.objectView.conditionalFormatting')}
                            value={`${(draft.conditionalFormatting || []).length} rules`}
                            onClick={() => toggleDataSub('conditionalFormatting')}
                        />
                        {expandedDataSubs.conditionalFormatting && (
                            <div data-testid="conditional-formatting-editor" className="pb-2 space-y-1">
                                {(draft.conditionalFormatting || []).map((rule: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1 text-xs border rounded p-1">
                                        <select
                                            data-testid={`cf-field-${idx}`}
                                            className="text-xs h-6 rounded border border-input bg-background px-1 flex-1"
                                            value={rule.field || ''}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                const updated = [...(draft.conditionalFormatting || [])];
                                                updated[idx] = { ...updated[idx], field: e.target.value };
                                                updateDraft('conditionalFormatting', updated);
                                            }}
                                        >
                                            <option value="">Field</option>
                                            {fieldOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                        </select>
                                        <select
                                            data-testid={`cf-operator-${idx}`}
                                            className="text-xs h-6 rounded border border-input bg-background px-1"
                                            value={rule.operator || 'equals'}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                const updated = [...(draft.conditionalFormatting || [])];
                                                updated[idx] = { ...updated[idx], operator: e.target.value };
                                                updateDraft('conditionalFormatting', updated);
                                            }}
                                        >
                                            <option value="equals">=</option>
                                            <option value="not_equals">≠</option>
                                            <option value="contains">contains</option>
                                            <option value="greater_than">&gt;</option>
                                            <option value="less_than">&lt;</option>
                                            <option value="in">in</option>
                                        </select>
                                        <Input
                                            data-testid={`cf-value-${idx}`}
                                            className="h-6 text-xs w-16"
                                            value={String(rule.value ?? '')}
                                            placeholder="Value"
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                const updated = [...(draft.conditionalFormatting || [])];
                                                updated[idx] = { ...updated[idx], value: e.target.value };
                                                updateDraft('conditionalFormatting', updated);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="text-destructive hover:text-destructive/80 text-xs"
                                            onClick={() => {
                                                const updated = (draft.conditionalFormatting || []).filter((_: any, i: number) => i !== idx);
                                                updateDraft('conditionalFormatting', updated);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    data-testid="add-conditional-rule"
                                    className="text-xs text-primary hover:underline"
                                    onClick={() => {
                                        const newRule = { field: '', operator: 'equals', value: '' };
                                        updateDraft('conditionalFormatting', [...(draft.conditionalFormatting || []), newRule]);
                                    }}
                                >
                                    + {t('console.objectView.addRule')}
                                </button>
                            </div>
                        )}
                        {/* Empty state (P2-18) */}
                        <ConfigRow label={t('console.objectView.emptyStateTitle')}>
                            <Input
                                data-testid="input-emptyState-title"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.title ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('emptyState', { ...(draft.emptyState || {}), title: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.emptyStateMessage')}>
                            <Input
                                data-testid="input-emptyState-message"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.message ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('emptyState', { ...(draft.emptyState || {}), message: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.emptyStateIcon')}>
                            <Input
                                data-testid="input-emptyState-icon"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.icon ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('emptyState', { ...(draft.emptyState || {}), icon: e.target.value })
                                }
                            />
                        </ConfigRow>
                    </div>
                )}

                {/* Inline Actions Section — list-level (collapsible) */}
                <SectionHeader
                    title={t('console.objectView.userActions')}
                    collapsible
                    collapsed={collapsedSections.userActions}
                    onToggle={() => toggleSection('userActions')}
                    testId="section-userActions"
                />
                {!collapsedSections.userActions && (
                    <div className="space-y-0.5">
                        {/* Semantic fix A: editRecordsInline → inlineEdit */}
                        <ConfigRow label={t('console.objectView.editRecordsInline')}>
                            <Switch
                                data-testid="toggle-editRecordsInline"
                                checked={draft.inlineEdit !== false}
                                onCheckedChange={(checked: boolean) => updateDraft('inlineEdit', checked)}
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
                        {/* Row actions (P1-10) */}
                        <ConfigRow
                            label={t('console.objectView.rowActions')}
                            value={`${(draft.rowActions || []).length} actions`}
                            onClick={() => toggleDataSub('rowActions')}
                        />
                        {expandedDataSubs.rowActions && (
                            <div data-testid="row-actions-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                <Input
                                    data-testid="input-rowActions"
                                    className="h-7 text-xs w-full"
                                    value={(draft.rowActions || []).join(', ')}
                                    placeholder="edit, delete, duplicate"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const actions = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                        updateDraft('rowActions', actions);
                                    }}
                                />
                            </div>
                        )}
                        {/* Bulk actions (P1-10) */}
                        <ConfigRow
                            label={t('console.objectView.bulkActions')}
                            value={`${(draft.bulkActions || []).length} actions`}
                            onClick={() => toggleDataSub('bulkActions')}
                        />
                        {expandedDataSubs.bulkActions && (
                            <div data-testid="bulk-actions-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                <Input
                                    data-testid="input-bulkActions"
                                    className="h-7 text-xs w-full"
                                    value={(draft.bulkActions || []).join(', ')}
                                    placeholder="delete, export, assign"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const actions = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                        updateDraft('bulkActions', actions);
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Sharing Section (P1-11) — collapsible */}
                <SectionHeader
                    title={t('console.objectView.sharing')}
                    collapsible
                    collapsed={collapsedSections.sharing}
                    onToggle={() => toggleSection('sharing')}
                    testId="section-sharing"
                />
                {!collapsedSections.sharing && (
                    <div className="space-y-0.5">
                        <ConfigRow label={t('console.objectView.sharingEnabled')}>
                            <Switch
                                data-testid="toggle-sharing-enabled"
                                checked={draft.sharing?.enabled === true}
                                onCheckedChange={(checked: boolean) =>
                                    updateDraft('sharing', { ...(draft.sharing || {}), enabled: checked })
                                }
                                className="scale-75"
                            />
                        </ConfigRow>
                        {draft.sharing?.enabled && (
                            <ConfigRow label={t('console.objectView.sharingVisibility')}>
                                <select
                                    data-testid="select-sharing-visibility"
                                    className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                    value={draft.sharing?.visibility || 'private'}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                        updateDraft('sharing', { ...(draft.sharing || {}), enabled: true, visibility: e.target.value })
                                    }
                                >
                                    <option value="private">Private</option>
                                    <option value="team">Team</option>
                                    <option value="organization">Organization</option>
                                    <option value="public">Public</option>
                                </select>
                            </ConfigRow>
                        )}
                    </div>
                )}

                {/* Accessibility Section (P2-19) — collapsible */}
                <SectionHeader
                    title={t('console.objectView.accessibility')}
                    collapsible
                    collapsed={collapsedSections.accessibility}
                    onToggle={() => toggleSection('accessibility')}
                    testId="section-accessibility"
                />
                {!collapsedSections.accessibility && (
                    <div className="space-y-0.5">
                        <ConfigRow label={t('console.objectView.ariaLabel')}>
                            <Input
                                data-testid="input-aria-label"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.aria?.label ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('aria', { ...(draft.aria || {}), label: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.ariaDescribedBy')}>
                            <Input
                                data-testid="input-aria-describedBy"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.aria?.describedBy ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateDraft('aria', { ...(draft.aria || {}), describedBy: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.ariaLive')}>
                            <select
                                data-testid="select-aria-live"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[100px]"
                                value={draft.aria?.live || 'off'}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                    updateDraft('aria', { ...(draft.aria || {}), live: e.target.value })
                                }
                            >
                                <option value="off">Off</option>
                                <option value="polite">Polite</option>
                                <option value="assertive">Assertive</option>
                            </select>
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
