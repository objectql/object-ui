/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '@testing-library/jest-dom';
import React from 'react';

// Import packages to register components (side-effect imports)
import '@object-ui/components'; // Register all ObjectUI components
import '@object-ui/fields'; // Register field widgets
import '@object-ui/plugin-dashboard'; // Register dashboard components
import '@object-ui/plugin-grid'; // Register grid components

// Manually re-register UI components to override field widgets and plugin components
// This is necessary because @object-ui/fields and plugins have @object-ui/components as a dependency,
// so components gets loaded BEFORE fields/plugins register their widgets, causing them to overwrite.
import { ComponentRegistry } from '@object-ui/core';
import type { TextSchema, InputSchema, TextareaSchema, ImageSchema, HtmlSchema, AvatarSchema, SelectSchema, SliderSchema, GridSchema } from '@object-ui/types';
import { Input, Textarea, Label, Avatar, AvatarImage, AvatarFallback, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Slider } from '@object-ui/components';
import { cn, renderChildren } from '@object-ui/components';

// Re-register text component
ComponentRegistry.register('text', 
  ({ schema, ...props }: { schema: TextSchema; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style,
        ...rest 
    } = props;

    if (dataObjId || schema.className || rest.className) {
        return (
            <span 
                data-obj-id={dataObjId}
                data-obj-type={dataObjType}
                style={style}
                className={schema.className || rest.className}
                {...rest}
            >
                {schema.content || schema.value}
            </span>
        );
    }

    return <>{schema.content || schema.value}</>;
  },
  {
    namespace: 'ui',
    label: 'Text',
  }
);

// Re-register email component
const InputRenderer = ({ schema, className, onChange, value, ...props }: { schema: InputSchema; className?: string; onChange?: (val: any) => void; value?: any; [key: string]: any }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  const { 
    'data-obj-id': dataObjId, 
    'data-obj-type': dataObjType,
    style, 
    ...inputProps 
  } = props;

  return (
    <div 
      className={cn("grid w-full items-center gap-1.5", schema.wrapperClass)}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    >
      {schema.label && <Label htmlFor={schema.id} className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
      <Input 
        type={schema.inputType || 'text'} 
        id={schema.id} 
        name={schema.name}
        placeholder={schema.placeholder} 
        className={className}
        required={schema.required}
        disabled={schema.disabled}
        readOnly={schema.readOnly}
        value={value ?? schema.value ?? ''}
        defaultValue={value === undefined ? schema.defaultValue : undefined}
        onChange={handleChange}
        {...inputProps} 
      />
    </div>
  );
};

ComponentRegistry.register('email', 
  (props: any) => <InputRenderer {...props} schema={{ ...props.schema, inputType: 'email' }} />,
  {
    namespace: 'ui',
    label: 'Email Input',
  }
);

// Re-register password component
ComponentRegistry.register('password', 
  (props: any) => <InputRenderer {...props} schema={{ ...props.schema, inputType: 'password' }} />,
  {
    namespace: 'ui',
    label: 'Password Input',
  }
);

// Re-register textarea component
ComponentRegistry.register('textarea', 
  ({ schema, className, onChange, value, ...props }: { schema: TextareaSchema; className?: string; onChange?: (val: any) => void; value?: any; [key: string]: any }) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    const { 
      'data-obj-id': dataObjId, 
      'data-obj-type': dataObjType,
      style, 
      ...inputProps 
    } = props;

    return (
      <div 
        className={cn("grid w-full gap-1.5", schema.wrapperClass)}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
      >
        {schema.label && <Label htmlFor={schema.id} className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
        <Textarea 
          id={schema.id} 
          name={schema.name}
          placeholder={schema.placeholder} 
          className={className} 
          disabled={schema.disabled}
          readOnly={schema.readOnly}
          required={schema.required}
          rows={schema.rows}
          value={value ?? schema.value ?? ''}
          defaultValue={value === undefined ? schema.defaultValue : undefined}
          onChange={handleChange}
          {...inputProps} 
        />
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Textarea',
  }
);

// Re-register image component
ComponentRegistry.register('image',
  ({ schema, className, ...props }: { schema: ImageSchema; className?: string; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...imgProps 
    } = props;

    return (
    <img
      src={schema.src}
      alt={schema.alt || ''}
      className={className}
      {...imgProps}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    />
  );
  },
  {
    namespace: 'ui',
    label: 'Image',
  }
);

// Re-register html component
ComponentRegistry.register('html', 
  ({ schema, className, ...props }: { schema: HtmlSchema; className?: string; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...htmlProps 
    } = props;

    return (
    <div 
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)} 
      dangerouslySetInnerHTML={{ __html: schema.html }}
      {...htmlProps}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
    />
    );
  },
  {
    namespace: 'ui',
    label: 'HTML Content',
  }
);

// Re-register avatar component
ComponentRegistry.register('avatar', 
  ({ schema, className, ...props }: { schema: AvatarSchema; className?: string; [key: string]: any }) => (
    <Avatar className={className} {...props}>
      <AvatarImage src={schema.src} alt={schema.alt} />
      <AvatarFallback>{schema.fallback}</AvatarFallback>
    </Avatar>
  ),
  {
    namespace: 'ui',
    label: 'Avatar',
  }
);

// Re-register select component
ComponentRegistry.register('select', 
  ({ schema, className, onChange, value, ...props }: { schema: SelectSchema; className?: string; onChange?: (val: any) => void; value?: any; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...selectProps 
    } = props;

    const handleValueChange = (newValue: string) => {
      if (onChange) {
        onChange(newValue);
      }
    };

    return (
      <div 
          className={cn("grid w-full items-center gap-1.5", schema.wrapperClass)}
          data-obj-id={dataObjId}
          data-obj-type={dataObjType}
          style={style}
      >
        {schema.label && <Label className={cn(schema.required && "text-destructive after:content-['*'] after:ml-0.5")}>{schema.label}</Label>}
        <Select 
          defaultValue={value === undefined ? schema.defaultValue : undefined} 
          value={value ?? schema.value}
          onValueChange={handleValueChange}
          disabled={schema.disabled}
          required={schema.required}
          name={schema.name}
          {...selectProps}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={schema.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {schema.options?.map((opt) => (
               <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Select',
  }
);

// Re-register slider component
ComponentRegistry.register('slider', 
  ({ schema, className, ...props }: { schema: SliderSchema; className?: string; [key: string]: any }) => {
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...sliderProps 
    } = props;

    const defaultValue = Array.isArray(schema.defaultValue) 
      ? schema.defaultValue 
      : schema.defaultValue !== undefined 
        ? [schema.defaultValue] 
        : undefined;

    return (
    <Slider 
      defaultValue={defaultValue} 
      max={schema.max} 
      min={schema.min}
      step={schema.step}
      className={className} 
      {...sliderProps} 
      {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    />
  );
  },
  {
    namespace: 'ui',
    label: 'Slider',
  }
);

// Re-register grid component to override plugin-grid's registration
ComponentRegistry.register('grid', 
  ({ schema, className, ...props }: { schema: GridSchema & { smColumns?: number, mdColumns?: number, lgColumns?: number, xlColumns?: number }; className?: string; [key: string]: any }) => {
    let baseCols = 2;
    let smCols, mdCols, lgCols, xlCols;

    if (typeof schema.columns === 'number') {
      baseCols = schema.columns;
    } else if (typeof schema.columns === 'object' && schema.columns !== null) {
      baseCols = schema.columns.xs ?? 1;
      smCols = schema.columns.sm;
      mdCols = schema.columns.md;
      lgCols = schema.columns.lg;
      xlCols = schema.columns.xl;
    }

    if (schema.smColumns) smCols = schema.smColumns;
    if (schema.mdColumns) mdCols = schema.mdColumns;
    if (schema.lgColumns) lgCols = schema.lgColumns;
    if (schema.xlColumns) xlCols = schema.xlColumns;

    const gap = schema.gap ?? 4;
    
    const GRID_COLS: Record<number, string> = {
      1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4',
      5: 'grid-cols-5', 6: 'grid-cols-6', 7: 'grid-cols-7', 8: 'grid-cols-8',
      9: 'grid-cols-9', 10: 'grid-cols-10', 11: 'grid-cols-11', 12: 'grid-cols-12'
    };
    const GRID_COLS_SM: Record<number, string> = {
      1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4',
      5: 'sm:grid-cols-5', 6: 'sm:grid-cols-6', 7: 'sm:grid-cols-7', 8: 'sm:grid-cols-8',
      9: 'sm:grid-cols-9', 10: 'sm:grid-cols-10', 11: 'sm:grid-cols-11', 12: 'sm:grid-cols-12'
    };
    const GRID_COLS_MD: Record<number, string> = {
      1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4',
      5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8',
      9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12'
    };
    const GRID_COLS_LG: Record<number, string> = {
      1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4',
      5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6', 7: 'lg:grid-cols-7', 8: 'lg:grid-cols-8',
      9: 'lg:grid-cols-9', 10: 'lg:grid-cols-10', 11: 'lg:grid-cols-11', 12: 'lg:grid-cols-12'
    };
    const GRID_COLS_XL: Record<number, string> = {
      1: 'xl:grid-cols-1', 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4',
      5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6', 7: 'xl:grid-cols-7', 8: 'xl:grid-cols-8',
      9: 'xl:grid-cols-9', 10: 'xl:grid-cols-10', 11: 'xl:grid-cols-11', 12: 'xl:grid-cols-12'
    };
    const GAPS: Record<number, string> = {
      0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3', 4: 'gap-4', 
      5: 'gap-5', 6: 'gap-6', 8: 'gap-8', 10: 'gap-10', 12: 'gap-12'
    };
    
    const gridClass = cn(
      'grid',
      GRID_COLS[baseCols] || 'grid-cols-2',
      smCols && GRID_COLS_SM[smCols],
      mdCols && GRID_COLS_MD[mdCols],
      lgCols && GRID_COLS_LG[lgCols],
      xlCols && GRID_COLS_XL[xlCols],
      GAPS[gap] || `gap-[${gap * 0.25}rem]`,
      className
    );

    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...gridProps 
    } = props;

    return (
      <div 
        className={gridClass} 
        {...gridProps}
        data-obj-id={dataObjId}
        data-obj-type={dataObjType}
        style={style}
      >
        {schema.children && renderChildren(schema.children)}
      </div>
    );
  },
  {
    namespace: 'ui',
    label: 'Grid Layout',
  }
);

// Polyfill ResizeObserver for Radix UI (Shadcn) components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

