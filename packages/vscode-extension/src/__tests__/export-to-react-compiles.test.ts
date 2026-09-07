/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7862 — COMPILES the file the `Export to React` command hands a user,
 * rather than reading substrings out of the generator that writes it.
 *
 * WHY A COMPILE AND NOT A SECOND SOURCE-TEXT PIN. The sibling pin
 * (`export-to-react-preamble.test.ts`, objectui#7837) asserts that named
 * strings are present or absent in the template. That instrument can only ever
 * catch the defects someone already thought to name: it was green for the whole
 * life of `import React from 'react'`, a line it never mentions, and it would be
 * green for the next line added to the preamble too. The preamble lives inside a
 * TEMPLATE LITERAL, so this package's `tsc --noEmit` sees one string, `tsup`
 * copies it through, and no doc gate's scan surface reaches this file. Compiling
 * the product closes the whole class instead of one member of it: any preamble
 * line that does not type-check — an unused binding, a syntax error, a JSX shape
 * the renderer does not accept — fails here without anyone having predicted it.
 *
 * THE DEFECT THIS WAS BUILT FOR. `generateReactComponent()` opened every file
 * with `import React from 'react'` while the only JSX in the file is one
 * SchemaRenderer element. Under the automatic runtime (`"jsx": "react-jsx"`,
 * what a new Vite or Next project is configured with) the identifier is never
 * read, so a consumer compiling with `noUnusedLocals: true` got
 * `TS6133: 'React' is declared but its value is never read` on the file the
 * command had just handed them.
 *
 * WHY THE MODULE STUBS ARE HERMETIC, NOT THE REAL `dist/index.d.ts`. The card
 * took its readings against the built declarations of `@object-ui/react` and
 * `@object-ui/components`. A TEST cannot: `.github/workflows/ci.yml` runs the
 * test job as `pnpm install --frozen-lockfile` followed by `pnpm test`, with no
 * build step between them, so both `dist/` trees are ABSENT there. Resolving to
 * them would make this file emit a TS2307 storm in CI — a red test that reports
 * a missing build rather than a defect in the template, which is the worst kind
 * of pin. The property under test is a property of the emitted TEXT — does the
 * preamble declare a binding no line of the file reads — and that is decided by
 * the compiler with any declaration for those specifiers. Import SHAPE against
 * the real packages stays the sibling pin's job; the two are complementary.
 *
 * WHY THE EXTRACTION IS DUPLICATED FROM THE SIBLING PIN. A shared helper would
 * have to be a non-`.test.ts` file under `src/`: `tsconfig.test.json` includes
 * only the `.test.ts` files under `src/`, so the helper would go unchecked,
 * while `tsconfig.json` excludes only those same files, so it WOULD land in the
 * build program and ship inside the `.vsix`. Twenty duplicated lines cost less.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const EXTENSION_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../extension.ts'),
  'utf8'
);

/** The one interpolation `generateReactComponent()` performs. */
const INTERPOLATION = '${schemaJson}';

/** A schema shaped like the `empty` template the extension itself ships. */
const SAMPLE_SCHEMA = JSON.stringify(
  {
    type: 'div',
    className: 'p-4',
    body: { type: 'text', content: 'Hello Object UI!' },
  },
  null,
  2
);

/**
 * The exact text a user receives — the template literal's body with the schema
 * interpolated, i.e. the PRODUCT, not the generator.
 *
 * Every failure mode throws with "this pin needs rewriting, not deleting": if
 * the generator is refactored, the pin has to be pointed at the new shape, and
 * an assertion that silently stops reading the real thing is exactly the
 * failure this file exists to stop.
 */
function generatedFile(): string {
  const fn = EXTENSION_SRC.indexOf('function generateReactComponent');
  if (fn < 0) {
    throw new Error(
      'generateReactComponent() is gone from extension.ts — this pin needs rewriting, not deleting.'
    );
  }
  const open = EXTENSION_SRC.indexOf('return `', fn);
  if (open < 0) {
    throw new Error(
      'generateReactComponent() no longer returns a template literal — this pin needs rewriting, not deleting.'
    );
  }
  const start = open + 'return `'.length;
  const close = EXTENSION_SRC.indexOf('`;', start);
  if (close < 0) {
    throw new Error(
      'unterminated template literal in generateReactComponent() — this pin needs rewriting, not deleting.'
    );
  }
  const template = EXTENSION_SRC.slice(start, close);

  // A backslash escape means the source text and the evaluated product differ,
  // and this extractor would compile something the user never receives. Refuse
  // rather than guess.
  if (template.includes('\\')) {
    throw new Error(
      'the template literal now contains a backslash escape, so slicing the source no longer yields the emitted text — this pin needs rewriting, not deleting.'
    );
  }
  const interpolations = template.match(/\$\{[^}]*\}/g) ?? [];
  if (interpolations.length !== 1 || interpolations[0] !== INTERPOLATION) {
    throw new Error(
      `expected exactly one ${INTERPOLATION} interpolation, found ${JSON.stringify(interpolations)} — this pin needs rewriting, not deleting.`
    );
  }
  return template.replace(INTERPOLATION, SAMPLE_SCHEMA);
}

/**
 * Minimal declarations for the four specifiers the generated file names. See
 * the header: the real `dist/` trees do not exist in the CI job that runs this.
 */
const STUB_DECLARATIONS = `
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element { readonly __brand: unique symbol }
    interface ElementAttributesProperty { props: object }
    interface ElementChildrenAttribute { children: object }
    interface IntrinsicElements { [name: string]: Record<string, unknown> }
  }
  export const Fragment: unknown;
  export function jsx(type: unknown, props: unknown, key?: unknown): JSX.Element;
  export function jsxs(type: unknown, props: unknown, key?: unknown): JSX.Element;
}
declare module 'react' {
  const React: { createElement(...args: unknown[]): unknown };
  export default React;
}
declare module '@object-ui/react' {
  import type { JSX } from 'react/jsx-runtime';
  export function SchemaRenderer(props: { schema: unknown }): JSX.Element;
}
declare module '@object-ui/components' {}
`;

const GENERATED_PATH = '/objectui-7862/Generated.tsx';
const STUB_PATH = '/objectui-7862/stubs.d.ts';

/** Compile one candidate file and return its diagnostics, formatted. */
function compile(source: string, overrides: ts.CompilerOptions = {}): string[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2020.d.ts'],
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    // The two options this pin exists for: a preamble line nothing reads is
    // exactly what `noUnusedLocals` reports, and it is the setting the card's
    // consumer had on.
    noUnusedLocals: true,
    noUnusedParameters: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    ...overrides,
  };

  const virtual = new Map<string, string>([
    [GENERATED_PATH, source],
    [STUB_PATH, STUB_DECLARATIONS],
  ]);
  const read = (fileName: string): string | undefined =>
    virtual.get(fileName) ??
    (existsSync(fileName) ? readFileSync(fileName, 'utf8') : undefined);

  const libDirectory = dirname(ts.getDefaultLibFilePath(options));
  const host: ts.CompilerHost = {
    fileExists: (fileName) => virtual.has(fileName) || existsSync(fileName),
    readFile: read,
    getSourceFile: (fileName, languageVersion) => {
      const text = read(fileName);
      return text === undefined
        ? undefined
        : ts.createSourceFile(fileName, text, languageVersion, true);
    },
    getDefaultLibFileName: () => join(libDirectory, 'lib.es2020.d.ts'),
    getDefaultLibLocation: () => libDirectory,
    writeFile: () => undefined,
    getCurrentDirectory: () => '/objectui-7862',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };

  const program = ts.createProgram([STUB_PATH, GENERATED_PATH], options, host);
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    if (diagnostic.file && diagnostic.start !== undefined) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      return `${diagnostic.file.fileName}(${line + 1},${character + 1}): error TS${diagnostic.code}: ${message}`;
    }
    return `error TS${diagnostic.code}: ${message}`;
  });
}

describe('Export to React — the file the command hands the user (objectui#7862)', () => {
  it('compiles clean under the automatic JSX runtime with noUnusedLocals', () => {
    // The whole point: an assertion on the PRODUCT, so a preamble line nobody
    // predicted still has to type-check.
    expect(compile(generatedFile())).toEqual([]);
  });

  it('is a harness that can fail — putting the import back reports TS6133', () => {
    // The positive control, executed on every run rather than once by hand: if
    // the stubs, options or host ever stop reaching the compiler, THIS goes red
    // instead of the pin above going quietly, permanently green.
    const withUnusedImport = `import React from 'react';\n${generatedFile()}`;
    const diagnostics = compile(withUnusedImport);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain(
      "error TS6133: 'React' is declared but its value is never read."
    );
  });

  it('records the cost of dropping the import: the classic transform needs it back', () => {
    // objectui#7862 chose the automatic runtime deliberately. This is what the
    // choice costs the classic `"jsx": "react"` transform, kept measurable so a
    // future reversal argues with a reading rather than a recollection.
    //
    // The assertion is on the SUBSTANCE — one diagnostic, about `React` — and
    // not on a code, because the code depends on what declares `react`. Both
    // were measured on this branch under TypeScript 6.0.3: against the real
    // `@types/react`, whose UMD global declaration is in scope, it is
    // `TS2686: 'React' refers to a UMD global, but the current file is a
    // module`; against the hermetic stubs above, which declare no UMD global,
    // it is `TS2874: This JSX tag requires 'React' to be in scope, but it could
    // not be found`. Pinning either code here would pin the stub, not the fact.
    const diagnostics = compile(generatedFile(), { jsx: ts.JsxEmit.React });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain("'React'");
  });
});
