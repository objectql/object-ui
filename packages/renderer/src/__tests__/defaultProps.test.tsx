import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '../registry';

// Import all renderers to ensure they're registered
import '../renderers/basic/div';
import '../renderers/basic/text';
import '../renderers/basic/span';
import '../renderers/basic/separator';
import '../renderers/form/button';
import '../renderers/form/input';
import '../renderers/form/checkbox';
import '../renderers/form/switch';
import '../renderers/form/select';
import '../renderers/form/textarea';
import '../renderers/form/toggle';
import '../renderers/form/slider';
import '../renderers/form/radio-group';
import '../renderers/form/calendar';
import '../renderers/form/input-otp';
import '../renderers/layout/card';
import '../renderers/layout/tabs';
import '../renderers/data-display/alert';
import '../renderers/data-display/avatar';
import '../renderers/data-display/badge';
import '../renderers/overlay/dialog';
import '../renderers/overlay/drawer';
import '../renderers/overlay/popover';
import '../renderers/overlay/sheet';
import '../renderers/overlay/tooltip';
import '../renderers/overlay/alert-dialog';
import '../renderers/overlay/dropdown-menu';
import '../renderers/overlay/context-menu';
import '../renderers/overlay/hover-card';
import '../renderers/disclosure/accordion';
import '../renderers/disclosure/collapsible';
import '../renderers/complex/table';
import '../renderers/complex/carousel';
import '../renderers/complex/resizable';
import '../renderers/complex/scroll-area';
import '../renderers/feedback/progress';
import '../renderers/feedback/skeleton';
import '../renderers/feedback/toaster';

describe('@object-ui/renderer - Default Props', () => {
  const componentsRequiringDefaults = [
    'div', 'text', 'span', 'separator',
    'button', 'input', 'checkbox', 'switch', 'select', 'textarea', 
    'toggle', 'toggle-group', 'slider', 'radio-group', 'calendar', 'input-otp',
    'card', 'tabs',
    'alert', 'avatar', 'badge',
    'dialog', 'drawer', 'popover', 'sheet', 'tooltip', 
    'alert-dialog', 'dropdown-menu', 'context-menu', 'hover-card',
    'accordion', 'collapsible',
    'table', 'carousel', 'resizable', 'scroll-area',
    'progress', 'skeleton', 'toaster'
  ];

  it('should have defaultProps defined for all components', () => {
    const missingDefaults: string[] = [];
    
    componentsRequiringDefaults.forEach(type => {
      const config = ComponentRegistry.getConfig(type);
      if (!config) {
        missingDefaults.push(`${type} (not registered)`);
      } else if (!config.defaultProps && !config.defaultChildren) {
        missingDefaults.push(`${type} (no defaultProps or defaultChildren)`);
      }
    });

    if (missingDefaults.length > 0) {
      console.error('Components missing default props:', missingDefaults);
    }

    expect(missingDefaults).toHaveLength(0);
  });

  it('should have valid defaultProps for button component', () => {
    const config = ComponentRegistry.getConfig('button');
    expect(config).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
    expect(config?.defaultProps?.label).toBeDefined();
    expect(typeof config?.defaultProps?.label).toBe('string');
  });

  it('should have valid defaultProps for input component', () => {
    const config = ComponentRegistry.getConfig('input');
    expect(config).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
    expect(config?.defaultProps?.label).toBeDefined();
    expect(config?.defaultProps?.placeholder).toBeDefined();
  });

  it('should have valid defaultProps for card component', () => {
    const config = ComponentRegistry.getConfig('card');
    expect(config).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
    expect(config?.defaultProps?.title).toBeDefined();
  });

  it('should have valid defaultProps for table component', () => {
    const config = ComponentRegistry.getConfig('table');
    expect(config).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
    expect(config?.defaultProps?.columns).toBeDefined();
    expect(Array.isArray(config?.defaultProps?.columns)).toBe(true);
    expect(config?.defaultProps?.data).toBeDefined();
    expect(Array.isArray(config?.defaultProps?.data)).toBe(true);
  });

  it('should have valid defaultProps with initial dimensions for div component', () => {
    const config = ComponentRegistry.getConfig('div');
    expect(config).toBeDefined();
    expect(config?.defaultProps).toBeDefined();
    expect(config?.defaultProps?.className).toBeDefined();
    // Should have some minimum dimensions to avoid collapsing
    expect(config?.defaultProps?.className).toContain('min-h');
  });

  it('should have defaultChildren defined for components that need them', () => {
    const componentsWithChildren = ['span', 'accordion', 'tabs', 'collapsible'];
    
    componentsWithChildren.forEach(type => {
      const config = ComponentRegistry.getConfig(type);
      expect(config).toBeDefined();
      expect(config?.defaultChildren || config?.defaultProps).toBeDefined();
    });
  });
});
