/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `button-group.mdx` publishes the shipped surface, in BOTH directions (objectui#6347).
 *
 * ## Why this file exists rather than "the docs gates went green"
 *
 * Nothing in CI reads a component page's `plaintext` interface fence.
 * `check-doc-component-types` reads the `type` STRING LITERALS out of docs code
 * blocks and asks only "does something register this type";
 * `check-doc-snippet-types` compiles `ts`/`tsx` fences and a `plaintext` fence is
 * not one. So a member row in that fence can name any key at all and every gate
 * stays green — the same hole `component-fixture-declared-keys.test.ts` records
 * for catalog fixtures, one surface over. A green CI run on the docs correction
 * this file accompanies would have meant "nothing else broke", NOT "the
 * correction is right".
 *
 * ## What the page taught before, measured on this tree
 *
 * Ten rows disagreed with `packages/types/src/navigation.ts` and its Zod mirror,
 * in BOTH directions — the card had noticed only the first direction:
 *
 *   OVER-stated (documented, never declared):  `ButtonGroupSchema.value`,
 *     `ButtonGroupSchema.selectionMode`, `ButtonGroupButton.value`,
 *     `ButtonGroupButton.icon`; `buttons` spelled REQUIRED against a declared
 *     `buttons?`; `label?` spelled optional against a declared required `label`.
 *   UNDER-stated (declared, never documented): `ButtonGroupButton.variant`,
 *     `.size`, `.onClick`, `.className`; three `variant` members
 *     (`secondary`, `destructive`, `link`) and one `size` member (`icon`).
 *
 * Both directions are one defect class with the sign flipped, which is why this
 * file asserts SET EQUALITY on the component's own members rather than the
 * subset the card enumerated. A one-directional pin is what let the omissions
 * sit beside the corrections through two earlier passes over these pages.
 *
 * ## The authority is the mirror's `.shape`, never parse acceptance
 *
 * `BaseSchema` is `.passthrough()` and carries `[key: string]: any`, so an
 * undeclared `selectionMode` PARSES GREEN and type-checks — acceptance cannot
 * tell "declared" from "admitted unexamined" (the reading
 * `undeclared-but-consumed-keys-6150.test.ts` and `object-grid-title-mirrored`
 * established). Membership is therefore read off `.shape`, optionality off each
 * member's own `safeParse(undefined)`, and the enum vocabularies through the
 * shared `enumOptions` reader rather than a hand-copied string list, so this
 * file follows the platform instead of asserting yesterday's vocabulary.
 *
 * ## The two BaseSchema-inherited rows are pinned too, and one of them was wrong
 *
 * The page also documents `disabled` and `className`, which `ButtonGroupSchema`
 * inherits rather than declares. `disabled` was spelled `boolean` against a
 * declared `boolean | string` (`base.ts`; the mirror is
 * `z.union([z.boolean(), z.string()])`, the string limb being the predicate
 * dialect `disabledOn` also carries).
 *
 * That reads at first like a repo-wide convention worth leaving alone — 14
 * `content/docs/components/**` pages spell a component schema's own `disabled`
 * as `boolean`. It is not: 13 of those 14 component schemas REDECLARE
 * `disabled?: boolean` themselves (`ButtonSchema`, `SelectSchema`,
 * `SwitchSchema`, `ToggleGroupSchema` and nine more), so their pages are right.
 * `ButtonGroupSchema` is the ONE that does not redeclare it, which makes this
 * page the outlier rather than the convention. Measured, not assumed — and it
 * is why the type TEXT of both inherited rows is asserted here rather than
 * waved through as "documented centrally".
 *
 * ## `## Selection Mode` is gone because the renderer cannot draw it
 *
 * `packages/components/src/renderers/basic/button-group.tsx` implements no
 * selection behaviour at all — it maps `schema.buttons` to `Button` elements and
 * reads `variant` / `size` / `className` / `label` only. The section's heading
 * promised a capability nothing implements. The renderer half is asserted here
 * too, so that whoever DOES implement selection sees this file go red and knows
 * the page owes a section again; without it, the deletion would read as a
 * permanent verdict rather than a statement about this tree.
 *
 * The two catalog fixtures the section used to render STAY (they are a different
 * verification population, fenced off by PR #6345) and are asserted present.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enumOptions } from '@object-ui/test-support';

import { BaseSchema } from '../zod/base.zod';
import { ButtonGroupButtonSchema, ButtonGroupSchema } from '../zod/navigation.zod';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const DOC_PATH = 'content/docs/components/basic/button-group.mdx';
const RENDERER_PATH = 'packages/components/src/renderers/basic/button-group.tsx';
const FIXTURE_DIR = 'examples/schema-catalog/src/schemas/components-basic-button-group';

const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

const doc = read(DOC_PATH);
const renderer = read(RENDERER_PATH);

/* ── The documented surface, parsed out of the page's `plaintext` fence ──── */

interface DocumentedMember {
  /** Spelled with a `?`. */
  readonly optional: boolean;
  /** Everything between the colon and the terminating semicolon, trimmed. */
  readonly typeText: string;
}

/** The one `plaintext` fence that carries the page's interface blocks. */
function schemaFence(): string {
  const fences = [...doc.matchAll(/```plaintext\n([\s\S]*?)```/g)].map((match) => match[1]);
  if (fences.length !== 1) {
    throw new Error(`expected exactly one \`plaintext\` fence in ${DOC_PATH}, found ${fences.length}`);
  }
  return fences[0];
}

/** The body of one `interface <name> { … }` block, THROWING when absent. */
function interfaceBody(source: string, name: string): string {
  const opener = `interface ${name} {`;
  const start = source.indexOf(opener);
  if (start === -1) throw new Error(`no \`${opener}\` block in ${DOC_PATH}`);
  const end = source.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated \`${opener}\` block in ${DOC_PATH}`);
  return source.slice(start + opener.length, end);
}

/** Member rows of an interface body, keyed by name. */
function documentedMembers(body: string): Map<string, DocumentedMember> {
  const members = new Map<string, DocumentedMember>();
  for (const match of body.matchAll(/^ {2}(\w+)(\?)?:\s*([^;]+);/gm)) {
    members.set(match[1], { optional: match[2] === '?', typeText: match[3].trim() });
  }
  return members;
}

/** The single-quoted literals in a documented union, in source order. */
const documentedLiterals = (typeText: string): string[] =>
  [...typeText.matchAll(/'([^']*)'/g)].map((match) => match[1]);

/* ── The declared surface, read off the shipped Zod mirrors ──────────────── */

type ZodShape = Record<string, { safeParse(value: unknown): { success: boolean } }>;

const buttonShape = ButtonGroupButtonSchema.shape as unknown as ZodShape;
const groupShape = ButtonGroupSchema.shape as unknown as ZodShape;
const BASE_KEYS = new Set(Object.keys(BaseSchema.shape));

/** A member accepts `undefined`, i.e. the page should spell it with a `?`. */
const declaredOptional = (shape: ZodShape, key: string): boolean =>
  shape[key].safeParse(undefined).success;

/**
 * Peel `.optional()` / `.default()` / `.nullable()` off a mirror member.
 *
 * Bounded rather than `while`, for the reason `@object-ui/test-support`'s
 * `enumOptions` gives: the step is reached through `unknown`, so a node that
 * unwraps to itself ends the walk instead of the process. That shared reader is
 * deliberately NOT used here — it answers "which enum NAMES does this accept",
 * and reading a union's option SCHEMAS out of it would be relying on a return
 * value its contract does not promise.
 */
interface WrapperCarrier {
  readonly options?: readonly unknown[];
  readonly def?: {
    readonly type?: string;
    readonly innerType?: unknown;
    readonly options?: readonly unknown[];
  };
  readonly _def?: { readonly innerType?: unknown };
}

function unwrapWrappers(node: unknown): WrapperCarrier | undefined {
  let carrier = node as WrapperCarrier | undefined;
  for (let depth = 0; carrier && depth <= 8; depth += 1) {
    const inner = carrier.def?.innerType ?? carrier._def?.innerType;
    if (!inner) return carrier;
    carrier = inner as WrapperCarrier;
  }
  return carrier;
}

/** The declared type of a member, spelled the way the page writes it. */
function declaredTypeText(node: unknown): string {
  const inner = unwrapWrappers(node);
  if (inner?.def?.type === 'union') {
    const options = inner.options ?? inner.def.options ?? [];
    return options.map((option) => unwrapWrappers(option)?.def?.type ?? 'unknown').join(' | ');
  }
  return String(inner?.def?.type ?? 'unknown');
}

/**
 * The members this component declares in its OWN right.
 *
 * `type` is re-declared by `.extend()` as the discriminator literal, so it
 * belongs here even though `BaseSchema` carries a `type` too; every other
 * inherited key is documented centrally, not on a component page.
 */
const groupOwnKeys = Object.keys(groupShape).filter((key) => key === 'type' || !BASE_KEYS.has(key));

const buttonBody = interfaceBody(schemaFence(), 'ButtonGroupButton');
const groupBody = interfaceBody(schemaFence(), 'ButtonGroupSchema');
const buttonDoc = documentedMembers(buttonBody);
const groupDoc = documentedMembers(groupBody);

describe('button-group.mdx: the `ButtonGroupButton` block IS the shipped mirror (objectui#6347)', () => {
  it('documents exactly the declared members — no more, no fewer', () => {
    expect([...buttonDoc.keys()].sort()).toEqual(Object.keys(buttonShape).sort());
  });

  it.each([...Object.keys(buttonShape)])('spells `%s` with the declared optionality', (key) => {
    expect(buttonDoc.get(key)?.optional).toBe(declaredOptional(buttonShape, key));
  });

  it.each(['variant', 'size'])('publishes the whole shipped `%s` vocabulary', (key) => {
    const shipped = enumOptions(buttonShape[key]);
    expect(shipped.length).toBeGreaterThan(0);
    expect(documentedLiterals(buttonDoc.get(key)?.typeText ?? '')).toEqual(shipped);
  });

  it('documents `onClick` as a runtime slot, not something a JSON author supplies', () => {
    // `onClick` is `() => void` / `z.function()`; objectui#4453 narrowed the
    // runtime to `typeof === 'function'`, so an authored object is dropped.
    expect(buttonDoc.get('onClick')?.typeText).toBe('() => void');
    expect(buttonBody).toContain('not authorable in JSON');
  });
});

describe('button-group.mdx: the `ButtonGroupSchema` block IS the shipped mirror (objectui#6347)', () => {
  it('names no member the mirror does not declare', () => {
    const undeclared = [...groupDoc.keys()].filter((key) => !(key in groupShape));
    expect(undeclared).toEqual([]);
  });

  it('documents every member this component declares in its own right', () => {
    const missing = groupOwnKeys.filter((key) => !groupDoc.has(key));
    expect(missing).toEqual([]);
    // Non-vacuity: the filter above is only worth something while it has
    // something to filter.
    expect([...groupOwnKeys].sort()).toEqual(['buttons', 'size', 'type', 'variant']);
  });

  it.each([...Object.keys(groupShape).filter((key) => !BASE_KEYS.has(key))])(
    'spells `%s` with the declared optionality',
    (key) => {
      expect(groupDoc.get(key)?.optional).toBe(declaredOptional(groupShape, key));
    },
  );

  it.each(['variant', 'size'])('publishes the whole shipped `%s` vocabulary', (key) => {
    const shipped = enumOptions(groupShape[key]);
    expect(shipped.length).toBeGreaterThan(0);
    expect(documentedLiterals(groupDoc.get(key)?.typeText ?? '')).toEqual(shipped);
  });

  it.each(['disabled', 'className'])(
    'the inherited `%s` row it documents matches the declared member',
    (key) => {
      expect(BASE_KEYS.has(key)).toBe(true);
      expect(groupDoc.get(key)?.optional).toBe(declaredOptional(groupShape, key));
      expect(groupDoc.get(key)?.typeText).toBe(declaredTypeText(groupShape[key]));
    },
  );

  it('`ButtonGroupSchema` is the one component schema that does NOT narrow `disabled`', () => {
    // The reason the row above says `boolean | string` while 13 sibling pages
    // correctly say `boolean`: those 13 schemas redeclare it. This assertion is
    // what stops a later `disabled?: boolean` narrowing on ButtonGroupSchema
    // from leaving the page silently over-stating instead of under-stating.
    expect(declaredTypeText(groupShape.disabled)).toBe('boolean | string');
    expect(Object.keys(groupShape).includes('disabled')).toBe(true);
  });
});

describe('button-group.mdx: no Selection Mode section, because the renderer has no selection (objectui#6347)', () => {
  it('the renderer reads neither `selectionMode` nor a group-level `value`', () => {
    expect(renderer).not.toMatch(/selectionMode/);
    expect(renderer).not.toMatch(/schema\.value/);
    // Control: this IS the renderer, and the scan can find things in it.
    expect(renderer).toContain('schema.buttons');
    expect(renderer).toContain("ComponentRegistry.register('button-group'");
  });

  it('the page carries no heading promising selection', () => {
    expect(doc).not.toMatch(/^#+ .*Selection/m);
    expect(doc).not.toContain('single-selection');
    expect(doc).not.toContain('multiple-selection');
  });

  it('the two catalog fixtures it used to render are still on disk', () => {
    // Removing the section orphans them from this page; catalog entries are a
    // separate verification population and are NOT deleted to tidy that up.
    for (const slug of ['single-selection', 'multiple-selection']) {
      expect(read(`${FIXTURE_DIR}/${slug}.json`)).toContain('"type": "button-group"');
    }
  });
});

describe('counter-probes: the readers above can still fail (objectui#6347)', () => {
  it('`interfaceBody` throws rather than returning an empty body', () => {
    expect(() => interfaceBody(schemaFence(), 'ButtonGroupSelectionSchema')).toThrow(
      /no `interface ButtonGroupSelectionSchema \{` block/,
    );
  });

  it('the extractor really parsed rows, not an empty match set', () => {
    expect(buttonDoc.size).toBe(Object.keys(buttonShape).length);
    expect(groupDoc.size).toBeGreaterThanOrEqual(groupOwnKeys.length);
  });

  it('an undeclared row would be caught — the shape the card reported', () => {
    const regressed = documentedMembers(
      "  buttons?: ButtonGroupButton[];\n  selectionMode?: 'single' | 'multiple' | 'none';",
    );
    expect([...regressed.keys()].filter((key) => !(key in groupShape))).toEqual(['selectionMode']);
  });

  it('an omitted declared row would be caught — the direction the card missed', () => {
    const regressed = documentedMembers('  type: string;\n  buttons?: ButtonGroupButton[];');
    expect(groupOwnKeys.filter((key) => !regressed.has(key))).toEqual(['variant', 'size']);
  });

  it('a truncated enum row would be caught', () => {
    expect(documentedLiterals("'default' | 'outline' | 'ghost'")).not.toEqual(
      enumOptions(groupShape.variant),
    );
  });

  it('`declaredTypeText` reads the mirror, not a hard-coded string', () => {
    // Non-vacuity for the union reader: it must distinguish the two inherited
    // rows from each other, and must not answer `unknown` for either.
    expect(declaredTypeText(groupShape.className)).toBe('string');
    expect(declaredTypeText(groupShape.disabled)).not.toBe(
      declaredTypeText(groupShape.className),
    );
    expect(declaredTypeText(groupShape.disabled)).not.toContain('unknown');
  });
});
