// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `PartialSchema<T>` declares ONE property for every instantiation — pinned, not
 * repaired (objectui#6397).
 *
 * ## What this file asserts, and why it is a PIN rather than a fix
 *
 * `packages/types/src/index.ts` exports:
 *
 *   export type PartialSchema<T extends BaseSchema> = {
 *     type: T['type'];
 *   } & Partial<Omit<T, 'type'>>;
 *
 * Its doc comment promises "all properties optional except the type". It does
 * not deliver that. Every instantiation declares exactly ONE property — `type`
 * — and carries a live `[key: string]: any`, so it accepts anything. Measured
 * through the checker against the emitted `index.d.ts`, the same instrument
 * that produced objectui#6269's 61 -> 0 reading:
 *
 *   PartialSchema<ObjectGridSchema>  -> 1 declared property: type   (source: 61)
 *   PartialSchema<ObjectFormSchema>  -> 1 declared property: type   (source: 67)
 *   PartialSchema<ObjectViewSchema>  -> 1 declared property: type   (source: 42)
 *   PartialSchema<ButtonSchema>      -> 1 declared property: type   (source: 27)
 *
 * ## The mechanism — objectui#6151 / #6269, third position
 *
 * `Omit<T, K>` is `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type
 * carrying a string index signature is `string | number` — the literal member
 * names are ABSORBED. Every `T extends BaseSchema` inherits `BaseSchema`'s
 * `[key: string]: any` (objectui#5155), so `Partial<Omit<T, 'type'>>` rebuilds a
 * type holding the index signature and none of the named members. The explicit
 * `{ type: T['type'] }` half of the intersection is the only reason the count is
 * 1 and not 0.
 *
 * objectui#6151 fixed this collapse in a HERITAGE clause and #6269 fixed it in
 * PROPERTY position. Neither of their guards can see this one: #6151's walks the
 * `LayoutSchema` union, #6269's reads `ObjectViewSchema`'s two slot properties,
 * and this is a GENERIC MAPPED-TYPE ALIAS with no union membership and no
 * declaring property. Hence a third pin.
 *
 * ## Why a pin and not a repair
 *
 * ⛔ Do not "fix" the declaration here, and do not tag it `@deprecated`. Triage
 * ruled (objectui#6397, 2026-08-25 re-judgement):
 *
 *   - Retiring the alias is a REMOVAL OF A PUBLISHED EXPORT of
 *     `@object-ui/types` — a breaking removal of published capability, which
 *     sits on the human floor. Not a dev's call, and not this file's business.
 *   - Repairing it in place is not available: `T` is generic, so there is no
 *     literal key list to `Pick` (the escape #6269 used for its two concrete
 *     schemas), and every generic re-spelling —
 *     `{ [K in keyof T as K extends 'type' ? never : K]?: T[K] }` included —
 *     collapses for the same `keyof T` reason.
 *   - Once objectui#5155 removes the root index signature, the alias starts
 *     working AS WRITTEN with no edit at all, and the removal question
 *     dissolves.
 *
 * So the one state that must not survive is "declared, published, collapsed,
 * and UNPINNED" — a published type that promises
 * `{ type } & everything-else-optional` and delivers `{ type } & any`, ready for
 * the next consumer to adopt as protection it does not provide. This file is
 * what removes the "unpinned".
 *
 * ## 🗑️ Removal condition — the objectui#5155 sequencing note
 *
 * ⭐ THIS FILE IS EXPECTED TO GO RED WHEN objectui#5155 LANDS. That is the
 * point, not a regression. When a #5155 phase drops `[key: string]: any` from
 * `BaseSchema`, `keyof T` becomes the literal member union again, `Omit` stops
 * absorbing names, and `PartialSchema<ObjectGridSchema>` jumps from 1 declared
 * property to 61. Section 3's tripwire (`BaseSchema` still declares a string
 * index) is the flag that says which side of that transition you are on.
 *
 * The correct response to that red is NOT to loosen these assertions. It is to
 * delete this file and, if `PartialSchema` is still unconsumed at that point,
 * file a fresh enforce-or-remove card for the maintainer — removal of a
 * published export stays on the human floor either way.
 *
 * ## Why it emits its own declarations instead of reading `dist/`
 *
 * This repo's per-PR `test` job runs `pnpm test` with NO build ahead of it
 * (turbo's `test` task only `dependsOn: ["^build"]` — the DEPENDENCY closure,
 * never the package's own build), and `packages/types` has no workspace
 * dependencies, so nothing builds it. A guard reading `dist/index.d.ts` would be
 * absent-or-stale on a cold CI cache — vacuous exactly where it is needed. So
 * this file runs the package's OWN tsconfig through the compiler API and
 * measures the emitted declaration: the artifact a consumer resolves, derived
 * deterministically and with no dependence on CI job ordering. Same reasoning as
 * `stack-schema-emitted-members.test.ts`, `object-view-slot-key-lists.test.ts`
 * and `package-exports-manifest.test.ts`.
 *
 * ## Census (objectui#6397, re-run on this branch)
 *
 * `PartialSchema` has ZERO in-repo instantiations. A grep across `packages/`,
 * `apps/`, `examples/`, `content/`, `docs/` and `scripts/` (excluding
 * `node_modules` and `dist`) finds exactly ONE occurrence of the identifier: the
 * declaration itself at `packages/types/src/index.ts`. There is no call site to
 * pin against, so the four types measured below are chosen deliberately — they
 * are the four the card itself measured, they are real published schemas from
 * four different modules of this package (`objectql`, `objectql`, `objectql`,
 * `base`-derived form/action families), and they are exactly the population an
 * "editor partial schema" alias would be pointed at. The synthetic type appears
 * only in section 1, where it is the CONTROL, never the subject.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Emit declarations with the package's OWN build settings, into a scratch dir
 * under `node_modules/` — which is gitignored, and from which Node's module
 * resolution still walks up to `packages/types/node_modules`, so the emitted
 * `import type … from '@objectstack/spec/ui'` still resolves.
 */
function emitDeclarations(): { dir: string; index: string } {
  const configPath = join(packageRoot, 'tsconfig.json');
  const readConfig = ts.readConfigFile(configPath, ts.sys.readFile);
  if (readConfig.error) {
    throw new Error(ts.flattenDiagnosticMessageText(readConfig.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(readConfig.config, ts.sys, packageRoot);

  const dir = mkdtempSync(join(packageRoot, 'node_modules', '.partial-schema-pin-'));
  const program = ts.createProgram([join(packageRoot, 'src', 'index.ts')], {
    ...parsed.options,
    outDir: dir,
    declaration: true,
    emitDeclarationOnly: true,
    declarationMap: false,
    noEmit: false,
    // The real build is `composite`/incremental; neither is meaningful for a
    // one-shot emit into a scratch dir, and both would write build info next to
    // the package's real artifacts.
    composite: false,
    incremental: false,
    tsBuildInfoFile: undefined,
  });
  const emitted = program.emit();
  const index = join(dir, 'index.d.ts');
  if (!existsSync(index)) {
    const diagnostics = [...emitted.diagnostics, ...program.getSemanticDiagnostics()]
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .slice(0, 10);
    throw new Error(`declaration emit produced no index.d.ts:\n${diagnostics.join('\n')}`);
  }
  return { dir, index };
}

const { dir: scratchDir, index: emittedIndex } = emitDeclarations();
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

/**
 * `PartialSchema` is a GENERIC alias: there is nothing to measure until it is
 * instantiated, and this repo instantiates it nowhere (see the census above).
 * So the probe below is where the instantiations are made — a source file
 * written NEXT TO the emitted `index.d.ts`, resolving `./index` to it, so every
 * type read here is read out of the artifact a consumer would resolve.
 *
 * `IndexFreeSchema` is the CONTROL and only the control: a `T` whose `keyof`
 * resolves to its literal member names because it declares no index signature.
 * It is the shape `PartialSchema`'s author was writing for.
 */
const PROBE_SOURCE = `
import type {
  PartialSchema,
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ButtonSchema,
  BaseSchema,
} from './index';

export type SourceGrid = ObjectGridSchema;
export type SourceForm = ObjectFormSchema;
export type SourceView = ObjectViewSchema;
export type SourceButton = ButtonSchema;
export type SourceBase = BaseSchema;

export type PartialGrid = PartialSchema<ObjectGridSchema>;
export type PartialForm = PartialSchema<ObjectFormSchema>;
export type PartialView = PartialSchema<ObjectViewSchema>;
export type PartialButton = PartialSchema<ButtonSchema>;

/** The control: no index signature, so \`keyof\` resolves to literal names. */
export type IndexFreeSchema = {
  type: 'index_free_control';
  alpha?: number;
  beta?: string;
  gamma?: boolean;
};
export type PartialIndexFree = PartialSchema<IndexFreeSchema>;
`;

const probeFile = join(scratchDir, '__partial-schema-probe.ts');
writeFileSync(probeFile, PROBE_SOURCE, 'utf8');

const program = ts.createProgram([probeFile], {
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
});
const checker = program.getTypeChecker();

function probeExports(): Map<string, ts.Symbol> {
  const sourceFile = program.getSourceFile(probeFile);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error(`no module symbol for ${probeFile}`);
  return new Map(checker.getExportsOfModule(moduleSymbol).map((s) => [s.getName(), s]));
}

function probeType(name: string): ts.Type {
  const symbol = probeExports().get(name);
  if (!symbol) throw new Error(`${name} is not exported from the probe`);
  return checker.getDeclaredTypeOfSymbol(symbol);
}

/** The property names a type DECLARES — not the keys its index signature answers. */
const declaredMembers = (name: string): string[] =>
  checker.getPropertiesOfType(probeType(name)).map((p) => p.getName()).sort();

const declaresStringIndex = (name: string): boolean =>
  checker.getIndexInfoOfType(probeType(name), ts.IndexKind.String) !== undefined;

/* ── 0. Non-vacuity — the probe really resolved the emitted declaration ───── */

/**
 * ⚠️ Load-bearing. Section 2 asserts a ONE-element member set; if the probe had
 * failed to resolve `./index`, or the emit had collapsed, every type here would
 * read as an empty or `any` shape and section 2 would pass over nothing. These
 * are what makes that impossible.
 */
describe('the probe resolved the emitted index.d.ts (guards everything below)', () => {
  it('reports no semantic errors — every import in the probe resolved', () => {
    const errors = program
      .getSemanticDiagnostics(program.getSourceFile(probeFile))
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    expect(errors).toEqual([]);
  });

  it('read the FRESHLY EMITTED index.d.ts, not `dist/` or a node_modules copy', () => {
    // `./index` from the probe must resolve to the scratch emit above. If it
    // ever resolved elsewhere, every number below would describe some other
    // artifact — possibly a stale one — while still looking like a measurement.
    expect(program.getSourceFiles().map((f) => f.fileName)).toContain(emittedIndex);
  });

  it.each([
    { name: 'SourceGrid', min: 20, sample: ['columns', 'pageSize', 'rowActions'] },
    { name: 'SourceForm', min: 20, sample: ['fields', 'sections', 'submitText'] },
    { name: 'SourceView', min: 20, sample: ['objectName', 'table', 'form'] },
    { name: 'SourceButton', min: 20, sample: ['buttonType', 'className', 'type'] },
  ])('$name declares its full member set before any Omit touches it', ({ name, min, sample }) => {
    // Counts at the time of the pin: 61 / 67 / 42 / 27. Asserted as a floor plus
    // named members rather than an exact number, so adding a member to a schema
    // does not have to be re-declared here — the collapse in section 2 is what
    // this file owns, not the census of these schemas (that is #6269's job for
    // grid and form).
    expect(declaredMembers(name).length).toBeGreaterThan(min);
    expect(declaredMembers(name)).toEqual(expect.arrayContaining(sample));
  });
});

/* ── 1. The control — the alias body is fine; the COLLAPSE is about `keyof T` ─ */

/**
 * ⭐ This is the ghost-assertion guard. "Declares exactly `['type']`" would be a
 * decoration if the instrument answered `['type']` for everything, or if
 * `PartialSchema` were incapable of declaring more than one property in any
 * circumstance. It is not: the SAME alias, measured by the SAME checker,
 * declares all four members of a `T` whose `keyof` resolves to literal names.
 *
 * Read the two together and the mechanism is unambiguous:
 *
 *   PartialSchema<IndexFreeSchema>   -> 4 declared, no index signature   (intended)
 *   PartialSchema<ObjectGridSchema>  -> 1 declared, index signature live (actual)
 *
 * That is also exactly what `PartialSchema<ObjectGridSchema>` becomes once
 * objectui#5155 removes `BaseSchema`'s index signature.
 */
describe('the intended reading — `PartialSchema` over an index-signature-free T', () => {
  it('declares `type` PLUS every other member, each optional', () => {
    expect(declaredMembers('PartialIndexFree')).toEqual(['alpha', 'beta', 'gamma', 'type']);
  });

  it('declares no string index signature — excess-property checks still fire', () => {
    expect(declaresStringIndex('PartialIndexFree')).toBe(false);
  });

  it('keeps everything but `type` optional (the `Partial` wrapper did its job)', () => {
    const optional = checker
      .getPropertiesOfType(probeType('PartialIndexFree'))
      .filter((p) => (p.getFlags() & ts.SymbolFlags.Optional) !== 0)
      .map((p) => p.getName())
      .sort();
    expect(optional).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('matches the control type it was derived from, member for member', () => {
    // Same population — so section 2's `['type']` cannot be blamed on the probe.
    expect(declaredMembers('PartialIndexFree')).toEqual(declaredMembers('IndexFreeSchema'));
  });
});

/* ── 2. The measurement — every real instantiation collapses to `type` ────── */

describe.each([
  { alias: 'PartialGrid', source: 'SourceGrid' },
  { alias: 'PartialForm', source: 'SourceForm' },
  { alias: 'PartialView', source: 'SourceView' },
  { alias: 'PartialButton', source: 'SourceButton' },
])('$alias collapses to one declared property (objectui#6397)', ({ alias, source }) => {
  it('declares EXACTLY `["type"]`, against a source that declares 20+ members', () => {
    // ⛔ If this goes red with a LARGER set, objectui#5155 has landed and the
    // alias now works as written — see this file's removal condition. Do not
    // widen the assertion; delete the file.
    expect(declaredMembers(alias)).toEqual(['type']);
    expect(declaredMembers(source).length).toBeGreaterThan(20);
  });

  it('drops every named member the source declared apart from `type`', () => {
    const lost = declaredMembers(source).filter((m) => m !== 'type');
    expect(lost.length).toBeGreaterThan(20);
    for (const member of lost) expect(declaredMembers(alias)).not.toContain(member);
  });

  it('carries a live string index signature — it accepts ANY key, at `any`', () => {
    // This is the second half of the harm and the reason the alias is not
    // protection: nothing errors, because every absent key is answered `any`.
    expect(declaresStringIndex(alias)).toBe(true);
  });

  it('still discriminates on `type` — the intersection’s explicit half survives', () => {
    const typeProp = checker.getPropertyOfType(probeType(alias), 'type');
    expect(typeProp).toBeDefined();
    // A literal type here (not `string`) is why the count is 1 rather than 0.
    expect(checker.typeToString(checker.getTypeOfSymbol(typeProp!))).not.toBe('any');
  });
});

/* ── 3. The objectui#5155 sequencing tripwire ────────────────────────────── */

describe('the collapse is caused by BaseSchema’s root index signature (objectui#5155)', () => {
  it('BaseSchema still declares `[key: string]: any`', () => {
    // When this flips to `false`, objectui#5155 has removed the root index
    // signature: `keyof T` resolves to literal member names again, `Omit` stops
    // absorbing them, `PartialSchema` starts working as written with no edit,
    // and section 2 above inverts. That is the sequencing this card pinned —
    // the response is to DELETE this file, not to relax it, and the retirement
    // question of objectui#6397 becomes a fresh enforce-or-remove card for the
    // maintainer (removal of a published export sits on the human floor).
    expect(declaresStringIndex('SourceBase')).toBe(true);
  });

  it.each(['SourceGrid', 'SourceForm', 'SourceView', 'SourceButton'])(
    '%s inherits that index signature, which is what absorbs its member names',
    (name) => {
      expect(declaresStringIndex(name)).toBe(true);
    },
  );
});
