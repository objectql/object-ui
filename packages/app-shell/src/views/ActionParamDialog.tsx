/**
 * ActionParamDialog — Collects user input for action parameters before execution.
 *
 * Dynamically renders form fields from ActionParamDef[] definitions:
 *  - type: 'select' → Shadcn Select component
 *  - type: 'text'   → Shadcn Input component
 *  - type: 'textarea' → Shadcn Textarea component
 *  - other types    → Shadcn Input with appropriate HTML type
 *
 * Returns collected param values or null on cancel.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import type { ActionParamDef } from '@object-ui/core';
import { LookupField } from '@object-ui/fields';

export interface ParamDialogState {
  open: boolean;
  params: ActionParamDef[];
  /** Dialog title — defaults to the generic "Action parameters" label when
   *  absent. Callers pass the action's own label (e.g. "Create environment")
   *  so the dialog reads as the task, not a generic param prompt. */
  title?: string;
  description?: string;
  resolve?: (value: Record<string, any> | null) => void;
}

interface ActionParamDialogProps {
  state: ParamDialogState;
  onOpenChange: (open: boolean) => void;
}

export function ActionParamDialog({ state, onOpenChange }: ActionParamDialogProps) {
  const { t } = useObjectTranslation();
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Reset values when params change
  useEffect(() => {
    if (state.open) {
      const defaults: Record<string, any> = {};
      for (const param of state.params) {
        if (param.defaultValue !== undefined) {
          defaults[param.name] = param.defaultValue;
        }
      }
      setValues(defaults);
      setErrors({});
    }
  }, [state.open, state.params]);

  const isMissingValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    // Boolean false is a VALID value — only treat undefined/null as missing.
    if (typeof value === 'boolean') return false;
    return false;
  };

  const handleSubmit = () => {
    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    for (const param of state.params) {
      if (param.required && isMissingValue(values[param.name])) {
        newErrors[param.name] = true;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    state.resolve?.(values);
    onOpenChange(false);
  };

  const handleCancel = () => {
    state.resolve?.(null);
    onOpenChange(false);
  };

  const updateValue = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: false }));
  };

  return (
    <Dialog open={state.open} onOpenChange={(open) => {
      if (!open) handleCancel();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title || t('actionDialog.title')}</DialogTitle>
          <DialogDescription>
            {state.description || t('actionDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {state.params.map((param) => {
            const isBooleanParam =
              param.type === 'boolean' || param.type === 'checkbox';
            // Boolean → render as inline checkbox row (label sits beside the
            // control instead of above it; help text appears underneath).
            if (isBooleanParam) {
              const checked = values[param.name] === true;
              return (
                <div key={param.name} className="grid gap-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={param.name}
                      checked={checked}
                      onCheckedChange={(c) => updateValue(param.name, c === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={param.name} className="font-normal cursor-pointer">
                      {param.label}
                      {param.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  {errors[param.name] && (
                    <p className="text-xs text-destructive ml-6">{t('actionDialog.requiredError', { label: param.label })}</p>
                  )}
                  {param.helpText && (
                    <p className="text-xs text-muted-foreground ml-6">{param.helpText}</p>
                  )}
                </div>
              );
            }
            const isLookupParam = param.type === 'lookup' || param.type === 'reference';
            return (
            <div key={param.name} className="grid gap-2">
              <Label htmlFor={param.name}>
                {param.label}
                {param.required && <span className="text-destructive ml-1">*</span>}
              </Label>

              {param.type === 'select' && param.options ? (
                <Select
                  value={values[param.name] ?? ''}
                  onValueChange={(val) => updateValue(param.name, val)}
                >
                  <SelectTrigger id={param.name} className={errors[param.name] ? 'border-destructive' : ''}>
                    <SelectValue placeholder={param.placeholder || t('actionDialog.selectPlaceholder', { label: param.label })} />
                  </SelectTrigger>
                  <SelectContent>
                    {param.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : isLookupParam && (param as any).referenceTo ? (
                // Render a real record picker (popover typeahead +
                // RecordPickerDialog) when the param resolves to a `lookup`
                // or `reference` field with a known `referenceTo` target.
                // `resolveActionParams()` copies the lookup-config from the
                // underlying object-field; the DataSource is picked up from
                // the surrounding SchemaRendererContext provided by the host
                // view (ObjectView / RecordDetailView).
                <LookupField
                  value={values[param.name] ?? null}
                  onChange={(v) => updateValue(param.name, v)}
                  field={{
                    name: param.name,
                    type: 'lookup',
                    reference_to: (param as any).referenceTo,
                    display_field: (param as any).displayField,
                    id_field: (param as any).idField,
                    description_field: (param as any).descriptionField,
                    multiple: (param as any).multiple,
                    title_format: (param as any).titleFormat,
                    lookup_columns: (param as any).lookupColumns,
                    lookup_filters: (param as any).lookupFilters,
                    lookup_page_size: (param as any).lookupPageSize,
                    depends_on: (param as any).dependsOn,
                    placeholder: param.placeholder,
                  } as any}
                />
              ) : param.type === 'textarea' ? (
                <Textarea
                  id={param.name}
                  value={values[param.name] ?? ''}
                  onChange={(e) => updateValue(param.name, e.target.value)}
                  placeholder={param.placeholder}
                  className={errors[param.name] ? 'border-destructive' : ''}
                />
              ) : param.type === 'number' ? (
                <Input
                  id={param.name}
                  type="number"
                  value={values[param.name] ?? ''}
                  onChange={(e) => updateValue(param.name, e.target.value === '' ? undefined : e.target.valueAsNumber)}
                  placeholder={param.placeholder}
                  className={errors[param.name] ? 'border-destructive' : ''}
                />
              ) : (
                <Input
                  id={param.name}
                  type={(['email', 'url', 'date', 'datetime-local', 'time', 'password'] as string[]).includes(param.type) ? param.type : 'text'}
                  value={values[param.name] ?? ''}
                  onChange={(e) => updateValue(param.name, e.target.value)}
                  placeholder={
                    param.placeholder ||
                    (isLookupParam ? t('actionDialog.lookupPlaceholder', { label: param.label }) : undefined)
                  }
                  className={errors[param.name] ? 'border-destructive' : ''}
                />
              )}

              {errors[param.name] && (
                <p className="text-xs text-destructive">{t('actionDialog.requiredError', { label: param.label })}</p>
              )}
              {param.helpText && (
                <p className="text-xs text-muted-foreground">{param.helpText}</p>
              )}
              {isLookupParam && !param.helpText && (
                <p className="text-xs text-muted-foreground">
                  {t('actionDialog.lookupHelpText')}
                </p>
              )}
            </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>{t('actionDialog.cancel')}</Button>
          <Button onClick={handleSubmit}>{t('actionDialog.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
