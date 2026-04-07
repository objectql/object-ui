/**
 * MetadataFormDialog
 *
 * Generic, registry-driven dialog for creating and editing metadata items.
 * Form fields are determined by the `formFields` configuration in the metadata
 * type registry, falling back to the default `name`, `label`, `description`
 * fields when not specified.
 *
 * @module components/MetadataFormDialog
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
} from '@object-ui/components';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_FORM_FIELDS,
  type MetadataFormFieldDef,
} from '../config/metadataTypeRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetadataFormDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Callback when the dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Dialog mode — create or edit. */
  mode: 'create' | 'edit';
  /** Human-readable type label (e.g. `'Dashboard'`). */
  typeLabel: string;
  /** Form field definitions from the registry (or defaults). */
  formFields?: MetadataFormFieldDef[];
  /** Initial values when editing an existing item. */
  initialValues?: Record<string, unknown>;
  /** Called when the user submits the form. Returns a promise. */
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetadataFormDialog({
  open,
  onOpenChange,
  mode,
  typeLabel,
  formFields,
  initialValues,
  onSubmit,
}: MetadataFormDialogProps) {
  const fields = formFields ?? DEFAULT_FORM_FIELDS;
  const isEdit = mode === 'edit';

  // Form state — values are stored as strings because the form is a generic
  // key-value store. Boolean fields use 'true'/'false' string representations.
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form values when dialog opens or initialValues change
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const f of fields) {
        initial[f.key] = String(initialValues?.[f.key] ?? '');
      }
      setValues(initial);
    }
  }, [open, initialValues, fields]);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      // Error handling is done by the caller (toast, etc.)
    } finally {
      setSubmitting(false);
    }
  }, [values, onSubmit, onOpenChange]);

  // Validate required fields
  const isValid = fields
    .filter((f) => f.required)
    .every((f) => (values[f.key] ?? '').trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="metadata-form-dialog">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Edit ${typeLabel}` : `New ${typeLabel}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Update the ${typeLabel.toLowerCase()} details below.`
              : `Fill in the details to create a new ${typeLabel.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {fields.map((field) => {
            const disabled = submitting || (isEdit && field.disabledOnEdit === true);
            const value = values[field.key] ?? '';
            const inputId = `metadata-field-${field.key}`;

            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={inputId}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.type === 'textarea' ? (
                  <Textarea
                    id={inputId}
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      handleChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={disabled}
                    data-testid={`metadata-field-${field.key}`}
                  />
                ) : field.type === 'select' && field.options ? (
                  <select
                    id={inputId}
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleChange(field.key, e.target.value)
                    }
                    disabled={disabled}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid={`metadata-field-${field.key}`}
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'number' ? (
                  <Input
                    id={inputId}
                    type="number"
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={disabled}
                    data-testid={`metadata-field-${field.key}`}
                  />
                ) : field.type === 'boolean' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      id={inputId}
                      checked={value === 'true'}
                      onCheckedChange={(checked: boolean) =>
                        handleChange(field.key, String(checked))
                      }
                      disabled={disabled}
                      data-testid={`metadata-field-${field.key}`}
                    />
                    <Label htmlFor={inputId} className="text-sm text-muted-foreground cursor-pointer">
                      {value === 'true' ? 'Yes' : 'No'}
                    </Label>
                  </div>
                ) : (
                  <Input
                    id={inputId}
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={disabled}
                    data-testid={`metadata-field-${field.key}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="metadata-form-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !isValid}
            data-testid="metadata-form-submit-btn"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
