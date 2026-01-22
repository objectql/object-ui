// Re-export the new InteractiveDemo as the main demo component
export { InteractiveDemo as ComponentDemo, DemoGrid } from './InteractiveDemo';

// Legacy exports for backward compatibility
export { InteractiveDemo, InteractiveDemo as CodeDemo } from './InteractiveDemo';

// Export types for use in MDX files
export type { SchemaNode } from './InteractiveDemo';
