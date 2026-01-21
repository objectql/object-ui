/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './index.css';

// Register all ObjectUI renderers (side-effects)
import './renderers'; 

// Export utils
export * from './lib/utils';

// Export raw Shadcn UI components
export * from './ui';

// Export an init function to ensure components are registered
// This is a workaround for bundlers that might tree-shake side-effect imports
export function initializeComponents() {
  // This function exists to ensure the import side-effects above are executed
  // Simply importing this module should register all components
  return true;
}
