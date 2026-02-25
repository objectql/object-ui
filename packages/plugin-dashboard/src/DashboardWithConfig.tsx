/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { cn, Button } from '@object-ui/components';
import type { DashboardSchema, DashboardWidgetSchema } from '@object-ui/types';

import { DashboardRenderer } from './DashboardRenderer';
import { DashboardConfigPanel } from './DashboardConfigPanel';
import { WidgetConfigPanel } from './WidgetConfigPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardWithConfigProps {
  /** Dashboard schema for rendering */
  schema: DashboardSchema;
  /** Current dashboard configuration (for the config panel) */
  config: Record<string, any>;
  /** Called when config panel saves dashboard-level changes */
  onConfigSave: (config: Record<string, any>) => void;
  /** Called when widget config panel saves widget-level changes */
  onWidgetSave?: (widgetId: string, config: Record<string, any>) => void;
  /** Callback invoked when dashboard refresh is triggered */
  onRefresh?: () => void;
  /** Total record count */
  recordCount?: number;
  /** Whether the config panel is open initially */
  defaultConfigOpen?: boolean;
  /** Additional CSS class name for the container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DashboardWithConfig — Composite component combining a DashboardRenderer
 * with a DashboardConfigPanel sidebar.
 *
 * Supports:
 * - Toggle config panel visibility via a Settings button
 * - Dashboard-level configuration editing
 * - Click-to-select a widget → sidebar switches to WidgetConfigPanel
 * - Back navigation from widget config to dashboard config
 * - Live preview: widget config changes are reflected in real time
 */
export function DashboardWithConfig({
  schema,
  config,
  onConfigSave,
  onWidgetSave,
  onRefresh,
  recordCount,
  defaultConfigOpen = false,
  className,
}: DashboardWithConfigProps) {
  const [configOpen, setConfigOpen] = useState(defaultConfigOpen);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Internal schema state for live preview during widget editing.
  // Updated on every field change; reset when external schema prop changes.
  const [liveSchema, setLiveSchema] = useState<DashboardSchema>(schema);
  const [configVersion, setConfigVersion] = useState(0);

  useEffect(() => {
    setLiveSchema(schema);
    setConfigVersion((v) => v + 1);
  }, [schema]);

  // Stable widget config for the config panel — only recomputed on
  // widget selection change or save (configVersion), NOT on every live
  // field change. This prevents useConfigDraft from resetting the draft.
  const selectedWidgetConfig = React.useMemo(() => {
    if (!selectedWidgetId || !liveSchema.widgets) return null;
    const widget = liveSchema.widgets.find(
      (w) => (w.id || w.title) === selectedWidgetId,
    );
    if (!widget) return null;
    return {
      id: widget.id ?? '',
      title: widget.title ?? '',
      description: widget.description ?? '',
      type: widget.type ?? '',
      object: widget.object ?? '',
      categoryField: widget.categoryField ?? '',
      valueField: widget.valueField ?? '',
      aggregate: widget.aggregate ?? '',
      colorVariant: widget.colorVariant ?? 'default',
      actionUrl: widget.actionUrl ?? '',
      layoutW: widget.layout?.w ?? 1,
      layoutH: widget.layout?.h ?? 1,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWidgetId, configVersion]);

  const handleWidgetSelect = useCallback(
    (widgetId: string) => {
      setSelectedWidgetId(widgetId);
      setConfigOpen(true);
    },
    [],
  );

  const handleWidgetClose = useCallback(() => {
    setSelectedWidgetId(null);
  }, []);

  // Live-update handler: updates liveSchema so DashboardRenderer re-renders.
  const handleWidgetFieldChange = useCallback(
    (field: string, value: any) => {
      if (!selectedWidgetId) return;
      setLiveSchema((prev) => {
        if (!prev.widgets) return prev;
        return {
          ...prev,
          widgets: prev.widgets.map((w) => {
            if ((w.id || w.title) !== selectedWidgetId) return w;
            if (field === 'layoutW') {
              return { ...w, layout: { ...(w.layout || {}), w: value } as DashboardWidgetSchema['layout'] };
            }
            if (field === 'layoutH') {
              return { ...w, layout: { ...(w.layout || {}), h: value } as DashboardWidgetSchema['layout'] };
            }
            return { ...w, [field]: value };
          }),
        };
      });
    },
    [selectedWidgetId],
  );

  const handleWidgetSave = useCallback(
    (widgetConfig: Record<string, any>) => {
      if (selectedWidgetId && onWidgetSave) {
        onWidgetSave(selectedWidgetId, widgetConfig);
      }
      setSelectedWidgetId(null);
      setConfigVersion((v) => v + 1);
    },
    [selectedWidgetId, onWidgetSave],
  );

  const handleToggleConfig = useCallback(() => {
    setConfigOpen((prev) => !prev);
    setSelectedWidgetId(null);
  }, []);

  return (
    <div
      className={cn('flex h-full w-full', className)}
      data-testid="dashboard-with-config"
    >
      {/* Main dashboard area */}
      <div className="flex-1 min-w-0 overflow-auto relative">
        {/* Settings toggle button */}
        <div className="absolute top-2 right-2 z-10">
          <Button
            size="sm"
            variant={configOpen ? 'default' : 'outline'}
            onClick={handleToggleConfig}
            data-testid="dashboard-config-toggle"
          >
            <Settings className="h-3.5 w-3.5 mr-1" />
            Settings
          </Button>
        </div>

        <DashboardRenderer
          schema={liveSchema}
          onRefresh={onRefresh}
          recordCount={recordCount}
        />
      </div>

      {/* Config panel sidebar */}
      {configOpen && (
        <div className="relative shrink-0">
          {selectedWidgetId && selectedWidgetConfig ? (
            <WidgetConfigPanel
              open={true}
              onClose={handleWidgetClose}
              config={selectedWidgetConfig}
              onSave={handleWidgetSave}
              onFieldChange={handleWidgetFieldChange}
            />
          ) : (
            <DashboardConfigPanel
              open={true}
              onClose={() => setConfigOpen(false)}
              config={config}
              onSave={onConfigSave}
            />
          )}
        </div>
      )}
    </div>
  );
}
