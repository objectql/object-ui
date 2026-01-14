import { ComponentRegistry } from '@object-ui/core';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/ui/form';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Checkbox } from '@/ui/checkbox';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '@/ui/select';
import { renderChildren } from '../../lib/utils';
import { Alert, AlertDescription } from '@/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import React from 'react';

// Form renderer component - Airtable-style feature-complete form
ComponentRegistry.register('form',
  ({ schema, className, onAction, ...props }) => {
    const {
      defaultValues = {},
      fields = [],
      submitLabel = 'Submit',
      cancelLabel = 'Cancel',
      showCancel = false,
      layout = 'vertical',
      columns = 1,
      onSubmit: onSubmitProp,
      onChange: onChangeProp,
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

    // Watch for form changes
    React.useEffect(() => {
      if (onChangeProp && onAction) {
        const subscription = form.watch((data) => {
          onAction({
            type: 'form_change',
            data,
            formData: data,
          });
        });
        return () => subscription.unsubscribe();
      }
    }, [form, onAction, onChangeProp]);

    // Handle form submission
    const handleSubmit = form.handleSubmit(async (data) => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        if (onAction) {
          const result = await onAction({
            type: 'form_submit',
            data,
            formData: data,
          });

          // Check if submission returned an error
          if (result?.error) {
            setSubmitError(result.error);
            return;
          }
        }

        if (onSubmitProp && typeof onSubmitProp === 'function') {
          await onSubmitProp(data);
        }

        if (resetOnSubmit) {
          form.reset();
        }
      } catch (error: any) {
        setSubmitError(error?.message || 'An error occurred during submission');
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    });

    // Handle cancel
    const handleCancel = () => {
      form.reset();
      if (onAction) {
        onAction({
          type: 'form_cancel',
          data: form.getValues(),
        });
      }
    };

    // Determine grid classes based on columns
    const gridClass = columns > 1 
      ? `grid gap-4 md:grid-cols-${Math.min(columns, 4)}`
      : 'space-y-4';

    return (
      <Form {...form}>
        <form onSubmit={handleSubmit} className={className} {...props}>
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
              {fields.map((field: any, index: number) => {
                const {
                  name,
                  label,
                  description,
                  type = 'input',
                  required = false,
                  disabled: fieldDisabled = false,
                  validation = {},
                  condition,
                  ...fieldProps
                } = field;

                // Handle conditional rendering
                if (condition) {
                  const watchField = condition.field;
                  const watchValue = form.watch(watchField);
                  
                  if (condition.equals && watchValue !== condition.equals) {
                    return null;
                  }
                  if (condition.notEquals && watchValue === condition.notEquals) {
                    return null;
                  }
                  if (condition.in && !condition.in.includes(watchValue)) {
                    return null;
                  }
                }

                // Build validation rules
                const rules: any = {
                  ...validation,
                };

                if (required) {
                  rules.required = validation.required || `${label || name} is required`;
                }

                return (
                  <FormField
                    key={field.id || name || index}
                    control={form.control}
                    name={name}
                    rules={rules}
                    render={({ field: formField }) => (
                      <FormItem>
                        {label && (
                          <FormLabel>
                            {label}
                            {required && <span className="text-destructive ml-1">*</span>}
                          </FormLabel>
                        )}
                        <FormControl>
                          {/* Render the actual field component based on type */}
                          {renderFieldComponent(type, {
                            ...fieldProps,
                            ...formField,
                            inputType: fieldProps.inputType,
                            options: fieldProps.options,
                            disabled: disabled || fieldDisabled || isSubmitting,
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
            <div className={`flex gap-2 ${layout === 'horizontal' ? 'justify-end' : 'justify-start'} mt-6`}>
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting || disabled}
                >
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting || disabled}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          )}
        </form>
      </Form>
    );
  },
  {
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

// Helper function to render field components
function renderFieldComponent(type: string, props: any) {
  const { schema, inputType, options, ...fieldProps } = props;

  switch (type) {
    case 'input':
      return <Input type={inputType || 'text'} {...fieldProps} />;
    
    case 'textarea':
      return <Textarea {...fieldProps} />;
    
    case 'checkbox':
      // For checkbox, we need to handle the value differently
      const { value, onChange, ...checkboxProps } = fieldProps;
      return (
        <div className="flex items-center space-x-2">
          <Checkbox 
            checked={value}
            onCheckedChange={onChange}
            {...checkboxProps}
          />
        </div>
      );
    
    case 'select':
      // For select with react-hook-form, we need to handle the onChange
      const { value: selectValue, onChange: selectOnChange, ...selectProps } = fieldProps;
      return (
        <Select value={selectValue} onValueChange={selectOnChange} {...selectProps}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options?.map((opt: any) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    
    default:
      return <Input type={inputType || 'text'} {...fieldProps} />;
  }
}
