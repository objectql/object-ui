/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { useState } from 'react';
import { X, Save, RotateCcw, ChevronRight } from 'lucide-react';

import { cn } from '../lib/utils';
import { Button } from '../ui/button';
import { SectionHeader } from './section-header';
import { ConfigFieldRenderer } from './config-field-renderer';
import type { ConfigPanelSchema } from '../types/config-panel';

export interface ConfigPanelRendererProps {
  /** Whether the panel is visible */
  open: boolean;
  /** Close callback */
  onClose: () => void;
  /** Schema describing the panel structure */
  schema: ConfigPanelSchema;
  /** Current draft values */
  draft: Record<string, any>;
  /** Whether the draft has uncommitted changes */
  isDirty: boolean;
  /** Called when any field changes */
  onFieldChange: (key: string, value: any) => void;
  /** Persist current draft */
  onSave: () => void;
  /** Revert draft to source */
  onDiscard: () => void;
  /** Extra content rendered in the header row */
  headerExtra?: React.ReactNode;
  /** Object definition for field pickers */
  objectDef?: Record<string, any>;
  /** Additional CSS class name */
  className?: string;
  /** Label for save button (default: "Save") */
  saveLabel?: string;
  /** Label for discard button (default: "Discard") */
  discardLabel?: string;
  /** Ref for the panel root element */
  panelRef?: React.Ref<HTMLDivElement>;
  /** ARIA role for the panel (e.g. "complementary") */
  role?: string;
  /** ARIA label for the panel */
  ariaLabel?: string;
  /** tabIndex for the panel root element */
  tabIndex?: number;
  /** Override data-testid for the panel root (default: "config-panel") */
  testId?: string;
}

/**
 * Schema-driven configuration panel renderer.
 *
 * Takes a `ConfigPanelSchema` and automatically renders the full panel:
 * - Header with breadcrumb & close button
 * - Scrollable body with collapsible sections
 * - Sticky footer with Save / Discard when dirty
 *
 * Each concrete panel (Dashboard, Form, Page…) only needs to provide
 * a schema and wire up `useConfigDraft`.
 */
export function ConfigPanelRenderer({
  open,
  onClose,
  schema,
  draft,
  isDirty,
  onFieldChange,
  onSave,
  onDiscard,
  headerExtra,
  objectDef,
  className,
  saveLabel = 'Save',
  discardLabel = 'Discard',
  panelRef,
  role,
  ariaLabel,
  tabIndex,
  testId,
}: ConfigPanelRendererProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!open) return null;

  const toggleCollapse = (key: string, defaultCollapsed?: boolean) => {
    setCollapsed((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? defaultCollapsed ?? false),
    }));
  };

  return (
    <div
      ref={panelRef}
      data-testid={testId ?? 'config-panel'}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      className={cn(
        'absolute inset-y-0 right-0 w-full sm:w-72 lg:w-80 sm:relative border-l bg-background flex flex-col shrink-0 z-20',
        className,
      )}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
        <nav aria-label="breadcrumb">
          <ol className="flex items-center gap-1 text-xs text-muted-foreground">
            {schema.breadcrumb.map((segment, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3" />}
                <li
                  className={cn(
                    idx === schema.breadcrumb.length - 1 && 'text-foreground font-medium',
                  )}
                >
                  {segment}
                </li>
              </React.Fragment>
            ))}
          </ol>
        </nav>
        <div className="flex items-center gap-1">
          {headerExtra}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-7 w-7 p-0"
            data-testid="config-panel-close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Scrollable sections ────────────────────────────── */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {schema.sections.map((section) => {
          if (section.visibleWhen && !section.visibleWhen(draft)) return null;

          const isCollapsed =
            collapsed[section.key] ?? section.defaultCollapsed ?? false;

          return (
            <div key={section.key} data-testid={`config-section-${section.key}`}>
              <SectionHeader
                title={section.title}
                collapsible={section.collapsible}
                collapsed={isCollapsed}
                onToggle={() => toggleCollapse(section.key, section.defaultCollapsed)}
                testId={`section-header-${section.key}`}
              />
              {section.hint && (
                <p className="text-[10px] text-muted-foreground mb-1">
                  {section.hint}
                </p>
              )}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.fields.map((field) => (
                    <ConfigFieldRenderer
                      key={field.key}
                      field={field}
                      value={draft[field.key]}
                      onChange={(v) => onFieldChange(field.key, v)}
                      draft={draft}
                      objectDef={objectDef}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      {isDirty && (
        <div className="px-4 py-2 border-t flex gap-2 shrink-0" data-testid="config-panel-footer">
          <Button size="sm" onClick={onSave} data-testid="config-panel-save">
            <Save className="h-3.5 w-3.5 mr-1" />
            {saveLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDiscard}
            data-testid="config-panel-discard"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            {discardLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
