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
import { parse as parseJsonc, printParseErrorCode, type ParseError } from 'jsonc-parser';

import { isKnownSchemaType } from '../utils/known-schema-types.js';

/**
 * Render a `jsonc-parser` error the way `JSON.parse` renders its own: a reason,
 * then where it happened. The parser reports a byte offset; the line/column is
 * derived here because a bare offset is not actionable in an editor.
 */
function describeParseError(text: string, error: ParseError): string {
  const upTo = text.slice(0, error.offset);
  const line = upTo.split('\n').length;
  const column = error.offset - (upTo.lastIndexOf('\n') + 1) + 1;
  return `${printParseErrorCode(error.error)} at line ${line} column ${column}`;
}

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
        // `.json` on disk means JSONC in practice — comments and trailing
        // commas are how `tsconfig.json`, `.eslintrc.json`, `devcontainer.json`
        // and VS Code's own settings are documented to be written. `JSON.parse`
        // rejected every one of them, and because a parse failure is the only
        // thing that increments `errors`, `objectui check` exited 1 in any
        // TypeScript project — 64 errors in this repository alone (objectui#5237).
        //
        // The reader is `jsonc-parser` (already shipped by `@object-ui/app-shell`),
        // NOT a comment-stripping regex: a `//` inside a string value — say a
        // URL — is not a comment, and a stripper that cannot tell the
        // difference corrupts valid files instead of reading them.
        const text = readFileSync(join(cwd, file), 'utf-8');
        const parseErrors: ParseError[] = [];
        // Comments are permitted by default; trailing commas are opt-in.
        // `allowEmptyContent` stays off so an empty `.json` is still an error,
        // exactly as `JSON.parse('')` was.
        const content = parseJsonc(text, parseErrors, { allowTrailingComma: true });

        // `parseJsonc` is error-TOLERANT: it recovers and returns a best-effort
        // value rather than throwing, so genuinely malformed JSON is caught by
        // consulting this array. Dropping this check would turn the fix into
        // "never fail on anything".
        if (parseErrors.length > 0) {
          const [first] = parseErrors;
          console.log(
            chalk.red(`x Invalid JSON in ${file}: ${describeParseError(text, first)}`)
          );
          errors++;
          continue;
        }

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
