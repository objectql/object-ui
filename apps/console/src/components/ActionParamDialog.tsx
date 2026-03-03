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
} from '@object-ui/components';
import type { ActionParamDef } from '@object-ui/core';

export interface ParamDialogState {
  open: boolean;
  params: ActionParamDef[];
  resolve?: (value: Record<string, any> | null) => void;
}

interface ActionParamDialogProps {
  state: ParamDialogState;
  onOpenChange: (open: boolean) => void;
}

export function ActionParamDialog({ state, onOpenChange }: ActionParamDialogProps) {
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
          <DialogTitle>Action Parameters</DialogTitle>
          <DialogDescription>
            Please provide the required information to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {state.params.map((param) => (
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
                    <SelectValue placeholder={param.placeholder || `Select ${param.label}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {param.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  placeholder={param.placeholder}
                  className={errors[param.name] ? 'border-destructive' : ''}
                />
              )}

              {errors[param.name] && (
                <p className="text-xs text-destructive">{param.label} is required</p>
              )}
              {param.helpText && (
                <p className="text-xs text-muted-foreground">{param.helpText}</p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleSubmit}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
