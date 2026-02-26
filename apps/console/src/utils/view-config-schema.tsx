/**
 * ViewConfigPanel — Schema Factory
 *
 * Builds a ConfigPanelSchema that describes the entire ViewConfigPanel
 * structure declaratively. Complex widgets use type='custom' render functions.
 *
 * Field ordering within each section strictly follows the NamedListView
 * interface property declaration order in packages/types/src/objectql.ts.
 * Each field is annotated with its spec source (e.g. "spec: NamedListView.label").
 * Fields not present in the spec are annotated as "UI extension" with a
 * protocol suggestion.
 */

import React from 'react';
import { Input, Switch, Checkbox, FilterBuilder, SortBuilder, ConfigRow } from '@object-ui/components';
import type { ConfigPanelSchema, ConfigField } from '@object-ui/components';
import type { FilterGroup, SortItem } from '@object-ui/components';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    VIEW_TYPE_LABELS,
    VIEW_TYPE_OPTIONS,
    ROW_HEIGHT_OPTIONS,
    toSpecFilter,
    parseCommaSeparated,
    parseNumberList,
} from './view-config-utils';
import type { FieldOption } from './view-config-utils';

// ---------------------------------------------------------------------------
// Expandable widget — proper React component to avoid hooks-in-render issues
// ---------------------------------------------------------------------------

function ExpandableWidget({ renderSummary, children }: {
    renderSummary: (toggle: () => void) => React.ReactNode;
    children: React.ReactNode;
}) {
    const [expanded, setExpanded] = React.useState(false);
    return (
        <>
            {renderSummary(() => setExpanded(prev => !prev))}
            {expanded && children}
        </>
    );
}

// ---------------------------------------------------------------------------
// Sortable column item — drag-to-reorder within the field selector
// ---------------------------------------------------------------------------

/** Minimum pointer movement in pixels before drag-to-reorder activates (prevents accidental drags on click) */
const COLUMN_DRAG_ACTIVATION_DISTANCE = 5;

function SortableColumnItem({ colName, label, idx, total, onToggle, onMove }: {
    colName: string;
    label: string;
    idx: number;
    total: number;
    onToggle: (name: string, checked: boolean) => void;
    onMove: (name: string, direction: 'up' | 'down') => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: colName });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.5 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            data-field-name={colName}
            data-field-label={label}
            className="flex items-center gap-1 text-xs hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1 group"
        >
            <span
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab touch-none"
                data-testid={`col-drag-handle-${colName}`}
            >
                <GripVertical className="h-3 w-3 text-muted-foreground/50" />
            </span>
            <button
                type="button"
                data-testid={`col-eye-${colName}`}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent shrink-0"
                onClick={() => onToggle(colName, false)}
                aria-label={`Hide ${label}`}
            >
                <Eye className="h-3.5 w-3.5 text-primary" />
            </button>
            <span className="truncate flex-1">{label}</span>
            <button
                type="button"
                data-testid={`col-move-up-${colName}`}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={idx === 0}
                onClick={() => onMove(colName, 'up')}
                aria-label={`Move ${label} up`}
            >
                <GripVertical className="h-3 w-3 rotate-90" />
            </button>
            <button
                type="button"
                data-testid={`col-move-down-${colName}`}
                className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent disabled:opacity-30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={idx === total - 1}
                onClick={() => onMove(colName, 'down')}
                aria-label={`Move ${label} down`}
            >
                <GripVertical className="h-3 w-3 -rotate-90" />
            </button>
        </div>
    );
}

/** Wrapper component for drag-and-drop column selector (uses hooks for sensors) */
function DraggableColumnList({ columns, fieldOptions, onToggle, onMove, onReorder }: {
    columns: string[];
    fieldOptions: FieldOption[];
    onToggle: (name: string, checked: boolean) => void;
    onMove: (name: string, direction: 'up' | 'down') => void;
    onReorder: (newColumns: string[]) => void;
}) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: COLUMN_DRAG_ACTIVATION_DISTANCE } }),
        useSensor(KeyboardSensor),
    );

    const handleDragEnd = React.useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = columns.indexOf(String(active.id));
        const newIndex = columns.indexOf(String(over.id));
        if (oldIndex === -1 || newIndex === -1) return;
        onReorder(arrayMove(columns, oldIndex, newIndex));
    }, [columns, onReorder]);

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={columns} strategy={verticalListSortingStrategy}>
                {columns.map((colName, idx) => {
                    const field = fieldOptions.find(f => f.value === colName);
                    return (
                        <SortableColumnItem
                            key={colName}
                            colName={colName}
                            label={field?.label || colName}
                            idx={idx}
                            total={columns.length}
                            onToggle={onToggle}
                            onMove={onMove}
                        />
                    );
                })}
            </SortableContext>
        </DndContext>
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewSchemaFactoryOptions {
    t: (key: string, params?: Record<string, any>) => string;
    fieldOptions: FieldOption[];
    objectDef: { name: string; label?: string; description?: string; fields?: Record<string, any>; [key: string]: any };
    /** Full updateField from useConfigDraft — used by custom renders that touch multiple keys */
    updateField: (key: string, value: any) => void;
    /** Precomputed FilterGroup for the current draft.filter */
    filterGroupValue: FilterGroup;
    /** Precomputed SortItem[] for the current draft.sort */
    sortItemsValue: SortItem[];
}

// ---------------------------------------------------------------------------
// View-type visibility predicates
// ---------------------------------------------------------------------------

/** True when the view type is grid (or unset, since grid is the default) */
const isGridView = (draft: Record<string, any>) => draft.type == null || draft.type === 'grid';

/** True for views that support the Group toolbar button (grid/kanban/gallery have grouping support) */
const supportsGrouping = (draft: Record<string, any>) => draft.type == null || ['grid', 'kanban', 'gallery'].includes(draft.type);

/** True for views where the color field is consumed at runtime (grid, calendar, timeline, gantt) */
const supportsColorField = (draft: Record<string, any>) => draft.type == null || ['grid', 'calendar', 'timeline', 'gantt'].includes(draft.type);

/** True for views that support conditional formatting (grid, kanban) */
const supportsConditionalFormatting = (draft: Record<string, any>) => draft.type == null || ['grid', 'kanban'].includes(draft.type);

/** True for views that support row/bulk actions (grid, kanban) */
const supportsRowActions = (draft: Record<string, any>) => draft.type == null || ['grid', 'kanban'].includes(draft.type);

/** True for views that support generic groupBy (grid, gallery — kanban has dedicated groupByField) */
const supportsGenericGroupBy = (draft: Record<string, any>) => draft.type == null || ['grid', 'gallery'].includes(draft.type);

// ---------------------------------------------------------------------------
// Schema factory
// ---------------------------------------------------------------------------

export function buildViewConfigSchema(opts: ViewSchemaFactoryOptions): ConfigPanelSchema {
    const { t, fieldOptions, objectDef, updateField, filterGroupValue, sortItemsValue } = opts;

    // -- helpers for select options --
    const fieldSelectOptions = fieldOptions.map(f => ({ value: f.value, label: f.label }));
    const fieldSelectWithNone = [
        { value: '', label: t('console.objectView.none') },
        ...fieldSelectOptions,
    ];

    return {
        breadcrumb: [t('console.objectView.page')], // second segment set dynamically in ViewConfigPanel
        sections: [
            // ── General Section (title/description/type) ─────────
            buildGeneralSection(t, objectDef),
            // ── Toolbar Section (search/filter/sort toggles) ─────
            buildToolbarSection(t),
            // ── Navigation Section (click mode, drawer, etc.) ────
            buildNavigationSection(t, updateField),
            // ── Records Section (selection, add record, etc.) ────
            buildRecordsSection(t, updateField),
            // ── Export & Print Section ───────────────────────────
            buildExportPrintSection(t, updateField),
            // ── Data Section ─────────────────────────────────────
            buildDataSection(t, fieldOptions, fieldSelectWithNone, objectDef, updateField, filterGroupValue, sortItemsValue),
            // ── Appearance Section ───────────────────────────────
            buildAppearanceSection(t, fieldOptions, fieldSelectWithNone, updateField),
            // ── User Actions Section ─────────────────────────────
            buildUserActionsSection(t, updateField),
            // ── Sharing Section ──────────────────────────────────
            buildSharingSection(t, updateField),
            // ── Accessibility Section ────────────────────────────
            buildAccessibilitySection(t, updateField),
        ],
    };
}

// ---------------------------------------------------------------------------
// General Section (title, description, view type)
// ---------------------------------------------------------------------------

function buildGeneralSection(
    t: ViewSchemaFactoryOptions['t'],
    objectDef: ViewSchemaFactoryOptions['objectDef'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'general',
        title: t('console.objectView.general'),
        hint: t('console.objectView.generalHint'),
        fields: [
            // spec: NamedListView.label — required view display label
            {
                key: 'label',
                label: t('console.objectView.title'),
                type: 'custom',
                render: (value, onChange) => (
                    <ConfigRow label={t('console.objectView.title')}>
                        <Input
                            data-testid="view-title-input"
                            className="h-7 text-xs w-32 text-right"
                            value={value || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.description — optional view description
            {
                key: 'description',
                label: t('console.objectView.description'),
                type: 'custom',
                render: (value, onChange) => (
                    <ConfigRow label={t('console.objectView.description')}>
                        <Input
                            data-testid="view-description-input"
                            className="h-7 text-xs w-32 text-right"
                            value={value ?? ''}
                            placeholder={objectDef.description || t('console.objectView.noDescription')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.type — view type enum
            {
                key: 'type',
                label: t('console.objectView.viewType'),
                type: 'custom',
                render: (value, onChange) => (
                    <ConfigRow label={t('console.objectView.viewType')}>
                        <select
                            data-testid="view-type-select"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground"
                            value={value || 'grid'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
                        >
                            {VIEW_TYPE_OPTIONS.map(vt => (
                                <option key={vt} value={vt}>{VIEW_TYPE_LABELS[vt]}</option>
                            ))}
                        </select>
                    </ConfigRow>
                ),
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Toolbar Section (search, sort, filter, hide fields, group, color, density)
// ---------------------------------------------------------------------------

function buildToolbarSection(
    t: ViewSchemaFactoryOptions['t'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'toolbar',
        title: t('console.objectView.toolbar'),
        hint: t('console.objectView.toolbarHint'),
        collapsible: true,
        fields: [
            // Toolbar toggles — ordered per spec: showSearch, showSort, showFilters, showHideFields, showGroup, showColor, showDensity
            buildSwitchField('showSearch', t('console.objectView.enableSearch'), 'toggle-showSearch', true),       // spec: NamedListView.showSearch
            buildSwitchField('showSort', t('console.objectView.enableSort'), 'toggle-showSort', true),             // spec: NamedListView.showSort
            buildSwitchField('showFilters', t('console.objectView.enableFilter'), 'toggle-showFilters', true),     // spec: NamedListView.showFilters
            buildSwitchField('showHideFields', t('console.objectView.enableHideFields'), 'toggle-showHideFields', true), // spec: NamedListView.showHideFields
            buildSwitchField('showGroup', t('console.objectView.enableGroup'), 'toggle-showGroup', true,          // spec: NamedListView.showGroup
                false, undefined, supportsGrouping),
            buildSwitchField('showColor', t('console.objectView.enableColor'), 'toggle-showColor', true,          // spec: NamedListView.showColor
                false, undefined, supportsColorField),
            buildSwitchField('showDensity', t('console.objectView.enableDensity'), 'toggle-showDensity', true,    // spec: NamedListView.showDensity
                false, undefined, isGridView),
        ],
    };
}

// ---------------------------------------------------------------------------
// Navigation Section (navigation mode, width, open new tab)
// ---------------------------------------------------------------------------

function buildNavigationSection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'navigation',
        title: t('console.objectView.navigationSection'),
        hint: t('console.objectView.navigationHint'),
        collapsible: true,
        fields: [
            // spec: NamedListView.navigation — navigation mode/width/openNewTab
            {
                key: '_navigationMode',
                label: t('console.objectView.navigationMode'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const navMode = draft.navigation?.mode || 'page';
                    return (
                        <ConfigRow label={t('console.objectView.navigationMode')}>
                            <select
                                data-testid="select-navigation-mode"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={navMode}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    const mode = e.target.value;
                                    updateField('navigation', { ...(draft.navigation || {}), mode });
                                    updateField('clickIntoRecordDetails', mode !== 'none');
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
                    );
                },
            },
            // spec: NamedListView.navigation.width (visible for drawer/modal/split)
            {
                key: '_navigationWidth',
                label: t('console.objectView.navigationWidth'),
                type: 'custom',
                helpText: t('console.objectView.navigationWidthHint'),
                visibleWhen: (draft) => ['drawer', 'modal', 'split'].includes(draft.navigation?.mode || 'page'),
                render: (_value, _onChange, draft) => {
                    const navMode = draft.navigation?.mode || 'page';
                    return (
                        <ConfigRow label={t('console.objectView.navigationWidth')}>
                            <Input
                                data-testid="input-navigation-width"
                                className="h-7 text-xs w-24 text-right"
                                value={draft.navigation?.width ?? ''}
                                placeholder="600px"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateField('navigation', { ...(draft.navigation || {}), mode: navMode, width: e.target.value })
                                }
                            />
                        </ConfigRow>
                    );
                },
            },
            // spec: NamedListView.navigation.openNewTab (visible for page/new_window)
            {
                key: '_navigationOpenNewTab',
                label: t('console.objectView.openNewTab'),
                type: 'custom',
                helpText: t('console.objectView.openNewTabHint'),
                visibleWhen: (draft) => ['page', 'new_window'].includes(draft.navigation?.mode || 'page'),
                render: (_value, _onChange, draft) => {
                    const navMode = draft.navigation?.mode || 'page';
                    return (
                        <ConfigRow label={t('console.objectView.openNewTab')}>
                            <Switch
                                data-testid="toggle-navigation-openNewTab"
                                checked={draft.navigation?.openNewTab === true}
                                onCheckedChange={(checked: boolean) =>
                                    updateField('navigation', { ...(draft.navigation || {}), mode: navMode, openNewTab: checked })
                                }
                                className="scale-75"
                            />
                        </ConfigRow>
                    );
                },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Records Section (selection, add record, inline editing toggles)
// ---------------------------------------------------------------------------

function buildRecordsSection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'records',
        title: t('console.objectView.records'),
        hint: t('console.objectView.recordsHint'),
        collapsible: true,
        fields: [
            // spec: NamedListView.selection — row selection mode
            {
                key: '_selectionType',
                label: t('console.objectView.selectionMode'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.selectionMode')}>
                        <select
                            data-testid="select-selection-type"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                            value={draft.selection?.type || 'multiple'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                updateField('selection', { type: e.target.value })
                            }
                        >
                            <option value="none">{t('console.objectView.selectionNone')}</option>
                            <option value="single">{t('console.objectView.selectionSingle')}</option>
                            <option value="multiple">{t('console.objectView.selectionMultiple')}</option>
                        </select>
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.addRecordViaForm + NamedListView.addRecord — add record config
            {
                key: '_addRecord',
                label: t('console.objectView.addRecordEnabled'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const hasAddForm = draft.addRecordViaForm === true || draft.addRecord?.enabled === true;
                    return (
                        <>
                            <ConfigRow label={t('console.objectView.addRecordEnabled')}>
                                <Switch
                                    data-testid="toggle-addRecord-enabled"
                                    checked={hasAddForm}
                                    onCheckedChange={(checked: boolean) => {
                                        updateField('addRecordViaForm', checked);
                                        updateField('addRecord', { ...(draft.addRecord || {}), enabled: checked });
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
                                                updateField('addRecord', { ...(draft.addRecord || {}), enabled: true, position: e.target.value })
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
                                                updateField('addRecord', { ...(draft.addRecord || {}), enabled: true, mode: e.target.value })
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
                                                updateField('addRecord', { ...(draft.addRecord || {}), enabled: true, formView: e.target.value })
                                            }
                                        />
                                    </ConfigRow>
                                </>
                            )}
                        </>
                    );
                },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Export & Print Section
// ---------------------------------------------------------------------------

function buildExportPrintSection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'exportPrint',
        title: t('console.objectView.exportPrint'),
        hint: t('console.objectView.exportPrintHint'),
        collapsible: true,
        defaultCollapsed: true,
        fields: [
            // spec: NamedListView.allowExport + NamedListView.exportOptions — export toggle + sub-config
            {
                key: '_export',
                label: t('console.objectView.allowExport'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const hasExport = draft.exportOptions != null || draft.allowExport === true;
                    return (
                        <>
                            <ConfigRow label={t('console.objectView.allowExport')}>
                                <Switch
                                    data-testid="toggle-allowExport"
                                    checked={hasExport}
                                    onCheckedChange={(checked: boolean) => updateField('allowExport', checked)}
                                    className="scale-75"
                                />
                            </ConfigRow>
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
                                                            updateField('exportOptions', { ...(draft.exportOptions || {}), formats });
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
                                                updateField('exportOptions', { ...(draft.exportOptions || {}), maxRecords: Number(e.target.value) || undefined })
                                            }
                                        />
                                    </ConfigRow>
                                    <ConfigRow label={t('console.objectView.exportIncludeHeaders')}>
                                        <Switch
                                            data-testid="toggle-export-includeHeaders"
                                            checked={draft.exportOptions?.includeHeaders !== false}
                                            onCheckedChange={(checked: boolean) =>
                                                updateField('exportOptions', { ...(draft.exportOptions || {}), includeHeaders: checked })
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
                                                updateField('exportOptions', { ...(draft.exportOptions || {}), fileNamePrefix: e.target.value })
                                            }
                                        />
                                    </ConfigRow>
                                </>
                            )}
                        </>
                    );
                },
            },
            // spec: NamedListView.showRecordCount (grid-only: record count bar is a grid feature)
            buildSwitchField('showRecordCount', t('console.objectView.showRecordCount'), 'toggle-showRecordCount', false, true,
                undefined, isGridView),
            // spec: NamedListView.allowPrinting (grid-only: print renders grid table)
            buildSwitchField('allowPrinting', t('console.objectView.allowPrinting'), 'toggle-allowPrinting', false, true,
                undefined, isGridView),
        ],
    };
}

// ---------------------------------------------------------------------------
// Data Section
// ---------------------------------------------------------------------------

function buildDataSection(
    t: ViewSchemaFactoryOptions['t'],
    fieldOptions: FieldOption[],
    _fieldSelectWithNone: Array<{ value: string; label: string }>,
    objectDef: ViewSchemaFactoryOptions['objectDef'],
    updateField: ViewSchemaFactoryOptions['updateField'],
    filterGroupValue: FilterGroup,
    sortItemsValue: SortItem[],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'data',
        title: t('console.objectView.data'),
        hint: t('console.objectView.listConfigHint'),
        collapsible: true,
        fields: [
            // UI extension: read-only source display — not a NamedListView property.
            {
                key: '_source',
                label: t('console.objectView.source'),
                type: 'custom',
                render: () => (
                    <ConfigRow label={t('console.objectView.source')} value={objectDef.label || objectDef.name} />
                ),
            },
            // spec: NamedListView.columns — fields/columns selector (expandable, Airtable-style)
            {
                key: '_columns',
                label: t('console.objectView.fields'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const visibleColumnsCount = Array.isArray(draft.columns) ? draft.columns.length : 0;
                    const fieldsSummary = visibleColumnsCount > 0
                        ? t('console.objectView.fieldsVisible', { count: visibleColumnsCount })
                        : t('console.objectView.none');
                    const handleColumnToggle = (fieldName: string, checked: boolean) => {
                        const currentCols: string[] = Array.isArray(draft.columns) ? [...draft.columns] : [];
                        if (checked && !currentCols.includes(fieldName)) {
                            currentCols.push(fieldName);
                        } else if (!checked) {
                            const idx = currentCols.indexOf(fieldName);
                            if (idx >= 0) currentCols.splice(idx, 1);
                        }
                        updateField('columns', currentCols);
                    };

                    const handleColumnMove = (fieldName: string, direction: 'up' | 'down') => {
                        const currentCols: string[] = Array.isArray(draft.columns) ? [...draft.columns] : [];
                        const idx = currentCols.indexOf(fieldName);
                        if (idx < 0) return;
                        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                        if (targetIdx < 0 || targetIdx >= currentCols.length) return;
                        [currentCols[idx], currentCols[targetIdx]] = [currentCols[targetIdx], currentCols[idx]];
                        updateField('columns', currentCols);
                    };

                    const handleShowAll = () => {
                        updateField('columns', fieldOptions.map(f => f.value));
                    };

                    const handleHideAll = () => {
                        updateField('columns', []);
                    };

                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.fields')}
                                    value={fieldsSummary}
                                    onClick={toggle}
                                />
                            )}
                        >
                            <div data-testid="column-selector" className="pb-2 space-y-1">
                                {/* Search + Show All / Hide All controls */}
                                <div className="flex items-center gap-1 pb-1">
                                    <Input
                                        data-testid="column-search-input"
                                        className="h-6 text-xs flex-1"
                                        placeholder={t('console.objectView.searchFields')}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const input = e.target;
                                            const container = input.closest('[data-testid="column-selector"]');
                                            if (!container) return;
                                            const query = input.value.toLowerCase();
                                            container.querySelectorAll<HTMLElement>('[data-field-name]').forEach(el => {
                                                const name = el.getAttribute('data-field-name') || '';
                                                const label = el.getAttribute('data-field-label') || '';
                                                el.style.display = (!query || name.toLowerCase().includes(query) || label.toLowerCase().includes(query)) ? '' : 'none';
                                            });
                                        }}
                                    />
                                    <button
                                        type="button"
                                        data-testid="column-show-all"
                                        className="text-xs text-primary hover:underline whitespace-nowrap"
                                        onClick={handleShowAll}
                                    >
                                        {t('console.objectView.showAllFields')}
                                    </button>
                                    <button
                                        type="button"
                                        data-testid="column-hide-all"
                                        className="text-xs text-primary hover:underline whitespace-nowrap"
                                        onClick={handleHideAll}
                                    >
                                        {t('console.objectView.hideAllFields')}
                                    </button>
                                </div>
                                <div className="space-y-0.5 max-h-48 overflow-auto">
                                    {/* Visible (selected) columns with drag-and-drop reorder */}
                                    {Array.isArray(draft.columns) && draft.columns.length > 0 && (
                                        <div data-testid="selected-columns" className="space-y-0.5 pb-1 mb-1 border-b border-border/50">
                                            <DraggableColumnList
                                                columns={draft.columns}
                                                fieldOptions={fieldOptions}
                                                onToggle={handleColumnToggle}
                                                onMove={handleColumnMove}
                                                onReorder={(newCols) => updateField('columns', newCols)}
                                            />
                                        </div>
                                    )}
                                    {/* Hidden (unselected) fields with eye-off toggle */}
                                    {fieldOptions
                                        .filter(f => !Array.isArray(draft.columns) || !draft.columns.includes(f.value))
                                        .map((f) => (
                                            <div key={f.value} data-field-name={f.value} data-field-label={f.label} className="flex items-center gap-1 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                                <GripVertical className="h-3 w-3 text-muted-foreground/20 shrink-0" />
                                                <button
                                                    type="button"
                                                    data-testid={`col-eye-${f.value}`}
                                                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent shrink-0"
                                                    onClick={() => handleColumnToggle(f.value, true)}
                                                    aria-label={`Show ${f.label}`}
                                                >
                                                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                                </button>
                                                <span className="truncate text-muted-foreground">{f.label}</span>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // spec: NamedListView.filter — filter conditions (expandable)
            {
                key: '_filterBy',
                label: t('console.objectView.filterBy'),
                type: 'custom',
                render: (_value, _onChange, _draft) => {
                    const filterCount = filterGroupValue.conditions.length;
                    const filterSummary = filterCount > 0
                        ? t('console.objectView.filtersCount', { count: filterCount })
                        : t('console.objectView.none');
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.filterBy')}
                                    value={filterSummary}
                                    onClick={toggle}
                                />
                            )}
                        >
                            <div data-testid="inline-filter-builder" className="pb-2">
                                <FilterBuilder
                                    fields={fieldOptions}
                                    value={filterGroupValue}
                                    onChange={(group: FilterGroup) => {
                                        const specFilter = toSpecFilter(
                                            group.logic,
                                            group.conditions.map(c => ({ field: c.field, operator: c.operator, value: c.value }))
                                        );
                                        updateField('filter', specFilter);
                                    }}
                                    className="[&_button]:h-7 [&_button]:text-xs [&_input]:h-7 [&_input]:text-xs"
                                    showClearAll
                                />
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // spec: NamedListView.sort — sort configuration (expandable)
            {
                key: '_sortBy',
                label: t('console.objectView.sortBy'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const sortCount = Array.isArray(draft.sort) ? draft.sort.filter((s: any) => s.field).length : 0;
                    const sortSummary = sortCount > 0
                        ? t('console.objectView.sortsCount', { count: sortCount })
                        : t('console.objectView.none');
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.sortBy')}
                                    value={sortSummary}
                                    onClick={toggle}
                                />
                            )}
                        >
                            <div data-testid="inline-sort-builder" className="pb-2">
                                <SortBuilder
                                    fields={fieldOptions.map(f => ({ value: f.value, label: f.label }))}
                                    value={sortItemsValue}
                                    onChange={(items: SortItem[]) => {
                                        const sortArr = items.map(s => ({ id: s.id, field: s.field, order: s.order }));
                                        updateField('sort', sortArr);
                                    }}
                                    className="[&_button]:h-7 [&_button]:text-xs"
                                />
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // NOTE: prefixField removed — not consumed by any runtime renderer
            // UI extension: groupBy — visible for grid/gallery (kanban has dedicated type-specific option).
            {
                key: '_groupBy',
                label: t('console.objectView.groupBy'),
                type: 'custom',
                visibleWhen: supportsGenericGroupBy,
                render: (_value, _onChange, draft) => {
                    const viewType = draft.type || 'grid';
                    const groupByValue = draft.kanban?.groupByField || draft.kanban?.groupField || draft.groupBy || '';
                    return (
                        <ConfigRow label={t('console.objectView.groupBy')}>
                            <select
                                data-testid="data-groupBy"
                                className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                                value={groupByValue}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                    updateField('groupBy', e.target.value);
                                    if (viewType === 'kanban') {
                                        const current = draft.kanban || {};
                                        updateField('kanban', { ...current, groupByField: e.target.value });
                                    }
                                }}
                            >
                                <option value="">{t('console.objectView.none')}</option>
                                {fieldOptions.map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </ConfigRow>
                    );
                },
            },
            // spec: NamedListView.pagination.pageSize
            {
                key: '_pageSize',
                label: t('console.objectView.pageSize'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.pageSize')}>
                        <Input
                            data-testid="input-pagination-pageSize"
                            className="h-7 text-xs w-20 text-right"
                            type="number"
                            value={draft.pagination?.pageSize ?? ''}
                            placeholder="25"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const val = Number(e.target.value) || undefined;
                                updateField('pagination', { ...(draft.pagination || {}), pageSize: val });
                            }}
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.pagination.pageSizeOptions
            {
                key: '_pageSizeOptions',
                label: t('console.objectView.pageSizeOptions'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.pageSizeOptions')}>
                        <Input
                            data-testid="input-pagination-pageSizeOptions"
                            className="h-7 text-xs w-28 text-right"
                            value={(draft.pagination?.pageSizeOptions || []).join(', ')}
                            placeholder="10, 25, 50, 100"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const opts = parseNumberList(e.target.value);
                                updateField('pagination', { ...(draft.pagination || {}), pageSizeOptions: opts.length ? opts : undefined });
                            }}
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.searchableFields (universal: search applies at data fetch level for all views)
            buildFieldMultiSelect('searchableFields', t('console.objectView.searchableFields'), 'searchable-fields-selector', 'searchable-field', fieldOptions, updateField, 'selected'),
            // spec: NamedListView.filterableFields (universal: filter field whitelisting applies to all views)
            buildFieldMultiSelect('filterableFields', t('console.objectView.filterableFields'), 'filterable-fields-selector', 'filterable-field', fieldOptions, updateField, 'selected'),
            // spec: NamedListView.hiddenFields
            buildFieldMultiSelect('hiddenFields', t('console.objectView.hiddenFields'), 'hidden-fields-selector', 'hidden-field', fieldOptions, updateField, 'hidden'),
            // spec: NamedListView.quickFilters (universal: quick filter buttons render in toolbar for all views)
            {
                key: '_quickFilters',
                label: t('console.objectView.quickFilters'),
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.quickFilters')}
                                    value={`${(draft.quickFilters || []).length} filters`}
                                    onClick={toggle}
                                />
                            )}
                        >
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
                                                updateField('quickFilters', updated);
                                            }}
                                        />
                                        <Checkbox
                                            data-testid={`quick-filter-default-${idx}`}
                                            checked={qf.defaultActive === true}
                                            onCheckedChange={(checked: boolean) => {
                                                const updated = [...(draft.quickFilters || [])];
                                                updated[idx] = { ...updated[idx], defaultActive: checked };
                                                updateField('quickFilters', updated);
                                            }}
                                            className="h-3.5 w-3.5"
                                        />
                                        <button
                                            type="button"
                                            className="text-destructive hover:text-destructive/80 text-xs"
                                            onClick={() => {
                                                const updated = (draft.quickFilters || []).filter((_: any, i: number) => i !== idx);
                                                updateField('quickFilters', updated);
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
                                        const newFilter = { id: crypto.randomUUID(), label: '', filters: [], defaultActive: false };
                                        updateField('quickFilters', [...(draft.quickFilters || []), newFilter]);
                                    }}
                                >
                                    + {t('console.objectView.addQuickFilter')}
                                </button>
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // spec: NamedListView.virtualScroll (grid-only: virtual scrolling applies to grid row rendering)
            buildSwitchField('virtualScroll', t('console.objectView.virtualScroll'), 'toggle-virtualScroll', false, true,
                undefined, isGridView),
            // UI extension: type-specific options — maps to NamedListView kanban/calendar/gantt/gallery/timeline/map sub-configs
            {
                key: '_typeOptions',
                label: 'Type-specific options',
                type: 'custom',
                render: (_value, _onChange, draft) => {
                    const viewType = draft.type || 'grid';
                    const handleTypeOptionChange = (typeKey: string, optionKey: string, value: any) => {
                        const current = draft[typeKey] || {};
                        updateField(typeKey, { ...current, [optionKey]: value });
                    };

                    if (viewType === 'grid') {
                        return <div data-testid="type-options-section" className="hidden" />;
                    }

                    return (
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
                    );
                },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Appearance Section
// ---------------------------------------------------------------------------

function buildAppearanceSection(
    t: ViewSchemaFactoryOptions['t'],
    fieldOptions: FieldOption[],
    _fieldSelectWithNone: Array<{ value: string; label: string }>,
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'appearance',
        title: t('console.objectView.appearance'),
        collapsible: true,
        fields: [
            // spec: NamedListView.striped (grid-only: row striping is a grid concept)
            buildSwitchField('striped', t('console.objectView.striped'), 'toggle-striped', false, true,
                undefined, isGridView),
            // spec: NamedListView.bordered (grid-only: borders are a grid concept)
            buildSwitchField('bordered', t('console.objectView.bordered'), 'toggle-bordered', false, true,
                undefined, isGridView),
            // spec: NamedListView.color — field for row/card coloring (grid, calendar, timeline, gantt)
            {
                key: 'color',
                label: t('console.objectView.color'),
                type: 'custom',
                visibleWhen: supportsColorField,
                render: (value, onChange) => (
                    <ConfigRow label={t('console.objectView.color')}>
                        <select
                            data-testid="appearance-color"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                            value={value || ''}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
                        >
                            <option value="">{t('console.objectView.none')}</option>
                            {fieldOptions.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                        </select>
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.wrapHeaders (grid-only: column headers are a grid concept)
            buildSwitchField('wrapHeaders', t('console.objectView.wrapHeaders'), 'toggle-wrapHeaders', false, true,
                undefined, isGridView),
            // NOTE: collapseAllByDefault removed — not consumed by any runtime renderer
            // NOTE: fieldTextColor removed — not consumed by any runtime renderer
            // spec: NamedListView.showDescription (universal: view description shown below toolbar for all views)
            buildSwitchField('showDescription', t('console.objectView.showFieldDescriptions'), 'toggle-showDescription', true),
            // spec: NamedListView.resizable (grid-only: column resizing is a grid concept)
            buildSwitchField('resizable', t('console.objectView.resizableColumns'), 'toggle-resizable', false, true,
                undefined, isGridView),
            // NOTE: densityMode removed — redundant with rowHeight which provides finer 5-value granularity
            // spec: NamedListView.rowHeight — 5-value enum: compact/short/medium/tall/extra_tall (grid-only)
            {
                key: 'rowHeight',
                label: t('console.objectView.rowHeight'),
                type: 'custom',
                visibleWhen: isGridView,
                render: (value, onChange) => (
                    <ConfigRow label={t('console.objectView.rowHeight')}>
                        <div className="flex gap-0.5" data-testid="appearance-rowHeight" role="radiogroup" aria-label={t('console.objectView.rowHeight')}>
                            {ROW_HEIGHT_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={(value || 'compact') === opt.value}
                                    aria-label={opt.value}
                                    data-testid={`row-height-${opt.value}`}
                                    className={`h-7 w-7 rounded border flex items-center justify-center ${
                                        (value || 'compact') === opt.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-input text-muted-foreground hover:bg-accent/50'
                                    }`}
                                    onClick={() => onChange(opt.value)}
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
                ),
            },
            // spec: NamedListView.conditionalFormatting (grid/kanban: both process conditional formatting rules)
            {
                key: '_conditionalFormatting',
                label: t('console.objectView.conditionalFormatting'),
                type: 'custom',
                visibleWhen: supportsConditionalFormatting,
                render: (_value, _onChange, draft) => {
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.conditionalFormatting')}
                                    value={`${(draft.conditionalFormatting || []).length} rules`}
                                    onClick={toggle}
                                />
                            )}
                        >
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
                                                updateField('conditionalFormatting', updated);
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
                                                updateField('conditionalFormatting', updated);
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
                                                updateField('conditionalFormatting', updated);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="text-destructive hover:text-destructive/80 text-xs"
                                            onClick={() => {
                                                const updated = (draft.conditionalFormatting || []).filter((_: any, i: number) => i !== idx);
                                                updateField('conditionalFormatting', updated);
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
                                        updateField('conditionalFormatting', [...(draft.conditionalFormatting || []), newRule]);
                                    }}
                                >
                                    + {t('console.objectView.addRule')}
                                </button>
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // spec: NamedListView.emptyState
            {
                key: '_emptyState',
                label: 'Empty state',
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <>
                        <ConfigRow label={t('console.objectView.emptyStateTitle')}>
                            <Input
                                data-testid="input-emptyState-title"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.title ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateField('emptyState', { ...(draft.emptyState || {}), title: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.emptyStateMessage')}>
                            <Input
                                data-testid="input-emptyState-message"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.message ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateField('emptyState', { ...(draft.emptyState || {}), message: e.target.value })
                                }
                            />
                        </ConfigRow>
                        <ConfigRow label={t('console.objectView.emptyStateIcon')}>
                            <Input
                                data-testid="input-emptyState-icon"
                                className="h-7 text-xs w-28 text-right"
                                value={draft.emptyState?.icon ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateField('emptyState', { ...(draft.emptyState || {}), icon: e.target.value })
                                }
                            />
                        </ConfigRow>
                    </>
                ),
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// User Actions Section
// ---------------------------------------------------------------------------

function buildUserActionsSection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'userActions',
        title: t('console.objectView.userActions'),
        collapsible: true,
        defaultCollapsed: true,
        fields: [
            // spec: NamedListView.inlineEdit (grid-only: only ObjectGrid supports inline editing)
            buildSwitchField('inlineEdit', t('console.objectView.inlineEdit'), 'toggle-inlineEdit', true,
                false, undefined, isGridView),
            // NOTE: clickIntoRecordDetails removed — behavior is handled by navigation mode config, not consumed as a standalone field by runtime
            // spec: NamedListView.addDeleteRecordsInline (grid-only: inline add/delete is a grid feature)
            buildSwitchField('addDeleteRecordsInline', t('console.objectView.addDeleteRecordsInline'), 'toggle-addDeleteRecordsInline', true,
                false, undefined, isGridView),
            // spec: NamedListView.rowActions (grid/kanban: row action menus)
            {
                key: '_rowActions',
                label: t('console.objectView.rowActions'),
                type: 'custom',
                visibleWhen: supportsRowActions,
                render: (_value, _onChange, draft) => {
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.rowActions')}
                                    value={`${(draft.rowActions || []).length} actions`}
                                    onClick={toggle}
                                />
                            )}
                        >
                            <div data-testid="row-actions-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                <Input
                                    data-testid="input-rowActions"
                                    className="h-7 text-xs w-full"
                                    value={(draft.rowActions || []).join(', ')}
                                    placeholder="edit, delete, duplicate"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        updateField('rowActions', parseCommaSeparated(e.target.value));
                                    }}
                                />
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
            // spec: NamedListView.bulkActions (grid/kanban: bulk action bar)
            {
                key: '_bulkActions',
                label: t('console.objectView.bulkActions'),
                type: 'custom',
                visibleWhen: supportsRowActions,
                render: (_value, _onChange, draft) => {
                    return (
                        <ExpandableWidget
                            renderSummary={(toggle) => (
                                <ConfigRow
                                    label={t('console.objectView.bulkActions')}
                                    value={`${(draft.bulkActions || []).length} actions`}
                                    onClick={toggle}
                                />
                            )}
                        >
                            <div data-testid="bulk-actions-selector" className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                                <Input
                                    data-testid="input-bulkActions"
                                    className="h-7 text-xs w-full"
                                    value={(draft.bulkActions || []).join(', ')}
                                    placeholder="delete, export, assign"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        updateField('bulkActions', parseCommaSeparated(e.target.value));
                                    }}
                                />
                            </div>
                        </ExpandableWidget>
                    );
                },
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Sharing Section
// ---------------------------------------------------------------------------

function buildSharingSection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'sharing',
        title: t('console.objectView.sharing'),
        collapsible: true,
        defaultCollapsed: true,
        fields: [
            // spec: NamedListView.sharing.enabled
            {
                key: '_sharingEnabled',
                label: t('console.objectView.sharingEnabled'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.sharingEnabled')}>
                        <Switch
                            data-testid="toggle-sharing-enabled"
                            checked={draft.sharing?.enabled === true}
                            onCheckedChange={(checked: boolean) =>
                                updateField('sharing', { ...(draft.sharing || {}), enabled: checked })
                            }
                            className="scale-75"
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.sharing.visibility
            {
                key: '_sharingVisibility',
                label: t('console.objectView.sharingVisibility'),
                type: 'custom',
                visibleWhen: (draft) => draft.sharing?.enabled === true,
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.sharingVisibility')}>
                        <select
                            data-testid="select-sharing-visibility"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[120px]"
                            value={draft.sharing?.visibility || 'private'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                updateField('sharing', { ...(draft.sharing || {}), enabled: true, visibility: e.target.value })
                            }
                        >
                            <option value="private">Private</option>
                            <option value="team">Team</option>
                            <option value="organization">Organization</option>
                            <option value="public">Public</option>
                        </select>
                    </ConfigRow>
                ),
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Accessibility Section
// ---------------------------------------------------------------------------

function buildAccessibilitySection(
    t: ViewSchemaFactoryOptions['t'],
    updateField: ViewSchemaFactoryOptions['updateField'],
): ConfigPanelSchema['sections'][number] {
    return {
        key: 'accessibility',
        title: t('console.objectView.accessibility'),
        collapsible: true,
        defaultCollapsed: true,
        fields: [
            // spec: NamedListView.aria.label
            {
                key: '_ariaLabel',
                label: t('console.objectView.ariaLabel'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.ariaLabel')}>
                        <Input
                            data-testid="input-aria-label"
                            className="h-7 text-xs w-28 text-right"
                            value={draft.aria?.label ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateField('aria', { ...(draft.aria || {}), label: e.target.value })
                            }
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.aria.describedBy
            {
                key: '_ariaDescribedBy',
                label: t('console.objectView.ariaDescribedBy'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.ariaDescribedBy')}>
                        <Input
                            data-testid="input-aria-describedBy"
                            className="h-7 text-xs w-28 text-right"
                            value={draft.aria?.describedBy ?? ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                updateField('aria', { ...(draft.aria || {}), describedBy: e.target.value })
                            }
                        />
                    </ConfigRow>
                ),
            },
            // spec: NamedListView.aria.live — polite/assertive/off
            {
                key: '_ariaLive',
                label: t('console.objectView.ariaLive'),
                type: 'custom',
                render: (_value, _onChange, draft) => (
                    <ConfigRow label={t('console.objectView.ariaLive')}>
                        <select
                            data-testid="select-aria-live"
                            className="text-xs h-7 rounded-md border border-input bg-background px-2 text-foreground max-w-[100px]"
                            value={draft.aria?.live || 'off'}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                updateField('aria', { ...(draft.aria || {}), live: e.target.value })
                            }
                        >
                            <option value="off">Off</option>
                            <option value="polite">Polite</option>
                            <option value="assertive">Assertive</option>
                        </select>
                    </ConfigRow>
                ),
            },
        ],
    };
}

// ---------------------------------------------------------------------------
// Field Helpers
// ---------------------------------------------------------------------------

/**
 * Build a standard Switch toggle field with custom testId.
 * @param defaultOn - if true, treat undefined/absent as enabled (checked = value !== false)
 * @param explicitTrue - if true, only check when value === true
 * @param disabledWhen - optional predicate to disable the switch based on draft state
 * @param visibleWhen - optional predicate to conditionally show the switch based on draft state
 */
function buildSwitchField(
    key: string,
    label: string,
    testId: string,
    defaultOn = false,
    explicitTrue = false,
    disabledWhen?: (draft: Record<string, any>) => boolean,
    visibleWhen?: (draft: Record<string, any>) => boolean,
): ConfigField {
    return {
        key,
        label,
        type: 'custom',
        disabledWhen,
        visibleWhen,
        render: (value, onChange, draft) => (
            <ConfigRow label={label}>
                <Switch
                    data-testid={testId}
                    checked={explicitTrue ? value === true : (defaultOn ? value !== false : !!value)}
                    disabled={disabledWhen ? disabledWhen(draft) : false}
                    onCheckedChange={(checked: boolean) => onChange(checked)}
                    className="scale-75"
                />
            </ConfigRow>
        ),
    };
}

/**
 * Build a multi-select field picker (searchable, filterable, hidden fields)
 */
function buildFieldMultiSelect(
    key: string,
    label: string,
    selectorTestId: string,
    itemTestIdPrefix: string,
    fieldOptions: FieldOption[],
    updateField: ViewSchemaFactoryOptions['updateField'],
    countLabel: string,
    visibleWhen?: (draft: Record<string, any>) => boolean,
): ConfigField {
    return {
        key: `_${key}`,
        label,
        type: 'custom',
        visibleWhen,
        render: (_value, _onChange, draft) => {
            return (
                <ExpandableWidget
                    renderSummary={(toggle) => (
                        <ConfigRow
                            label={label}
                            value={`${(draft[key] || []).length} ${countLabel}`}
                            onClick={toggle}
                        />
                    )}
                >
                    <div data-testid={selectorTestId} className="pb-2 space-y-0.5 max-h-36 overflow-auto">
                        {fieldOptions.map(f => (
                            <label key={f.value} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded-sm py-0.5 px-1 -mx-1">
                                <Checkbox
                                    data-testid={`${itemTestIdPrefix}-${f.value}`}
                                    checked={(draft[key] || []).includes(f.value)}
                                    onCheckedChange={(checked: boolean) => {
                                        const current: string[] = draft[key] || [];
                                        const updated = checked
                                            ? [...current, f.value]
                                            : current.filter((v: string) => v !== f.value);
                                        updateField(key, updated);
                                    }}
                                    className="h-3.5 w-3.5"
                                />
                                <span className="truncate">{f.label}</span>
                            </label>
                        ))}
                    </div>
                </ExpandableWidget>
            );
        },
    };
}
