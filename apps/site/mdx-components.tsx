import defaultComponents from 'fumadocs-ui/mdx';
import { ComponentDemo, DemoGrid, CodeDemo } from './app/components/ComponentDemo';

// Re-export types for use in MDX files
export type { SchemaNode } from './app/components/ComponentDemo';

export default {
  ...defaultComponents,
  ComponentDemo,
  DemoGrid,
  CodeDemo,
};
