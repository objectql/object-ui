/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { SliderSchema } from '@object-ui/types';
import { Slider } from '../../ui';

ComponentRegistry.register('slider', 
  ({ schema, className, ...props }: { schema: SliderSchema; className?: string; [key: string]: any }) => {
    // Extract designer-related props
    const { 
        'data-obj-id': dataObjId, 
        'data-obj-type': dataObjType,
        style, 
        ...sliderProps 
    } = props;

    // Ensure defaultValue is an array for backward compatibility
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
      // Apply designer props
      {...{ 'data-obj-id': dataObjId, 'data-obj-type': dataObjType, style }}
    />
  );
  },
  {
    label: 'Slider',
    inputs: [
      { name: 'defaultValue', type: 'array', label: 'Default Value', defaultValue: [50] },
      { name: 'max', type: 'number', label: 'Max', defaultValue: 100 },
      { name: 'min', type: 'number', label: 'Min', defaultValue: 0 },
      { name: 'step', type: 'number', label: 'Step', defaultValue: 1 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      defaultValue: [50],
      max: 100,
      min: 0,
      step: 1,
      className: 'w-full'
    }
  }
);
