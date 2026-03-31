import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardRenderer } from '../DashboardRenderer';
import { ComponentRegistry } from '@object-ui/core';

describe('debug', () => {
  it('what does metric with object render', () => {
    console.log('metric registered?', !!ComponentRegistry.get('metric'));
    console.log('object-metric registered?', !!ComponentRegistry.get('object-metric'));

    const schema = {
      type: 'dashboard' as const,
      name: 'test',
      title: 'Test',
      widgets: [
        {
          type: 'metric',
          object: 'opportunity',
          layout: { x: 0, y: 0, w: 1, h: 1 },
          options: {
            label: 'Total Revenue',
            value: '$652,000',
            icon: 'DollarSign',
          },
        },
      ],
    } as any;

    const { container } = render(<DashboardRenderer schema={schema} />);
    console.log('RENDERED HTML:', container.innerHTML.substring(0, 500));
    
    const allTypes = container.querySelectorAll('[role="alert"]');
    console.log('Alert roles:', allTypes.length);
    
    const pres = container.querySelectorAll('pre');
    console.log('PRE ELEMENTS:', pres.length);
  });
});
