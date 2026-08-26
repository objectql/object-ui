// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `ObjectViewSchema`'s `table` and `form` slots SHIP the members they promise,
 * and their key lists cannot drift from the source schemas (objectui#6269).
 *
 * ## The defect
 *
 * The two slots were declared by deriving from the schema they document:
 *
 *   table?: Partial<Omit<ObjectGridSchema, 'type' | 'objectName'>>;
 *   form?:  Partial<Omit<ObjectFormSchema, 'type' | 'objectName' | 'mode'>>;
 *
 * Both derived types declared ZERO properties. `Omit<T, K>` is
 * `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type carrying a string
 * index signature is `string | number` — the literal member names are ABSORBED.
 * `ObjectGridSchema` and `ObjectFormSchema` both inherit `BaseSchema`'s
 * `[key: string]: any` (objectui#5155), so each `Pick` rebuilt a type holding
 * the index signature and none of the named members. Measured through the
 * checker before the fix:
 *
 *   ObjectGridSchema                                              -> 61 members
 *   Omit<ObjectGridSchema, 'type' | 'objectName'>                 ->  0 members
 *   ObjectFormSchema                                              -> 67 members
 *   Omit<ObjectFormSchema, 'type' | 'objectName' | 'mode'>        ->  0 members
 *
 * ⚠️ Those two member counts are the HISTORICAL reading that produced this
 * pin, kept verbatim because the `-> 0` half is only legible beside them. The
 * LIVE counts are 62 and 68: objectui#6357 declared `bind` on `BaseSchema`,
 * both schemas inherit it, and this guard turned red naming them — which is
 * precisely the drift it exists to catch. The key was added to both slot
 * unions in the same change, so the slots still ship the full configuration.
 *
 * Nothing errored — the index signature answers every key as `any` — so the
 * symptoms were in the tools that READ the declaration: `table: { colunms: 3 }`
 * type-checked, `table: { pageSize: 'ten' }` type-checked, and editor completion
 * inside `table: { … }` offered nothing at all for a slot documented as
 * "inherits from ObjectGridSchema".
 *
 * This is objectui#6151's collapse in PROPERTY position. #6151's guard
 * (`stack-schema-emitted-members.test.ts`) walks the `LayoutSchema` UNION; these
 * two are properties on `ObjectViewSchema`, not union members, so that walker
 * cannot see them. Hence a second pin rather than an extension of the first.
 *
 * ## The repair, and the hazard it introduces
 *
 * Each `Omit` became a `Partial<Pick<…, ExplicitKeyUnion>>`. `Pick` with
 * LITERAL keys never computes `keyof T`, so it cannot collapse. The cost is a
 * hand-written key list that silently drifts the moment a member is added to
 * the source schema — a member that exists on `ObjectGridSchema` but is missing
 * from `ObjectGridSlotKey` is simply not configurable through the slot, and
 * nothing says so.
 *
 * ⭐ Neutralising that drift is what this file is for. It recomputes each source
 * schema's declared members THROUGH THE CHECKER — the same instrument that
 * produced the 61 -> 0 measurement — and requires the slot's member set to
 * equal exactly "source members minus the identity keys the view fixes". A
 * member added to `ObjectGridSchema` and not to the key list turns this red.
 *
 * ## Why it emits its own declarations instead of reading `dist/`
 *
 * This repo's per-PR `test` job runs `pnpm test` with NO build ahead of it
 * (turbo's `test` task only `dependsOn: ["^build"]` — the DEPENDENCY closure,
 * never the package's own build), and `packages/types` has no workspace
 * dependencies, so nothing builds it. A guard reading `dist/objectql.d.ts`
 * would be absent-or-stale on a cold CI cache — vacuous exactly where it is
 * needed. So this file runs the package's OWN tsconfig through the compiler API
 * and measures the emitted declaration: the artifact a consumer resolves,
 * derived deterministically and with no dependence on CI job ordering. Same
 * reasoning as `stack-schema-emitted-members.test.ts` and
 * `package-exports-manifest.test.ts`.
 *
 * ## 🗑️ Removal condition (recorded at triage's request)
 *
 * These `Pick` lists exist ONLY because `BaseSchema` carries a root string index
 * signature. When an objectui#5155 phase removes it, `keyof ObjectGridSchema`
 * becomes the literal member union again, `Omit` stops collapsing, and
 * `ObjectGridSlotKey` / `ObjectFormSlotKey` — together with this whole file —
 * become removable in favour of the original `Omit` form. `declaresStringIndex`
 * below is the tripwire that will notice: when it reports `false` for the source
 * schemas, the mechanism this file guards is gone.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The identity keys each slot deliberately withholds — the view fixes them. */
const TABLE_IDENTITY_KEYS = ['type', 'objectName'] as const;
const FORM_IDENTITY_KEYS = ['type', 'objectName', 'mode'] as const;

/**
 * Emit declarations with the package's OWN build settings, into a scratch dir
 * under `node_modules/` — which is gitignored, and from which Node's module
 * resolution still walks up to `packages/types/node_modules`, so the emitted
 * `import type … from '@objectstack/spec/ui'` still resolves.
 */
function emitDeclarations(): { dir: string; objectql: string } {
  const configPath = join(packageRoot, 'tsconfig.json');
  const readConfig = ts.readConfigFile(configPath, ts.sys.readFile);
  if (readConfig.error) {
    throw new Error(ts.flattenDiagnosticMessageText(readConfig.error.messageText, '\n'));
  }
  const parsed = ts.parseJsonConfigFileContent(readConfig.config, ts.sys, packageRoot);

  const dir = mkdtempSync(join(packageRoot, 'node_modules', '.view-slot-pin-'));
  const program = ts.createProgram([join(packageRoot, 'src', 'objectql.ts')], {
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
  const objectql = join(dir, 'objectql.d.ts');
  if (!existsSync(objectql)) {
    const diagnostics = [...emitted.diagnostics, ...program.getSemanticDiagnostics()]
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
      .slice(0, 10);
    throw new Error(`declaration emit produced no objectql.d.ts:\n${diagnostics.join('\n')}`);
  }
  return { dir, objectql };
}

const { dir: scratchDir, objectql: emittedObjectql } = emitDeclarations();
afterAll(() => rmSync(scratchDir, { recursive: true, force: true }));

const program = ts.createProgram([emittedObjectql], {
  noEmit: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
});
const checker = program.getTypeChecker();

function exportedType(name: string): ts.Type {
  const sourceFile = program.getSourceFile(emittedObjectql);
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error(`no module symbol for ${emittedObjectql}`);
  const symbol = checker
    .getExportsOfModule(moduleSymbol)
    .find((s) => s.getName() === name);
  if (!symbol) throw new Error(`${name} is not exported from the emitted objectql.d.ts`);
  return checker.getDeclaredTypeOfSymbol(symbol);
}

const memberNames = (type: ts.Type): string[] =>
  checker.getPropertiesOfType(type).map((p) => p.getName()).sort();

const declaresStringIndex = (type: ts.Type): boolean =>
  checker.getIndexInfoOfType(type, ts.IndexKind.String) !== undefined;

/** The type of one `ObjectViewSchema` slot, with `undefined` stripped. */
function slotType(slot: 'table' | 'form'): ts.Type {
  const view = exportedType('ObjectViewSchema');
  const property = checker.getPropertyOfType(view, slot);
  if (!property) throw new Error(`ObjectViewSchema declares no \`${slot}\` member`);
  return checker.getNonNullableType(checker.getTypeOfSymbol(property));
}

/* ── 1. Degenerate control — the SOURCE schemas still declare their members ── */

/**
 * ⚠️ Load-bearing. Section 2 compares the slot against the source schema; if
 * BOTH collapsed to zero the comparison would pass over two empty sets. These
 * numbers are what makes that impossible. They are re-derived here, not
 * inherited: bump them deliberately when a member is genuinely added.
 */
describe('the source schemas still declare their full member sets', () => {
  it('ObjectGridSchema declares 62 members and carries the #5155 index signature', () => {
    const grid = exportedType('ObjectGridSchema');
    expect(memberNames(grid)).toHaveLength(62);
    expect(memberNames(grid)).toEqual(expect.arrayContaining(['columns', 'pageSize', 'rowActions']));
    // When this flips to `false`, objectui#5155 has removed the root index
    // signature and the `Pick` lists this file pins become removable.
    expect(declaresStringIndex(grid)).toBe(true);
  });

  it('ObjectFormSchema declares 68 members and carries the #5155 index signature', () => {
    const form = exportedType('ObjectFormSchema');
    expect(memberNames(form)).toHaveLength(68);
    expect(memberNames(form)).toEqual(expect.arrayContaining(['fields', 'sections', 'submitText']));
    expect(declaresStringIndex(form)).toBe(true);
  });
});

/* ── 2. The measurement — the key lists equal members-minus-identity-keys ─── */

describe.each([
  { slot: 'table' as const, source: 'ObjectGridSchema', identity: TABLE_IDENTITY_KEYS },
  { slot: 'form' as const, source: 'ObjectFormSchema', identity: FORM_IDENTITY_KEYS },
])('ObjectViewSchema.$slot ships $source’s configuration (objectui#6269)', ({ slot, source, identity }) => {
  it('declares EXACTLY the source members minus the identity keys the view fixes', () => {
    // Before the fix this read `[]` against 59 (table) / 64 (form).
    // Set equality, not a spot check: it fails when the slot collapses again,
    // AND when a member is added to the source schema without being added to
    // the key list (the duplicate-list hazard this pin exists to neutralise).
    const expected = memberNames(exportedType(source)).filter(
      (k) => !(identity as readonly string[]).includes(k),
    );
    expect(memberNames(slotType(slot))).toEqual(expected);
  });

  it('withholds the identity keys the view already fixes', () => {
    const declared = memberNames(slotType(slot));
    for (const key of identity) expect(declared).not.toContain(key);
  });

  it('declares NO string index signature — that is what re-opens the defect', () => {
    // A `[key: string]: any` here would make every assertion above cosmetic:
    // excess-property checks on `table: { … }` literals would stop firing and
    // typos would be accepted again, exactly as before the fix.
    expect(declaresStringIndex(slotType(slot))).toBe(false);
  });

  it('keeps every member optional (the `Partial` wrapper survived)', () => {
    const required = checker
      .getPropertiesOfType(slotType(slot))
      .filter((p) => (p.getFlags() & ts.SymbolFlags.Optional) === 0)
      .map((p) => p.getName());
    expect(required).toEqual([]);
  });
});

/* ── 3. Spot checks — the members an author actually reaches for ─────────── */

describe('the slots offer the members their doc comments promise', () => {
  it.each(['columns', 'pageSize', 'rowActions', 'selectable', 'sort', 'className'])(
    'table declares `%s` as a named member, not merely via an index signature',
    (member) => {
      expect(memberNames(slotType('table'))).toContain(member);
    },
  );

  it.each(['fields', 'sections', 'layout', 'submitText', 'readOnly', 'className'])(
    'form declares `%s` as a named member, not merely via an index signature',
    (member) => {
      expect(memberNames(slotType('form'))).toContain(member);
    },
  );
});
