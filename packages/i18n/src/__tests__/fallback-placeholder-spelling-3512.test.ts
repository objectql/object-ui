/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Every placeholder a provider-less fallback will ever meet is spelled the one
 * way that fallback can resolve — objectui#3512.
 *
 * ## The fork this closes, and the direction it is closed in
 *
 * `createSafeTranslation`'s `fallbackT` interpolates with an EXACT literal
 * needle (`useSafeTranslation.ts`: ``value.split(`{{${k}}}`).join(String(v))``),
 * so it recognises `{{name}}` and nothing else. i18next — which serves the
 * SAME strings whenever an `I18nProvider` is mounted — additionally recognises
 * `{{ name }}` (whitespace inside the braces), `{{count, number}}` (a format
 * spec), `{{- name}}` (the unescape prefix) and `$t(otherKey)` (nesting).
 * Measured on a real i18next 26.3.6 instance configured the way `createI18n`
 * configures it (`interpolation: { escapeValue: false }`), those four render
 * correctly through the provider and leak literal braces without one.
 *
 * The card left two directions open. The maintainer's objectui#4135 ruling
 * settled it: `{{x}}` is EXCLUSIVELY i18next-bound copy, `{x}` is a hole filled
 * downstream of `t()`. So the answer is not to teach the fallback three more
 * dialects (a second interpolator to keep in step with i18next forever), it is
 * to hold the copy to the one spelling both paths agree on. Declared =
 * enforced: the divergence stays unreachable by construction instead of by
 * luck. The fallback's behaviour is deliberately NOT changed by this file.
 *
 * ## The false positives this must not produce
 *
 * Two classes, both named on the card and by three triage rounds:
 *
 *   - **Single braces.** `{shown}` / `{total}` in `gantt.quickFilter.resultSummary`
 *     is a downstream hole by design — its call site does a literal
 *     `.replace('{shown}', …)`. Under #4135 that is the CORRECT spelling for a
 *     non-i18next hole, so flagging it would invert the ruling. The rule below
 *     only ever inspects the inside of a `{{…}}` pair, so single braces are
 *     structurally out of range, and the liveness cases pin real single-brace
 *     rows staying green.
 *   - **JSX object literals.** `style={{ opacity: 0 }}`, `context={{ org }}` —
 *     `{{` in TSX that is syntax, not copy. Every earlier sweep of this card hit
 *     them, because a bare source grep cannot tell them from a spaced
 *     placeholder. This gate never greps source text for `{{`: it reads only
 *     STRING VALUES reached through a copy table's own data structure, and a JSX
 *     brace is not inside a string literal. The class is excluded by where the
 *     scanner looks, not by an allow-list that could rot.
 *
 * ## The copy sources under the gate, and why exactly these
 *
 * The subject is "text a literal-needle interpolator can be asked to render".
 * Three surfaces, measured on this tree:
 *
 *   1. **The ten locale packs** (`builtInLocales`, 28k+ string leaves). Imported
 *      as data. They are upstream of surface 2 — `defaults-maps-mirror-en-pack.test.ts`
 *      (objectui#4401) and objectui#3440 pin defaults rows byte-identical to
 *      their `en` row — so a spaced placeholder authored in a pack lands in a
 *      defaults table by way of a gate that is doing its job. Note the existing
 *      `all-locales-key-parity.test.ts` "placeholders match en" case cannot see
 *      this: its `\{\{\w+\}\}` shape regex simply does not match `{{ name }}`,
 *      so a spelling introduced in `en` AND its nine translations at once is
 *      shape-equal, hence green. That case compares packs to each other; this
 *      one judges a pack against the fallback's grammar in absolute terms.
 *   2. **The `createSafeTranslation` defaults tables** — 31 of them, 762 string
 *      rows, DISCOVERED rather than listed (below), so a new table is gated the
 *      day it is written.
 *   3. **The three hand-rolled sibling tables** whose packages re-implemented
 *      the same literal needle instead of taking the factory
 *      (`GANTT_DEFAULT_TRANSLATIONS`, `IMPORT_DEFAULT_TRANSLATIONS`,
 *      `TIMELINE_DEFAULT_TRANSLATIONS`; each file states its own reason for not
 *      using the factory). They are a registry, and a completeness case pins the
 *      set of files carrying that needle, so a fourth copy of the interpolator
 *      cannot quietly land outside the gate.
 *
 * Two neighbours were measured and deliberately left out:
 *
 *   - **Inline `t(key, { defaultValue })`.** `fallbackT` does read it (the
 *     objectui#3865 chain step), and 0 of them violate the rule today. Left out
 *     because it is a call-site OPTION rather than a copy table — the two
 *     surfaces this card was scoped to — and because `check:i18n-keys`'
 *     `default-value-drift` class already pins 906 of its 909 literal inline
 *     defaults byte-identical to their `en` row, which surface 1 gates. The
 *     residual is those 3 "not comparable" plus 62 computed ones: recorded as a
 *     coverage boundary, and filed, rather than silently assumed covered.
 *   - **`ConcurrentUpdateDialog.tsx`'s `.split('{{field}}')`.** A hard-coded
 *     needle CONSUMING a pack value, not a table of its own — surface 1 covers
 *     the value it splits.
 *
 * ## Division of labour with the three existing i18n gates
 *
 * All four read the same packs, and each is blind to what this one owns:
 *
 *   - `scripts/check-i18n-call-site-keys.mjs` — its `holesOf()` deliberately
 *     reads THROUGH all four dialects when extracting a hole's NAME (`{{n, number}}`
 *     yields `n`, `{{- html}}` yields `html`, `{{user.name}}` yields `user`), so
 *     that an argument-parity verdict survives one appearing. It tolerates; it
 *     never rejects — and its own comment records the measurement this file turns
 *     into a rule: "all 84 distinct holes in `en` are bare names". This gate is
 *     the enforcement half of that sentence.
 *   - `all-locales-key-parity.test.ts` — pack vs pack, and RELATIVE: its shape
 *     regex is `\{\{\w+\}\}`, which does not match `{{ name }}` at all. A
 *     spelling introduced in `en` and its nine translations together is
 *     shape-equal in that comparison, hence green. This file judges a pack
 *     against the fallback's grammar in ABSOLUTE terms, which is the only way
 *     that case is reachable.
 *   - `scripts/check-i18n-en-drift.mjs` — fires on an `en` value CHANGING. A
 *     value authored with a spaced placeholder on day one never changes, so it
 *     is invisible there by construction.
 *
 * ## Why this file lives in `@object-ui/i18n` when two of its surfaces do not
 *
 * `defaults-maps-mirror-en-pack.test.ts` had to move to `app-shell` because it
 * IMPORTS three plugin maps, and every one of those packages depends on this
 * one — importing them back inverts the dependency. This file imports nothing
 * outside its own package: it READS the source files as text and parses them,
 * which is not a module dependency in either direction (same mechanism as
 * `forwardref-props-annotation.guard.test.ts`). So the rule can live beside the
 * fallback whose grammar it is enforcing, which is where the next person to
 * touch `useSafeTranslation.ts` will look.
 *
 * ## Direction of the reverse verification, predicted before running (#4118)
 *
 * Straight red, not the inverted or count-shaped variants: the rule is an
 * absolute predicate over values, with no `??` chain and no verdict count for a
 * mutation to empty out. Injecting `{{ name }}` (spaced), `{{count, number}}`
 * (format spec) or `$t(other)` (nesting) into ONE real row of ONE real table
 * must turn exactly the case that owns that surface red, naming the file and the
 * key — and leave the liveness and single-brace cases green, because the
 * injected row is one row. Verified all three ways on this tree, plus the two
 * false-positive controls staying green; recorded on the PR.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { builtInLocales } from '../locales';

const here = path.dirname(fileURLToPath(import.meta.url));
// packages/i18n/src/__tests__  ->  repo root
const REPO_ROOT = path.resolve(here, '../../../..');

/* ------------------------------------------------------------------ */
/* The rule                                                            */
/* ------------------------------------------------------------------ */

/**
 * A `{{…}}` pair and its contents. `[^{}]*` deliberately: a placeholder never
 * nests braces, and refusing to cross one keeps an unterminated `{{` from
 * swallowing the rest of the sentence into a bogus "placeholder".
 */
const DOUBLE_BRACE = /\{\{([^{}]*)\}\}/g;

/** Every `{{` occurrence, matched or not — the balance check's other half. */
const DOUBLE_BRACE_OPEN = /\{\{/g;

/**
 * The one spelling `fallbackT` resolves. `k` comes from `Object.entries(options)`
 * and is spliced into the needle raw, so the accepted name is exactly a bare
 * identifier: no whitespace, no format spec, no `-` prefix, no dotted path.
 */
const CANONICAL_NAME = /^[A-Za-z0-9_]+$/;

/** i18next's nesting syntax. The fallback has no notion of it at all. */
const NESTING = '$t(';

/** Why one placeholder is not something `fallbackT` can resolve. */
function reasonFor(inner: string): string {
  if (inner !== inner.trim()) return 'whitespace inside the braces';
  if (inner.startsWith('-')) return 'the {{- x}} unescape prefix';
  if (inner.includes(',')) return 'an i18next format spec';
  if (inner.includes('.')) return 'a dotted/keyed placeholder path';
  return 'a non-identifier placeholder name';
}

/**
 * THE rule. Returns one human-readable violation per offending placeholder, and
 * `[]` for copy the provider-less fallback renders identically to i18next.
 *
 * Only the inside of a `{{…}}` pair is judged, so single-brace `{x}` holes
 * (objectui#4135's downstream-fill convention) can never reach a verdict here.
 */
export function placeholderViolations(value: string): string[] {
  const out: string[] = [];
  const regions = [...value.matchAll(DOUBLE_BRACE)];
  for (const region of regions) {
    const inner = region[1];
    if (CANONICAL_NAME.test(inner)) continue;
    out.push(
      `${JSON.stringify(region[0])} — ${reasonFor(inner)}; the fallback resolves only {{name}}`,
    );
  }
  // An unterminated `{{` renders as literal braces on BOTH paths, so it is not
  // an i18next divergence — but it is never intentional copy, and the regions
  // above cannot report what they did not match.
  const opens = (value.match(DOUBLE_BRACE_OPEN) ?? []).length;
  if (opens > regions.length) out.push('an unterminated `{{` with no closing `}}`');
  if (value.includes(NESTING)) {
    out.push('`$t(` — i18next nesting, which the fallback emits verbatim');
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Copy source 1 — the ten locale packs                                */
/* ------------------------------------------------------------------ */

interface Leaf {
  readonly key: string;
  readonly value: string;
}

function leaves(node: unknown, prefix = ''): Leaf[] {
  if (typeof node === 'string') return [{ key: prefix, value: node }];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const LOCALE_CODES = Object.keys(builtInLocales) as (keyof typeof builtInLocales)[];
const PACK_LEAVES = new Map(LOCALE_CODES.map((code) => [code, leaves(builtInLocales[code])]));

/* ------------------------------------------------------------------ */
/* Copy source 2/3 — the defaults tables, read from source             */
/* ------------------------------------------------------------------ */

/** The factory, and plugin-detail's re-export alias for it. */
const FACTORY_NAMES = new Set(['createSafeTranslation', 'createSafeTranslationHook']);

/**
 * The literal needle, as it is spelled in source: ``.split(`{{${``. The
 * completeness case below pins which files carry it, so a fourth hand-rolled
 * copy of `fallbackT` forces an edit here instead of escaping the gate.
 */
const NEEDLE_IN_SOURCE = '.split(`{{${';

/** Every runtime `.ts`/`.tsx` under the workspace — tests and tooling excluded. */
function collectSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name === '__tests__' ||
        name === '__mocks__' ||
        name.startsWith('.')
      ) {
        continue;
      }
      const full = path.join(dir, name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.(test|spec|bench|stories)\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  };
  for (const root of ['packages', 'apps', 'examples']) {
    const full = path.join(REPO_ROOT, root);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full);
  }
  return out.sort();
}

const SOURCE_FILES = collectSourceFiles();
const rel = (abs: string) => path.relative(REPO_ROOT, abs);

const parsed = new Map<string, ts.SourceFile | null>();
function sourceFileFor(abs: string): ts.SourceFile | null {
  if (parsed.has(abs)) return parsed.get(abs) ?? null;
  const sf = existsSync(abs)
    ? ts.createSourceFile(
        abs,
        readFileSync(abs, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      )
    : null;
  parsed.set(abs, sf);
  return sf;
}

/** Peel the wrappers a table declaration may carry before its object literal. */
function unwrap(node: ts.Expression): ts.Expression {
  let e = node;
  for (;;) {
    if (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e)) {
      e = e.expression;
      continue;
    }
    return e;
  }
}

/** The initializer of a top-level `const <name> = …` in this file. */
function constInitializer(sf: ts.SourceFile, name: string): ts.Expression | null {
  let found: ts.Expression | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** Follow `import { <name> } from './relative'` to the file that declares it. */
function importedFrom(sf: ts.SourceFile, name: string): string | null {
  let spec: string | null = null;
  ts.forEachChild(sf, (node) => {
    if (spec !== null) return;
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      for (const element of node.importClause.namedBindings.elements) {
        if (element.name.text === name) spec = node.moduleSpecifier.text;
      }
    }
  });
  if (spec === null || !(spec as string).startsWith('.')) return null;
  const base = path.resolve(path.dirname(sf.fileName), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * A string a table row is declared with. Handles the `'a' + 'b'` concatenation
 * one row uses (`plugin-form/src/occSave.tsx`); anything else returns
 * `undefined` and is REPORTED rather than skipped — a row the gate cannot read
 * is a hole in it, not an exemption.
 */
function staticString(node: ts.Expression): string | undefined {
  const e = unwrap(node);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(e.left);
    const right = staticString(e.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
  return undefined;
}

/** One row of one gated table, located precisely enough to fix. */
interface Row {
  readonly table: string;
  readonly where: string;
  readonly key: string;
  readonly value: string;
}

interface TableScan {
  readonly rows: Row[];
  /** Rows whose value is not a static string, and tables that never resolved. */
  readonly unreadable: string[];
}

function scanObjectLiteral(
  literal: ts.ObjectLiteralExpression,
  table: string,
  into: TableScan,
  keyPrefix = '',
): void {
  const owner = literal.getSourceFile();
  const at = (node: ts.Node) =>
    `${rel(owner.fileName)}:${owner.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  for (const property of literal.properties) {
    if (ts.isPropertyAssignment(property)) {
      const name =
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
          ? property.name.text
          : null;
      if (name === null) {
        into.unreadable.push(`${at(property)} — computed key in ${table}`);
        continue;
      }
      const key = keyPrefix ? `${keyPrefix}.${name}` : name;
      const initializer = unwrap(property.initializer);
      if (ts.isObjectLiteralExpression(initializer)) {
        scanObjectLiteral(initializer, table, into, key);
        continue;
      }
      const value = staticString(initializer);
      if (value === undefined) {
        into.unreadable.push(`${at(property)} — ${table}.${key} is not a static string`);
        continue;
      }
      into.rows.push({ table, where: at(property), key, value });
    } else {
      into.unreadable.push(`${at(property)} — non-assignment member in ${table}`);
    }
  }
}

/**
 * Resolve a `createSafeTranslation` first argument to its object literal: an
 * inline table, a `const` in the same file, or a `const` imported from a
 * relative module.
 */
function resolveTableArgument(
  sf: ts.SourceFile,
  argument: ts.Expression,
): { literal: ts.ObjectLiteralExpression | null; name: string } {
  const unwrapped = unwrap(argument);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return { literal: unwrapped, name: '(inline table)' };
  }
  if (ts.isIdentifier(unwrapped)) {
    const name = unwrapped.text;
    let initializer = constInitializer(sf, name);
    if (initializer === null) {
      const from = importedFrom(sf, name);
      const imported = from === null ? null : sourceFileFor(from);
      if (imported) initializer = constInitializer(imported, name);
    }
    if (initializer !== null) {
      const literal = unwrap(initializer);
      if (ts.isObjectLiteralExpression(literal)) return { literal, name };
    }
    return { literal: null, name };
  }
  return { literal: null, name: ts.SyntaxKind[unwrapped.kind] };
}

/**
 * The three tables whose packages re-implemented `fallbackT`'s literal needle
 * rather than taking the factory. Each file states its own reason for that;
 * none of them changes the grammar the needle accepts, so the rule is the same.
 * `TIMELINE_DEFAULT_TRANSLATIONS` also reaches the factory — listed anyway, so
 * the registry mirrors the needle-file set the completeness case pins.
 */
const HAND_ROLLED_TABLES: readonly { readonly file: string; readonly name: string }[] = [
  { file: 'packages/plugin-gantt/src/useGanttTranslation.ts', name: 'GANTT_DEFAULT_TRANSLATIONS' },
  { file: 'packages/plugin-grid/src/ImportWizard.tsx', name: 'IMPORT_DEFAULT_TRANSLATIONS' },
  {
    file: 'packages/plugin-timeline/src/useTimelineTranslation.ts',
    name: 'TIMELINE_DEFAULT_TRANSLATIONS',
  },
];

/** Files that carry the literal needle today — the completeness case's subject. */
const NEEDLE_FILES = [
  'packages/i18n/src/useSafeTranslation.ts',
  'packages/plugin-gantt/src/useGanttTranslation.ts',
  'packages/plugin-grid/src/ImportWizard.tsx',
  'packages/plugin-timeline/src/useTimelineTranslation.ts',
];

function scanDefaultsTables(): TableScan & { readonly tables: string[]; readonly needle: string[] } {
  const scan: TableScan = { rows: [], unreadable: [] };
  const tables: string[] = [];
  const needle: string[] = [];

  for (const abs of SOURCE_FILES) {
    const text = readFileSync(abs, 'utf8');
    if (text.includes(NEEDLE_IN_SOURCE)) needle.push(rel(abs));
    if (!text.includes('createSafeTranslation')) continue;
    const sf = sourceFileFor(abs);
    if (!sf) continue;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee)
          ? callee.text
          : ts.isPropertyAccessExpression(callee)
            ? callee.name.text
            : null;
        if (name !== null && FACTORY_NAMES.has(name) && node.arguments.length > 0) {
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const { literal, name: tableName } = resolveTableArgument(sf, node.arguments[0]);
          const label = `${tableName} (${rel(abs)}:${line})`;
          if (literal === null) {
            // Not an exemption: a table the gate cannot reach is a table the
            // gate does not cover, and that has to be visible.
            scan.unreadable.push(`${rel(abs)}:${line} — cannot resolve ${tableName} to a table`);
          } else {
            tables.push(label);
            scanObjectLiteral(literal, label, scan);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(sf, visit);
  }

  for (const { file, name } of HAND_ROLLED_TABLES) {
    const abs = path.join(REPO_ROOT, file);
    const sf = sourceFileFor(abs);
    const initializer = sf === null ? null : constInitializer(sf, name);
    const literal = initializer === null ? null : unwrap(initializer);
    if (literal === null || !ts.isObjectLiteralExpression(literal)) {
      scan.unreadable.push(`${file} — hand-rolled table ${name} no longer resolves`);
      continue;
    }
    const label = `${name} (${file})`;
    tables.push(label);
    scanObjectLiteral(literal, label, scan);
  }

  return { ...scan, tables, needle: needle.sort() };
}

const TABLE_SCAN = scanDefaultsTables();

/* ------------------------------------------------------------------ */
/* The cases                                                           */
/* ------------------------------------------------------------------ */

describe('the fallback only ever meets placeholders it can resolve (objectui#3512)', () => {
  describe('the locale packs', () => {
    it('the walk reaches real copy — not an empty assertion', () => {
      // Non-vacuity, #4118 family standard. Every assertion below is "no value
      // violates", which a broken walk satisfies trivially. Floors, not pins.
      expect(LOCALE_CODES).toHaveLength(10);
      const total = [...PACK_LEAVES.values()].reduce((n, list) => n + list.length, 0);
      expect(total).toBeGreaterThan(20_000);
      for (const code of LOCALE_CODES) {
        expect(PACK_LEAVES.get(code)!.length, `${code} contributed no strings`).toBeGreaterThan(
          1_000,
        );
      }
    });

    it('the scanner sees placeholders at all — the positive control', () => {
      // The zero-violation assertions below are only meaningful if the scanner
      // finds the placeholders that DO exist. Same reasoning as the parity
      // suite's `EN.size > 2000` guard: a regex that matched nothing would make
      // this file green while asserting nothing whatsoever.
      const spellings = new Set<string>();
      for (const { value } of PACK_LEAVES.get('en')!) {
        for (const region of value.matchAll(DOUBLE_BRACE)) spellings.add(region[0]);
      }
      expect(spellings.size).toBeGreaterThan(50);
      expect(spellings).toContain('{{count}}');
      expect(spellings).toContain('{{name}}');
      // …and every one of them is canonical, which is the rule restated over
      // the set the control just proved is non-empty.
      expect([...spellings].filter((s) => placeholderViolations(s).length > 0)).toEqual([]);
    });

    it.each(LOCALE_CODES)('%s uses only placeholders the fallback resolves', (code) => {
      const violations = PACK_LEAVES.get(code)!.flatMap(({ key, value }) =>
        placeholderViolations(value).map(
          (why) => `${code} pack, ${key} = ${JSON.stringify(value)}\n    ${why}`,
        ),
      );
      expect(violations, `${code}: ${violations.length} placeholder spelling violation(s)`).toEqual(
        [],
      );
    });
  });

  describe('the defaults tables', () => {
    it('discovers every table — not an empty assertion', () => {
      // The discovery is structural (first argument of the factory + the
      // hand-rolled registry), so these are floors that a new table raises for
      // free; only a table DISAPPEARING has to be explained.
      expect(TABLE_SCAN.tables.length).toBeGreaterThanOrEqual(34);
      expect(TABLE_SCAN.rows.length).toBeGreaterThanOrEqual(700);
      expect(SOURCE_FILES.length).toBeGreaterThan(1_000);
      // Every discovered table resolved to a literal and every row to a string.
      // A table the scanner cannot read is a hole in the gate, reported here
      // rather than skipped in silence.
      expect(TABLE_SCAN.unreadable).toEqual([]);
    });

    it('covers the three hand-rolled interpolators, and no fourth exists', () => {
      // The registry above is a list, and lists rot. This pins the fact that
      // makes it complete: exactly these files re-implement the literal needle.
      // A new copy of `fallbackT` fails here, naming itself, instead of serving
      // an ungated table.
      expect(TABLE_SCAN.needle).toEqual(NEEDLE_FILES);
      for (const { name, file } of HAND_ROLLED_TABLES) {
        const rows = TABLE_SCAN.rows.filter((row) => row.table === `${name} (${file})`);
        expect(rows.length, `${name} contributed no rows`).toBeGreaterThan(0);
      }
    });

    it('every table row uses only placeholders the fallback resolves', () => {
      // THE gate for surfaces 2 and 3. This is the path that actually renders
      // without a provider, so a violation here is the user-visible one.
      const violations = TABLE_SCAN.rows.flatMap(({ table, where, key, value }) =>
        placeholderViolations(value).map(
          (why) => `${where}  ${key} = ${JSON.stringify(value)}\n    in ${table}\n    ${why}`,
        ),
      );
      expect(
        violations,
        `${violations.length} placeholder spelling violation(s) in the defaults tables`,
      ).toEqual([]);
    });
  });

  describe('the rule does not over-reach (objectui#4135)', () => {
    it('leaves single-brace holes alone', () => {
      // #4135: `{x}` is a hole filled downstream of `t()`. Flagging it would
      // invert the ruling this gate exists to enforce. Both a synthetic case and
      // the real row that motivated the exception.
      expect(placeholderViolations('Showing {shown} / {total} tasks')).toEqual([]);
      expect(placeholderViolations('{count}')).toEqual([]);
      expect(placeholderViolations('Rendered {2} of {n}')).toEqual([]);

      const real = PACK_LEAVES.get('en')!.find(
        ({ key }) => key === 'gantt.quickFilter.resultSummary',
      );
      // Positive control: the exempt row is genuinely IN the scanned set and
      // genuinely single-braced, so its green verdict is the rule declining to
      // fire — not the row having quietly left the corpus.
      expect(real?.value, 'the single-brace control row left the en pack').toContain('{shown}');
      expect(real?.value).not.toContain('{{');
      expect(placeholderViolations(real!.value)).toEqual([]);
    });

    it('leaves JSX object-literal braces out of range by construction', () => {
      // The known false-positive class from three triage rounds: `style={{ … }}`
      // and `context={{ org }}` are TSX syntax, never copy. They are excluded by
      // WHERE the scanner looks — inside string values of a copy table — so the
      // proof is that no scanned row is a JSX brace, not an allow-list.
      const jsxLike = TABLE_SCAN.rows.filter(
        ({ value }) => value.includes('style={{') || value.includes('={{'),
      );
      expect(jsxLike.map((row) => `${row.where} ${row.key}`)).toEqual([]);
      // And the packs never carry a JSX-shaped string either.
      const packJsx = [...PACK_LEAVES.values()]
        .flat()
        .filter(({ value }) => value.includes('={{'));
      expect(packJsx.map(({ key }) => key)).toEqual([]);
    });

    it('does fire on each of the four i18next-only spellings', () => {
      // The rule's own unit coverage, so the corpus cases above cannot be the
      // only evidence it works. One case per divergence the card measured.
      expect(placeholderViolations('Hello {{ name }}')).toHaveLength(1);
      expect(placeholderViolations('Hello {{ name }}')[0]).toContain('whitespace');
      expect(placeholderViolations('Total {{count, number}}')).toHaveLength(1);
      expect(placeholderViolations('Total {{count, number}}')[0]).toContain('format spec');
      expect(placeholderViolations('Hi {{- name}}')).toHaveLength(1);
      expect(placeholderViolations('Hi {{- name}}')[0]).toContain('unescape prefix');
      expect(placeholderViolations('A $t(otherKey)')).toHaveLength(1);
      expect(placeholderViolations('A $t(otherKey)')[0]).toContain('nesting');
      // …and the canonical spelling, which every one of them is a deviation from.
      expect(placeholderViolations('Hello {{name}}, {{name}}')).toEqual([]);
      expect(placeholderViolations('Deleted {{count}} of {{total}}')).toEqual([]);
      // Structural leftovers the regions cannot report on their own.
      expect(placeholderViolations('Hello {{name')).toHaveLength(1);
      expect(placeholderViolations('Hello {{name')[0]).toContain('unterminated');
    });
  });
});
