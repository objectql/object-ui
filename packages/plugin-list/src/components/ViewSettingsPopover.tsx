/**
 * ViewSettingsPopover
 *
 * UX Sprint 2 (P1-4): consolidates four small toolbar controls that the
 * UX audit flagged as "too many top-level chips":
 *   - Group by
 *   - Row color
 *   - Density
 *   - Hide fields
 *
 * into a single "View settings" popover keyed by a gear icon. Filter and
 * Sort remain top-level because they're primary data operations, but the
 * appearance/grouping cluster collapses behind one trigger that opens an
 * accordion-style sheet.
 *
 * Implementation notes:
 *   - Each section is collapsible (default open) so users can focus on one.
 *   - Content is duplicated from the original inline popovers; if you change
 *     behavior, update both this and the legacy code path in ListView.tsx
 *     (kept behind `appearance.compactToolbar: false` for back-compat).
 *
 * @module
 */

import * as React from 'react';
import {
  cn,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  GroupingEditor,
} from '@object-ui/components';
import {
  Settings2,
  Group,
  Paintbrush,
  Rows4,
  Rows3,
  Rows2,
  EyeOff,
  ChevronDown,
} from 'lucide-react';

export interface ViewSettingsField {
  name: string;
  label?: string;
}

export interface ViewSettingsDensity {
  mode: 'compact' | 'comfortable' | 'spacious';
  cycle: () => void;
}

export interface ViewSettingsPopoverProps {
  t: (key: string, opts?: any) => string;
  allFields: ViewSettingsField[];

  showGroup?: boolean;
  groupingConfig?: any;
  setGroupingConfig?: (next: any) => void;

  showColor?: boolean;
  rowColorConfig?: { field: string; colors?: Record<string, string> } | undefined;
  setRowColorConfig?: (next: { field: string; colors: Record<string, string> } | undefined) => void;

  showDensity?: boolean;
  density?: ViewSettingsDensity;

  showHideFields?: boolean;
  hiddenFields?: Set<string>;
  updateHiddenFields?: (next: Set<string>) => void;

  /** Record editing — toggle inline cell editing (persists `inlineEdit` on the view). */
  showInlineEdit?: boolean;
  inlineEdit?: boolean;
  setInlineEdit?: (next: boolean) => void;
}

interface SectionProps {
  title: string;
  badge?: number;
  onClear?: () => void;
  clearLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, badge, onClear, clearLabel, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((x) => !x)}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground"
        >
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')}
          />
          {title}
          {typeof badge === 'number' && badge > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] text-primary tabular-nums">
              {badge}
            </span>
          )}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            {clearLabel}
          </button>
        )}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

export function ViewSettingsPopover(props: ViewSettingsPopoverProps) {
  const {
    t,
    allFields,
    showGroup,
    groupingConfig,
    setGroupingConfig,
    showColor,
    rowColorConfig,
    setRowColorConfig,
    showDensity,
    density,
    showHideFields,
    hiddenFields,
    updateHiddenFields,
    showInlineEdit,
    inlineEdit,
    setInlineEdit,
  } = props;

  const [open, setOpen] = React.useState(false);

  // Active count: how many of the 4 controls have non-default state.
  const activeCount = [
    !!groupingConfig?.fields?.length,
    !!rowColorConfig?.field,
    density && density.mode !== 'compact',
    (hiddenFields?.size ?? 0) > 0,
    !!inlineEdit,
  ].filter(Boolean).length;

  const DensityIcon =
    density?.mode === 'compact' ? Rows4 : density?.mode === 'comfortable' ? Rows3 : Rows2;

  const triggerLabel = t('list.viewSettings', { defaultValue: 'View settings' });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={triggerLabel}
          title={triggerLabel}
          className={cn(
            'h-7 px-2 text-muted-foreground hover:text-primary text-xs transition-colors duration-150',
            activeCount > 0 && 'text-foreground font-medium',
          )}
          data-testid="view-settings-trigger"
        >
          <Settings2 className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{triggerLabel}</span>
          {activeCount > 0 && (
            <span className="ml-1 flex h-4 min-w-[16px] items-center justify-center text-[10px] font-medium text-muted-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="view-settings-content">
        <div className="px-3 py-2 border-b">
          <div className="text-sm font-semibold">{triggerLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {t('list.viewSettingsHint', {
              defaultValue: 'Grouping, color, density, and visible fields.',
            })}
          </div>
        </div>

        {showGroup && setGroupingConfig && (
          <Section
            title={t('list.group', { defaultValue: 'Group' })}
            badge={groupingConfig?.fields?.length || 0}
            onClear={groupingConfig ? () => setGroupingConfig(undefined) : undefined}
            clearLabel={t('list.clear', { defaultValue: 'Clear' })}
          >
            <GroupingEditor
              value={groupingConfig as any}
              fieldOptions={allFields.map((f) => ({ value: f.name, label: f.label || f.name }))}
              maxLevels={3}
              labels={{
                addGroup: t('list.addGroup', 'Add group field'),
                collapseTitle: t('list.collapsedByDefault', 'Collapsed by default'),
                removeTitle: t('list.removeGroup', 'Remove'),
              }}
              onChange={(next) => setGroupingConfig(next as any)}
            />
          </Section>
        )}

        {showColor && setRowColorConfig && (
          <Section
            title={t('list.color', { defaultValue: 'Row color' })}
            onClear={rowColorConfig ? () => setRowColorConfig(undefined) : undefined}
            clearLabel={t('list.clear', { defaultValue: 'Clear' })}
            defaultOpen={!!rowColorConfig}
          >
            <label className="block text-[11px] text-muted-foreground mb-1">
              {t('list.colorByField', { defaultValue: 'Color by field' })}
            </label>
            <select
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
              value={rowColorConfig?.field || ''}
              onChange={(e) => {
                const field = e.target.value;
                if (!field) {
                  setRowColorConfig(undefined);
                } else {
                  setRowColorConfig({ field, colors: rowColorConfig?.colors || {} });
                }
              }}
              data-testid="color-field-select"
            >
              <option value="">{t('list.none', { defaultValue: 'None' })}</option>
              {allFields.map((field) => (
                <option key={field.name} value={field.name}>
                  {field.label || field.name}
                </option>
              ))}
            </select>
          </Section>
        )}

        {showDensity && density && (
          <Section
            title={t('grid.toolbar.densityMode', { defaultValue: 'Density' })}
            defaultOpen={density.mode !== 'compact'}
          >
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5"
                onClick={density.cycle}
                data-testid="view-settings-density-cycle"
              >
                <DensityIcon className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {density.mode === 'compact'
                    ? t('grid.toolbar.densityCompact', { defaultValue: 'Compact' })
                    : density.mode === 'comfortable'
                      ? t('grid.toolbar.densityComfortable', { defaultValue: 'Comfortable' })
                      : t('grid.toolbar.densitySpacious', { defaultValue: 'Spacious' })}
                </span>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                {t('grid.toolbar.densityCycleShortHint', {
                  defaultValue: 'Click to cycle',
                })}
              </span>
            </div>
          </Section>
        )}

        {showInlineEdit && setInlineEdit && (
          <Section
            title={t('list.recordEditingTitle', { defaultValue: 'Record editing' })}
            defaultOpen={!!inlineEdit}
          >
            <label className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-muted cursor-pointer">
              <input
                type="checkbox"
                checked={!!inlineEdit}
                onChange={() => setInlineEdit(!inlineEdit)}
                className="rounded border-input"
                data-testid="view-settings-inline-edit"
              />
              <span>
                {t('list.inlineEditLabel', {
                  defaultValue: 'Edit records inline (click a cell to edit)',
                })}
              </span>
            </label>
          </Section>
        )}

        {showHideFields && hiddenFields && updateHiddenFields && (
          <Section
            title={t('list.hideFieldsTitle', { defaultValue: 'Hide fields' })}
            badge={hiddenFields.size}
            onClear={hiddenFields.size > 0 ? () => updateHiddenFields(new Set()) : undefined}
            clearLabel={t('list.showAll', { defaultValue: 'Show all' })}
            defaultOpen={hiddenFields.size > 0}
          >
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {allFields.map((field) => (
                <label
                  key={field.name}
                  className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenFields.has(field.name)}
                    onChange={() => {
                      const next = new Set(hiddenFields);
                      if (next.has(field.name)) next.delete(field.name);
                      else next.add(field.name);
                      updateHiddenFields(next);
                    }}
                    className="rounded border-input"
                  />
                  <span className="truncate">{field.label || field.name}</span>
                </label>
              ))}
            </div>
          </Section>
        )}
      </PopoverContent>
    </Popover>
  );
}
