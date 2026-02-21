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
import { X, Save, RotateCcw } from 'lucide-react';
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

/** Editor panel types that can be opened from clickable rows */
export interface ViewConfigPanelProps {
    /** Whether the panel is open */
    open: boolean;
    /** Close callback */
    onClose: () => void;
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

/** Section heading */
function SectionHeader({ title }: { title: string }) {
    return (
        <div className="pt-4 pb-1.5 first:pt-0">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h3>
        </div>
    );
}

export function ViewConfigPanel({ open, onClose, activeView, objectDef, onViewUpdate, onSave }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Local draft state — clone of activeView, mutated by UI interactions
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Reset draft when switching to a different view (by ID change only).
    // We intentionally depend on activeView.id rather than the full activeView
    // object so that real-time draft propagation (via onViewUpdate → parent
    // setViewDraft → merged activeView) does not reset isDirty to false.
    useEffect(() => {
        setDraft({ ...activeView });
        setIsDirty(false);
    }, [activeView.id]);

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
        setDraft({ ...activeView });
        setIsDirty(false);
    }, [activeView]);

    /** Save draft via parent callback */
    const handleSave = useCallback(() => {
        onSave?.(draft);
        setIsDirty(false);
    }, [draft, onSave]);

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

    if (!open) return null;

    return (
        <div
            ref={panelRef}
            data-testid="view-config-panel"
            role="complementary"
            aria-label={t('console.objectView.configureView')}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 w-full sm:w-72 lg:w-80 sm:relative sm:inset-auto border-l bg-background flex flex-col shrink-0 z-20 transition-all overflow-hidden"
        >
            {/* Panel Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
                <span className="text-sm font-semibold text-foreground truncate">
                    {t('console.objectView.configureView')}
                </span>
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
                {/* Page Section */}
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
                        <span className="text-xs text-muted-foreground italic truncate ml-4 text-right">
                            {objectDef.description || t('console.objectView.noDescription')}
                        </span>
                    </ConfigRow>
                </div>

                {/* Data Section */}
                <SectionHeader title={t('console.objectView.data')} />
                <div className="space-y-2">
                    <ConfigRow label={t('console.objectView.source')} value={objectDef.label || objectDef.name} />

                    {/* Columns — inline checkbox list */}
                    <div className="pt-1">
                        <span className="text-xs text-muted-foreground">{t('console.objectView.columns')}</span>
                        <div data-testid="column-selector" className="mt-1 space-y-1 max-h-36 overflow-auto">
                            {fieldOptions.map((f) => {
                                const checked = Array.isArray(draft.columns) ? draft.columns.includes(f.value) : false;
                                return (
                                    <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                        <Checkbox
                                            data-testid={`col-checkbox-${f.value}`}
                                            checked={checked}
                                            onCheckedChange={(c) => handleColumnToggle(f.value, c === true)}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span className="truncate">{f.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filters — inline FilterBuilder */}
                    <div className="pt-1">
                        <span className="text-xs text-muted-foreground">{t('console.objectView.filterBy')}</span>
                        <div data-testid="inline-filter-builder" className="mt-1">
                            <FilterBuilder
                                fields={fieldOptions}
                                value={filterGroupValue}
                                onChange={handleFilterChange}
                                className="[&_button]:h-7 [&_button]:text-xs [&_input]:h-7 [&_input]:text-xs"
                                showClearAll
                            />
                        </div>
                    </div>

                    {/* Sort — inline SortBuilder */}
                    <div className="pt-1">
                        <span className="text-xs text-muted-foreground">{t('console.objectView.sortBy')}</span>
                        <div data-testid="inline-sort-builder" className="mt-1">
                            <SortBuilder
                                fields={fieldOptions.map(f => ({ value: f.value, label: f.label }))}
                                value={sortItemsValue}
                                onChange={handleSortChange}
                                className="[&_button]:h-7 [&_button]:text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Appearance Section */}
                <SectionHeader title={t('console.objectView.appearance')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.showDescription')}>
                        <Switch
                            data-testid="toggle-showDescription"
                            checked={hasShowDescription}
                            onCheckedChange={(checked: boolean) => updateDraft('showDescription', checked)}
                            className="scale-75"
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

                {/* User Filters Section */}
                <SectionHeader title={t('console.objectView.userFilters')} />
                <div className="space-y-0.5">
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

                {/* User Actions Section */}
                <SectionHeader title={t('console.objectView.userActions')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.addRecordViaForm')}>
                        <Switch
                            data-testid="toggle-addRecordViaForm"
                            checked={hasAddForm}
                            onCheckedChange={(checked: boolean) => updateDraft('addRecordViaForm', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                </div>

                {/* Advanced Section */}
                <SectionHeader title={t('console.objectView.advanced')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.allowExport')}>
                        <Switch
                            data-testid="toggle-allowExport"
                            checked={hasExport}
                            onCheckedChange={(checked: boolean) => updateDraft('allowExport', checked)}
                            className="scale-75"
                        />
                    </ConfigRow>
                </div>
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
