/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a new plugin using the @object-ui/create-plugin package
 * 
 * @param pluginName - Name of the plugin to create
 */
export async function createPlugin(pluginName: string) {
  console.log(chalk.blue('🚀 Creating ObjectUI plugin...\n'));

  // Resolve the create-plugin script path
  const createPluginScript = resolve(
    __dirname,
    '../../../create-plugin/dist/index.js'
  );

  return new Promise<void>((resolve, reject) => {
    // Spawn the create-plugin command
    const child = spawn('node', [createPluginScript, pluginName], {
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', (error) => {
      console.error(chalk.red('Failed to create plugin:'), error);
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`create-plugin exited with code ${code}`));
      }
    });
  });
}
