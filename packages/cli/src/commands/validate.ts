/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { load as loadYaml } from 'js-yaml';
import { safeValidateSchema } from '@object-ui/types/zod';

/**
 * Validate a schema file
 * 
 * @param schemaPath - Path to the schema file (JSON or YAML)
 */
export async function validate(schemaPath: string) {
  console.log(chalk.blue('🔍 ObjectUI Schema Validator\n'));

  // Resolve the schema path
  const resolvedPath = resolve(process.cwd(), schemaPath);

  // Check if file exists
  if (!existsSync(resolvedPath)) {
    console.error(chalk.red(`✗ Error: Schema file not found: ${schemaPath}`));
    process.exit(1);
  }

  try {
    // Read the file
    const fileContent = readFileSync(resolvedPath, 'utf-8');
    let schema: unknown;

    // Parse based on file extension
    if (schemaPath.endsWith('.yaml') || schemaPath.endsWith('.yml')) {
      console.log(chalk.gray(`Reading YAML schema from: ${schemaPath}`));
      schema = loadYaml(fileContent);
    } else if (schemaPath.endsWith('.json')) {
      console.log(chalk.gray(`Reading JSON schema from: ${schemaPath}`));
      schema = JSON.parse(fileContent);
    } else {
      // Try JSON first, then YAML
      try {
        schema = JSON.parse(fileContent);
        console.log(chalk.gray(`Reading schema from: ${schemaPath} (detected as JSON)`));
      } catch {
        schema = loadYaml(fileContent);
        console.log(chalk.gray(`Reading schema from: ${schemaPath} (detected as YAML)`));
      }
    }

    // Validate the schema
    console.log(chalk.gray('Validating schema...\n'));
    const result = safeValidateSchema(schema);

    if (result.success) {
      console.log(chalk.green('✓ Schema is valid!\n'));
      
      // Show some info about the schema
      const data = result.data;
      console.log(chalk.bold('Schema Information:'));
      console.log(chalk.gray('  Type:'), data.type || 'unknown');
      
      if (data.id) {
        console.log(chalk.gray('  ID:'), data.id);
      }
      
      if (data.label || data.title) {
        console.log(chalk.gray('  Label:'), data.label || data.title);
      }
      
      // Count children if present
      if (data.children && Array.isArray(data.children)) {
        console.log(chalk.gray('  Children:'), data.children.length);
      }
      
      console.log('');
      process.exit(0);
    } else {
      console.error(chalk.red('✗ Schema validation failed!\n'));
      console.error(chalk.bold('Validation Errors:'));
      
      // Format Zod errors nicely. `.issues` is the only accessor on a Zod 4
      // ZodError — the `.errors` alias was removed, so reading it yielded
      // undefined and this loop threw a TypeError that the catch below
      // reported as "Error reading or parsing schema file", hiding the very
      // errors this command exists to print.
      result.error.issues.forEach((issue, index) => {
        console.error(chalk.red(`\n${index + 1}. ${issue.message}`));
        if (issue.path && issue.path.length > 0) {
          console.error(chalk.gray(`   Path: ${issue.path.join(' → ')}`));
        }
        if (issue.code) {
          console.error(chalk.gray(`   Code: ${issue.code}`));
        }
      });
      
      console.error('');
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Error reading or parsing schema file:'));
    console.error(chalk.red((error as Error).message));
    console.error('');
    process.exit(1);
  }
}
