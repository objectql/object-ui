import type { SchemaNode } from '@object-ui/protocol';

export type ComponentRendererProps = {
  schema: SchemaNode;
  className?: string;
  [key: string]: any;
};

export type ComponentRenderer = React.FC<ComponentRendererProps>;

export type ComponentInput = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  enum?: string[] | { label: string; value: any }[];
  description?: string;
  advanced?: boolean;
};

export type ComponentMeta = {
  label?: string; // Display name in designer
  icon?: string; // Icon name or svg string
  inputs?: ComponentInput[];
  defaultProps?: Record<string, any>; // Default props when dropped
  defaultChildren?: SchemaNode[]; // Default children when dropped
};

export type ComponentConfig = ComponentMeta & {
  type: string;
  component: ComponentRenderer;
};

class Registry {
  private components = new Map<string, ComponentConfig>();

  register(type: string, component: ComponentRenderer, meta?: ComponentMeta) {
    if (this.components.has(type)) {
      console.warn(`Component type "${type}" is already registered. Overwriting.`);
    }
    this.components.set(type, {
      type,
      component,
      ...meta
    });
  }

  get(type: string): ComponentRenderer | undefined {
    return this.components.get(type)?.component;
  }

  getConfig(type: string): ComponentConfig | undefined {
    return this.components.get(type);
  }

  has(type: string): boolean {
    return this.components.has(type);
  }
  
  getAllTypes(): string[] {
    return Array.from(this.components.keys());
  }

  getAllConfigs(): ComponentConfig[] {
    return Array.from(this.components.values());
  }
}

export const ComponentRegistry = new Registry();
