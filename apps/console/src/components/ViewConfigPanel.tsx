/**
 * ViewConfigPanel — Schema-Driven
 *
 * Airtable-style right-side configuration panel for inline view editing.
 * Migrated to Schema-Driven architecture using ConfigPanelRenderer +
 * useConfigDraft, replacing ~1600 lines of imperative code with a
 * declarative schema factory.
 *
 * All changes are buffered in a local draft state. Clicking Save commits
 * the draft via onSave; Discard resets to the original activeView.
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { ConfigPanelRenderer, useConfigDraft } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { buildViewConfigSchema } from '../utils/view-config-schema';
import { deriveFieldOptions, toFilterGroup, toSortItems, VIEW_TYPE_LABELS } from '../utils/view-config-utils';

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
    }), []); // eslint-disable-line react-hooks/exhaustive-deps

    // Stabilize source reference: only change when view ID changes.
    // This prevents useConfigDraft from resetting on every parent re-render
    // (same behavior as original useEffect with [activeView.id] dependency).
    const stableActiveView = useMemo(
        () => ({ ...activeView }),
        [mode === 'create' ? 'create' : activeView.id], // eslint-disable-line react-hooks/exhaustive-deps
    );
    const effectiveActiveView = mode === 'create' ? defaultNewView : stableActiveView;

    // Schema-driven draft state management
    const { draft, isDirty, updateField, discard } = useConfigDraft(effectiveActiveView, {
        mode,
        onUpdate: onViewUpdate,
    });

    // Focus the panel when it opens for keyboard accessibility
    useEffect(() => {
        if (open && panelRef.current) {
            panelRef.current.focus();
        }
    }, [open]);

    // Derive field options from objectDef
    const fieldOptions = useMemo(() => deriveFieldOptions(objectDef), [objectDef.fields]);

    // Bridge: filter/sort → builder format
    const filterGroupValue = useMemo(() => toFilterGroup(draft.filter), [draft.filter]);
    const sortItemsValue = useMemo(() => toSortItems(draft.sort), [draft.sort]);

    // Build schema
    const schema = useMemo(
        () => buildViewConfigSchema({
            t,
            fieldOptions,
            objectDef,
            updateField,
            filterGroupValue,
            sortItemsValue,
        }),
        [t, fieldOptions, objectDef, updateField, filterGroupValue, sortItemsValue],
    );

    // Override breadcrumb with dynamic view type
    const viewType = draft.type || 'grid';
    const dynamicSchema = useMemo(() => ({
        ...schema,
        breadcrumb: [t('console.objectView.page'), VIEW_TYPE_LABELS[viewType] || viewType],
    }), [schema, t, viewType]);

    // Save/discard handlers with create mode support
    const handleSave = useCallback(() => {
        if (mode === 'create') {
            onCreate?.(draft);
        } else {
            onSave?.(draft);
        }
        // Clear dirty state after save while preserving draft values
        discard();
    }, [draft, onSave, onCreate, mode, discard]);

    const handleDiscard = useCallback(() => {
        if (mode === 'create') {
            onClose();
            return;
        }
        discard();
    }, [discard, mode, onClose]);

    const panelTitle = mode === 'create'
        ? t('console.objectView.createView')
        : t('console.objectView.configureView');

    return (
        <ConfigPanelRenderer
            open={open}
            onClose={onClose}
            schema={dynamicSchema}
            draft={draft}
            isDirty={isDirty}
            onFieldChange={updateField}
            onSave={handleSave}
            onDiscard={handleDiscard}
            objectDef={objectDef}
            saveLabel={t('console.objectView.save')}
            discardLabel={t('console.objectView.discard')}
            panelRef={panelRef}
            role="complementary"
            ariaLabel={panelTitle}
            tabIndex={-1}
            testId="view-config-panel"
            closeTitle={t('console.objectView.closePanel')}
            footerTestId="view-config-footer"
            saveTestId="view-config-save"
            discardTestId="view-config-discard"
            className="transition-all overflow-hidden"
        />
    );
}
