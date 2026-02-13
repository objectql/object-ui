/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * WizardForm Component
 * 
 * A multi-step wizard form that guides users through sections step by step.
 * Aligns with @objectstack/spec FormView type: 'wizard'
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { FormField, DataSource } from '@object-ui/types';
import { Button, cn } from '@object-ui/components';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { FormSection } from './FormSection';
import { SchemaRenderer } from '@object-ui/react';
import { mapFieldTypeToFormType, buildValidationRules } from '@object-ui/fields';
import type { FormSectionConfig } from './TabbedForm';

export interface WizardFormSchema {
  type: 'object-form';
  formType: 'wizard';
  
  /**
   * Object name for ObjectQL schema lookup
   */
  objectName: string;
  
  /**
   * Form mode
   */
  mode: 'create' | 'edit' | 'view';
  
  /**
   * Record ID (for edit/view modes)
   */
  recordId?: string | number;
  
  /**
   * Wizard step sections
   */
  sections: FormSectionConfig[];
  
  /**
   * Allow navigation to any step (not just sequential)
   * @default false
   */
  allowSkip?: boolean;
  
  /**
   * Show step indicators
   * @default true
   */
  showStepIndicator?: boolean;
  
  /**
   * Text for Next button
   * @default 'Next'
   */
  nextText?: string;
  
  /**
   * Text for Previous button
   * @default 'Back'
   */
  prevText?: string;
  
  /**
   * Submit button text (shown on last step)
   */
  submitText?: string;
  
  /**
   * Show cancel button
   * @default true
   */
  showCancel?: boolean;
  
  /**
   * Cancel button text
   */
  cancelText?: string;
  
  /**
   * Initial values
   */
  initialValues?: Record<string, any>;
  
  /**
   * Initial data (alias)
   */
  initialData?: Record<string, any>;
  
  /**
   * Read-only mode
   */
  readOnly?: boolean;
  
  /**
   * Callbacks
   */
  onSuccess?: (data: any) => void | Promise<void>;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  
  /**
   * Called when step changes
   */
  onStepChange?: (step: number) => void;
  
  /**
   * CSS class
   */
  className?: string;
}

export interface WizardFormProps {
  schema: WizardFormSchema;
  dataSource?: DataSource;
  className?: string;
}

/**
 * WizardForm Component
 * 
 * Renders a multi-step wizard form with step indicators and navigation.
 * 
 * @example
 * ```tsx
 * <WizardForm
 *   schema={{
 *     type: 'object-form',
 *     formType: 'wizard',
 *     objectName: 'users',
 *     mode: 'create',
 *     sections: [
 *       { label: 'Step 1: Personal', fields: ['firstName', 'lastName'] },
 *       { label: 'Step 2: Contact', fields: ['email', 'phone'] },
 *       { label: 'Step 3: Review', fields: [] },
 *     ]
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 */
export const WizardForm: React.FC<WizardFormProps> = ({
  schema,
  dataSource,
  className,
}) => {
  const [objectSchema, setObjectSchema] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = schema.sections.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  // Fetch object schema
  React.useEffect(() => {
    const fetchSchema = async () => {
      if (!dataSource) {
        setLoading(false);
        return;
      }
      
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        setObjectSchema(schemaData);
      } catch (err) {
        setError(err as Error);
      }
    };
    
    fetchSchema();
  }, [schema.objectName, dataSource]);

  // Fetch initial data
  React.useEffect(() => {
    const fetchData = async () => {
      if (schema.mode === 'create' || !schema.recordId || !dataSource) {
        setFormData(schema.initialData || schema.initialValues || {});
        setLoading(false);
        return;
      }
      
      try {
        const data = await dataSource.findOne(schema.objectName, schema.recordId);
        setFormData(data || {});
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    
    if (objectSchema || !dataSource) {
      fetchData();
    }
  }, [objectSchema, schema.mode, schema.recordId, schema.initialData, schema.initialValues, dataSource, schema.objectName]);

  // Build section fields from object schema
  const buildSectionFields = useCallback((section: FormSectionConfig): FormField[] => {
    const fields: FormField[] = [];
    
    for (const fieldDef of section.fields) {
      const fieldName = typeof fieldDef === 'string' ? fieldDef : fieldDef.name;
      
      if (typeof fieldDef === 'object') {
        fields.push(fieldDef);
      } else if (objectSchema?.fields?.[fieldName]) {
        const field = objectSchema.fields[fieldName];
        fields.push({
          name: fieldName,
          label: field.label || fieldName,
          type: mapFieldTypeToFormType(field.type),
          required: field.required || false,
          disabled: schema.readOnly || schema.mode === 'view' || field.readonly,
          placeholder: field.placeholder,
          description: field.help || field.description,
          validation: buildValidationRules(field),
          field: field,
          options: field.options,
          multiple: field.multiple,
        });
      } else {
        fields.push({
          name: fieldName,
          label: fieldName,
          type: 'input',
        });
      }
    }
    
    return fields;
  }, [objectSchema, schema.readOnly, schema.mode]);

  // Current section fields
  const currentSectionFields = useMemo(() => {
    if (currentStep >= 0 && currentStep < totalSteps) {
      return buildSectionFields(schema.sections[currentStep]);
    }
    return [];
  }, [currentStep, totalSteps, schema.sections, buildSectionFields]);

  // Handle step data collection (merge partial data into formData)
  const handleStepSubmit = useCallback(async (stepData: Record<string, any>) => {
    const mergedData = { ...formData, ...stepData };
    setFormData(mergedData);
    
    // Mark step as completed
    setCompletedSteps(prev => new Set(prev).add(currentStep));

    if (isLastStep) {
      // Final submission
      setSubmitting(true);
      try {
        if (!dataSource) {
          if (schema.onSuccess) {
            await schema.onSuccess(mergedData);
          }
          return mergedData;
        }
        
        let result;
        if (schema.mode === 'create') {
          result = await dataSource.create(schema.objectName, mergedData);
        } else if (schema.mode === 'edit' && schema.recordId) {
          result = await dataSource.update(schema.objectName, schema.recordId, mergedData);
        }
        
        if (schema.onSuccess) {
          await schema.onSuccess(result);
        }
        return result;
      } catch (err) {
        if (schema.onError) {
          schema.onError(err as Error);
        }
        throw err;
      } finally {
        setSubmitting(false);
      }
    } else {
      // Move to next step
      goToStep(currentStep + 1);
    }
  }, [formData, currentStep, isLastStep, schema, dataSource]);

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      if (schema.onStepChange) {
        schema.onStepChange(step);
      }
    }
  }, [totalSteps, schema]);

  const handlePrev = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleCancel = useCallback(() => {
    if (schema.onCancel) {
      schema.onCancel();
    }
  }, [schema]);

  const handleStepClick = useCallback((step: number) => {
    if (schema.allowSkip || completedSteps.has(step) || step <= currentStep) {
      goToStep(step);
    }
  }, [schema.allowSkip, completedSteps, currentStep, goToStep]);

  if (error) {
    return (
      <div className="p-4 border border-red-300 bg-red-50 rounded-md">
        <h3 className="text-red-800 font-semibold">Error loading form</h3>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="mt-2 text-sm text-gray-600">Loading form...</p>
      </div>
    );
  }

  const currentSection = schema.sections[currentStep];

  return (
    <div className={cn('w-full', className, schema.className)}>
      {/* Step Indicator */}
      {schema.showStepIndicator !== false && (
        <nav aria-label="Progress" className="mb-8">
          <ol className="flex items-center">
            {schema.sections.map((section, index) => {
              const isActive = index === currentStep;
              const isCompleted = completedSteps.has(index);
              const isClickable = schema.allowSkip || isCompleted || index <= currentStep;

              return (
                <li
                  key={index}
                  className={cn(
                    'relative flex-1',
                    index !== totalSteps - 1 && 'pr-8 sm:pr-12'
                  )}
                >
                  {/* Connector line */}
                  {index !== totalSteps - 1 && (
                    <div
                      className="absolute top-3 sm:top-4 left-6 -right-4 sm:left-10 sm:-right-2 h-0.5"
                      aria-hidden="true"
                    >
                      <div
                        className={cn(
                          'h-full',
                          isCompleted ? 'bg-primary' : 'bg-muted'
                        )}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className={cn(
                      'group relative flex items-center',
                      isClickable ? 'cursor-pointer' : 'cursor-not-allowed'
                    )}
                    onClick={() => handleStepClick(index)}
                    disabled={!isClickable}
                  >
                    {/* Step circle - smaller on mobile */}
                    <span
                      className={cn(
                        'flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-medium transition-colors',
                        isCompleted && 'bg-primary text-primary-foreground',
                        isActive && !isCompleted && 'border-2 border-primary bg-background text-primary',
                        !isActive && !isCompleted && 'border-2 border-muted bg-background text-muted-foreground'
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      ) : (
                        index + 1
                      )}
                    </span>

                    {/* Step label */}
                    <span className="ml-2 sm:ml-3 text-xs sm:text-sm font-medium hidden sm:block">
                      <span
                        className={cn(
                          isActive ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {section.label || `Step ${index + 1}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Current Step Content */}
      <div className="min-h-[200px]">
        {currentSection && (
          <FormSection
            label={currentSection.label}
            description={currentSection.description}
            columns={currentSection.columns || 1}
          >
            {currentSectionFields.length > 0 ? (
              <SchemaRenderer
                schema={{
                  type: 'form' as const,
                  fields: currentSectionFields,
                  layout: 'vertical' as const,
                  defaultValues: formData,
                  showSubmit: false,
                  showCancel: false,
                  onSubmit: handleStepSubmit,
                }}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No fields configured for this step
              </div>
            )}
          </FormSection>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <div>
          {schema.showCancel !== false && (
            <Button
              variant="ghost"
              onClick={handleCancel}
            >
              {schema.cancelText || 'Cancel'}
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Step counter */}
          <span className="text-sm text-muted-foreground mr-2">
            Step {currentStep + 1} of {totalSteps}
          </span>
          
          {!isFirstStep && (
            <Button
              variant="outline"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {schema.prevText || 'Back'}
            </Button>
          )}
          
          {isLastStep ? (
            <Button
              onClick={() => handleStepSubmit(formData)}
              disabled={submitting || schema.mode === 'view'}
            >
              {submitting ? 'Submitting...' : (schema.submitText || (schema.mode === 'create' ? 'Create' : 'Update'))}
            </Button>
          ) : (
            <Button
              onClick={() => handleStepSubmit(formData)}
            >
              {schema.nextText || 'Next'}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WizardForm;
