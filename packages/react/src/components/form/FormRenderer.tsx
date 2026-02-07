/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useForm, FormProvider, UseFormReturn } from 'react-hook-form';
import type { FormView, FormSection } from '@objectstack/spec/ui';
import { FieldFactory } from './FieldFactory';
import {
  useFieldDependency,
  type FieldDependencyConfig,
} from '../../hooks/useFieldDependency';

export interface FormRendererProps {
  /**
   * The FormView schema from @objectstack/spec
   */
  schema: FormView;
  /**
   * Initial form data
   */
  data?: Record<string, any>;
  /**
   * Form submission handler
   */
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  /**
   * Form change handler
   */
  onChange?: (data: Record<string, any>) => void;
  /**
   * Custom class name for the form
   */
  className?: string;
  /**
   * Whether the form is disabled
   */
  disabled?: boolean;
}

/**
 * FormRenderer component that renders forms based on FormViewSchema
 * from @objectstack/spec
 */
export const FormRenderer: React.FC<FormRendererProps> = ({
  schema,
  data = {},
  onSubmit,
  onChange,
  className = '',
  disabled = false,
}) => {
  // Create form methods with react-hook-form
  const methods = useForm({
    defaultValues: data,
    mode: 'onChange',
  });

  const { handleSubmit, watch } = methods;

  // Watch for form changes
  React.useEffect(() => {
    if (onChange) {
      const subscription = watch((value) => {
        onChange(value as Record<string, any>);
      });
      return () => subscription.unsubscribe();
    }
  }, [watch, onChange]);

  // Handle form submission
  const onSubmitForm = handleSubmit(async (formData) => {
    if (onSubmit) {
      await onSubmit(formData);
    }
  });

  // Render sections or fields
  const renderContent = () => {
    if (!schema.sections || schema.sections.length === 0) {
      return null;
    }

    return (
      <div className="space-y-6">
        {schema.sections.map((section, index) => (
          <FormSectionRenderer
            key={index}
            section={section}
            methods={methods}
            disabled={disabled}
          />
        ))}
      </div>
    );
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmitForm} className={`space-y-6 ${className}`}>
        {renderContent()}
        
        {/* Submit button - optional, can be customized */}
        <div className="flex justify-end gap-2">
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit
          </button>
        </div>
      </form>
    </FormProvider>
  );
};

interface FormSectionRendererProps {
  section: FormSection;
  methods: UseFormReturn<any>;
  disabled?: boolean;
}

// Grid column classes for different column counts
const GRID_COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
} as const;

// Column span classes
const COL_SPAN = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
} as const;

/**
 * Renders a form section with grid layout
 */
const FormSectionRenderer: React.FC<FormSectionRendererProps> = ({
  section,
  methods,
  disabled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(section.collapsed || false);

  // Determine grid columns based on section.columns
  const gridCols = GRID_COLS[section.columns || 1];

  // Watch all form values for dependency evaluation
  const watchedValues = methods.watch();

  // Build dependency configs from section fields
  const depConfigs: FieldDependencyConfig[] = React.useMemo(() => {
    return section.fields.map((field) => {
      const fieldConfig = typeof field === 'string' ? { field } : field;
      const fieldName = typeof field === 'string' ? field : field.field;
      return {
        name: fieldName,
        dependsOn: (fieldConfig as any).dependsOn,
        visibleOn: (fieldConfig as any).visibleOn,
        hidden: fieldConfig.hidden,
      };
    });
  }, [section.fields]);

  const { getFieldVisibility, getDependentFields } = useFieldDependency({
    fields: depConfigs,
    formData: watchedValues,
  });

  // Track parent changes and reset dependent fields
  const prevParentValues = React.useRef<Record<string, unknown>>({});
  React.useEffect(() => {
    for (const config of depConfigs) {
      if (config.dependsOn) {
        const parentValue = watchedValues[config.dependsOn];
        const prevValue = prevParentValues.current[config.dependsOn];
        if (prevValue !== undefined && prevValue !== parentValue) {
          // Parent changed — reset all dependent fields
          const dependents = getDependentFields(config.dependsOn);
          for (const depField of dependents) {
            methods.setValue(depField, undefined);
          }
        }
        prevParentValues.current[config.dependsOn] = parentValue;
      }
    }
  }, [watchedValues, depConfigs, getDependentFields, methods]);

  const handleToggleCollapse = () => {
    if (section.collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      {section.label && (
        <div
          className={`flex items-center justify-between mb-4 ${
            section.collapsible ? 'cursor-pointer' : ''
          }`}
          onClick={handleToggleCollapse}
        >
          <h3 className="text-lg font-semibold">{section.label}</h3>
          {section.collapsible && (
            <span className="text-sm text-gray-500">
              {isCollapsed ? '▶' : '▼'}
            </span>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className={`grid ${gridCols} gap-4`}>
          {section.fields.map((field, index) => {
            // Handle both string fields (legacy) and FormFieldSchema objects
            const fieldName = typeof field === 'string' ? field : field.field;
            const fieldConfig = typeof field === 'string' ? { field: fieldName } : field;

            // Skip hidden fields
            if (fieldConfig.hidden) {
              return null;
            }

            // Evaluate dependsOn/visibleOn visibility
            if (!getFieldVisibility(fieldName)) {
              return null;
            }

            // Calculate colSpan for grid
            const colSpan = fieldConfig.colSpan || 1;
            const colSpanClass = COL_SPAN[Math.min(colSpan, section.columns || 1) as keyof typeof COL_SPAN];

            return (
              <div key={`${fieldName}-${index}`} className={colSpanClass}>
                <FieldFactory
                  field={fieldConfig}
                  methods={methods}
                  disabled={disabled || fieldConfig.readonly}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

FormRenderer.displayName = 'FormRenderer';
