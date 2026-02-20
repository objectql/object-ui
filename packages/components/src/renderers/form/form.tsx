/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { FormSchema, FormField as FormFieldConfig, ValidationRule, FieldCondition, SelectOption } from '@object-ui/types';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '../../ui/form';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import { Switch } from '../../ui/switch';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '../../ui/select';
import { renderChildren } from '../../lib/utils';
import { Alert, AlertDescription } from '../../ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import React from 'react';

// Form renderer component - Airtable-style feature-complete form
ComponentRegistry.register('form',
  ({ schema, className, onAction, ...props }: { schema: FormSchema; className?: string; onAction?: (action: any) => void; [key: string]: any }) => {
    const {
      defaultValues = {},
      fields = [],
      submitLabel = 'Submit',
      cancelLabel = 'Cancel',
      showCancel = false,
      showSubmit = true,
      layout = 'vertical',
      columns = 1,
      onSubmit: onSubmitProp,
      onChange: onChangeProp,
      onCancel: onCancelProp,
      resetOnSubmit = false,
      validationMode = 'onSubmit',
      disabled = false,
    } = schema;

    // Initialize react-hook-form
    const form = useForm({
      defaultValues,
      mode: validationMode,
    });

    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitError, setSubmitError] = React.useState<string | null>(null);

    // React to defaultValues changes
    React.useEffect(() => {
      form.reset(defaultValues);
    }, [defaultValues]);

    // Watch for form changes - only track changes when onAction is available
    React.useEffect(() => {
      if (onAction) {
        const subscription = form.watch((data) => {
          onAction({
            type: 'form_change',
            data,
            formData: data,
          });
        });
        return () => subscription.unsubscribe();
      }
    }, [form, onAction]);

    // Handle form submission
    const handleSubmit = form.handleSubmit(async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);

      // Defensive check: If data is an Event, use getValues()
      let formData = data;
      // Check for Event-like properties
      const isEvent = data && (
        (data as any).nativeEvent || 
        typeof (data as any).preventDefault === 'function' || 
        typeof (data as any).stopPropagation === 'function' ||
        (data as any).target ||
        (data as any).bubbles
      );

      if (isEvent) {
        // This should not happen with RHF handleSubmit, but just in case
        formData = form.getValues();
      } else if (!formData || Object.keys(formData).length === 0) {
        // Fallback: if data is empty check getValues(), in case RHF failed to pass it for some reason
        const values = form.getValues();
        if (values && Object.keys(values).length > 0) {
             formData = values;
        }
      }

      try {
        if (onAction) {
          const result = await onAction({
            type: 'form_submit',
            data: formData,
            formData: formData,
          }) as any;

          // Check if submission returned an error
          if (result?.error) {
            setSubmitError(result.error);
            return;
          }
        }

        if (onSubmitProp && typeof onSubmitProp === 'function') {
          await onSubmitProp(formData);
        }

        if (resetOnSubmit) {
          form.reset();
        }
      } catch (error) {
        // Handle different error types safely
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
            ? error 
            : 'An error occurred during submission';
        setSubmitError(errorMessage);
        
        // Log errors for debugging (dev environment only)
        // process may not be defined in all environments
        if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
          console.error('Form submission error:', error);
        }
      } finally {
        setIsSubmitting(false);
      }
    });

    // Handle cancel
    const handleCancel = () => {
      form.reset();
      
      if (onCancelProp && typeof onCancelProp === 'function') {
        onCancelProp();
      }

      if (onAction) {
        onAction({
          type: 'form_cancel',
          data: form.getValues(),
        });
      }
    };

    // Determine grid classes based on columns (explicit classes for Tailwind JIT)
    // Mobile-first: 1 column on mobile, responsive breakpoints for larger screens
    const gridColsClass = 
      columns === 1 ? '' :
      columns === 2 ? 'md:grid-cols-2' :
      columns === 3 ? 'md:grid-cols-2 lg:grid-cols-3' :
      'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    
    const gridClass = columns > 1 
      ? cn('grid gap-4', gridColsClass)
      : 'space-y-4';

    // Extract designer-related props and conflicting handlers
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        onSubmit: _ignoredOnSubmit, // Prevent overwriting our handleSubmit
        onChange: _ignoredOnChange, // Prevent overwriting our onChange
        // Extract schema props that should not be spread to DOM (handled separately by schema destructuring above)
        submitLabel: _submitLabel,
        cancelLabel: _cancelLabel,
        showSubmit: _showSubmit,
        showCancel: _showCancel,
        resetOnSubmit: _resetOnSubmit,
        defaultValues: _defaultValues,
        inputType: _inputType,
        ...formProps 
    } = props;

    return (
      <Form {...form}>
        <form 
            onSubmit={handleSubmit} 
            className={className} 
            {...formProps}
            // Apply designer props
            data-obj-id={dataObjId}
            data-obj-type={dataObjType}
            style={style}
        >
          {/* Form Error Alert */}
          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Form Fields */}
          {schema.children ? (
            // If children are provided directly, render them
            <div className={schema.fieldContainerClass || 'space-y-4'}>
              {renderChildren(schema.children)}
            </div>
          ) : (
            // Otherwise render fields from schema
            <div className={schema.fieldContainerClass || gridClass}>
              {fields.map((field: FormFieldConfig) => {
                const {
                  name,
                  label,
                  description,
                  type = 'input',
                  required = false,
                  disabled: fieldDisabled = false,
                  validation = {},
                  condition,
                  colSpan,
                  hidden,
                  widget,
                  visibleOn,
                  readonly,
                  ...fieldProps
                } = field;

                // Skip hidden fields
                if (hidden) return null;

                // Handle conditional rendering with null/undefined safety
                if (condition) {
                  const watchField = condition.field;
                  const watchValue = form.watch(watchField);
                  
                  // Check for null/undefined before evaluating conditions
                  const hasValue = watchValue !== undefined && watchValue !== null;
                  
                  if (condition.equals !== undefined && watchValue !== condition.equals) {
                    return null;
                  }
                  if (condition.notEquals !== undefined && watchValue === condition.notEquals) {
                    return null;
                  }
                  if (condition.in && (!hasValue || !condition.in.includes(watchValue))) {
                    return null;
                  }
                }

                // Build validation rules
                const rules: any = {
                  ...validation,
                };

                if (required) {
                  rules.required = typeof validation.required === 'string' 
                    ? validation.required 
                    : `${label || name} is required`;
                }

                // Use field.id or field.name for stable keys (never use index alone)
                const fieldKey = field.id ?? name;

                // Resolve the component type: prefer widget override, fallback to field type
                const resolvedType = widget || type;

                // colSpan classes for grid layout
                const colSpanClass = colSpan && colSpan > 1
                  ? colSpan === 2 ? 'col-span-2'
                  : colSpan === 3 ? 'col-span-3'
                  : colSpan >= 4 ? 'col-span-4'
                  : ''
                  : '';

                return (
                  <FormField
                    key={fieldKey}
                    control={form.control}
                    name={name}
                    rules={rules}
                    render={({ field: formField }) => (
                      <FormItem className={colSpanClass || undefined}>
                        {label && (
                          <FormLabel className="text-xs sm:text-sm">
                            {label}
                            {required && (
                              <span className="text-destructive ml-1" aria-label="required">
                                *
                              </span>
                            )}
                          </FormLabel>
                        )}
                        <FormControl>
                          {/* Render the actual field component based on resolved type */}
                          {renderFieldComponent(resolvedType, {
                            ...fieldProps,
                            // specialized fields needs raw metadata, but we should traverse down if it exists
                            // field is the field configuration loop variable
                            field: (field as any).field || field, 
                            ...formField,
                            inputType: fieldProps.inputType,
                            options: fieldProps.options,
                            placeholder: fieldProps.placeholder,
                            disabled: disabled || fieldDisabled || readonly || isSubmitting,
                          })}
                        </FormControl>
                        {description && (
                          <FormDescription>{description}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
          )}

          {/* Form Actions */}
          {(schema.showActions !== false) && (
            <div className={`flex flex-col sm:flex-row gap-2 ${layout === 'horizontal' ? 'sm:justify-end' : 'sm:justify-start'} mt-6`}>
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting || disabled}
                  className="w-full sm:w-auto"
                >
                  {cancelLabel}
                </Button>
              )}
              {showSubmit && (
              <Button
                type="submit"
                disabled={isSubmitting || disabled}
                className="w-full sm:w-auto"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
              )}
            </div>
          )}
        </form>
      </Form>
    );
  },
  {
    namespace: 'ui',
    label: 'Form',
    inputs: [
      { 
        name: 'fields', 
        type: 'array', 
        label: 'Fields',
        description: 'Array of field configurations with name, label, type, validation, etc.'
      },
      { 
        name: 'defaultValues', 
        type: 'object', 
        label: 'Default Values',
        description: 'Object with default values for form fields'
      },
      { name: 'submitLabel', type: 'string', label: 'Submit Button Label', defaultValue: 'Submit' },
      { name: 'cancelLabel', type: 'string', label: 'Cancel Button Label', defaultValue: 'Cancel' },
      { name: 'showCancel', type: 'boolean', label: 'Show Cancel Button', defaultValue: false },
      { 
        name: 'layout', 
        type: 'enum', 
        enum: ['vertical', 'horizontal'],
        label: 'Layout',
        defaultValue: 'vertical'
      },
      { 
        name: 'columns', 
        type: 'number', 
        label: 'Number of Columns',
        defaultValue: 1,
        description: 'For multi-column layouts (1-4)'
      },
      { 
        name: 'validationMode', 
        type: 'enum',
        enum: ['onSubmit', 'onBlur', 'onChange', 'onTouched', 'all'],
        label: 'Validation Mode',
        defaultValue: 'onSubmit'
      },
      { name: 'resetOnSubmit', type: 'boolean', label: 'Reset After Submit', defaultValue: false },
      { name: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false },
      { name: 'className', type: 'string', label: 'CSS Class' },
      { name: 'fieldContainerClass', type: 'string', label: 'Field Container CSS Class' }
    ],
    defaultProps: {
      submitLabel: 'Submit',
      cancelLabel: 'Cancel',
      showCancel: false,
      layout: 'vertical',
      columns: 1,
      validationMode: 'onSubmit',
      resetOnSubmit: false,
      disabled: false,
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'input',
          required: true,
          placeholder: 'Enter your name',
        },
        {
          name: 'email',
          label: 'Email',
          type: 'input',
          inputType: 'email',
          required: true,
          placeholder: 'Enter your email',
        },
      ],
    },
  }
);

// Helper function to render field components with proper typing
interface RenderFieldProps {
  inputType?: string;
  options?: SelectOption[];
  placeholder?: string;
  value?: any;
  onChange?: (value: any) => void;
  disabled?: boolean;
  [key: string]: any;
}

function renderFieldComponent(type: string, props: RenderFieldProps) {
  // 1. Try to resolve specialized field widget from registry first
  // We prioritize registry components (e.g., 'field.currency', 'field.date')
  const RegisteredComponent = ComponentRegistry.get(type);

  if (RegisteredComponent) {
    // For specialized fields (e.g. fields package), they expect 'field' prop.
    // Ensure we pass all props.
    // Also pass 'schema' for standard renderers that expect it
    return <RegisteredComponent schema={props} {...props} />;
  }

  const { inputType, options = [], placeholder, ...fieldProps } = props;

  switch (type) {
    case 'input':
      if (inputType === 'file') {
        // File inputs cannot be controlled with value prop
         const { value, ...fileProps } = fieldProps;
         return <Input type="file" placeholder={placeholder} className="min-h-[44px] sm:min-h-0" {...fileProps} />;
      }
      return <Input type={inputType || 'text'} placeholder={placeholder} className="min-h-[44px] sm:min-h-0" {...fieldProps} value={fieldProps.value ?? ''} />;
      
    case 'textarea':
      return <Textarea placeholder={placeholder} className="min-h-[44px] sm:min-h-0" {...fieldProps} value={fieldProps.value ?? ''} />;
    
    case 'checkbox': {
      // For checkbox, we need to handle the value differently
      const { value, onChange, ...checkboxProps } = fieldProps;
      return (
        <Checkbox 
          checked={value}
          onCheckedChange={onChange}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...checkboxProps}
        />
      );
    }

    case 'switch': {
      // For switch, we need to handle the value differently (same as checkbox)
      const { value, onChange, ...switchProps } = fieldProps;
      return (
        <Switch 
          checked={value}
          onCheckedChange={onChange}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          {...switchProps}
        />
      );
    }
    
    case 'select': {
      // For select with react-hook-form, we need to handle the onChange
      const { value: selectValue, onChange: selectOnChange, ...selectProps } = fieldProps;
      
      // Safety check for options
      if (!options || options.length === 0) {
        return <div className="text-sm text-muted-foreground">No options available</div>;
      }
      
      return (
        <Select value={selectValue} onValueChange={selectOnChange} {...selectProps}>
          <SelectTrigger className="min-h-[44px] sm:min-h-0">
            <SelectValue placeholder={placeholder ?? 'Select an option'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt: SelectOption) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    default:
      return <Input type={inputType || 'text'} placeholder={placeholder} {...fieldProps} />;
  }
}
