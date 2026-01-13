import { ComponentRegistry } from '../../registry';
import { Slider } from '@object-ui/ui';

ComponentRegistry.register('slider', 
  ({ schema, className, ...props }) => (
    <Slider 
      defaultValue={schema.defaultValue} 
      max={schema.max} 
      min={schema.min}
      step={schema.step}
      className={className} 
      {...props} 
    />
  ),
  {
    label: 'Slider',
    inputs: [
      { name: 'defaultValue', type: 'array', label: 'Default Value', defaultValue: [50] },
      { name: 'max', type: 'number', label: 'Max', defaultValue: 100 },
      { name: 'min', type: 'number', label: 'Min', defaultValue: 0 },
      { name: 'step', type: 'number', label: 'Step', defaultValue: 1 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
