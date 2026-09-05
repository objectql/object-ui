/**
 * objectui#7104 — `AlertDialogSchema` declares the keys the `alert-dialog`
 * renderer READS.
 *
 * Measured on `origin/main` `a3eb5d07a`, re-measured unchanged on `6eebc54b6`
 * (2026-09-05, the branch's merge-base at push time): the renderer
 * (`packages/components/src/renderers/overlay/alert-dialog.tsx`) reads
 * `schema.content` (the body, through `renderChildren`), `schema.cancelText`
 * (draws `AlertDialogCancel` only when truthy), `schema.actionText` (draws
 * `AlertDialogAction` only when truthy) and `schema.onAction` (that button's
 * `onClick`) — and NONE of the four was declared on the TS interface or in the
 * zod mirror. They were accepted only because `BaseSchema` carries
 * `[key: string]: any` and the mirror is `.passthrough()`: no editor completed
 * them, no page named them, and a wrong-typed value rode through unexamined.
 * Meanwhile the three keys the type DID declare for the same affordance
 * (`cancelLabel` / `confirmLabel` / `confirmVariant`) are read by nothing, so a
 * document written strictly against the shipped type renders an EMPTY footer.
 *
 * Direction (the PM ruling on the card): declare what the renderer reads. The
 * read dialect is the one live documents are written in — the component's own
 * registered `inputs` and `defaultProps` ship `cancelText` / `actionText`, and
 * the in-repo producer census (lit controls in the PR body) finds three
 * producers of the read dialect on an alert-dialog node and zero of the
 * declared one. Teaching the renderer `cancelLabel` instead would silently
 * blank the footer of every document that works today. ⛔ Neither dialect is
 * declared twice: one affordance, one authoring name (AGENTS.md #0.1).
 *
 * ## Both faces, per key
 *
 * - `content`, `cancelText`, `actionText` — declared on BOTH faces with the
 *   value domain the read enforces: `renderChildren` takes a node or a node
 *   array (the sibling overlays' `content` shape), and the two labels are
 *   truthiness-gated strings with NO renderer default (omit one and that
 *   button is not drawn; the designer palette seeds `'Cancel'` / `'Continue'`).
 * - `onAction` — a RUNTIME SLOT in the objectui#6124 shape: callable on the TS
 *   face (the renderer wires it as the action button's `onClick`), refused BY
 *   NAME in the mirror through `handlerKeyRefusal()` because JSON has no
 *   function value. It is the live key the `onConfirm` tombstone points at.
 *
 * ## Red first
 *
 * Written and run BEFORE the schema edit, on the untouched base. Predicted and
 * observed there: the membership legs red (no such mirror members), the
 * wrong-typed-value legs red (the values parsed green through passthrough),
 * the `onAction` legs red, the docs rows red (the page still published the
 * phantom `actions` row); the controls, the renderer scan, the inert-trio pins
 * and the fixture pins green. The compile-time leg failed on every `Equal`
 * over the four new members, which resolved to `any` through the index
 * signature. The PR body carries the counts from that run.
 *
 * ## What this file pins as UNRESOLVED, on purpose
 *
 * - `cancelLabel` / `confirmLabel` / `confirmVariant` stay declared on both
 *   faces and read by nothing. Retiring them is a NARROWING with its own card
 *   and its own changeset grade (the objectui#7104 ruling); the pins below
 *   record today's state so that the PR which retires them re-derives these
 *   lines deliberately rather than passing unnoticed.
 * - The four schema-catalog fixtures author `actions`, a key no surface
 *   carries, so the docs page's own examples render an empty footer —
 *   objectui#7693. Pinned here as that card's filed premise; its fix goes red
 *   here and re-derives the pin.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'zod';

import type { SchemaNode } from '../base';
import type { AlertDialogSchema } from '../overlay';
import { AlertDialogSchema as AlertDialogZod } from '../zod/overlay.zod.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

const RENDERER = 'packages/components/src/renderers/overlay/alert-dialog.tsx';
const DECLARATION = 'packages/types/src/overlay.ts';
const DOC = 'content/docs/components/overlay/alert-dialog.mdx';
const FIXTURE_DIR = 'examples/schema-catalog/src/schemas/components-overlay-alert-dialog';
const FIXTURES = ['basic-alert-dialog', 'confirmation-dialog', 'custom-actions', 'destructive-action'] as const;

/** The three JSON-authorable keys the renderer reads. */
const READ_KEYS = ['content', 'cancelText', 'actionText'] as const;
/** The three keys the type declares for the same affordance and nothing reads. */
const INERT_DECLARED = ['cancelLabel', 'confirmLabel', 'confirmVariant'] as const;

const shape = AlertDialogZod.shape;

/** A document in the read dialect, every declared value well-typed. */
const AUTHORED = {
  type: 'alert-dialog',
  title: 'Delete this account?',
  description: 'This action cannot be undone.',
  trigger: { type: 'button', label: 'Delete account', variant: 'destructive' },
  content: [{ type: 'text', content: 'Everything under the account goes with it.' }],
  cancelText: 'Keep it',
  actionText: 'Delete',
} as const;

/* -- Type-level leg: compiled by `tsc -p packages/types/tsconfig.test.json` -- */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
/** A runtime slot keeps a callable member (the objectui#6124 pin's shape). */
type KeepsFunction<T> = [Extract<NonNullable<T>, (...args: never[]) => unknown>] extends [never]
  ? false
  : true;

// The read keys, at the read's own value domain. `SchemaNode` already admits
// `undefined`, so no `| undefined` on `content` (the objectui#7082 note).
export type _Content = Expect<Equal<AlertDialogSchema['content'], SchemaNode | SchemaNode[]>>;
export type _CancelText = Expect<Equal<AlertDialogSchema['cancelText'], string | undefined>>;
export type _ActionText = Expect<Equal<AlertDialogSchema['actionText'], string | undefined>>;
export type _OnAction = Expect<Equal<AlertDialogSchema['onAction'], (() => void) | undefined>>;
export type _OnActionCallable = Expect<KeepsFunction<AlertDialogSchema['onAction']>>;

// The mirror's INPUT side: the two labels accept a string, the slot accepts
// nothing a JSON author can write.
type MirrorInput = z.input<typeof AlertDialogZod>;
export type _MirrorCancelText = Expect<Equal<MirrorInput['cancelText'], string | undefined>>;
export type _MirrorActionText = Expect<Equal<MirrorInput['actionText'], string | undefined>>;
export type _MirrorOnActionRefused = Expect<Equal<MirrorInput['onAction'], undefined>>;

// The inert trio still reads as DECLARED — the retirement card re-derives these.
export type _CancelLabelStillDeclared = Expect<Equal<AlertDialogSchema['cancelLabel'], string | undefined>>;
export type _ConfirmLabelStillDeclared = Expect<Equal<AlertDialogSchema['confirmLabel'], string | undefined>>;
export type _ConfirmVariantStillDeclared = Expect<
  Equal<AlertDialogSchema['confirmVariant'], 'default' | 'destructive' | undefined>
>;

// A wrong-typed value is now a compile error AT the key. Before objectui#7104
// the index signature absorbed it: `cancelText: 123` compiled clean.
export const wellTyped: AlertDialogSchema = { type: 'alert-dialog', cancelText: 'Cancel', actionText: 'Continue' };
export const wrongTyped: AlertDialogSchema = {
  type: 'alert-dialog',
  // @ts-expect-error objectui#7104 — `cancelText` is a string, no longer `any` through the index signature
  cancelText: 123,
};

/* -- Readers for the docs Schema block and the TS interface (the objectui#7082 shape) -- */

interface Member {
  readonly optional: boolean;
  readonly typeText: string;
}

function schemaFence(doc: string): string {
  const fences = [...doc.matchAll(/```plaintext\n([\s\S]*?)```/g)].map((match) => match[1]);
  if (fences.length !== 1) throw new Error(`expected exactly one plaintext fence in ${DOC}, found ${fences.length}`);
  return fences[0];
}

function interfaceBody(source: string, opener: string): string {
  const start = source.indexOf(opener);
  if (start === -1) throw new Error(`no \`${opener}\` block`);
  const end = source.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated \`${opener}\` block`);
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

const declaredInterface = () =>
  interfaceBody(read(DECLARATION), 'export interface AlertDialogSchema extends BaseSchema {');

/* -- Runtime leg -- */

describe('the three read keys are DECLARED on the mirror (objectui#7104)', () => {
  it.each(READ_KEYS)('`%s` is a member of the mirror shape (membership cannot be read off acceptance under passthrough)', (key) => {
    expect(shape[key]).toBeDefined();
  });

  it.each(READ_KEYS)('`%s`: the declared value parses green and SURVIVES the parse', (key) => {
    // Green under passthrough before the change too — survival alone cannot
    // tell a declared key from an undeclared one, which is why membership is
    // asserted off `.shape` above and refusal is asserted below.
    const result = AlertDialogZod.safeParse(AUTHORED);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[key]).toEqual(AUTHORED[key]);
  });

  it.each([
    ['cancelText', 123],
    ['actionText', ['Continue']],
    // `SchemaNodeSchema` is `BaseSchemaCore | primitive`, and `BaseSchemaCore`
    // requires `type` — an object without one is not a node.
    ['content', { label: 'a node without a type' }],
  ] as const)('`%s` refuses a wrong-typed value AT the key — the enforcement the declaration adds', (key, wrong) => {
    const result = AlertDialogZod.safeParse({ ...AUTHORED, [key]: wrong });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => String(issue.path[0]))).toContain(key);
  });

  it('control: the SAME wrong-typed value under an UNDECLARED key is still admitted unexamined — passthrough is unchanged', () => {
    const result = AlertDialogZod.safeParse({ ...AUTHORED, actionLabel: 123 });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.actionLabel).toBe(123);
  });

  it('control: a document that omits all three still parses green — every new member is optional', () => {
    const { content: _content, cancelText: _cancelText, actionText: _actionText, ...rest } = AUTHORED;
    expect(AlertDialogZod.safeParse(rest).success).toBe(true);
  });
});

describe('`onAction` is a RUNTIME SLOT — callable on the TS face, refused BY NAME in the mirror (objectui#7104, the objectui#6124 shape)', () => {
  it('is a member of the mirror shape, carrying the runtime-slot guidance as its description', () => {
    const member = shape.onAction as { description?: string } | undefined;
    expect(member).toBeDefined();
    expect(member?.description).toContain('RUNTIME SLOT');
    expect(member?.description).toContain('`onAction`');
    expect(member?.description).not.toContain('RETIRED');
  });

  it('a JSON author writing it is refused at its own path and pointed at the node-type spelling', () => {
    const result = AlertDialogZod.safeParse({ ...AUTHORED, onAction: { action: 'toast', title: 'Deleted' } });
    expect(result.success).toBe(false);
    if (result.success) return;
    const issue = result.error.issues.find((candidate) => String(candidate.path[0]) === 'onAction');
    expect(issue).toBeDefined();
    expect(issue?.code).toBe('custom');
    expect(issue?.message).toContain('action:button');
  });

  it('a live function is refused too — the mirror is not the programmatic channel', () => {
    expect(AlertDialogZod.safeParse({ ...AUTHORED, onAction: () => undefined }).success).toBe(false);
  });
});

describe('the fact the declaration records: the renderer READS these keys and teaches them (objectui#7104)', () => {
  it('reads `schema.content`, `schema.cancelText`, `schema.actionText` and `schema.onAction`', () => {
    const renderer = read(RENDERER);
    for (const key of ['content', 'cancelText', 'actionText', 'onAction']) {
      expect(renderer, key).toContain(`schema.${key}`);
    }
  });

  it('its registered `inputs` and `defaultProps` ship the read dialect, and none of the declared-but-unread trio', () => {
    const renderer = read(RENDERER);
    expect(renderer).toMatch(/name:\s*'cancelText'/);
    expect(renderer).toMatch(/name:\s*'actionText'/);
    expect(renderer).toMatch(/name:\s*'content'/);
    expect(renderer).toMatch(/^\s*cancelText:\s*'Cancel',/m);
    expect(renderer).toMatch(/^\s*actionText:\s*'Continue',/m);
    for (const key of INERT_DECLARED) expect(renderer, key).not.toContain(key);
  });

  it('control: the scan can find things — this IS the alert-dialog registration', () => {
    const renderer = read(RENDERER);
    expect(renderer).toContain("ComponentRegistry.register('alert-dialog'");
    expect(renderer).toContain('renderChildren(schema.trigger)');
  });
});

describe('the declared-but-unread trio is UNTOUCHED here — recorded for its own card (objectui#7104)', () => {
  it.each(INERT_DECLARED)('`%s` is still declared on the mirror', (key) => {
    expect(shape[key]).toBeDefined();
  });

  it.each(INERT_DECLARED)('`%s` is still declared on the TS interface', (key) => {
    expect(members(declaredInterface()).get(key)?.optional).toBe(true);
  });

  it.each(INERT_DECLARED)('`%s` is still read by nothing in the renderer', (key) => {
    expect(read(RENDERER)).not.toContain(key);
  });

  it('their docblocks still publish an `@default` the renderer never applies — the prong-2 reading the follow-up judges', () => {
    const iface = declaredInterface();
    expect(iface).toMatch(/@default 'Cancel'[\s\S]{0,40}cancelLabel\?: string;/);
    expect(iface).toMatch(/@default 'Confirm'[\s\S]{0,40}confirmLabel\?: string;/);
    expect(iface).toMatch(/@default 'default'[\s\S]{0,40}confirmVariant\?: 'default' \| 'destructive';/);
  });
});

describe('the docs page publishes the read dialect (objectui#7104)', () => {
  const rows = () => members(interfaceBody(schemaFence(read(DOC)), 'interface AlertDialogSchema {'));

  it.each([
    ['content', 'SchemaNode | SchemaNode[]'],
    ['cancelText', 'string'],
    ['actionText', 'string'],
  ])('row `%s` is published as `%s`, optional — the declaration\'s own spelling', (key, typeText) => {
    expect(rows().get(key)).toEqual({ optional: true, typeText });
  });

  it('the phantom `actions` row is gone — no surface ever carried it', () => {
    expect(rows().has('actions')).toBe(false);
    expect(read(DOC)).not.toMatch(/^\s*actions\?:/m);
  });

  it('`onAction` is not published as an authorable row — a runtime slot has no JSON spelling', () => {
    expect(rows().has('onAction')).toBe(false);
  });

  it('the page does not teach the declared-but-unread trio either', () => {
    for (const key of INERT_DECLARED) expect(rows().has(key), key).toBe(false);
  });

  it('control: the rows both faces always agreed on are still there', () => {
    expect(rows().get('type')?.typeText).toBe("'alert-dialog'");
    // `trigger` widened to the union on both faces with objectui#7081; the row
    // still says what the declaration says.
    expect(rows().get('trigger')?.typeText).toBe('SchemaNode | SchemaNode[]');
  });
});

describe('the schema-catalog fixtures still author `actions` — objectui#7693, pinned as its filed premise', () => {
  it.each(FIXTURES)('%s.json carries an `actions` array and neither `cancelText` nor `actionText`', (name) => {
    const fixture = JSON.parse(read(`${FIXTURE_DIR}/${name}.json`)) as Record<string, unknown>;
    expect(Array.isArray(fixture.actions)).toBe(true);
    expect(fixture).not.toHaveProperty('cancelText');
    expect(fixture).not.toHaveProperty('actionText');
  });

  it('and every one of them parses GREEN regardless — passthrough is why nothing red covers objectui#7693', () => {
    for (const name of FIXTURES) {
      expect(AlertDialogZod.safeParse(JSON.parse(read(`${FIXTURE_DIR}/${name}.json`))).success, name).toBe(true);
    }
  });
});
