/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { Slider } from '../ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';
import { ConfigRow } from './config-row';
import { FilterBuilder } from './filter-builder';
import { SortBuilder } from './sort-builder';
import type { ConfigField } from '../types/config-panel';

export interface ConfigFieldRendererProps {
  /** Field schema */
  field: ConfigField;
  /** Current value */
  value: any;
  /** Change handler */
  onChange: (value: any) => void;
  /** Full draft for visibility evaluation and custom render */
  draft: Record<string, any>;
  /** Object definition for field-picker controls */
  objectDef?: Record<string, any>;
}

/**
 * Renders a single config field based on its ControlType.
 *
 * Supports: input, switch, select, checkbox, slider, color, icon-group, custom.
 * filter/sort/field-picker are rendered as placeholders that consumers can
 * override with type='custom' when full sub-editor integration is needed.
 */
export function ConfigFieldRenderer({
  field,
  value,
  onChange,
  draft,
  objectDef: _objectDef,
}: ConfigFieldRendererProps) {
  // Visibility gate
  if (field.visibleWhen && !field.visibleWhen(draft)) {
    return null;
  }

  const effectiveDisabled = field.disabled || (field.disabledWhen ? field.disabledWhen(draft) : false);
  const effectiveValue = value ?? field.defaultValue;

  let content: React.ReactNode = null;

  switch (field.type) {
    case 'input':
      content = (
        <ConfigRow label={field.label}>
          <Input
            data-testid={`config-field-${field.key}`}
            className="h-7 w-32 text-xs"
            value={effectiveValue ?? ''}
            placeholder={field.placeholder}
            disabled={effectiveDisabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </ConfigRow>
      );
      break;

    case 'switch':
      content = (
        <ConfigRow label={field.label}>
          <Switch
            data-testid={`config-field-${field.key}`}
            checked={!!effectiveValue}
            disabled={effectiveDisabled}
            onCheckedChange={(checked) => onChange(checked)}
            className="scale-75"
          />
        </ConfigRow>
      );
      break;

    case 'checkbox':
      content = (
        <ConfigRow label={field.label}>
          <Checkbox
            data-testid={`config-field-${field.key}`}
            checked={!!effectiveValue}
            disabled={effectiveDisabled}
            onCheckedChange={(checked) => onChange(checked)}
          />
        </ConfigRow>
      );
      break;

    case 'select':
      content = (
        <ConfigRow label={field.label}>
          <Select
            value={String(effectiveValue ?? '')}
            onValueChange={(val) => onChange(val)}
            disabled={effectiveDisabled}
          >
            <SelectTrigger
              data-testid={`config-field-${field.key}`}
              className="h-7 w-32 text-xs"
            >
              <SelectValue placeholder={field.placeholder ?? 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ConfigRow>
      );
      break;

    case 'slider':
      content = (
        <ConfigRow label={field.label}>
          <div className="flex items-center gap-2 w-32">
            <Slider
              data-testid={`config-field-${field.key}`}
              value={[Number(effectiveValue ?? field.min ?? 0)]}
              min={field.min ?? 0}
              max={field.max ?? 100}
              step={field.step ?? 1}
              disabled={effectiveDisabled}
              onValueChange={(vals) => onChange(vals[0])}
              aria-label={field.label}
            />
            <span className="text-xs text-muted-foreground w-6 text-right">
              {effectiveValue ?? field.min ?? 0}
            </span>
          </div>
        </ConfigRow>
      );
      break;

    case 'color':
      content = (
        <ConfigRow label={field.label}>
          <input
            data-testid={`config-field-${field.key}`}
            type="color"
            className="h-7 w-10 rounded border cursor-pointer"
            value={effectiveValue ?? '#000000'}
            disabled={effectiveDisabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </ConfigRow>
      );
      break;

    case 'icon-group':
      content = (
        <ConfigRow label={field.label}>
          <div className="flex items-center gap-0.5" data-testid={`config-field-${field.key}`}>
            {(field.options ?? []).map((opt) => (
              <Button
                key={opt.value}
                type="button"
                size="sm"
                variant={effectiveValue === opt.value ? 'default' : 'ghost'}
                className={cn('h-7 w-7 p-0', effectiveValue === opt.value && 'ring-1 ring-primary')}
                disabled={effectiveDisabled}
                onClick={() => onChange(opt.value)}
                title={opt.label}
              >
                {opt.icon ?? <span className="text-[10px]">{opt.label.charAt(0)}</span>}
              </Button>
            ))}
          </div>
        </ConfigRow>
      );
      break;

    case 'field-picker':
      content = (
        <ConfigRow
          label={field.label}
          value={effectiveValue ?? field.placeholder ?? 'Select field…'}
          onClick={effectiveDisabled ? undefined : () => {
            /* open field picker - consumers should use type='custom' for full integration */
          }}
        />
      );
      break;

    case 'filter':
      content = (
        <div data-testid={`config-field-${field.key}`}>
          <ConfigRow label={field.label} />
          <FilterBuilder
            fields={field.fields}
            value={effectiveValue}
            onChange={onChange}
            className="px-1 pb-2"
          />
        </div>
      );
      break;

    case 'sort':
      content = (
        <div data-testid={`config-field-${field.key}`}>
          <ConfigRow label={field.label} />
          <SortBuilder
            fields={field.fields}
            value={effectiveValue}
            onChange={onChange}
            className="px-1 pb-2"
          />
        </div>
      );
      break;

    case 'custom':
      if (field.render) {
        content = <>{field.render(effectiveValue, onChange, draft)}</>;
      }
      break;

    default:
      break;
  }

  if (!content) return null;

  // Wrap with helpText when provided
  if (field.helpText) {
    return (
      <div>
        {content}
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-1">{field.helpText}</p>
      </div>
    );
  }

  return <>{content}</>;
}
