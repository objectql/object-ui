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
import { safeValidateSchema } from '@object-ui/types/zod';

import { isKnownSchemaType } from '../utils/known-schema-types.js';
import { didYouMeanClause } from '../utils/known-type-case-suggestion.js';

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
 * ⛔ There is deliberately NO `$schema` arm, and no ObjectUI `$schema` URL
 * exists to declare.
 *
 * An earlier revision of this file admitted a file whose root `$schema` had an
 * `objectui.org` host, completed by a canonical URL proposed for the
 * maintainer to confirm. The maintainer ruled against minting that identifier
 * (2026-08-20, objectui#5127, verbatim 「C」), superseding the `$schema` half of
 * the 2026-08-19 ruling. The structural arm below is unaffected and stands.
 *
 * - A `$schema` URL is a permanent public identifier that lives in USERS'
 *   files, which no sweep can ever reach. Minting the address before the
 *   document it names exists is backwards.
 * - The only consumer that needs a URL rather than any agreed marker is an
 *   editor resolving `$schema` over HTTP. An agent authoring schemas instead
 *   needs a contract it can read BEFORE writing — a file, and `node_modules`
 *   is right there — and a good error AFTER writing, which is this command,
 *   already version-correct from the installed packages.
 * - The value would be untyped, unchecked and host-matched, so an agent that
 *   mis-remembered the path would be silently accepted: a version-fossil
 *   generator, in files we cannot fix.
 * - Zero files declared it, in this repository or anywhere else, so the arm
 *   matched nothing. Dropping it gives up no coverage that was being
 *   delivered.
 *
 * Because that matching was host-based rather than literal, the arm can be
 * added later without invalidating a single file. The trigger that clause once
 * pointed at is gone: `@object-ui/types` shipping a generated JSON Schema was
 * objectui#5392, and the maintainer ruled it Option B on 2026-08-25 — no
 * shipped artifact. There is therefore no document a `$schema` URL could name,
 * and the recall that arm was being kept in reserve for is repaid instead by
 * the validity arm below, which reads the Zod schemas already in
 * `node_modules` rather than a URL fetched over HTTP.
 */

/**
 * Does this parsed file positively read as an ObjectUI schema (objectui#5127,
 * objectui#6075)?
 *
 * `type` carries at least seven unrelated vocabularies in JSON — the most
 * common of them being `package.json`'s `"type": "module"` — so the presence
 * of a root `type` is not evidence that a file is a UI schema. Before this
 * gate, `objectui check` judged every root `type` against the component-key
 * universe and the FIRST line a user saw in their own project was a warning
 * about their own `package.json`: 45 of the 46 warnings this repository
 * produced were exactly that.
 *
 * The fix is a positive marker, not a consumer-side skip list: a file is
 * judged when it is recognisable as an ObjectUI node. A list of filenames to
 * exclude was considered and rejected — it is a second hand-maintained list of
 * the shape objectui#5115 had just finished deleting, and it can only ever
 * enumerate the foreign vocabularies someone already thought of.
 *
 * There are two arms, and the ORDER is load-bearing:
 *
 * 1. The structural arm (`OBJECTUI_STRUCTURAL_KEYS`, above) — a set-membership
 *    test over the parsed root, and the cheap one. It runs first so the
 *    common case never pays for arm 2.
 * 2. The validity arm — the document parses as an ObjectUI component schema
 *    under `@object-ui/types`' own Zod union. This is the recogniser the
 *    2026-08-25 ruling on objectui#5392 selected (Option B, no shipped schema
 *    artifact): measured over this repository it admits schemas the structural
 *    arm cannot see — leaf nodes that carry only their own vocabulary — while
 *    refusing every `package.json`, because `"module"` is not a component the
 *    protocol models.
 *
 * ⛔ There is deliberately no third arm reading a registered root `type`
 * alone. `{ "name": "x", "type": "form" }` is a plausible `package.json` and
 * `form` is a real component key; admitting on the type name re-creates the
 * exact defect this gate exists to remove. Recognition needs SHAPE.
 *
 * ⚠️ The validity arm couples this command's recall to `@object-ui/types`:
 * tightening a Zod schema moves files out of recognition. That is not a
 * hazard left to chance — it is the reason `check` reports a third bucket
 * rather than two (see `UNVALIDATED_CANDIDATE` below). A file that stops
 * validating stops being *judged*, but it does not stop being *mentioned*.
 */
function isObjectUiSchemaFile(content: Record<string, unknown>): boolean {
  return (
    OBJECTUI_STRUCTURAL_KEYS.some((key) => key in content) ||
    safeValidateSchema(content).success
  );
}

/**
 * `UNVALIDATED_CANDIDATE` — the bucket a validity-based recogniser MUST report
 * rather than swallow (objectui#6075).
 *
 * A recogniser built on validation conflates two entirely different findings:
 * "this file is not ours" and "this file is ours and it is broken". The second
 * is the more valuable of the two — it is the thing this command exists to
 * find — and filing it under the first makes it vanish. The symptom of that
 * bug is an ABSENCE: the file simply stops being mentioned, and nothing
 * prompts a re-read.
 *
 * It is not a theoretical bucket. Measured over this repository at the commit
 * that introduced this function, 100 eligible files failed the validity arm,
 * and 54 of them were real ObjectUI content — schema-catalog leaves such as
 * `{ "type": "text", "content": "Small text", "variant": "small" }`, whose
 * `variant` is not in `TextSchema`'s enum. Reported as foreign, all 54 would
 * have gone quiet.
 *
 * The discriminator is `isKnownSchemaType`: does the root `type` name a
 * component THIS BUILD registers? It is the same derived universe the
 * judgement arm uses, so it needs no second list, and it is the one signal
 * that separates a broken `"type": "text"` node from `"type": "module"`.
 *
 * Its cost, stated rather than hidden: a foreign document whose root `type`
 * happens to collide with a registered component key lands here. A JSON Schema
 * document with `"type": "object"` is exactly that, and this repository
 * contains one. The cost is one advisory line naming a file — not a warning
 * about the reader's `package.json`, which is the failure this gate was built
 * for. The opposite error is the one that cannot be seen.
 *
 * ⛔ This bucket is REPORTED, never counted as skipped. Moving files from the
 * skipped count into an unreported bucket would make the recall debt look
 * repaid while nothing had been repaid, which is the one outcome objectui#6075
 * names as unacceptable.
 */
function isUnvalidatedCandidate(type: string): boolean {
  return isKnownSchemaType(type);
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
  // no ObjectUI recogniser admitted. Reported below so the narrowed judgement
  // surface is never silent (objectui#5127) — a check that quietly stops
  // checking is worse than one that warns too loudly, because nothing prompts
  // a re-read.
  let skipped = 0;
  // The third bucket (objectui#6075): eligible files the recogniser refused
  // whose root `type` nevertheless names a component this build registers.
  // These are ObjectUI content that does not validate — a finding, not a
  // foreign file — so they are listed by name rather than folded into the
  // count above.
  const unvalidatedCandidates: { file: string; type: string }[] = [];
  
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
              // Refused. Which of the two refusals is this? A file whose root
              // `type` names a registered component is ObjectUI content the
              // recogniser could not validate — say so. Everything else is
              // simply not ours.
              if (isUnvalidatedCandidate(content.type)) {
                unvalidatedCandidates.push({ file, type: content.type });
              } else {
                skipped++;
              }
            } else if (!isKnownSchemaType(content.type)) {
              // The known-type universe is DERIVED from the repository's
              // registration calls (see `packages/cli/src/utils/known-schema-types.ts`
              // and the script that writes it), not typed by hand. The array that
              // used to sit here had drifted both ways at once — objectui#5115.
              // objectui#5247 — the type is still UNKNOWN and still reported;
              // the clause only names the spelling that would have resolved,
              // and is empty whenever no known type differs by case alone.
              console.log(
                chalk.yellow(
                  `⚠️ Unknown schema type "${content.type}" in ${file}` +
                    didYouMeanClause(content.type)
                )
              );
            }
          }
        }
      }
    } catch (e) {
      console.log(chalk.red(`x Invalid JSON in ${file}: ${(e as Error).message}`));
      errors++;
    }
  }

  // Printed BEFORE the skipped count, and per file rather than as a bare
  // number: this bucket is the one a two-bucket report would have destroyed,
  // and a count alone is not enough to act on (objectui#6075). The list is
  // uncapped for the same reason the unknown-type warnings above are — a cap
  // is a quieter way of losing the finding.
  if (unvalidatedCandidates.length > 0) {
    const n = unvalidatedCandidates.length;
    console.log(
      chalk.yellow(
        `⚠️ ${n} file${n === 1 ? '' : 's'} carr${n === 1 ? 'ies' : 'y'} a registered ObjectUI component type but did not validate as an ObjectUI schema:`
      )
    );
    for (const { file, type } of unvalidatedCandidates) {
      console.log(chalk.yellow(`   ${file} (type "${type}")`));
    }
    console.log(
      chalk.dim('   Run `objectui validate <file>` on any of them for the reason.')
    );
    console.log(
      chalk.dim(
        '   Either the document is off-spec, or its component type is not modelled by @object-ui/types.'
      )
    );
    console.log(
      chalk.dim(
        '   These are NOT counted as skipped: a schema that fails validation is a broken schema, not a foreign file.'
      )
    );
  }

  if (skipped > 0) {
    console.log(
      chalk.dim(
        `Skipped ${skipped} file${skipped === 1 ? '' : 's'} with a root "type" that no ObjectUI recogniser admitted.`
      )
    );
    // The hint names the marker keys by rendering the gate's OWN array, never
    // a sentence written alongside it. A hint that describes a way in that the
    // build does not honour is worse than no hint: the reader follows it,
    // nothing changes, and the command looks broken rather than narrow. The
    // previous revision of this line advised declaring a `$schema` URL — an
    // arm the 2026-08-20 ruling removed — which is exactly that failure had it
    // outlived the code it described.
    console.log(
      chalk.dim(
        `  A file is checked when its root carries an ObjectUI structural key: ${OBJECTUI_STRUCTURAL_KEYS.join(', ')}.`
      )
    );
    // The second arm, stated because the sentence above no longer describes
    // the whole predicate — and an explanation that has stopped describing
    // what the code does is the defect class objectui#6074 had just finished
    // removing from this file.
    console.log(
      chalk.dim(
        '  It is also checked when the whole document validates as an ObjectUI component schema.'
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
