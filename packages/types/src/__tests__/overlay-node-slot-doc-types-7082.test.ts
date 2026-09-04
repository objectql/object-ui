/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Six component pages name their node slots at the type those keys DECLARE
 * (objectui#7082).
 *
 * ## Why this file exists rather than "the docs gates went green"
 *
 * Every row this pins lives in a `plaintext` fence. `check:doc-snippets`
 * compiles `ts`/`tsx`/`typescript` fences only (`TS_FENCE_LANGUAGES`,
 * `scripts/check-doc-snippet-types.mjs`) and `check:doc-types` reads only the
 * `type` STRING LITERALS out of docs code blocks. So a member row in these
 * fences may name any type at all and every gate stays green -- the blindness
 * objectui#5250 records and objectui#5867 declares the population of. A green
 * CI run on the correction this file accompanies means "nothing else broke",
 * NOT "the correction is right". Same reasoning, and the same shape, as
 * `button-group-doc-surface-6347.test.ts` (PR #7078).
 *
 * ## The authority here is the TS declaration, NOT the Zod mirror
 *
 * That is the one deliberate departure from the #7078 model, and it is load
 * bearing. On this tree the TS interface and its mirror DISAGREE on four
 * `trigger` rows: `AlertDialogSchema`, `SheetSchema`, `HoverCardSchema` and
 * `DropdownMenuSchema` all declare `trigger: SchemaNode` (singular) while
 * `zod/overlay.zod.ts` mirrors each as `z.union([SchemaNodeSchema,
 * z.array(SchemaNodeSchema)])`. That asymmetry is objectui#7081 -- OPEN, a
 * published-type widening awaiting a maintainer decision. Pinning these pages
 * against the mirror would publish the array form on all four and silently
 * pre-empt that ruling, so the pin follows the type an author's editor reads.
 *
 * `DropdownMenuSchema.trigger` therefore stays SINGULAR on the page even
 * though its mirror, its sibling `ContextMenuSchema` and its own shipped
 * `defaultProps` (`renderers/overlay/dropdown-menu.tsx`) all use the array
 * form. The incoherence is real; it IS #7081, and it is recorded below rather
 * than resolved here. The type-level leg makes the boundary mechanical: widen
 * the declaration and `tsc -p tsconfig.test.json` fails, so whoever lands
 * #7081 is told the page owes an update.
 *
 * ## What the pages taught before, measured on `2c3cd1b`
 *
 * Nine rows across six pages spelled a node slot `ComponentSchema`. That was a
 * real shipped export (`blocks.ts`) and it was NOT a node slot -- it was the
 * concrete `type: 'component'` block. A reader who looked the name up found a
 * narrow, unrelated type. Seven of the nine are corrected; the other two are
 * NOT type-name defects at all and are recorded as divergences below, because
 * no honest docs-only edit resolves them.
 *
 * ⚠️ Since objectui#4895 that export is GONE -- the whole block schema family
 * was retired under ADR-0049 (maintainer ruling 2026-09-02, option C1). The
 * correction stands unchanged; only its two type-level premise assertions left,
 * because the type they compared against no longer exists. See the note where
 * they stood.
 *
 * ## Two rows this file records instead of asserting green
 *
 * `AlertDialogSchema.actions` and `EmptySchema.action` are documented but
 * declared NOWHERE -- not on the TS interface, not in the mirror. Renaming
 * either to `SchemaNode` would have swapped one false claim for another, so
 * both keep their rows and are pinned as UNDECLARED. The day either is
 * declared, this file goes red and the page is owed a row.
 *
 * Likewise the requiredness of `AlertDialogSchema.trigger`, `SheetSchema.trigger`
 * and `SheetSchema.content`: all three are declared OPTIONAL and published
 * REQUIRED. That is objectui#7073's defect class, not this card's, and it is
 * fenced out of the diff -- but pinned here so it cannot be lost, and so a fix
 * on either side turns this file red rather than passing unnoticed.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SchemaNode } from '../base';
import type {
  AlertDialogSchema,
  ContextMenuSchema,
  DropdownMenuSchema,
  HoverCardSchema,
  SheetSchema,
} from '../overlay';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/* -- Type-level leg: compiled by `tsc -p packages/types/tsconfig.test.json` -- */

type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** Does this slot admit the ARRAY form? The whole of #7081 in one operator. */
type AdmitsArray<T> = SchemaNode[] extends T ? true : false;

// The seven corrected rows, asserted against the declarations themselves rather
// than against the page text the runtime leg reads.
export type _HoverCardTrigger = Expect<Equals<HoverCardSchema['trigger'], SchemaNode>>;
export type _HoverCardContent = Expect<Equals<HoverCardSchema['content'], SchemaNode | SchemaNode[]>>;
// No `NonNullable` here on purpose: `SchemaNode` ALREADY admits `null |
// undefined`, so stripping them would compare against a type neither side has.
export type _SheetContent = Expect<Equals<SheetSchema['content'], SchemaNode | SchemaNode[]>>;
export type _ContextMenuTrigger = Expect<Equals<ContextMenuSchema['trigger'], SchemaNode | SchemaNode[]>>;

// The #7081 boundary, mechanically. `ContextMenuSchema` admits an array and its
// page says so; `DropdownMenuSchema` refuses one and its page says so too.
export type _ContextMenuAdmitsArray = Expect<Equals<AdmitsArray<ContextMenuSchema['trigger']>, true>>;
export type _DropdownAdmitsArray = Expect<Equals<AdmitsArray<DropdownMenuSchema['trigger']>, false>>;
export type _AlertDialogAdmitsArray = Expect<Equals<AdmitsArray<AlertDialogSchema['trigger']>, false>>;
export type _SheetAdmitsArray = Expect<Equals<AdmitsArray<SheetSchema['trigger']>, false>>;

// The premise the whole correction rests on used to be pinned here as two
// type-level assertions: `ComponentSchema` is a real export, and it is NOT a
// node slot -- a `type: 'component'` block is one SchemaNode among many, never
// the slot type. Both are gone because their SUBJECT is: `ComponentSchema` was
// retired with the whole block schema family in objectui#4895 (ADR-0049
// enforce-or-remove, maintainer ruling 2026-09-02, option C1), so the
// comparison is no longer expressible -- the same shape as the theme
// retirement's note in `phase2-schemas.test.ts`.
//
// The correction this file pins is UNAFFECTED, and in fact strengthened: the
// nine rows that spelled a node slot `ComponentSchema` were wrong because the
// name meant something narrow and unrelated, and now the name means nothing at
// all. `block-family-retired-4895.test.ts` pins it out of the published
// surface; the seven corrected rows below still assert against `SchemaNode`.

/* -- Reading a member row, on both sides -- */

interface Member {
  /** Spelled with a `?`. */
  readonly optional: boolean;
  /** Everything between the colon and the terminating semicolon, trimmed. */
  readonly typeText: string;
}

/** The one `plaintext` fence that carries a page's interface blocks. */
function schemaFence(doc: string, path: string): string {
  const fences = [...doc.matchAll(/```plaintext\n([\s\S]*?)```/g)].map((match) => match[1]);
  if (fences.length !== 1) {
    throw new Error(`expected exactly one \`plaintext\` fence in ${path}, found ${fences.length}`);
  }
  return fences[0];
}

/** The body of one `interface <name> {` block, THROWING when absent. */
function interfaceBody(source: string, opener: string, path: string): string {
  const start = source.indexOf(opener);
  if (start === -1) throw new Error(`no \`${opener}\` block in ${path}`);
  const end = source.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated \`${opener}\` block in ${path}`);
  return source.slice(start + opener.length, end);
}

/**
 * Member rows of an interface body, keyed by name.
 *
 * JSDoc is stripped first: the declaration bodies carry multi-paragraph doc
 * comments, and a `@example` fence inside one holds lines that look exactly
 * like member rows.
 */
function members(body: string): Map<string, Member> {
  const bare = body.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found = new Map<string, Member>();
  for (const match of bare.matchAll(/^ {2}(\w+)(\?)?:\s*([^;]+);/gm)) {
    found.set(match[1], { optional: match[2] === '?', typeText: match[3].trim() });
  }
  return found;
}

/* -- The six subjects -- */

interface Subject {
  readonly name: string;
  readonly docPath: string;
  readonly declPath: string;
}

const SUBJECTS: readonly Subject[] = [
  { name: 'AlertDialogSchema', docPath: 'content/docs/components/overlay/alert-dialog.mdx', declPath: 'packages/types/src/overlay.ts' },
  { name: 'ContextMenuSchema', docPath: 'content/docs/components/overlay/context-menu.mdx', declPath: 'packages/types/src/overlay.ts' },
  { name: 'HoverCardSchema', docPath: 'content/docs/components/overlay/hover-card.mdx', declPath: 'packages/types/src/overlay.ts' },
  { name: 'DropdownMenuSchema', docPath: 'content/docs/components/overlay/dropdown-menu.mdx', declPath: 'packages/types/src/overlay.ts' },
  { name: 'SheetSchema', docPath: 'content/docs/components/overlay/sheet.mdx', declPath: 'packages/types/src/overlay.ts' },
  { name: 'EmptySchema', docPath: 'content/docs/components/feedback/empty.mdx', declPath: 'packages/types/src/feedback.ts' },
];

const documented = new Map<string, Map<string, Member>>();
const declared = new Map<string, Map<string, Member>>();
for (const subject of SUBJECTS) {
  const doc = read(subject.docPath);
  documented.set(
    subject.name,
    members(interfaceBody(schemaFence(doc, subject.docPath), `interface ${subject.name} {`, subject.docPath)),
  );
  declared.set(
    subject.name,
    members(
      interfaceBody(
        read(subject.declPath),
        `export interface ${subject.name} extends BaseSchema {`,
        subject.declPath,
      ),
    ),
  );
}

const docRow = (owner: string, key: string): Member | undefined => documented.get(owner)?.get(key);
const declRow = (owner: string, key: string): Member | undefined => declared.get(owner)?.get(key);

/** The seven rows objectui#7082 corrects: owner, key, and the declared text. */
const CORRECTED: ReadonlyArray<readonly [string, string, string]> = [
  ['AlertDialogSchema', 'trigger', 'SchemaNode'],
  ['ContextMenuSchema', 'trigger', 'SchemaNode | SchemaNode[]'],
  ['HoverCardSchema', 'trigger', 'SchemaNode'],
  ['HoverCardSchema', 'content', 'SchemaNode | SchemaNode[]'],
  ['DropdownMenuSchema', 'trigger', 'SchemaNode'],
  ['SheetSchema', 'trigger', 'SchemaNode'],
  ['SheetSchema', 'content', 'SchemaNode | SchemaNode[]'],
];

describe('six overlay/feedback pages name node slots at the declared type (objectui#7082)', () => {
  it.each(CORRECTED)('%s.%s is published as the declaration spells it', (owner, key, expected) => {
    // Both legs, so neither side can drift alone: the page says `expected`, and
    // `expected` is still what the declaration says.
    expect(docRow(owner, key)?.typeText).toBe(expected);
    expect(declRow(owner, key)?.typeText).toBe(expected);
  });

  it.each(CORRECTED)('%s.%s no longer names `ComponentSchema`', (owner, key) => {
    expect(docRow(owner, key)?.typeText).not.toContain('ComponentSchema');
  });

  it('`ComponentSchema` is no longer a shipped export at all, which is why the old rows were wrong', () => {
    // The original assertion here read `blocks.ts` and proved `ComponentSchema`
    // was a DISTINCT export -- the concrete `type: 'component'` block, not a
    // slot type -- which is what made the nine old rows wrong. objectui#4895
    // retired the whole block schema family, so the same premise is now proved
    // the other way: the name is gone, and `blocks.ts` is a tombstone.
    const blocks = read('packages/types/src/blocks.ts');
    expect(blocks).not.toContain('export interface ComponentSchema');
    expect(blocks).toContain('RETIRED (objectui#4895');
    // Control: the file is still there and still readable, so the absence above
    // is a reading about its CONTENT and not about a failed read.
    expect(blocks).toContain('@module blocks');
    // And `SchemaNode` is the slot type these keys actually carry.
    expect(read('packages/types/src/base.ts')).toContain(
      'export type SchemaNode = BaseSchema | string | number | boolean | null | undefined;',
    );
  });
});

describe('objectui#7081 is NOT pre-empted: the singular rows stay singular (objectui#7082)', () => {
  it('`DropdownMenuSchema.trigger` is declared singular, so the page says singular', () => {
    expect(declRow('DropdownMenuSchema', 'trigger')?.typeText).toBe('SchemaNode');
    expect(docRow('DropdownMenuSchema', 'trigger')?.typeText).toBe('SchemaNode');
  });

  it('its Zod mirror still says otherwise -- the asymmetry #7081 exists to rule on', () => {
    // Recorded, not resolved. When #7081 lands, whichever side moves, one of
    // these two assertions fails and the page is re-derived deliberately.
    const mirror = read('packages/types/src/zod/overlay.zod.ts');
    expect(mirror).toContain(
      "trigger: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).describe('Menu trigger')",
    );
  });

  it('its sibling `ContextMenuSchema` really does declare the union -- the two differ', () => {
    expect(declRow('ContextMenuSchema', 'trigger')?.typeText).not.toBe(
      declRow('DropdownMenuSchema', 'trigger')?.typeText,
    );
  });

  it("the renderer's shipped `defaultProps.trigger` is still an array", () => {
    expect(read('packages/components/src/renderers/overlay/dropdown-menu.tsx')).toMatch(
      /trigger:\s*\[\s*\{\s*type:\s*'button'/,
    );
  });
});

describe('rows a docs-only edit cannot honestly resolve, recorded rather than renamed (objectui#7082)', () => {
  it.each([
    ['AlertDialogSchema', 'actions', 'content/docs/components/overlay/alert-dialog.mdx'],
    ['EmptySchema', 'action', 'content/docs/components/feedback/empty.mdx'],
  ])('%s.%s is documented but declared nowhere', (owner, key) => {
    expect(docRow(owner, key)).toBeDefined();
    expect(declRow(owner, key)).toBeUndefined();
    // Nor in the mirror, which is where a "declared elsewhere" reading would hide.
    const mirrorPath =
      owner === 'EmptySchema' ? 'packages/types/src/zod/feedback.zod.ts' : 'packages/types/src/zod/overlay.zod.ts';
    const mirrorBody = interfaceBody(read(mirrorPath), `export const ${owner} = BaseSchema.extend({`, mirrorPath);
    expect(mirrorBody).not.toMatch(new RegExp(`^\\s*${key}:`, 'm'));
  });

  it('`EmptySchema.action` is nevertheless READ by the shipped renderer, through a cast', () => {
    // Undeclared-but-consumed, the objectui#6150 class. It is also why the row
    // was not renamed to `SchemaNode`: the renderer requires an OBJECT, so
    // `SchemaNode` -- which admits `string | number | boolean` -- would have
    // been a new false claim rather than a correction. The cast named
    // `ComponentSchema` until objectui#4895 retired it; it now names
    // `BaseSchema`, which IS that object half, so the reasoning above is
    // preserved rather than worked around.
    const renderer = read('packages/components/src/renderers/feedback/empty.tsx');
    expect(renderer).toContain("(schema as any).action as BaseSchema | undefined");
    expect(renderer).toContain("typeof actionSchema === 'object'");
  });

  it('`AlertDialogSchema.actions` is read by nothing at all', () => {
    const renderer = read('packages/components/src/renderers/overlay/alert-dialog.tsx');
    expect(renderer).not.toMatch(/schema\.actions/);
    // Control: this IS the renderer, and the scan can find things in it.
    expect(renderer).toContain("ComponentRegistry.register('alert-dialog'");
    expect(renderer).toContain('renderChildren(schema.trigger)');
  });
});

describe('requiredness divergences left to the objectui#7073 class, pinned so they cannot be lost', () => {
  it.each([
    ['AlertDialogSchema', 'trigger'],
    ['SheetSchema', 'trigger'],
    ['SheetSchema', 'content'],
  ])('%s.%s is declared optional and still published required', (owner, key) => {
    expect(declRow(owner, key)?.optional).toBe(true);
    expect(docRow(owner, key)?.optional).toBe(false);
  });

  it('`ContextMenuSchema.trigger` is the one already corrected, by #7073 -- the control', () => {
    expect(declRow('ContextMenuSchema', 'trigger')?.optional).toBe(true);
    expect(docRow('ContextMenuSchema', 'trigger')?.optional).toBe(true);
  });
});

describe('counter-probes: the readers above can still fail (objectui#7082)', () => {
  it('`interfaceBody` throws rather than returning an empty body', () => {
    expect(() => interfaceBody('nothing here', 'export interface SheetSchema extends BaseSchema {', 'x.ts')).toThrow(
      /no `export interface SheetSchema extends BaseSchema \{` block/,
    );
  });

  it('`schemaFence` throws when a page stops holding exactly one fence', () => {
    expect(() => schemaFence('```plaintext\na\n```\n```plaintext\nb\n```\n', 'x.mdx')).toThrow(/found 2/);
  });

  it('the extractors really parsed rows, not empty match sets', () => {
    for (const subject of SUBJECTS) {
      expect(documented.get(subject.name)?.size).toBeGreaterThan(1);
      expect(declared.get(subject.name)?.size).toBeGreaterThan(1);
    }
  });

  it('the pre-fix spelling would be caught', () => {
    const regressed = members('  trigger: ComponentSchema;      // Component that triggers the dialog');
    expect(regressed.get('trigger')?.typeText).toBe('ComponentSchema');
    expect(regressed.get('trigger')?.typeText).not.toBe('SchemaNode');
  });

  it('a blind string replace to the array form would be caught on dropdown-menu', () => {
    // The exact regression the card and #7081 warn about.
    const regressed = members('  trigger: SchemaNode | SchemaNode[];  // Trigger component');
    expect(regressed.get('trigger')?.typeText).not.toBe(declRow('DropdownMenuSchema', 'trigger')?.typeText);
  });

  it('JSDoc stripping does not eat real rows, and `@example` rows do not become fake ones', () => {
    const parsed = members(
      '\n  /**\n   * @example\n   * ```ts\n   * fake: NotAMember;\n   * ```\n   */\n  real?: SchemaNode;\n',
    );
    expect([...parsed.keys()]).toEqual(['real']);
    expect(parsed.get('real')).toEqual({ optional: true, typeText: 'SchemaNode' });
  });

  it('optionality is read, not assumed -- the two directions differ in this very file', () => {
    expect(declRow('HoverCardSchema', 'trigger')?.optional).toBe(false);
    expect(declRow('SheetSchema', 'trigger')?.optional).toBe(true);
  });
});
