/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DebugFlags } from '@object-ui/core';
import { ComponentRegistry } from '@object-ui/core';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DebugPanelTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  render: () => React.ReactNode;
}

export interface DebugPanelProps {
  /** Whether the panel is open */
  open: boolean;
  /** Toggle callback */
  onClose: () => void;
  /** Debug flags from the URL / hook */
  flags?: DebugFlags;
  /** Current schema being rendered (for the Schema tab) */
  schema?: unknown;
  /** Current data context (for the Data tab) */
  dataContext?: unknown;
  /** Extra tabs provided by plugins */
  extraTabs?: DebugPanelTab[];
  /** CSS class override */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Built-in tab renderers                                            */
/* ------------------------------------------------------------------ */

function SchemaTab({ schema }: { schema?: unknown }) {
  if (!schema) {
    return <p className="text-xs text-muted-foreground italic">No schema available</p>;
  }
  return (
    <pre className="text-[11px] leading-relaxed font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
      {JSON.stringify(schema, null, 2)}
    </pre>
  );
}

function DataTab({ dataContext }: { dataContext?: unknown }) {
  if (!dataContext) {
    return <p className="text-xs text-muted-foreground italic">No data context available</p>;
  }
  return (
    <pre className="text-[11px] leading-relaxed font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
      {JSON.stringify(dataContext, null, 2)}
    </pre>
  );
}

function RegistryTab() {
  const entries = useMemo(() => {
    try {
      return ComponentRegistry.getAllTypes();
    } catch {
      return [];
    }
  }, []);

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No registered components</p>;
  }
  return (
    <div className="space-y-1 max-h-[60vh] overflow-auto">
      {entries.map((name: string) => (
        <div
          key={name}
          className="flex items-center gap-2 px-2 py-1 rounded text-xs font-mono bg-muted/30"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
          {name}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground mt-2">
        {entries.length} component{entries.length !== 1 ? 's' : ''} registered
      </p>
    </div>
  );
}

function FlagsTab({ flags }: { flags?: DebugFlags }) {
  if (!flags) {
    return <p className="text-xs text-muted-foreground italic">No debug flags</p>;
  }
  return (
    <pre className="text-[11px] leading-relaxed font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap break-all">
      {JSON.stringify(flags, null, 2)}
    </pre>
  );
}

/* ------------------------------------------------------------------ */
/*  DebugPanel                                                        */
/* ------------------------------------------------------------------ */

/**
 * A floating developer debug panel activated via URL parameters or manual toggle.
 *
 * Built-in tabs:
 * - **Schema** — current rendered JSON schema
 * - **Data** — active data context
 * - **Registry** — all registered component types
 * - **Flags** — current debug flags
 *
 * Plugins can inject additional tabs via the `extraTabs` prop.
 */
export function DebugPanel({
  open,
  onClose,
  flags,
  schema,
  dataContext,
  extraTabs = [],
  className,
}: DebugPanelProps) {
  const builtInTabs: DebugPanelTab[] = useMemo(() => [
    { id: 'schema', label: 'Schema', render: () => <SchemaTab schema={schema} /> },
    { id: 'data', label: 'Data', render: () => <DataTab dataContext={dataContext} /> },
    { id: 'registry', label: 'Registry', render: () => <RegistryTab /> },
    { id: 'flags', label: 'Flags', render: () => <FlagsTab flags={flags} /> },
  ], [schema, dataContext, flags]);

  const allTabs = useMemo(() => [...builtInTabs, ...extraTabs], [builtInTabs, extraTabs]);
  const [activeTabId, setActiveTabId] = useState(allTabs[0]?.id ?? 'schema');

  const activeTab = allTabs.find((t) => t.id === activeTabId) ?? allTabs[0];

  const handleTabChange = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[9999] w-[420px] max-w-[95vw] rounded-lg border bg-background shadow-2xl',
        'flex flex-col overflow-hidden',
        className,
      )}
      data-testid="debug-panel"
      role="dialog"
      aria-label="Developer Debug Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          🛠 Debug Panel
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-sm leading-none px-1"
          aria-label="Close debug panel"
          data-testid="debug-panel-close"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto" role="tablist">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              tab.id === activeTab?.id
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid={`debug-tab-${tab.id}`}
          >
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 overflow-auto max-h-[50vh]" data-testid="debug-panel-content">
        {activeTab?.render()}
      </div>
    </div>
  );
}
