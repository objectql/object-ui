// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DashboardConfigPanel — the runtime DashboardView's right-rail
 * "dashboard editor".
 *
 * MIGRATED: this single panel replaces BOTH legacy `plugin-dashboard`
 * panels (the dashboard-level `DashboardConfigPanel` and the per-widget
 * `WidgetConfigPanel`). Instead of the `buildWidgetSchema` /
 * `ConfigPanelRenderer` engine it hosts the studio's spec-driven
 * inspectors so the runtime and the metadata studio share ONE
 * dashboard-editing surface:
 *
 *   - no widget selected → {@link DashboardDefaultInspector} (dashboard level)
 *   - widget selected     → {@link DashboardWidgetInspector} (widget level)
 *
 * It lives in `app-shell` (next to the studio inspectors) rather than in
 * `plugin-dashboard`: `app-shell` depends on `plugin-dashboard`, so hosting
 * the inspectors here avoids the circular import a plugin-side panel would
 * need.
 *
 * Unlike the legacy panel, this component is CONTROLLED: it holds no draft
 * state of its own. Both inspectors edit the FULL nested dashboard `schema`
 * (`{...,widgets:[{id,...}]}`) directly — the dashboard-level inspector via a
 * shallow top-level `onPatch`, the widget inspector by addressing
 * `schema.widgets` by `w.id`. Because the inspectors work on the spec-shaped
 * draft, the runtime's old flatten / unflatten / extract adapters are gone.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { ArrowLeft, Trash2, X } from 'lucide-react';
import { DashboardDefaultInspector } from './metadata-admin/inspectors/DashboardDefaultInspector';
import { DashboardWidgetInspector } from './metadata-admin/inspectors/DashboardWidgetInspector';
import { RuntimeDraftBar } from './RuntimeDraftBar';
import { detectLocale } from './metadata-admin/i18n';
import type { MetadataSelection } from './metadata-admin/preview-registry';

export interface DashboardConfigPanelProps<
  T extends Record<string, any> = Record<string, any>,
> {
  /** Whether the panel is open. */
  open: boolean;
  /** Close callback. */
  onClose: () => void;
  /** The current dashboard definition (full nested spec Dashboard document). */
  schema: T | null;
  /** The id of the widget selected on the canvas, or null for dashboard level. */
  selectedWidgetId: string | null;
  /** Switch the selected widget (null returns to the dashboard-level panel). */
  onSelectWidget: (id: string | null) => void;
  /** Persist the current schema. */
  onSave: (schema: T) => void;
  /** Called on every edit so the host can drive a live preview / autosave. */
  onChange: (schema: T) => void;
  /** Remove the given widget (used by the widget-level header trash button). */
  onRemoveWidget?: (id: string) => void;
  /** Dashboard artifact name — the `:name` for the draft/publish chrome. */
  name?: string;
  /**
   * Studio metadata client — drives the ADR-0034 draft/publish chrome
   * ({@link RuntimeDraftBar}).
   */
  metadataClient?: any;
  /** Called after a publish / discard so the host can refresh its read. */
  onAfterChange?: () => void;
}

export function DashboardConfigPanel<
  T extends Record<string, any> = Record<string, any>,
>({
  open,
  onClose,
  schema,
  selectedWidgetId,
  onSelectWidget,
  onSave,
  onChange,
  onRemoveWidget,
  name: artifactName,
  metadataClient,
  onAfterChange,
}: DashboardConfigPanelProps<T>) {
  const { t } = useObjectTranslation();
  const locale = useMemo(() => detectLocale(), []);
  // Unsaved-edits flag — gates Publish (mirrors studio's "save first"). The
  // panel unmounts on close, so this resets to false on each open.
  const [dirty, setDirty] = useState(false);
  // Bumped on save so the draft chrome surfaces the indicator immediately.
  const [savedSignal, setSavedSignal] = useState(0);

  // Controlled: merge an inspector patch into the current schema and bubble it
  // back up. No local draft state — `schema` is the single source of truth.
  const handlePatch = useCallback(
    (patch: Record<string, unknown>) => {
      setDirty(true);
      onChange({ ...(schema ?? {}), ...patch } as T);
    },
    [schema, onChange],
  );

  // ADR-0034 (#1515): resume a pending draft into the editor on open
  // (flag-ON only). The dashboard document IS the controlled schema, so push
  // it up as a live edit (preview only — no save) and treat it as the clean
  // baseline.
  const handleResumeDraft = useCallback(
    (body: Record<string, unknown>) => {
      onChange(body as T);
      setDirty(false);
    },
    [onChange],
  );

  const handleSelectionChange = useCallback(
    (sel: MetadataSelection | null) => {
      onSelectWidget(sel && sel.kind === 'widget' ? sel.id : null);
    },
    [onSelectWidget],
  );

  const widgets = Array.isArray(schema?.widgets) ? (schema!.widgets as any[]) : [];
  const selectedWidget = selectedWidgetId
    ? widgets.find((w) => w?.id === selectedWidgetId)
    : null;

  if (!open) return null;

  const name = typeof schema?.name === 'string' ? schema.name : '';
  const title = selectedWidget
    ? t('widget.editor.title', { defaultValue: 'Edit widget' })
    : t('dashboard.editor.title', { defaultValue: 'Edit dashboard' });

  return (
    <aside
      className="hidden sm:flex w-[440px] shrink-0 flex-col border-l bg-background h-full"
      data-testid="dashboard-config-panel"
      role="complementary"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 shrink-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {selectedWidget && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectWidget(null)}
              className="h-7 w-7 p-0"
              aria-label={t('dashboard.editor.backToDashboard', {
                defaultValue: 'Back to dashboard',
              })}
              title={t('dashboard.editor.backToDashboard', {
                defaultValue: 'Back to dashboard',
              })}
              data-testid="dashboard-config-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="text-sm font-medium truncate">{title}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedWidget && onRemoveWidget && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveWidget(selectedWidgetId!)}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              aria-label={t('widget.editor.delete', { defaultValue: 'Delete widget' })}
              title={t('widget.editor.delete', { defaultValue: 'Delete widget' })}
              data-testid="widget-delete-button"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0"
            aria-label={t('common.close', { defaultValue: 'Close' })}
            data-testid="dashboard-config-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {selectedWidget ? (
          <DashboardWidgetInspector
            type="dashboard"
            name={name}
            draft={schema ?? {}}
            selection={{ kind: 'widget', id: selectedWidgetId! }}
            onPatch={handlePatch}
            onClearSelection={() => onSelectWidget(null)}
            onSelectionChange={handleSelectionChange}
            readOnly={false}
            locale={locale}
          />
        ) : (
          <DashboardDefaultInspector
            type="dashboard"
            name={name}
            draft={schema ?? {}}
            onPatch={handlePatch}
            onSelectionChange={handleSelectionChange}
            readOnly={false}
            locale={locale}
          />
        )}
      </div>

      <div
        data-testid="dashboard-config-footer"
        className="flex items-center justify-end gap-2 border-t px-4 py-2.5 shrink-0"
      >
        <RuntimeDraftBar
          type="dashboard"
          name={artifactName || name || undefined}
          metadataClient={metadataClient}
          dirty={dirty}
          onResume={handleResumeDraft}
          savedSignal={savedSignal}
          onAfterChange={onAfterChange}
        />
        <Button
          size="sm"
          onClick={() => {
            onSave((schema ?? {}) as T);
            setDirty(false);
            setSavedSignal((s) => s + 1);
          }}
          data-testid="dashboard-config-save"
        >
          {t('common.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </aside>
  );
}
