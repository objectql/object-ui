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
 * The canonical, permanent public identifier for the ObjectUI schema protocol.
 *
 * ⚠️ PROPOSED — confirmed by the maintainer at merge (objectui#5127). A
 * `$schema` URL is a permanent public identifier: files in user projects will
 * carry it forever, so it is a maintainer decision, not a dev one. The
 * reasoning behind this spelling is in the PR body.
 *
 * The matcher below deliberately does NOT compare against this string. It
 * recognises the ObjectUI ORIGIN, so every file that already declares an
 * `objectui.org` schema URL keeps working whichever exact path the maintainer
 * confirms.
 */
export const OBJECTUI_SCHEMA_URL = 'https://objectui.org/schema/v1/objectui.schema.json';

/**
 * Root keys that positively identify a file as an ObjectUI schema node.
 *
 * Every entry is a property DECLARED on `BaseSchema`
 * (`packages/types/src/base.ts`) — this set is read out of the protocol's own
 * node contract, not invented here, and it is closed: it grows only when
 * `BaseSchema` grows.
 *
 * `BaseSchema`'s remaining properties are deliberately absent because their
 * NAMES are generic enough to head foreign root vocabularies, and a marker
 * that matches a foreign file re-creates the exact defect this gate exists to
 * remove. Measured over this repository (objectui#5127): `name` appears at the
 * root of 45 of the 46 foreign judged files and `description` at 44 — both are
 * `package.json` keys — so admitting `BaseSchema` wholesale takes the foreign
 * retention from 0 files to all 46. `id`, `label`, `data` and `type` itself are
 * held out on the same reasoning.
 */
const OBJECTUI_STRUCTURAL_KEYS: readonly string[] = [
  // Composition — the `children`/`body`-class keys the ruling names.
  'body',
  'children',
  // Presentation.
  'className',
  'style',
  'placeholder',
  // Conditional rendering and interaction state.
  'visible',
  'visibleWhen',
  'visibleOn',
  'hidden',
  'hiddenOn',
  'disabled',
  'disabledOn',
  // Test and accessibility handles.
  'testId',
  'ariaLabel',
];

/**
 * Does this `$schema` value point at ObjectUI?
 *
 * Matches on the URL's HOST, not on a literal string, for two reasons. The
 * canonical URL above is still awaiting the maintainer's confirmation, and a
 * literal comparison would silently stop recognising every migrated file the
 * moment the confirmed path differs by one character. And a `startsWith` test
 * against a prefix answers YES for `https://objectui.org.example.com/…`, which
 * is a different origin entirely — so the value is parsed as a URL and the
 * hostname compared, rather than the string matched.
 */
function pointsAtObjectUi(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  let hostname: string;
  try {
    ({ hostname } = new URL(value));
  } catch {
    // Not a URL — `$schema` is present but says nothing about ObjectUI.
    return false;
  }
  const host = hostname.toLowerCase();
  return host === 'objectui.org' || host.endsWith('.objectui.org');
}

/**
 * Does this parsed file positively read as an ObjectUI schema (objectui#5127)?
 *
 * `type` carries at least seven unrelated vocabularies in JSON — the most
 * common of them being `package.json`'s `"type": "module"` — so the presence
 * of a root `type` is not evidence that a file is a UI schema. Before this
 * gate, `objectui check` judged every root `type` against the component-key
 * universe and the FIRST line a user saw in their own project was a warning
 * about their own `package.json`: 45 of the 46 warnings this repository
 * produced were exactly that.
 *
 * The fix is producer-side declaration, not a consumer-side skip list: a file
 * is judged when it SAYS it is an ObjectUI schema (`$schema`) or when it is
 * structurally recognisable as one. A list of filenames to exclude was
 * considered and rejected — it is a second hand-maintained list of the shape
 * objectui#5115 had just finished deleting, and it can only ever enumerate the
 * foreign vocabularies someone already thought of.
 *
 * ⚠️ The structural arm is a TRANSITIONAL fallback, not the contract. It is
 * drawn for precision over recall on purpose: a foreign file wrongly judged is
 * this card's defect reappearing in a user's project, while a real schema
 * wrongly skipped is a coverage debt that the corpus migration repays and that
 * the skipped-file count below keeps visible in the meantime.
 */
function isObjectUiSchemaFile(content: Record<string, unknown>): boolean {
  if (pointsAtObjectUi(content.$schema)) return true;
  return OBJECTUI_STRUCTURAL_KEYS.some((key) => key in content);
}

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
  // Files that a root `type` string made ELIGIBLE for type judgement and that
  // no ObjectUI marker admitted. Reported below so the narrowed judgement
  // surface is never silent (objectui#5127) — a check that quietly stops
  // checking is worse than one that warns too loudly, because nothing prompts
  // a re-read.
  let skipped = 0;
  
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
          if (typeof content.type === 'string') {
            // The marker gate (objectui#5127). Only a file that positively
            // reads as an ObjectUI schema enters type judgement; every other
            // root-`type` vocabulary — `package.json`'s `"module"`,
            // JSON Schema's `"object"`, and the rest — is simply not judged.
            //
            // Note this arm is reached for `.json` only, as the parse above
            // is. The glob also matches `.yaml`/`.yml`, and those files are
            // read by neither arm, before this change or after it.
            if (!isObjectUiSchemaFile(content as Record<string, unknown>)) {
              skipped++;
            } else if (!isKnownSchemaType(content.type)) {
              // The known-type universe is DERIVED from the repository's
              // registration calls (see `packages/cli/src/utils/known-schema-types.ts`
              // and the script that writes it), not typed by hand. The array that
              // used to sit here had drifted both ways at once — objectui#5115.
              console.log(chalk.yellow(`⚠️ Unknown schema type "${content.type}" in ${file}`));
            }
          }
        }
      }
    } catch (e) {
      console.log(chalk.red(`x Invalid JSON in ${file}: ${(e as Error).message}`));
      errors++;
    }
  }

  if (skipped > 0) {
    console.log(
      chalk.dim(
        `Skipped ${skipped} file${skipped === 1 ? '' : 's'} with a root "type" and no ObjectUI schema marker.`
      )
    );
    console.log(
      chalk.dim(
        `  A file is checked when it declares "$schema": "${OBJECTUI_SCHEMA_URL}" or carries a structural key (children/body/className/...).`
      )
    );
  }
  
  if (errors === 0) {
    console.log(chalk.green('✓ All checks passed'));
  } else {
    console.log(chalk.red(`Found ${errors} errors`));
    process.exit(1);
  }
}
