/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `packages/data-objectstack/README.md`'s filter-operator tables are held to
 * `@object-ui/core`'s `convertFiltersToAST` — the code that decides every row
 * (objectui#8558).
 *
 * ## Why this file exists
 *
 * The "Supported Filter Operators" table was a hand-written mirror of the
 * `operatorMap` inside `convertOperatorToAST`, and by objectui#8558 it had
 * drifted from the code in three independent ways at once:
 *
 *   - `$nin` / `$notin` were documented as lowering to `notin`, with a worked
 *     example whose OUTPUT read `['status', 'notin', ['archived']]`. The map
 *     says `nin`. A reader who copied the example got a node the server
 *     refuses;
 *   - `$regex` was documented as lowering to `contains`. That downgrade was
 *     retired (objectui#8447 / PR #8512): `$regex` is REFUSED with a
 *     `FilterOperatorError`, because a substring match is a different
 *     question, not a weaker version of the same one;
 *   - only `$startswith` was listed, while the map carries both spellings and
 *     `$startsWith` is the spec's (`FILTER_OPERATORS`, `data/filter.zod.ts`).
 *
 * Re-deriving the whole table for that card found the rest of the drift: four
 * operators the code's own "Supported operators:" message enumerates —
 * `$notContains`, `$endsWith`, `$null`, `$exists` — had no row at all, and
 * neither did the `$and` / `$or` combinators nor the `$not` refusal.
 *
 * Three drifts in one table is the signal that hand-maintenance does not
 * survive here — the same shape as the ledger figures in
 * `packages/types/src/__tests__/zod-mirror-parity.test.ts` rotting while every
 * pin stayed green (objectui#8252). This file is the smaller version of
 * "generate the table": the table stays authored, and every claim it makes is
 * EXECUTED against the code on every run.
 *
 * ## What is asserted — every claim, by execution, never by a restated list
 *
 *   - every row's worked example is run through `convertFiltersToAST`, and its
 *     documented output must be exactly what the function returns — or, for a
 *     row in the refused table, the function must throw the `INVALID_FILTER`
 *     / 400 envelope the table promises. This is the check that would have
 *     caught the `notin` example: it is a claim about OUTPUT, so it is checked
 *     as one;
 *   - every `$`-spelling in the supported table's first column must lower, and
 *     to exactly the operator(s) its row's second column names. `$null` and
 *     `$exists` are probed with both booleans, so their rows must name both
 *     directions;
 *   - the supported table must carry a row for EVERY key of
 *     `convertOperatorToAST`'s `operatorMap` (alias spellings included — the
 *     omitted `$startsWith` was an alias row) and for every operator the
 *     unknown-operator error message calls supported (`$null` / `$exists`
 *     live outside the map);
 *   - every `$`-spelling in the refused table must be refused, and every
 *     combinator row's keyword must be the one its lowered group carries.
 *
 * ## The expected values are READ OUT OF the code, never listed here
 *
 * Hardcoding `nin` below would rebuild the defect one level up: a second
 * hand-maintained copy, in a test, that would then have to be edited whenever
 * the map changed — the edit everybody makes without reading. So the map is
 * read from `filter-converter.ts`'s source (the only way to see its lowercase
 * aliases without exporting it; a control below proves the read agrees with
 * the runtime), the supported list is read from the error the function throws
 * for an unknown operator, and every lowering comes from calling the function.
 * A red here is always "fix the README (or the code)", never "update the test".
 *
 * ## Exhaustiveness IS asserted, deliberately
 *
 * `plugin-calendar`'s `readme-calendar-view-schema.test.ts` declines to assert
 * exhaustiveness because its fence is a declared partial summary. This table
 * is headed "Supported Filter Operators" and is the only place the
 * `$`-dialect lowering is documented for consumers, so a missing row is
 * exactly the omission objectui#8558 counted as a defect. It is held complete
 * in the direction that misleads a reader: every operator the code accepts
 * has a row.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertFiltersToAST, convertOperatorToAST } from '@object-ui/core';

/** Walk up to the workspace root, so both files are found by repo layout. */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found from this test file');
}

const ROOT = repoRoot();
const README_PATH = 'packages/data-objectstack/README.md';
const CONVERTER_PATH = 'packages/core/src/utils/filter-converter.ts';
const README = readFileSync(join(ROOT, README_PATH), 'utf8');
const CONVERTER_SOURCE = readFileSync(join(ROOT, CONVERTER_PATH), 'utf8');

const SUPPORTED_HEADING = '#### Supported Filter Operators';
const COMBINATORS_HEADING = '#### Logical combinators';
const REFUSED_HEADING = '#### Refused at lowering time';

/** The arrow every worked example puts between its input and its output. */
const ARROW = '→';

interface Row {
  /** 1-based line in the README, for the failure message. */
  readonly line: number;
  readonly cells: readonly string[];
}

/**
 * Body rows (header and separator dropped) of the first markdown table under
 * `heading`. A missing heading or a heading with no table fails LOUDLY: a pin
 * that silently iterated zero rows would be green over a deleted table.
 */
function tableUnder(heading: string): Row[] {
  const lines = README.split('\n');
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    throw new Error(
      `${README_PATH} no longer has a "${heading}" heading, so this pin has nothing to `
        + 'compare (objectui#8558). If the page was restructured, re-point this reader at '
        + 'the new heading — do not delete the pin, or the table goes back to being prose '
        + 'that nothing holds to convertFiltersToAST.',
    );
  }
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith('|')) {
    if (/^#{1,6} /.test(lines[i])) {
      throw new Error(`${README_PATH}: no table between "${heading}" and the next heading`);
    }
    i += 1;
  }
  const rows: Row[] = [];
  for (; i < lines.length && lines[i].startsWith('|'); i += 1) {
    const cells = lines[i]
      .replace(/^\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((cell) => cell.trim());
    rows.push({ line: i + 1, cells });
  }
  if (rows.length < 3) {
    throw new Error(`${README_PATH}: the table under "${heading}" has no body rows`);
  }
  return rows.slice(2);
}

/** `$`-spellings written as inline code in a cell, in order of appearance. */
function operatorSpellings(cell: string): string[] {
  return [...cell.matchAll(/`(\$[A-Za-z]+)`/g)].map((match) => match[1]);
}

/** Every inline-code span in a cell, in order of appearance. */
function codeSpans(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/**
 * The README's examples are JS literals — bare keys, single quotes. They are
 * rewritten to JSON and parsed, deliberately narrowly: `JSON.parse` throws on
 * anything the rewrite does not understand, which is the right answer for an
 * example this file cannot execute. No `eval`.
 */
function parseLiteral(source: string, where: string): unknown {
  const json = source
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_match, text: string) => JSON.stringify(text))
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(json);
  } catch (error) {
    // `Object.assign` rather than the `{ cause }` constructor option: this
    // tree compiles against `lib: ES2020`, which has no `ErrorOptions`. Same
    // idiom `src/index.ts` uses.
    throw Object.assign(
      new Error(
        `${where}: cannot parse the example literal ${source} (rewritten as ${json}): `
          + `${(error as Error).message}`,
      ),
      { cause: error },
    );
  }
}

interface Example {
  readonly input: Record<string, unknown>;
  /** The documented output; `undefined` when the row documents a throw. */
  readonly output: unknown;
  readonly throws: boolean;
  /** Everything after the arrow, verbatim — the refused table's promise lives here. */
  readonly rhs: string;
}

/** The third cell of a row, split at its arrow into an executable input and a documented result. */
function exampleOf(row: Row, where: string): Example {
  const cell = row.cells[2] ?? '';
  const at = cell.indexOf(ARROW);
  if (at === -1) throw new Error(`${where}: the example cell has no "${ARROW}": ${cell}`);
  const lhs = codeSpans(cell.slice(0, at));
  if (lhs.length !== 1) {
    throw new Error(`${where}: expected exactly one code span before the arrow, found ${lhs.length}`);
  }
  const input = parseLiteral(lhs[0], where);
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${where}: the example input must be an object literal: ${lhs[0]}`);
  }
  const rhs = cell.slice(at + ARROW.length).trim();
  const throws = /\bthrows\b/.test(rhs);
  const rhsSpans = codeSpans(rhs);
  if (!throws && rhsSpans.length !== 1) {
    throw new Error(`${where}: expected exactly one code span after the arrow, found ${rhsSpans.length}`);
  }
  return {
    input: input as Record<string, unknown>,
    output: throws ? undefined : parseLiteral(rhsSpans[0], where),
    throws,
    rhs,
  };
}

type Lowering =
  | { readonly refused: true }
  | { readonly refused: false; readonly operators: ReadonlySet<string> };

/**
 * What `convertFiltersToAST` does with `spelling` in operator position — the
 * AST operator(s) it emits, or a refusal. Probed with both booleans because
 * `$null` / `$exists` read their value to pick a direction; for every other
 * operator the value is irrelevant and both probes agree.
 */
function lowerings(spelling: string): Lowering {
  const operators = new Set<string>();
  for (const value of [true, false]) {
    let node: unknown;
    try {
      node = convertFiltersToAST({ probe: { [spelling]: value } });
    } catch (error) {
      expect(
        error,
        `${spelling} threw something other than the INVALID_FILTER / 400 envelope`,
      ).toMatchObject({ code: 'INVALID_FILTER', httpStatus: 400 });
      return { refused: true };
    }
    if (!Array.isArray(node) || node[0] !== 'probe' || typeof node[1] !== 'string') {
      throw new Error(
        `probing ${spelling} lowered to ${JSON.stringify(node)}, not a comparison node on the probed field`,
      );
    }
    operators.add(node[1]);
  }
  return { refused: false, operators };
}

/**
 * `convertOperatorToAST`'s `operatorMap`, read out of the source so the
 * lowercase aliases are visible without exporting the map. The slice is
 * anchored on the declaration, and a control below holds every entry to the
 * runtime, so a moved or reshaped map fails loudly rather than reading empty.
 */
function operatorMapFromSource(): Map<string, string> {
  const start = CONVERTER_SOURCE.indexOf('const operatorMap');
  const end = start === -1 ? -1 : CONVERTER_SOURCE.indexOf('};', start);
  if (start === -1 || end === -1) {
    throw new Error(
      `${CONVERTER_PATH} no longer declares \`const operatorMap\` (objectui#8558): re-point `
        + 'this reader at wherever the $-operator vocabulary now lives',
    );
  }
  const map = new Map<string, string>();
  for (const match of CONVERTER_SOURCE.slice(start, end).matchAll(/'(\$[A-Za-z]+)':\s*'([^']+)'/g)) {
    map.set(match[1], match[2]);
  }
  return map;
}

/**
 * The operators the unknown-operator error calls supported — the code's own
 * enumeration, which is where `$null` / `$exists` (handled outside the map)
 * are listed.
 */
function supportedOperatorsFromError(): string[] {
  let message = '';
  try {
    convertFiltersToAST({ probe: { $definitelyNotAnOperator: 1 } });
  } catch (error) {
    message = (error as Error).message;
  }
  const match = /Supported operators:\s*([^.]+)\./.exec(message);
  if (!match) {
    throw new Error(
      'convertFiltersToAST no longer enumerates its supported operators in the '
        + `unknown-operator error (objectui#8558); the message was: ${JSON.stringify(message)}`,
    );
  }
  return [...match[1].matchAll(/\$[A-Za-z]+/g)].map((m) => m[0]);
}

const sorted = (values: Iterable<string>) => [...values].sort();

describe('README filter-operator tables are decided by convertFiltersToAST (objectui#8558)', () => {
  const operatorMap = operatorMapFromSource();
  const supportedByError = supportedOperatorsFromError();
  const supported = tableUnder(SUPPORTED_HEADING);
  const combinators = tableUnder(COMBINATORS_HEADING);
  const refused = tableUnder(REFUSED_HEADING);

  describe('controls — the code-side populations were really read', () => {
    it('reads the operator map out of filter-converter.ts, and it agrees with the runtime', () => {
      expect(operatorMap.size).toBeGreaterThanOrEqual(12);
      expect(operatorMap.get('$eq')).toBe('=');
      const disagreeing = [...operatorMap]
        .filter(([spelling, target]) => convertOperatorToAST(spelling) !== target)
        .map(([spelling, target]) => `${spelling}: source says ${target}, runtime says ${convertOperatorToAST(spelling)}`);
      expect(disagreeing, 'the source read of operatorMap does not match convertOperatorToAST').toEqual([]);
    });

    it('reads the supported list out of the unknown-operator error', () => {
      expect(supportedByError.length).toBeGreaterThanOrEqual(10);
      expect(supportedByError).toContain('$eq');
      expect(supportedByError).toContain('$exists');
    });

    it('found all three tables, each with rows', () => {
      expect(supported.length).toBeGreaterThanOrEqual(12);
      expect(combinators.length).toBeGreaterThanOrEqual(2);
      expect(refused.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('every worked example does what its row says', () => {
    it('supported and combinator rows lower to exactly the documented output', () => {
      const bad: string[] = [];
      for (const row of [...supported, ...combinators]) {
        const where = `${README_PATH}:${row.line}`;
        const example = exampleOf(row, where);
        if (example.throws) {
          bad.push(`${where}: a row outside the refused table documents a throw`);
          continue;
        }
        let actual: unknown;
        try {
          actual = convertFiltersToAST(example.input);
        } catch (error) {
          bad.push(`${where}: ${JSON.stringify(example.input)} threw: ${(error as Error).message}`);
          continue;
        }
        if (JSON.stringify(actual) !== JSON.stringify(example.output)) {
          bad.push(
            `${where}: ${JSON.stringify(example.input)} lowers to ${JSON.stringify(actual)}, `
              + `the row says ${JSON.stringify(example.output)}`,
          );
        }
      }
      expect(
        bad,
        'a worked example a reader can copy must be the exact node convertFiltersToAST '
          + 'emits (the objectui#8558 `notin` example was not)',
      ).toEqual([]);
    });

    it('refused rows throw the INVALID_FILTER / 400 envelope they promise', () => {
      const bad: string[] = [];
      for (const row of refused) {
        const where = `${README_PATH}:${row.line}`;
        const example = exampleOf(row, where);
        if (!example.throws || !example.rhs.includes('INVALID_FILTER')) {
          bad.push(`${where}: a refused row must document "throws \`INVALID_FILTER\`", found: ${example.rhs}`);
          continue;
        }
        let thrown: unknown;
        try {
          const node = convertFiltersToAST(example.input);
          bad.push(`${where}: ${JSON.stringify(example.input)} lowered to ${JSON.stringify(node)} instead of throwing`);
          continue;
        } catch (error) {
          thrown = error;
        }
        const envelope = thrown as { code?: unknown; httpStatus?: unknown; name?: unknown };
        if (envelope.code !== 'INVALID_FILTER' || envelope.httpStatus !== 400) {
          bad.push(
            `${where}: ${JSON.stringify(example.input)} threw ${String(envelope.name)} with code `
              + `${String(envelope.code)} / status ${String(envelope.httpStatus)}, not INVALID_FILTER / 400`,
          );
        }
      }
      expect(bad, 'the refused table promises a specific envelope; the code must honour it').toEqual([]);
    });
  });

  describe('the Supported Filter Operators table', () => {
    it('every spelling in the first column lowers to exactly the operator(s) the second column names', () => {
      const bad: string[] = [];
      for (const row of supported) {
        const where = `${README_PATH}:${row.line}`;
        const documented = sorted(codeSpans(row.cells[1] ?? ''));
        for (const spelling of operatorSpellings(row.cells[0] ?? '')) {
          const lowering = lowerings(spelling);
          if (lowering.refused) {
            bad.push(`${where}: ${spelling} is refused by convertFiltersToAST, so it is not a supported operator`);
            continue;
          }
          const emitted = sorted(lowering.operators);
          if (JSON.stringify(emitted) !== JSON.stringify(documented)) {
            bad.push(`${where}: ${spelling} lowers to ${emitted.join(' / ')}, the row says ${documented.join(' / ')}`);
          }
        }
      }
      expect(
        bad,
        'the ObjectStack Operator column is the operator the lowered node carries — '
          + 'a wrong one (objectui#8558: `notin` for `nin`) is a node the server refuses',
      ).toEqual([]);
    });

    it('carries a row for every key of the operator map, alias spellings included', () => {
      const listed = new Set(supported.flatMap((row) => operatorSpellings(row.cells[0] ?? '')));
      const missing = [...operatorMap.keys()].filter((spelling) => !listed.has(spelling));
      expect(
        missing,
        'convertOperatorToAST accepts these spellings and the table does not list them '
          + '(objectui#8558: `$startsWith`, the spec spelling, was the missing one)',
      ).toEqual([]);
    });

    it('carries a row for every operator the unknown-operator error calls supported', () => {
      const listed = new Set(supported.flatMap((row) => operatorSpellings(row.cells[0] ?? '')));
      const missing = supportedByError.filter((spelling) => !listed.has(spelling));
      expect(
        missing,
        'the code tells an author these operators are supported and the table has no row for them '
          + '(objectui#8558 found `$notContains`, `$endsWith`, `$null`, `$exists` missing)',
      ).toEqual([]);
    });
  });

  describe('the Logical combinators table', () => {
    it('the second column is the keyword the lowered group carries', () => {
      const bad: string[] = [];
      for (const row of combinators) {
        const where = `${README_PATH}:${row.line}`;
        const spellings = operatorSpellings(row.cells[0] ?? '');
        const documented = codeSpans(row.cells[1] ?? '');
        const { input, output } = exampleOf(row, where);
        const head = Array.isArray(output) ? output[0] : undefined;
        if (spellings.length !== 1 || documented.length !== 1) {
          bad.push(`${where}: a combinator row names one key and one keyword`);
          continue;
        }
        if (!(spellings[0] in input)) {
          bad.push(`${where}: the example does not use ${spellings[0]}`);
        }
        if (head !== documented[0]) {
          bad.push(`${where}: the documented output opens with ${String(head)}, the row says ${documented[0]}`);
        }
      }
      expect(bad).toEqual([]);
    });
  });

  describe('the Refused at lowering time table', () => {
    it('every $-spelling in the first column is refused when probed in operator position', () => {
      const bad: string[] = [];
      for (const row of refused) {
        const where = `${README_PATH}:${row.line}`;
        for (const spelling of operatorSpellings(row.cells[0] ?? '')) {
          if (!lowerings(spelling).refused) {
            bad.push(`${where}: ${spelling} is listed as refused but convertFiltersToAST lowers it`);
          }
        }
      }
      expect(bad, 'a spelling the code accepts must not be documented as refused').toEqual([]);
    });
  });
});
