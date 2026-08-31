// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The 13 renderer-read keys that no shipped type declared (objectui#6150).
 *
 * ## What the card measured, and what this file pins
 *
 * A census over all 76 `content/docs/components/**` pages found 68 documented
 * keys that are not declared members of their shipped type; **13** were shown
 * to be genuinely READ by the renderer. Those are capabilities that work at
 * runtime, that the docs describe, and that the published contract never
 * mentioned — the reads compile only because `BaseSchema` ends with
 * `[key: string]: any` (objectui#5155), so `schema.trigger` on a type that
 * never declared `trigger` resolves to `any` instead of erroring.
 *
 * Re-derived on this branch before anything was edited, through the SAME
 * resolution path the census used (built `packages/types/dist/index.d.ts`, and
 * cross-checked against `src/index.ts` — the two agreed on all 8 types): all 13
 * were still undeclared, and all 13 reads were still present.
 *
 * ## ⚠️ This is NOT a key-membership widening — measured, not assumed
 *
 * Every one of the 8 mirrors extends `BaseSchema`, which is `.passthrough()`,
 * and `.extend()` carries that policy through (measured on the built mirrors:
 * `catchall` is `z.unknown()` on all 8). So **before this card every one of the
 * 13 keys already parsed green and already survived the parse** — admitted
 * unexamined, not refused and not stripped. What changes here is:
 *
 *   1. **declaration** — the key becomes a member of the shipped TypeScript
 *      type, so an editor completes it and an annotation checks it; and
 *   2. **enforcement** — for the 12 mirrored keys the value is now VALIDATED.
 *      In the value dimension that is a NARROWING, not a widening: `content: 42`
 *      parsed green before and is refused now.
 *
 * The same reading is why membership below is asserted on the mirror's own
 * `.shape` and never on parse acceptance — under `.passthrough()`, acceptance
 * cannot tell "declared" from "admitted unexamined" (the form
 * `object-grid-title-mirrored.test.ts` established for objectui#6639).
 * `undeclaredSentinel` is the control that keeps that distinction visible: an
 * undeclared key of the wrong type is still admitted, exactly as before, on
 * every one of the 8 mirrors.
 *
 * ## One of the 13 is not mirrored, deliberately
 *
 * `TreeViewSchema.onNodeClick` is INVOKED (`schema.onNodeClick(node)`), not read
 * as a value. A function cannot appear in an authored JSON document, so it is a
 * runtime slot; objectui#6152 ruled that class never gets a zod mirror and is
 * recorded in `zod-mirror-parity.test.ts`'s `RuntimeOnlyDeclared` instead. Its
 * assertions below are the mirror-image of the other twelve: declared on the TS
 * face, ABSENT from the mirror shape, and pinned as a call signature.
 *
 * ## The read sites are pinned, not just described
 *
 * A declaration is worth its doc comment only while the read exists — and the
 * card's own rule is that a key whose reader was removed must be DROPPED, never
 * declared. So each entry carries the renderer file and the exact source text of
 * its read, checked off disk (the form `base-bind-declared.test.ts` uses). Line
 * numbers drift and are therefore in prose only; the READ is the fact.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TextSchema } from '../zod/layout.zod';
import { CarouselSchema, FilterBuilderSchema } from '../zod/complex.zod';
import { TreeViewSchema } from '../zod/data-display.zod';
import { CheckboxSchema, FileUploadSchema } from '../zod/form.zod';
import { ContextMenuSchema, HoverCardSchema } from '../zod/overlay.zod';

import type { TextSchema as TsTextSchema } from '../layout';
import type { CarouselSchema as TsCarouselSchema, FilterBuilderSchema as TsFilterBuilderSchema } from '../complex';
import type { TreeNode, TreeViewSchema as TsTreeViewSchema } from '../data-display';
import type { CheckboxSchema as TsCheckboxSchema, FileUploadSchema as TsFileUploadSchema } from '../form';
import type { ContextMenuSchema as TsContextMenuSchema, HoverCardSchema as TsHoverCardSchema, OverlayAlignment } from '../overlay';
import type { SchemaNode } from '../base';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

/* ── Type-level helpers (invariant equality, house form) ─────────────────── */

type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/**
 * The declared TYPE of each of the 13, pinned invariantly.
 *
 * `[key: string]: any` would make every one of these `any` if the member were
 * NOT declared, and `Equal< any, string >` is false — so these fail the moment a
 * declaration is removed and the key falls back to the index signature. That is
 * what makes them a guard and not a restatement.
 */
export type _ContentIsString = Expect< Equal< NonNullable< TsTextSchema['content'] >, string > >;
export type _OptsIsOpenBag = Expect< Equal< NonNullable< TsCarouselSchema['opts'] >, Record< string, unknown > > >;
export type _OrientationIsAxis = Expect< Equal< NonNullable< TsCarouselSchema['orientation'] >, 'horizontal' | 'vertical' > >;
export type _ItemClassNameIsString = Expect< Equal< NonNullable< TsCarouselSchema['itemClassName'] >, string > >;
export type _FilterWrapperClassIsString = Expect< Equal< NonNullable< TsFilterBuilderSchema['wrapperClass'] >, string > >;
export type _NodesIsTreeNodes = Expect< Equal< NonNullable< TsTreeViewSchema['nodes'] >, TreeNode[] > >;
export type _TreeTitleIsString = Expect< Equal< NonNullable< TsTreeViewSchema['title'] >, string > >;
export type _RequiredIsBoolean = Expect< Equal< NonNullable< TsCheckboxSchema['required'] >, boolean > >;
export type _ButtonTextIsString = Expect< Equal< NonNullable< TsFileUploadSchema['buttonText'] >, string > >;
export type _UploadWrapperClassIsString = Expect< Equal< NonNullable< TsFileUploadSchema['wrapperClass'] >, string > >;
export type _AlignIsOverlayAlignment = Expect< Equal< NonNullable< TsHoverCardSchema['align'] >, OverlayAlignment > >;
export type _TriggerIsNodeOrNodes = Expect< Equal< NonNullable< TsContextMenuSchema['trigger'] >, SchemaNode | SchemaNode[] > >;

/**
 * INVOKED, not read — so the declared type is a call signature taking the
 * clicked node, not a value shape. Getting this wrong widens the surface
 * incorrectly, which is why it is pinned separately and invariantly.
 */
export type _OnNodeClickIsNodeHandler =
  Expect< Equal< NonNullable< TsTreeViewSchema['onNodeClick'] >, (node: TreeNode) => void > >;

/* ── The 13, as data ─────────────────────────────────────────────────────── */

interface Case {
  /** Mirror + TS type name, for the test title. */
  type: string;
  key: string;
  /** The zod mirror, or `null` for the one runtime-only key. */
  mirror: { shape: Record< string, unknown >; safeParse: (v: unknown) => { success: boolean; data?: any; error?: any } } | null;
  /** A minimal LEGAL document for this type, carrying none of the 13. */
  control: Record< string, unknown >;
  /** A value the declaration admits. */
  legal: unknown;
  /** A value the declaration refuses — the enforcement this card adds. */
  illegal: unknown;
  /** Renderer file, relative to the repo root. */
  reader: string;
  /** Exact source text of the read, as it stands today. */
  readText: string;
}

const NODE: SchemaNode = { type: 'text', value: 'x' } as SchemaNode;
const TEXT_CONTROL = { type: 'text' };
const CAROUSEL_CONTROL = { type: 'carousel', items: [] };
const FILTER_CONTROL = { type: 'filter-builder', fields: [] };
const TREE_CONTROL = { type: 'tree-view', data: [] };
const CHECKBOX_CONTROL = { type: 'checkbox', label: 'Accept' };
const UPLOAD_CONTROL = { type: 'file-upload', label: 'Attach' };
const HOVER_CONTROL = { type: 'hover-card', content: NODE, trigger: NODE };
const MENU_CONTROL = { type: 'context-menu', items: [], children: NODE };

const R = 'packages/components/src/renderers/';

const CASES: Case[] = [
  { type: 'TextSchema', key: 'content', mirror: TextSchema as never, control: TEXT_CONTROL,
    legal: 'hello', illegal: 42,
    reader: R + 'basic/text.tsx', readText: '{schema.content || schema.value}' },

  { type: 'CarouselSchema', key: 'opts', mirror: CarouselSchema as never, control: CAROUSEL_CONTROL,
    legal: { loop: true, align: 'start' }, illegal: 'not-an-option-bag',
    reader: R + 'complex/carousel.tsx', readText: 'opts={schema.opts}' },
  { type: 'CarouselSchema', key: 'orientation', mirror: CarouselSchema as never, control: CAROUSEL_CONTROL,
    legal: 'vertical', illegal: 'diagonal',
    reader: R + 'complex/carousel.tsx', readText: "orientation={schema.orientation || 'horizontal'}" },
  { type: 'CarouselSchema', key: 'itemClassName', mirror: CarouselSchema as never, control: CAROUSEL_CONTROL,
    legal: 'basis-1/2', illegal: 42,
    reader: R + 'complex/carousel.tsx', readText: 'className={schema.itemClassName}' },

  { type: 'FilterBuilderSchema', key: 'wrapperClass', mirror: FilterBuilderSchema as never, control: FILTER_CONTROL,
    legal: 'p-4', illegal: 42,
    reader: R + 'complex/filter-builder.tsx', readText: "className={schema.wrapperClass || ''}" },

  { type: 'TreeViewSchema', key: 'nodes', mirror: TreeViewSchema as never, control: TREE_CONTROL,
    legal: [{ id: 'a', label: 'A' }], illegal: 'not-an-array',
    reader: R + 'data-display/tree-view.tsx', readText: 'boundData || schema.nodes || schema.data || []' },
  { type: 'TreeViewSchema', key: 'title', mirror: TreeViewSchema as never, control: TREE_CONTROL,
    legal: 'Folders', illegal: 42,
    reader: R + 'data-display/tree-view.tsx', readText: '{schema.title}' },
  // INVOKED, not read as a value — no mirror, by objectui#6152's ruling.
  { type: 'TreeViewSchema', key: 'onNodeClick', mirror: null, control: TREE_CONTROL,
    legal: () => {}, illegal: undefined,
    reader: R + 'data-display/tree-view.tsx', readText: 'schema.onNodeClick(node)' },

  { type: 'CheckboxSchema', key: 'required', mirror: CheckboxSchema as never, control: CHECKBOX_CONTROL,
    legal: true, illegal: 'yes',
    reader: R + 'form/checkbox.tsx', readText: 'required={schema.required}' },

  { type: 'FileUploadSchema', key: 'buttonText', mirror: FileUploadSchema as never, control: UPLOAD_CONTROL,
    legal: 'Choose files', illegal: 42,
    reader: R + 'form/file-upload.tsx', readText: 'schema.buttonText ||' },
  { type: 'FileUploadSchema', key: 'wrapperClass', mirror: FileUploadSchema as never, control: UPLOAD_CONTROL,
    legal: 'mt-2', illegal: 42,
    reader: R + 'form/file-upload.tsx', readText: "${schema.wrapperClass || ''}" },

  { type: 'HoverCardSchema', key: 'align', mirror: HoverCardSchema as never, control: HOVER_CONTROL,
    legal: 'start', illegal: 'middle',
    reader: R + 'overlay/hover-card.tsx', readText: 'align={schema.align}' },

  // ⚠️ The enforcement `trigger` gains is REAL but weak, and the weakness is the
  // union's, not this card's: `SchemaNodeSchema` admits a node object, a string,
  // a number, a boolean, `null` and `undefined`, so `trigger: 42` is a LEGAL
  // node. The refused value below is an object with no `type` — refused by every
  // limb. `HoverCardSchema.trigger`, already declared, has exactly this reach.
  { type: 'ContextMenuSchema', key: 'trigger', mirror: ContextMenuSchema as never, control: MENU_CONTROL,
    legal: NODE, illegal: { notANode: true },
    reader: R + 'overlay/context-menu.tsx', readText: 'renderChildren(schema.trigger ||' },
];

/** An undeclared key, carried by the control so the before-state stays visible. */
const SENTINEL = 'undeclaredControlKey6150';

describe('objectui#6150 — the 13 renderer-read keys are declared on their shipped types', () => {
  it('the batch is exactly 13 keys over 8 shipped types', () => {
    // Non-vacuity for every per-case assertion below, and the card's own bound:
    // the census found 68 undeclared documented keys and only these 13 were
    // shown to be genuinely read. A 14th belongs on its own card, not here.
    expect(CASES).toHaveLength(13);
    expect(new Set(CASES.map((c) => c.type)).size).toBe(8);
  });

  describe.each(CASES.map((c) => [`${c.type}.${c.key}`, c] as const))('%s', (_title, c) => {
    const { key, mirror, control, legal, illegal, reader, readText } = c;
    it('the renderer still reads it — the fact the declaration records', () => {
      const src = readFileSync(join(REPO_ROOT, reader), 'utf8');
      expect(src, `${reader} no longer reads \`schema.${key}\` as \`${readText}\``).toContain(readText);
    });

    if (mirror) {
      it('is a member of the mirror shape (membership cannot be read off acceptance under passthrough)', () => {
        expect(Object.keys(mirror.shape)).toContain(key);
      });

      it('accepts the declared value and the value SURVIVES the parse', () => {
        const r = mirror.safeParse({ ...control, [key]: legal });
        expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
        if (r.success) expect(r.data[key]).toEqual(legal);
      });

      it('refuses a wrong-typed value AT the key — the enforcement mirroring adds', () => {
        const r = mirror.safeParse({ ...control, [key]: illegal });
        expect(r.success).toBe(false);
        if (!r.success) {
          expect(r.error.issues.map((i: { path: (string | number)[] }) => i.path.join('.'))).toContain(key);
        }
      });

      it('control: the declared-keys-only document parses green, before and after', () => {
        expect(mirror.safeParse(control).success).toBe(true);
      });

      it('control: the SAME wrong-typed value under an UNDECLARED key is still admitted unexamined', () => {
        // The before-state of all 13, kept on purpose. `.passthrough()` admits
        // an undeclared key of any type — which is what each of these keys did
        // before this card, and is why the refusal above measures the new
        // enforcement rather than the base object's strictness. It is also the
        // proof that nothing OUTSIDE the 13 moved: the unknown-key policy of
        // every touched mirror is byte-for-byte the policy it had before.
        const r = mirror.safeParse({ ...control, [SENTINEL]: illegal });
        expect(r.success).toBe(true);
        if (r.success) expect(r.data[SENTINEL]).toEqual(illegal);
      });
    } else {
      it('is DECLARED on the TS face but ABSENT from the mirror — a runtime slot, per objectui#6152', () => {
        // The type-level pin `_OnNodeClickIsNodeHandler` above carries the
        // declaration half; this is the deliberate asymmetry, recorded in
        // `zod-mirror-parity.test.ts`'s `RuntimeOnlyDeclared`.
        expect(Object.keys(TreeViewSchema.shape)).not.toContain(key);
      });

      it('a document carrying it is admitted unexamined, exactly as before', () => {
        const r = TreeViewSchema.safeParse({ ...control, [key]: legal });
        expect(r.success).toBe(true);
      });

      it('is INVOKED at its read site, not merely read', () => {
        const src = readFileSync(join(REPO_ROOT, reader), 'utf8');
        expect(src).toContain('if (schema.onNodeClick)');
        expect(src).toContain('schema.onNodeClick(node)');
      });
    }
  });
});
