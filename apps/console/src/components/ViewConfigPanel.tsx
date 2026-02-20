/**
 * ViewConfigPanel
 *
 * Airtable-style right-side configuration panel for inline view editing.
 * Displays view settings organized into sections: Page, Data, Appearance,
 * User Filters, User Actions, and Advanced.
 *
 * Designed to be rendered inline (no overlay/Sheet) alongside the main content,
 * following the same pattern as MetadataPanel.
 */

import { useMemo } from 'react';
import { Button } from '@object-ui/components';
import { X, ChevronRight } from 'lucide-react';
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
}

/** A single labeled row in the config panel */
function ConfigRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between py-1.5 min-h-[32px]">
            <span className="text-xs text-muted-foreground shrink-0">{label}</span>
            {children || (
                <span className="text-xs text-foreground truncate ml-4 text-right">{value}</span>
            )}
        </div>
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

/** A toggle-style indicator (read-only for now, shows on/off state) */
function ToggleIndicator({ enabled }: { enabled: boolean }) {
    return (
        <div
            className={`w-8 h-5 rounded-full relative transition-colors ${
                enabled ? 'bg-primary' : 'bg-muted'
            }`}
            role="img"
            aria-label={enabled ? 'Enabled' : 'Disabled'}
        >
            <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
            />
        </div>
    );
}

export function ViewConfigPanel({ open, onClose, activeView, objectDef }: ViewConfigPanelProps) {
    const { t } = useObjectTranslation();

    const viewLabel = activeView.label || activeView.id;
    const viewType = activeView.type || 'grid';
    const columnCount = activeView.columns?.length || 0;
    const filterCount = Array.isArray(activeView.filter) ? activeView.filter.length : 0;
    const sortCount = Array.isArray(activeView.sort) ? activeView.sort.length : 0;

    const hasSearch = activeView.showSearch !== false;
    const hasFilter = activeView.showFilters !== false;
    const hasSort = activeView.showSort !== false;
    const hasExport = activeView.exportOptions !== undefined || activeView.allowExport !== false;

    // Format filter summary
    const filterSummary = useMemo(() => {
        if (filterCount === 0) return t('console.objectView.none');
        return `${filterCount} ${t('console.objectView.filterBy').toLowerCase()}`;
    }, [filterCount, t]);

    // Format sort summary
    const sortSummary = useMemo(() => {
        if (sortCount === 0) return t('console.objectView.none');
        return activeView.sort?.map((s: any) => `${s.field} ${s.order || s.direction || 'asc'}`).join(', ') || t('console.objectView.none');
    }, [activeView.sort, sortCount, t]);

    if (!open) return null;

    return (
        <div
            data-testid="view-config-panel"
            className="w-72 lg:w-80 border-l bg-background flex flex-col shrink-0 z-20 transition-all overflow-hidden"
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
                    <ConfigRow label={t('console.objectView.title')} value={viewLabel} />
                    <ConfigRow label={t('console.objectView.description')}>
                        <span className="text-xs text-muted-foreground italic truncate ml-4 text-right">
                            {objectDef.description || t('console.objectView.noDescription')}
                        </span>
                    </ConfigRow>
                </div>

                {/* Data Section */}
                <SectionHeader title={t('console.objectView.data')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.source')} value={objectDef.label || objectDef.name} />
                    <ConfigRow label={t('console.objectView.columns')}>
                        <span className="text-xs text-foreground flex items-center gap-1">
                            {columnCount > 0 ? t('console.objectView.columnsConfigured', { count: columnCount }) : t('console.objectView.none')}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </span>
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.filterBy')}>
                        <span className="text-xs text-foreground flex items-center gap-1">
                            {filterSummary}
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </span>
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.sortBy')}>
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
                        <ToggleIndicator enabled={!!objectDef.description} />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.viewType')} value={VIEW_TYPE_LABELS[viewType] || viewType} />
                </div>

                {/* User Filters Section */}
                <SectionHeader title={t('console.objectView.userFilters')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.enableSearch')}>
                        <ToggleIndicator enabled={hasSearch} />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.enableFilter')}>
                        <ToggleIndicator enabled={hasFilter} />
                    </ConfigRow>
                    <ConfigRow label={t('console.objectView.enableSort')}>
                        <ToggleIndicator enabled={hasSort} />
                    </ConfigRow>
                </div>

                {/* User Actions Section */}
                <SectionHeader title={t('console.objectView.userActions')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.addRecordViaForm')}>
                        <ToggleIndicator enabled={false} />
                    </ConfigRow>
                </div>

                {/* Advanced Section */}
                <SectionHeader title={t('console.objectView.advanced')} />
                <div className="space-y-0.5">
                    <ConfigRow label={t('console.objectView.allowExport')}>
                        <ToggleIndicator enabled={hasExport} />
                    </ConfigRow>
                </div>
            </div>
        </div>
    );
}
