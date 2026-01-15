import { describe, it, expect } from 'vitest';
import { FormDesigner } from '../components/FormDesigner';
import { LayoutDesigner } from '../components/LayoutDesigner';
import { GeneralDesigner } from '../components/GeneralDesigner';
import { Designer } from '../components/Designer';

describe('Specialized Designers', () => {
  it('should export FormDesigner component', () => {
    expect(FormDesigner).toBeDefined();
    expect(typeof FormDesigner).toBe('function');
  });

  it('should export LayoutDesigner component', () => {
    expect(LayoutDesigner).toBeDefined();
    expect(typeof LayoutDesigner).toBe('function');
  });

  it('should export GeneralDesigner component', () => {
    expect(GeneralDesigner).toBeDefined();
    expect(typeof GeneralDesigner).toBe('function');
  });

  it('should export unified Designer component', () => {
    expect(Designer).toBeDefined();
    expect(typeof Designer).toBe('function');
  });
});
