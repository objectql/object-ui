// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardDefaultInspector — the curated "home" panel for a Dashboard.
 *
 * Shown as the DEFAULT right panel (no selection) for a dashboard. Mirrors
 * {@link ReportDefaultInspector} but for the flat Dashboard document.
 *
 * SPEC-DRIVEN: the layout / filter / performance config fields are NOT
 * hardcoded. They are rendered by feeding the spec's canonical authoring
 * form (`dashboardForm`) and the spec-derived Dashboard JSONSchema into the
 * generic {@link SchemaForm}. Adding a new dashboard prop to
 * `@objectstack/spec` flows through with zero code changes here.
 *
 * The inspector keeps a thin curated layer for the cross-cutting concerns the
 * spec form can't express well on its own:
 *   1. the LABEL / DESCRIPTION basics, and
 *   2. the WIDGETS list — add / remove / reorder / select drills into the
 *      scoped {@link DashboardWidgetInspector}. Those fields are therefore
 *      pruned from the spec form to avoid double-editing.
 *
 * Unlike a View (a nested document with a variant BODY), a Dashboard is FLAT:
 * label / description / widgets / layout all live at the draft top level, so
 * every write is a plain shallow `onPatch`. Widgets are addressed by their
 * own `id` (matching {@link DashboardWidgetInspector} and {@link
 * DashboardPreview}), not by an index path.
 */

import * as React from 'react';
import { GripVertical, X } from 'lucide-react';
import { Badge, Button, Label } from '@object-ui/components';
import type { DashboardWidgetSchema } from '@object-ui/types';
import {
  InspectorShell,
  InspectorTextField,
  appendArray,
  moveArray,
  spliceArray,
  uniqueId,
} from './_shared';
import { AddWidgetPicker } from '../previews/AddWidgetPicker';
import { WIDGET_TYPE_META, UnknownWidgetIcon } from '../previews/widget-types';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import { getDashboardForm, getDashboardSchema } from '../dashboard-schema';
import { t } from '../i18n';

type DashboardWidget = DashboardWidgetSchema & { id: string };

export function DashboardDefaultInspector({
  draft,
  onPatch,
  readOnly,
  locale,
  onSelectionChange,
}: MetadataDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);

  const labelValue = typeof draft.label === 'string' ? (draft.label as string) : '';
  const descriptionValue =
    typeof draft.description === 'string' ? (draft.description as string) : '';

  const widgets: DashboardWidget[] = React.useMemo(
    () =>
      Array.isArray(draft.widgets) ? (draft.widgets as DashboardWidget[]) : [],
    [draft.widgets],
  );

  /* ─────────────── Widget read / write / reorder / select ─────────────── */

  const addWidget = (type: string) => {
    const existingIds = widgets.map((w) => w?.id).filter(Boolean) as string[];
    const id = uniqueId('widget', existingIds);
    const meta = WIDGET_TYPE_META[type];
    const title = meta ? `New ${meta.label.toLowerCase()}` : 'New widget';
    const widget = { id, type, title, ...(meta?.defaults ?? {}) } as unknown as DashboardWidget;
    onPatch({ widgets: appendArray(widgets, widget) });
    onSelectionChange?.({ kind: 'widget', id, label: title });
  };

  const removeWidget = (index: number) => {
    onPatch({ widgets: spliceArray(widgets, index, null) });
  };

  const moveWidget = (from: number, to: number) => {
    if (from === to) return;
    onPatch({ widgets: moveArray(widgets, from, to) });
  };

  const selectWidget = (widget: DashboardWidget, index: number) => {
    if (!widget?.id) return;
    onSelectionChange?.({
      kind: 'widget',
      id: widget.id,
      label: widget.title || widget.id || `Widget ${index + 1}`,
    });
  };

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const schema = getDashboardSchema();
  const form = getDashboardForm();

  return (
    <InspectorShell
      kindLabel={tr('engine.inspector.dashboard.kind')}
      title={String(labelValue || draft.name || tr('engine.inspector.dashboard.kind'))}
      onClose={() => {}}
      closeLabel={tr('engine.inspector.dashboard.close')}
      hideClose
    >
      <InspectorTextField
        label={tr('engine.inspector.dashboard.label')}
        value={labelValue}
        onCommit={(v) => onPatch({ label: v })}
        placeholder={tr('engine.inspector.dashboard.labelPlaceholder')}
        disabled={readOnly}
      />
      <InspectorTextField
        label={tr('engine.inspector.dashboard.description')}
        value={descriptionValue}
        onCommit={(v) => onPatch({ description: v })}
        placeholder={tr('engine.inspector.dashboard.descriptionPlaceholder')}
        disabled={readOnly}
      />

      <div className="border-t pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">
            {tr('engine.inspector.dashboard.widgets')}
          </Label>
          <Badge variant="outline" className="text-[10px]">
            {widgets.length}
          </Badge>
        </div>

        {widgets.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-center text-[11px] text-muted-foreground">
            {tr('engine.inspector.dashboard.widgetsEmpty')}
          </p>
        ) : (
          <div className="space-y-1">
            {widgets.map((w, i) => {
              const meta = WIDGET_TYPE_META[w?.type as string];
              const Icon = meta?.icon ?? UnknownWidgetIcon;
              const showDropLine =
                overIndex === i && dragIndex !== null && dragIndex !== i;
              return (
                <div
                  key={w?.id ?? i}
                  draggable={!readOnly}
                  onDragStart={() => setDragIndex(i)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIndex(i);
                  }}
                  onDrop={() => {
                    if (dragIndex != null && dragIndex !== i) moveWidget(dragIndex, i);
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={
                    'group flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs hover:bg-accent' +
                    (showDropLine ? ' border-primary' : '')
                  }
                >
                  {!readOnly && (
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    onClick={() => selectWidget(w, i)}
                    title={w?.title || w?.id}
                  >
                    {w?.title || w?.id || `Widget ${i + 1}`}
                  </button>
                  <code className="text-[10px] text-muted-foreground">{w?.type}</code>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 shrink-0 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => removeWidget(i)}
                      title={tr('engine.inspector.dashboard.removeWidget')}
                      aria-label={tr('engine.inspector.dashboard.removeWidget')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <AddWidgetPicker
            onAdd={addWidget}
            label={tr('engine.inspector.add.widget')}
          />
        )}
      </div>

      <div className="border-t pt-3">
        {schema ? (
          <SchemaForm
            schema={schema}
            form={form}
            value={draft}
            hiddenFields={['name', 'label', 'description', 'widgets']}
            readOnly={readOnly}
            onChange={(next) => onPatch(next)}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {tr('engine.inspector.dashboard.noSchema')}
          </p>
        )}
      </div>
    </InspectorShell>
  );
}
