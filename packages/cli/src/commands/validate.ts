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
import { findSpecVocabularyFormFields } from '../utils/spec-vocabulary-hint.js';

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

      // Mixed-vocabulary entries validate (the runtime `name` satisfies the
      // schema) but the spec `field` key is dead weight: the renderer ignores
      // it and strip-mode validation drops it. Valid ≠ clean — say so (#3090).
      const mixed = findSpecVocabularyFormFields(schema).filter((f) => f.mixedName);
      if (mixed.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const m of mixed) {
          console.log(chalk.yellow(
            `  ${m.path}: '${m.mixedName}' also carries { field: '${m.field}' } — mixed form-field ` +
            `vocabularies. The renderer ignores \`field\` here; drop one of the two.`,
          ));
        }
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
      // Every issue gets a Path line, INCLUDING a root-level one (objectui#7004).
      //
      // The guard here used to be `issue.path.length > 0`, which dropped the
      // line entirely for `path: []` — silent in exactly the case a reader
      // most needs oriented. That case is not rare: `safeValidateSchema` runs
      // `AnyComponentSchema`, which is a `z.union` of every component arm, so
      // ANY document matching no arm reports one top-level issue at the root
      // (`invalid_union` · `Invalid input` · `path: []`). Measured before this
      // change, a menu carrying the retired `{ type: 'separator' }` divider
      // spelling printed `1. Invalid input` and a Code line, and nothing said
      // whether the whole document or some node inside it had been judged.
      //
      // `(root)` is parenthesised so it cannot be read as a real key literally
      // named `root` — a genuine path to one would print as `root`.
      //
      // ⛔ Scope: this prints the top-level issue's own path and NOTHING more.
      // The other half of objectui#7004 — whether a failing union should also
      // surface its per-arm diagnoses, and if so which arm's — is an
      // author-facing diagnostic contract awaiting a maintainer ruling, so
      // `issue.errors` is deliberately NOT walked here.
      result.error.issues.forEach((issue, index) => {
        console.error(chalk.red(`\n${index + 1}. ${issue.message}`));
        const path = issue.path ?? [];
        console.error(
          chalk.gray(`   Path: ${path.length > 0 ? path.join(' → ') : '(root)'}`)
        );
        if (issue.code) {
          console.error(chalk.gray(`   Code: ${issue.code}`));
        }
      });

      // "name: expected string, received undefined" on a `{ field: … }` entry
      // reads as an instruction to bolt a `name` on — which converts the
      // metadata WRONGLY (the spec shape stands for an object-schema merge
      // that a bare rename throws away). When the input matches that
      // signature, name the actual boundary and the real fixes (#3090).
      const specShaped = findSpecVocabularyFormFields(schema).filter((f) => !f.mixedName);
      if (specShaped.length > 0) {
        console.error(chalk.bold('\nLikely cause — spec form-view vocabulary in a standalone form:'));
        for (const s of specShaped) {
          console.error(chalk.yellow(
            `   ${s.path}: { field: '${s.field}' } is the spec form-VIEW shape (an object-field reference).`,
          ));
        }
        console.error(chalk.yellow(
          `   A standalone \`type: 'form'\` component uses { name: … } (the form data path).\n` +
          `   Fix: author the field with \`name\` and its own type/label — or, to reference object fields\n` +
          `   with the spec shape, use an object-bound form (\`type: 'object-form'\` with objectName +\n` +
          `   sections), whose section fields are translated by the renderer.`,
        ));
      }

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
