import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';

describe('Debug Test', () => {
  it('should show what component returns', () => {
    const Component = ComponentRegistry.get('image');
    console.log('=== DEBUG: Component type ===', typeof Component);
    console.log('=== DEBUG: Component ===', Component);
    
    if (Component) {
      const { container } = render(<Component schema={{ type: 'image', src: 'test.jpg', alt: 'test' }} />);
      console.log('=== DEBUG: Container HTML ===', container.innerHTML);
      console.log('=== DEBUG: Container text ===', container.textContent);
      console.log('=== DEBUG: Has img ===', container.querySelector('img'));
    }
    
    expect(true).toBe(true);
  });
});
