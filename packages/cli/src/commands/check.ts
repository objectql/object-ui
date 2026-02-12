/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { globSync } from 'glob';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function check() {
  console.log(chalk.bold('Object UI Schema Check'));
  const cwd = process.cwd();
  
  // 1. Find all JSON/YAML files
  const files = globSync('**/*.{json,yaml,yml}', { 
    cwd, 
    ignore: ['node_modules/**', 'dist/**', '.git/**'] 
  });
  
  console.log(`Analyzing ${files.length} files...`);
  
  let errors = 0;
  
  for (const file of files) {
    try {
      // Basic JSON parsing check
      if (file.endsWith('.json')) {
        const content = JSON.parse(readFileSync(join(cwd, file), 'utf-8'));
        // Schema validation: check for ObjectUI schema patterns
        if (content && typeof content === 'object' && content.type) {
          const knownTypes = [
            'page', 'form', 'grid', 'crud', 'kanban', 'calendar', 'dashboard',
            'chart', 'detail', 'list', 'timeline', 'gantt', 'map', 'gallery',
            'object-view', 'detail-view', 'object-chart',
          ];
          if (typeof content.type === 'string' && !knownTypes.includes(content.type)) {
            console.log(chalk.yellow(`⚠️ Unknown schema type "${content.type}" in ${file}`));
          }
        }
      }
    } catch (e) {
      console.log(chalk.red(`x Invalid JSON in ${file}: ${(e as Error).message}`));
      errors++;
    }
  }
  
  if (errors === 0) {
    console.log(chalk.green('✓ All checks passed'));
  } else {
    console.log(chalk.red(`Found ${errors} errors`));
    process.exit(1);
  }
}
