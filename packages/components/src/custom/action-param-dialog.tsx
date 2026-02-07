/**
 * ObjectUI — Action Param Dialog
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Renders a dialog to collect ActionParam values before action execution.
 * Used by the ActionRunner when an action defines params to collect.
 */

import React, { useState, useCallback } from 'react';
import type { ActionParamDef } from '@object-ui/core';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export interface ActionParamDialogProps {
  /** The param definitions to render */
  params: ActionParamDef[];
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the user submits the form */
  onSubmit: (values: Record<string, any>) => void;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
}

/**
 * ActionParamDialog renders a dialog with form fields for each ActionParam.
 * It collects user input and returns the values on submit.
 */
export const ActionParamDialog: React.FC<ActionParamDialogProps> = ({
  params,
  open,
  onSubmit,
  onCancel,
  title = 'Action Parameters',
  description = 'Please provide the required parameters.',
}) => {
  // Initialize values from defaultValues
  const [values, setValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    params.forEach((p) => {
      if (p.defaultValue !== undefined) {
        initial[p.name] = p.defaultValue;
      } else {
        initial[p.name] = p.type === 'boolean' ? false : '';
      }
    });
    return initial;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate required fields
    const newErrors: Record<string, string> = {};
    params.forEach((p) => {
      if (p.required) {
        const val = values[p.name];
        if (val === undefined || val === null || val === '') {
          newErrors[p.name] = `${p.label} is required`;
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(values);
  }, [params, values, onSubmit]);

  const renderField = (param: ActionParamDef) => {
    const value = values[param.name];
    const error = errors[param.name];

    switch (param.type) {
      case 'textarea':
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              id={param.name}
              value={value || ''}
              onChange={(e) => handleChange(param.name, e.target.value)}
              placeholder={param.placeholder}
            />
            {param.helpText && (
              <p className="text-sm text-muted-foreground">{param.helpText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={param.name}
              type="number"
              value={value ?? ''}
              onChange={(e) => handleChange(param.name, Number.isNaN(e.target.valueAsNumber) ? '' : e.target.valueAsNumber)}
              placeholder={param.placeholder}
            />
            {param.helpText && (
              <p className="text-sm text-muted-foreground">{param.helpText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'boolean':
        return (
          <div key={param.name} className="flex items-center space-x-2">
            <Checkbox
              id={param.name}
              checked={!!value}
              onCheckedChange={(checked) => handleChange(param.name, !!checked)}
            />
            <Label htmlFor={param.name}>{param.label}</Label>
            {param.helpText && (
              <p className="text-sm text-muted-foreground ml-2">{param.helpText}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Select
              value={value || ''}
              onValueChange={(val) => handleChange(param.name, val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={param.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {param.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {param.helpText && (
              <p className="text-sm text-muted-foreground">{param.helpText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={param.name}
              type="date"
              value={value || ''}
              onChange={(e) => handleChange(param.name, e.target.value)}
            />
            {param.helpText && (
              <p className="text-sm text-muted-foreground">{param.helpText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );

      // text and all other types default to text input
      default:
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Input
              id={param.name}
              type="text"
              value={value || ''}
              onChange={(e) => handleChange(param.name, e.target.value)}
              placeholder={param.placeholder}
            />
            {param.helpText && (
              <p className="text-sm text-muted-foreground">{param.helpText}</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {params.map(renderField)}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ActionParamDialog.displayName = 'ActionParamDialog';
