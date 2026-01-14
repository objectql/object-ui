import type { SchemaNode } from '../types';

export type ComponentRenderer<T = any> = T;

export type ComponentInput = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  enum?: string[] | { label: string; value: any }[];
  uiType?: string; // UI hint (e.g., 'textarea', 'password')
  description?: string;
  advanced?: boolean;
};

export type ComponentMeta = {
  label?: string; // Display name in designer
  icon?: string; // Icon name or svg string
  category?: string; // Grouping category
  inputs?: ComponentInput[];
  defaultProps?: Record<string, any>; // Default props when dropped
  defaultChildren?: SchemaNode[]; // Default children when dropped
  examples?: Record<string, any>; // Example configurations
};

export type ComponentConfig<T = any> = ComponentMeta & {
  type: string;
  component: ComponentRenderer<T>;
};

export class Registry<T = any> {
  private components = new Map<string, ComponentConfig<T>>();

  register(type: string, component: ComponentRenderer<T>, meta?: ComponentMeta) {
    if (this.components.has(type)) {
      console.warn(`Component type "${type}" is already registered. Overwriting.`);
    }
    this.components.set(type, {
      type,
      component,
      ...meta
    });
  }

  get(type: string): ComponentRenderer<T> | undefined {
    return this.components.get(type)?.component;
  }

  getConfig(type: string): ComponentConfig<T> | undefined {
    return this.components.get(type);
  }

  has(type: string): boolean {
    return this.components.has(type);
  }
  
  getAllTypes(): string[] {
    return Array.from(this.components.keys());
  }

  getAllConfigs(): ComponentConfig<T>[] {
    return Array.from(this.components.values());
  }
}

export const ComponentRegistry = new Registry<any>();
