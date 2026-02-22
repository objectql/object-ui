/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { cn, Button } from '@object-ui/components';
import type { DashboardSchema } from '@object-ui/types';

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

  // Find the selected widget's config (flattened)
  const selectedWidgetConfig = React.useMemo(() => {
    if (!selectedWidgetId || !schema.widgets) return null;
    const widget = schema.widgets.find(
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
  }, [selectedWidgetId, schema.widgets]);

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

  const handleWidgetSave = useCallback(
    (widgetConfig: Record<string, any>) => {
      if (selectedWidgetId && onWidgetSave) {
        onWidgetSave(selectedWidgetId, widgetConfig);
      }
      setSelectedWidgetId(null);
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
          schema={schema}
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
