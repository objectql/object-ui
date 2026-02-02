
/**
 * ObjectStack Console Plugin
 * 
 * This plugin provides the standard UI interface for ObjectStack applications.
 * It can be integrated into any ObjectStack runtime as a static asset plugin.
 * 
 * Spec Compliance:
 * - Supports AppSchema with homePageId, requiredPermissions, branding
 * - Implements navigation types: object, dashboard, page, url, group
 * - Renders ObjectSchema-based CRUD interfaces
 * - Supports multi-app switching
 * 
 * @see https://github.com/objectstack-ai/objectui
 */

export const staticPath = 'dist';

export default {
  staticPath,
  name: '@object-ui/console',
  version: '0.1.0',
  type: 'ui-plugin',
  description: 'ObjectStack Console - The standard runtime UI for ObjectStack applications',
  
  // Plugin metadata for ObjectStack runtime
  metadata: {
    author: 'ObjectUI Team',
    license: 'MIT',
    homepage: 'https://www.objectui.org',
    repository: 'https://github.com/objectstack-ai/objectui',
    
    
    // Plugin capabilities
    capabilities: [
      'ui-rendering',
      'crud-operations',
      'multi-app-support',
      'dynamic-navigation',
      'theme-support'
    ]
  }
};
