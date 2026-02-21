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
import { Button, Switch, Input } from '@object-ui/components';
import { X, ChevronRight, Save, RotateCcw } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';

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
export type EditorPanelType = 'columns' | 'filters' | 'sort';

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
    /** Called to open a sub-editor panel (columns, filters, sort) */
    onOpenEditor?: (editor: EditorPanelType) => void;
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

export function ViewConfigPanel({ open, onClose, activeView, objectDef, onViewUpdate, onOpenEditor, onSave }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Local draft state — clone of activeView, mutated by UI interactions
    const [draft, setDraft] = useState<Record<string, any>>({});
    const [isDirty, setIsDirty] = useState(false);

    // Reset draft when activeView changes (e.g. switching views)
    useEffect(() => {
        setDraft({ ...activeView });
        setIsDirty(false);
    }, [activeView]);

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
    const columnCount = draft.columns?.length || 0;
    const filterCount = Array.isArray(draft.filter) ? draft.filter.length : 0;
    const sortCount = Array.isArray(draft.sort) ? draft.sort.length : 0;

    const hasSearch = draft.showSearch !== false;
    const hasFilter = draft.showFilters !== false;
    const hasSort = draft.showSort !== false;
    const hasExport = draft.exportOptions !== undefined || draft.allowExport !== false;
    const hasAddForm = draft.addRecordViaForm === true;
    const hasShowDescription = draft.showDescription !== false;

    // Format filter summary
    const filterSummary = useMemo(() => {
        if (filterCount === 0) return t('console.objectView.none');
        return `${filterCount} ${t('console.objectView.filterBy').toLowerCase()}`;
    }, [filterCount, t]);

    // Format sort summary
    const sortSummary = useMemo(() => {
        if (sortCount === 0) return t('console.objectView.none');
        return draft.sort?.map((s: any) => `${s.field} ${s.order || s.direction || 'asc'}`).join(', ') || t('console.objectView.none');
    }, [draft.sort, sortCount, t]);

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
                        <Input
                            data-testid="view-description-input"
                            className="h-7 text-xs w-32 text-right italic"
                            value={objectDef.description || ''}
                            placeholder={t('console.objectView.noDescription')}
                            readOnly
                        />
                    </ConfigRow>
                </div>

                {/* Data Section */}
                <SectionHeader title={t('console.objectView.data')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.source')} value={objectDef.label || objectDef.name} />
                    <ConfigRow label={t('console.objectView.columns')} onClick={() => onOpenEditor?.('columns')}>
                        <span className="text-xs text-foreground flex items-center gap-1">
                            {columnCount > 0 ? t('console.objectView.columnsConfigured', { count: columnCount }) : t('console.objectView.none')}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </span>
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.filterBy')} onClick={() => onOpenEditor?.('filters')}>
                        <span className="text-xs text-foreground flex items-center gap-1">
                            {filterSummary}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </span>
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.sortBy')} onClick={() => onOpenEditor?.('sort')}>
                        <span className="text-xs text-foreground flex items-center gap-1 truncate max-w-[140px]">
                            {sortSummary}
                            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        </span>
                    </ConfigRow>
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
