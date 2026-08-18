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

import { isKnownSchemaType } from '../utils/known-schema-types.js';

/**
 * @param cwd Directory to scan. Defaults to the process working directory,
 *   which is what the `objectui check` command passes. Taking it as an
 *   argument is what lets the tests scan a fixture tree without `chdir`, which
 *   Vitest's worker threads do not support.
 */
export async function check(cwd: string = process.cwd()) {
  console.log(chalk.bold('Object UI Schema Check'));

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
          // The known-type universe is DERIVED from the repository's
          // registration calls (see `packages/cli/src/utils/known-schema-types.ts`
          // and the script that writes it), not typed by hand. The array that
          // used to sit here had drifted both ways at once — objectui#5115.
          if (typeof content.type === 'string' && !isKnownSchemaType(content.type)) {
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
