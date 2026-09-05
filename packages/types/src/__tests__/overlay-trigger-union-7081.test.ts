/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The overlay family's `trigger` slot admits a node OR a node array on every
 * face it ships on (objectui#7081).
 *
 * ## What was wrong, measured on `origin/main` `737037f2`
 *
 * Seven overlay declarations spelled `trigger` as a single `SchemaNode`:
 * `DialogSchema`, `AlertDialogSchema`, `SheetSchema`, `DrawerSchema` (optional)
 * and `PopoverSchema`, `HoverCardSchema`, `DropdownMenuSchema` (required).
 * Every one of their Zod mirrors (`zod/overlay.zod.ts`) spelled the same key
 * `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`; every one of their
 * renderers hands `schema.trigger` to `renderChildren`, whose `Array.isArray`
 * branch (`packages/components/src/lib/utils.tsx:23`) serves the array; and
 * every one of their registrations ships `defaultProps.trigger` as an ARRAY.
 * The two siblings that already carried the union on the TS face
 * (`TooltipSchema`, `ContextMenuSchema`) are the controls below.
 *
 * So the published type -- the one an author's editor reads -- refused the
 * form the validator accepted, the runtime rendered and the component's own
 * default shipped: copying a renderer's default into a typed document was a
 * type error against the type that shipped it.
 *
 * ## Why no gate caught it
 *
 * `zod-mirror-parity.test.ts` asserts one direction only: the mirror accepts
 * everything the declaration declares. A mirror WIDER than its declaration is
 * exactly what that test is built to allow (objectui#5684). This file pins
 * the other direction for this one slot, on this one family.
 *
 * ## What moved (triage 2026-09-03 on the card)
 *
 * The TS face only. The validator's accept set does not move -- the mirror
 * already accepted both forms -- so this is a declaration catching up with
 * what ships, not a capability. `SchemaNode` itself is untouched, and a bare
 * `SchemaNode` slot still refuses an array (the counter-control below).
 *
 * ## The faces, per member
 *
 * - TS: `XSchema['trigger']` equals `SchemaNode | SchemaNode[]`, optionality
 *   kept per member (`SchemaNode` already admits `undefined`, so no
 *   `| undefined` on the optional ones -- the objectui#7082 note).
 * - Zod: the mirror parses a single node AND an array, and refuses a non-node
 *   at the `trigger` path, so the parse is examining the key.
 * - the registration: the shipped `defaultProps.trigger`, read off the
 *   renderer source, is an array, equals the typed copy in `SHIPPED`, and
 *   parses through the mirror. The typed copy is what compiles against the
 *   declaration -- the card's own complaint, made a pin.
 * - the docs: each page's `trigger` row publishes the union.
 *
 * ## Ablation
 *
 * With `overlay.ts` reverted to its pre-#7081 bytes, the `_*Trigger` and
 * `_*AdmitsArray` legs for the seven and the seven `shipped*` documents fail
 * under `tsc -p tsconfig.test.json`; the controls, the counter-control and
 * every runtime leg stay green (the mirror and the renderers never moved).
 * Recorded on the PR.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BaseSchema, SchemaNode } from '../base';
import type { CollapsibleSchema } from '../disclosure';
import type {
  AlertDialogSchema,
  ContextMenuSchema,
  DialogSchema,
  DrawerSchema,
  DropdownMenuSchema,
  HoverCardSchema,
  PopoverSchema,
  SheetSchema,
  TooltipSchema,
} from '../overlay';
import {
  AlertDialogSchema as AlertDialogZod,
  ContextMenuSchema as ContextMenuZod,
  DialogSchema as DialogZod,
  DrawerSchema as DrawerZod,
  DropdownMenuSchema as DropdownMenuZod,
  HoverCardSchema as HoverCardZod,
  PopoverSchema as PopoverZod,
  SheetSchema as SheetZod,
  TooltipSchema as TooltipZod,
} from '../zod/overlay.zod.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

const DECLARATION = 'packages/types/src/overlay.ts';
const MIRROR = 'packages/types/src/zod/overlay.zod.ts';
const RENDERERS = 'packages/components/src/renderers/overlay';
const DOCS = 'content/docs/components/overlay';
const RENDER_CHILDREN = 'packages/components/src/lib/utils.tsx';

/* -- Type-level leg: compiled by `tsc -p packages/types/tsconfig.test.json` -- */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** Does this slot admit the ARRAY form? The whole of objectui#7081 in one operator. */
type AdmitsArray<T> = SchemaNode[] extends T ? true : false;
/** Is the key spelled with a `?` -- read off the type, not off the source text. */
type IsOptionalKey<T, K extends keyof T> = Record<never, never> extends Pick<T, K> ? true : false;

type Union = SchemaNode | SchemaNode[];

// The seven widened members, each equal to the union `ContextMenuSchema` spells.
export type _DialogTrigger = Expect<Equal<DialogSchema['trigger'], Union>>;
export type _AlertDialogTrigger = Expect<Equal<AlertDialogSchema['trigger'], Union>>;
export type _SheetTrigger = Expect<Equal<SheetSchema['trigger'], Union>>;
export type _DrawerTrigger = Expect<Equal<DrawerSchema['trigger'], Union>>;
export type _PopoverTrigger = Expect<Equal<PopoverSchema['trigger'], Union>>;
export type _HoverCardTrigger = Expect<Equal<HoverCardSchema['trigger'], Union>>;
export type _DropdownMenuTrigger = Expect<Equal<DropdownMenuSchema['trigger'], Union>>;

export type _DialogAdmitsArray = Expect<Equal<AdmitsArray<DialogSchema['trigger']>, true>>;
export type _AlertDialogAdmitsArray = Expect<Equal<AdmitsArray<AlertDialogSchema['trigger']>, true>>;
export type _SheetAdmitsArray = Expect<Equal<AdmitsArray<SheetSchema['trigger']>, true>>;
export type _DrawerAdmitsArray = Expect<Equal<AdmitsArray<DrawerSchema['trigger']>, true>>;
export type _PopoverAdmitsArray = Expect<Equal<AdmitsArray<PopoverSchema['trigger']>, true>>;
export type _HoverCardAdmitsArray = Expect<Equal<AdmitsArray<HoverCardSchema['trigger']>, true>>;
export type _DropdownMenuAdmitsArray = Expect<Equal<AdmitsArray<DropdownMenuSchema['trigger']>, true>>;

// Optionality is KEPT per member: four optional, three required, as before.
export type _DialogOptional = Expect<Equal<IsOptionalKey<DialogSchema, 'trigger'>, true>>;
export type _AlertDialogOptional = Expect<Equal<IsOptionalKey<AlertDialogSchema, 'trigger'>, true>>;
export type _SheetOptional = Expect<Equal<IsOptionalKey<SheetSchema, 'trigger'>, true>>;
export type _DrawerOptional = Expect<Equal<IsOptionalKey<DrawerSchema, 'trigger'>, true>>;
export type _PopoverRequired = Expect<Equal<IsOptionalKey<PopoverSchema, 'trigger'>, false>>;
export type _HoverCardRequired = Expect<Equal<IsOptionalKey<HoverCardSchema, 'trigger'>, false>>;
export type _DropdownMenuRequired = Expect<Equal<IsOptionalKey<DropdownMenuSchema, 'trigger'>, false>>;

// Controls: the two members that already carried the union are unchanged.
export type _TooltipTrigger = Expect<Equal<TooltipSchema['trigger'], Union>>;
export type _ContextMenuTrigger = Expect<Equal<ContextMenuSchema['trigger'], Union>>;

// Counter-control: `AdmitsArray` can say `false`, and `SchemaNode` itself did
// not move -- the widening is per member, not on the node type.
export type _SchemaNodeUntouched = Expect<
  Equal<SchemaNode, BaseSchema | string | number | boolean | null | undefined>
>;
interface SingularSlot {
  trigger: SchemaNode;
}
export type _SingularRefusesArray = Expect<Equal<AdmitsArray<SingularSlot['trigger']>, false>>;
export const singularStaysSingular: SingularSlot = {
  // @ts-expect-error objectui#7081 -- a bare `SchemaNode` slot still refuses the array form; the widening is per member, not on `SchemaNode`
  trigger: [{ type: 'button', label: 'Open' }],
};

// The one in-repo `trigger` OUTSIDE the family with the same asymmetry,
// recorded rather than resolved (`disclosure.ts`: `string | SchemaNode` on the
// TS face, the union in `disclosure.zod.ts`, an array in `collapsible.tsx`'s
// `defaultProps`). Fenced out of objectui#7081 and filed as its own card; the
// day it widens, this leg goes red and the pin is re-derived deliberately.
export type _CollapsibleStillSingular = Expect<Equal<AdmitsArray<CollapsibleSchema['trigger']>, false>>;

/**
 * The `defaultProps.trigger` each overlay registration ships, copied VERBATIM
 * from its renderer. The runtime leg below proves each copy still equals the
 * source, so this table cannot drift from what ships; this table is what
 * compiles against the declarations.
 */
const SHIPPED = {
  dialog: [{ type: 'button', label: 'Open Dialog' }],
  'alert-dialog': [{ type: 'button', label: 'Open Alert', variant: 'destructive' }],
  sheet: [{ type: 'button', label: 'Open Sheet' }],
  drawer: [{ type: 'button', label: 'Open Drawer' }],
  popover: [{ type: 'button', label: 'Open Popover', variant: 'outline' }],
  'hover-card': [{ type: 'button', label: 'Hover me', variant: 'link' }],
  'dropdown-menu': [{ type: 'button', label: 'Menu', variant: 'outline' }],
  tooltip: [{ type: 'button', label: 'Hover me', variant: 'outline' }],
  'context-menu': [{ type: 'text', content: 'Right click here' }],
};

// The card's complaint, as a compile: the renderer's own shipped default,
// authored into a typed document. Red on the pre-#7081 declarations.
export const shippedDialog: DialogSchema = { type: 'dialog', trigger: SHIPPED.dialog };
export const shippedAlertDialog: AlertDialogSchema = { type: 'alert-dialog', trigger: SHIPPED['alert-dialog'] };
export const shippedSheet: SheetSchema = { type: 'sheet', trigger: SHIPPED.sheet };
export const shippedDrawer: DrawerSchema = { type: 'drawer', trigger: SHIPPED.drawer };
export const shippedPopover: PopoverSchema = { type: 'popover', trigger: SHIPPED.popover, content: [] };
export const shippedHoverCard: HoverCardSchema = { type: 'hover-card', trigger: SHIPPED['hover-card'], content: [] };
export const shippedDropdownMenu: DropdownMenuSchema = {
  type: 'dropdown-menu',
  trigger: SHIPPED['dropdown-menu'],
  items: [],
};

// A widening, not a replacement: every singular `trigger` keeps type-checking.
const SINGLE = { type: 'button', label: 'Open' };
export const singleDialog: DialogSchema = { type: 'dialog', trigger: SINGLE };
export const singleAlertDialog: AlertDialogSchema = { type: 'alert-dialog', trigger: SINGLE };
export const singleSheet: SheetSchema = { type: 'sheet', trigger: SINGLE };
export const singleDrawer: DrawerSchema = { type: 'drawer', trigger: SINGLE };
export const singlePopover: PopoverSchema = { type: 'popover', trigger: SINGLE, content: [] };
export const singleHoverCard: HoverCardSchema = { type: 'hover-card', trigger: SINGLE, content: [] };
export const singleDropdownMenu: DropdownMenuSchema = { type: 'dropdown-menu', trigger: SINGLE, items: [] };

/* -- Readers (the objectui#7082 shape) -- */

interface Member {
  readonly optional: boolean;
  readonly typeText: string;
}

function schemaFence(doc: string, path: string): string {
  const fences = [...doc.matchAll(/```plaintext\n([\s\S]*?)```/g)].map((match) => match[1]);
  if (fences.length !== 1) throw new Error(`expected exactly one plaintext fence in ${path}, found ${fences.length}`);
  return fences[0];
}

function interfaceBody(source: string, opener: string, path: string): string {
  const start = source.indexOf(opener);
  if (start === -1) throw new Error(`no \`${opener}\` block in ${path}`);
  const end = source.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated \`${opener}\` block in ${path}`);
  return source.slice(start + opener.length, end);
}

function members(body: string): Map<string, Member> {
  const bare = body.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found = new Map<string, Member>();
  for (const match of bare.matchAll(/^ {2}(\w+)(\?)?:\s*([^;]+);/gm)) {
    found.set(match[1], { optional: match[2] === '?', typeText: match[3].trim() });
  }
  return found;
}

/**
 * The `trigger: [...]` literal inside a registration's `defaultProps`, as the
 * VALUE it denotes. The renderers write these as plain JS object literals with
 * bare keys and single-quoted strings; that grammar is converted to JSON here,
 * and anything outside it THROWS rather than parsing to something else.
 */
function shippedTrigger(rendererSource: string, path: string): unknown {
  const at = rendererSource.indexOf('defaultProps:');
  if (at === -1) throw new Error(`no \`defaultProps:\` in ${path}`);
  const open = rendererSource.indexOf('trigger:', at);
  if (open === -1) throw new Error(`no \`trigger:\` under \`defaultProps\` in ${path}`);
  const start = rendererSource.indexOf('[', open);
  let depth = 0;
  let end = -1;
  for (let i = start; i < rendererSource.length; i += 1) {
    if (rendererSource[i] === '[') depth += 1;
    if (rendererSource[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (start === -1 || end === -1) throw new Error(`\`defaultProps.trigger\` in ${path} is not an array literal`);
  const literal = rendererSource.slice(start, end + 1);
  if (!/^\[\s*\{(\s*\w+:\s*'[^'":]*'\s*,?)+\s*\}\s*\]$/.test(literal)) {
    throw new Error(`\`defaultProps.trigger\` in ${path} is outside the literal grammar this reader converts: ${literal}`);
  }
  return JSON.parse(literal.replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
}

/* -- The family -- */

interface Member7081 {
  readonly name: string;
  readonly type: keyof typeof SHIPPED;
  readonly zod: { safeParse: (value: unknown) => { success: boolean; data?: any; error?: any } };
  readonly optional: boolean;
  /** The other REQUIRED keys of the mirror, so a parse can fail only on `trigger`. */
  readonly rest: Record<string, unknown>;
}

const NODE = { type: 'button', label: 'Open' };
const NODES = [NODE, { type: 'text', content: 'and another' }];

const WIDENED: readonly Member7081[] = [
  { name: 'DialogSchema', type: 'dialog', zod: DialogZod, optional: true, rest: {} },
  { name: 'AlertDialogSchema', type: 'alert-dialog', zod: AlertDialogZod, optional: true, rest: {} },
  { name: 'SheetSchema', type: 'sheet', zod: SheetZod, optional: true, rest: {} },
  { name: 'DrawerSchema', type: 'drawer', zod: DrawerZod, optional: true, rest: {} },
  { name: 'PopoverSchema', type: 'popover', zod: PopoverZod, optional: false, rest: { content: [] } },
  { name: 'HoverCardSchema', type: 'hover-card', zod: HoverCardZod, optional: false, rest: { content: [] } },
  { name: 'DropdownMenuSchema', type: 'dropdown-menu', zod: DropdownMenuZod, optional: false, rest: { items: [] } },
];

/** The two that already declared the union: same legs, so the widened seven are held to the settled shape. */
const CONTROLS: readonly Member7081[] = [
  { name: 'TooltipSchema', type: 'tooltip', zod: TooltipZod, optional: true, rest: {} },
  { name: 'ContextMenuSchema', type: 'context-menu', zod: ContextMenuZod, optional: true, rest: { items: [] } },
];

const FAMILY = [...WIDENED, ...CONTROLS];

describe.each(FAMILY)('$name.trigger admits a node or a node array on every face (objectui#7081)', ({ name, type, zod, optional, rest }) => {
  it('the declaration spells the union, optionality kept', () => {
    const row = members(interfaceBody(read(DECLARATION), `export interface ${name} extends BaseSchema {`, DECLARATION)).get('trigger');
    expect(row).toEqual({ optional, typeText: 'SchemaNode | SchemaNode[]' });
  });

  it('the mirror parses a SINGLE node and hands it back', () => {
    const result = zod.safeParse({ type, ...rest, trigger: NODE });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.trigger).toEqual(NODE);
  });

  it('the mirror parses a node ARRAY and hands it back', () => {
    const result = zod.safeParse({ type, ...rest, trigger: NODES });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.trigger).toEqual(NODES);
  });

  it('the mirror refuses a non-node AT the `trigger` path -- the parse is examining the key', () => {
    // `SchemaNodeSchema` is `BaseSchemaCore | primitive`, and `BaseSchemaCore`
    // requires `type`: an object without one is not a node, in either form.
    for (const wrong of [{ label: 'a node without a type' }, [{ label: 'a node without a type' }]]) {
      const result = zod.safeParse({ type, ...rest, trigger: wrong });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.issues.map((issue: { path: unknown[] }) => String(issue.path[0]))).toContain('trigger');
    }
  });

  it('the registration ships `defaultProps.trigger` as an ARRAY, equal to the typed copy, and the mirror parses it', () => {
    const path = `${RENDERERS}/${type}.tsx`;
    const shipped = shippedTrigger(read(path), path);
    expect(Array.isArray(shipped)).toBe(true);
    expect(shipped).toEqual(SHIPPED[type]);
    expect(zod.safeParse({ type, ...rest, trigger: shipped }).success).toBe(true);
  });

  it('the renderer hands `schema.trigger` to `renderChildren` -- the read site the docblock names', () => {
    expect(read(`${RENDERERS}/${type}.tsx`)).toMatch(/renderChildren\(schema\.trigger/);
  });

  it('the docs page publishes the union', () => {
    const path = `${DOCS}/${type}.mdx`;
    const row = members(interfaceBody(schemaFence(read(path), path), `interface ${name} {`, path)).get('trigger');
    expect(row?.typeText).toBe('SchemaNode | SchemaNode[]');
  });
});

describe('what did NOT move (objectui#7081)', () => {
  it('`renderChildren` still has the `Array.isArray` branch every docblock points at', () => {
    const utils = read(RENDER_CHILDREN);
    expect(utils).toContain('export function renderChildren(');
    expect(utils).toMatch(/if \(Array\.isArray\(children\)\)/);
  });

  it('the mirror spells the union on all nine overlay `trigger` members -- a census, so a tenth or a ninth cannot slip in or out unnoticed', () => {
    const spelled = read(MIRROR).match(/^\s*trigger: z\.union\(\[SchemaNodeSchema, z\.array\(SchemaNodeSchema\)\]\)/gm) ?? [];
    expect(spelled).toHaveLength(FAMILY.length);
  });

  it('no overlay declaration spells `trigger` as a bare `SchemaNode` any more', () => {
    expect(read(DECLARATION)).not.toMatch(/^\s*trigger\??: SchemaNode;/m);
    // Control: the scan can find the widened spelling, nine times.
    expect(read(DECLARATION).match(/^\s*trigger\??: SchemaNode \| SchemaNode\[\];/gm)).toHaveLength(FAMILY.length);
  });

  it('every widened docblock names its read site and the array branch', () => {
    const source = read(DECLARATION);
    for (const { type } of WIDENED) {
      expect(source, type).toContain(`packages/components/src/renderers/overlay/${type}.tsx:`);
    }
    expect(source.match(/`Array\.isArray` branch/g)).toHaveLength(WIDENED.length);
  });
});

describe('counter-probes: the readers above can still fail (objectui#7081)', () => {
  it('`shippedTrigger` throws on a literal outside its grammar rather than parsing it to something else', () => {
    expect(() => shippedTrigger("defaultProps: { trigger: [{ type: 'button', label: \"double\" }] }", 'x.tsx')).toThrow(
      /outside the literal grammar/,
    );
    expect(() => shippedTrigger("defaultProps: { trigger: { type: 'button' } }", 'x.tsx')).toThrow(/not an array literal/);
    expect(() => shippedTrigger('inputs: []', 'x.tsx')).toThrow(/no `defaultProps:`/);
  });

  it('`shippedTrigger` reads a nested literal whole', () => {
    expect(shippedTrigger("defaultProps: {\n  trigger: [{ type: 'button', label: 'Open Alert', variant: 'destructive' }],\n}", 'x.tsx')).toEqual(
      SHIPPED['alert-dialog'],
    );
  });

  it('the pre-#7081 spelling would be caught on every widened member', () => {
    const regressed = members('  trigger: SchemaNode;');
    expect(regressed.get('trigger')).toEqual({ optional: false, typeText: 'SchemaNode' });
    expect(regressed.get('trigger')?.typeText).not.toBe('SchemaNode | SchemaNode[]');
  });

  it('the extractors really parsed rows, not empty match sets', () => {
    for (const { name } of FAMILY) {
      expect(members(interfaceBody(read(DECLARATION), `export interface ${name} extends BaseSchema {`, DECLARATION)).size).toBeGreaterThan(1);
    }
  });
});
