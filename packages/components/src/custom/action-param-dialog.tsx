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
import { createSafeTranslation } from '@object-ui/i18n';
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

/**
 * The `select` branch's placeholder — objectui#4386.
 *
 * ## Why a pack key, not a two-character glyph edit
 *
 * The branch used to render `param.placeholder || 'Select...'`, and that one
 * literal carried two defects at once: it is hardcoded English (this file
 * imported no translation hook at all, so a zh-CN user read `Select...` in an
 * otherwise Chinese dialog — the #4024 family), and its ellipsis is ASCII,
 * which #3878 converged the ten packs away from. Routing the fallback through
 * a pack key fixes BOTH, because each locale's value carries whatever glyph
 * that locale wants; re-spelling `...` to `…` in place would have fixed only
 * the smaller half and left the English frozen in.
 *
 * ## Why `common.select`, and why no pack file changed
 *
 * REUSED, not added. `common.select` already ships in all ten packs
 * (`Select…` / `选择…` / `Auswählen…` / …) and `packages/fields`'
 * `LookupField` already consumes it for the structurally identical job — the
 * placeholder of a Radix select trigger, behind the same authored-metadata-wins
 * `authored?.placeholder || t(...)` shape this branch uses. One key, one
 * wording, on both select-trigger paths.
 *
 * The near-miss candidate is `common.selectOption` (`Select an option` /
 * `请选择`), which the FORM renderer's built-in select uses. It was rejected on
 * two counts: it is a different sentence, so adopting it would silently rewrite
 * this dialog's visible copy, and neither its `en` nor its `zh` value ends in an
 * ellipsis — it would have dropped the very glyph half of the defect. A NEW key
 * was not needed and would have collided with the #4375/#4376 pair in flight
 * across the packs.
 *
 * Because `common.select` is already in `ellipsis-glyph-3878.test.ts`'s
 * `CONVERGED_KEYS`, the U+2026 this site now renders is pinned by that gate for
 * free, in every locale.
 *
 * ## Why the SAFE hook
 *
 * `createSafeTranslation`, not a bare `useObjectTranslation`: this dialog is
 * rendered with no `I18nProvider` by embedded hosts and by this package's own
 * bare-render tests (`action-param-dialog-aria-required`,
 * `action-param-dialog-label-association` both mount it provider-less). With no
 * provider the bare hook returns the raw KEY, so the placeholder would read
 * `common.select`. The default below is the pack's stand-in on that path and is
 * byte-identical to the `en` value, so a provider-less host renders `Select…` —
 * the literal this replaced, modulo the glyph the card asked for.
 */
const useSafeParamTranslation = createSafeTranslation(
  { 'common.select': 'Select…' },
  // Probe key: one this component itself consumes, so it cannot rot into
  // pointing at a key no caller reads.
  'common.select',
);

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
  const { t } = useSafeParamTranslation();

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
    // Required is a STATE and must reach the CONTROL, not just the label's
    // asterisk (objectui#3299, same shape as #3290/#3298): `aria-required` on
    // each control, `aria-hidden` on the `*` so it stays out of the accessible
    // name. Deliberately NOT the native `required` attribute — that would arm
    // the browser's constraint-validation bubble alongside this dialog's own
    // "<label> is required" messages (#3290 ruling). `|| undefined` so an
    // optional param carries no attribute at all.
    const ariaRequired = param.required || undefined;

    switch (param.type) {
      case 'textarea':
        return (
          <div key={param.name} className="space-y-2">
            <Label htmlFor={param.name}>
              {param.label}
              {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
            </Label>
            <Textarea
              id={param.name}
              aria-required={ariaRequired}
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
              {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
            </Label>
            <Input
              id={param.name}
              aria-required={ariaRequired}
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
              {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
            </Label>
            <Select
              value={value || ''}
              onValueChange={(val) => handleChange(param.name, val)}
            >
              {/* The trigger IS the focusable combobox control, so both the
                  state and the `id` belong on it (the Radix root renders no
                  element of its own). Without the `id` the sibling
                  `<Label htmlFor={param.name}>` pointed at nothing, so the
                  label text never reached the combobox's accessible name —
                  every other branch already sets the `id` (objectui#3341).
                  `button` is a labelable element, so the plain `htmlFor`
                  association is enough here; no `aria-labelledby` needed. */}
              <SelectTrigger id={param.name} aria-required={ariaRequired}>
                <SelectValue placeholder={param.placeholder || t('common.select')} />
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
              {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
            </Label>
            <Input
              id={param.name}
              aria-required={ariaRequired}
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
              {param.required && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
            </Label>
            <Input
              id={param.name}
              aria-required={ariaRequired}
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
