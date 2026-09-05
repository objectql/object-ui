/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `'kanban'` arm declares the plugin dialect, and the validator applies it
 * (objectui#7664 — maintainer ruling (a), 2026-09-05, decision batch #41).
 *
 * ## The defect this pins shut
 *
 * For an authored `type: 'kanban'` document two different types were
 * authoritative depending on who asked: `safeValidateSchema` (the CLI's
 * `validate` / `check`) honoured `DeclarativeKanbanSchema` — `columns` with
 * `color`, `draggable`, cards with `labels` / `priority` — while the renderer
 * registered for the key (`ObjectKanbanRenderer`, `@object-ui/plugin-kanban`)
 * consumed that package's own `KanbanSchema` — `objectName` / `groupBy` /
 * `cardTitle` / `cardFields`, cards with `badges`. A board could pass
 * validation and render EMPTY (objectui#6086 measured the consequence). The
 * ruling: the PLUGIN dialect is authoritative. This package now declares it
 * (`complex.ts`, mirrored in `zod/complex.zod.ts`), `SchemaRegistry['kanban']`
 * names it, the plugin imports it back, and the declarative trio retired.
 *
 * ## What is pinned, and in which channel
 *
 *   1. COMPILE-TIME — `SchemaRegistry['kanban']` IS `KanbanSchema` (the
 *      objectui#7645 interim value `BaseSchema & { type: 'kanban' }` is gone,
 *      and the published `ComponentType` union still yields `'kanban'`, the
 *      `_KeyKept` pin carried forward from the retired 7645 file); the
 *      `ComplexSchema` arm is the same type; the retired keys read `undefined`
 *      off the interface (`?: never`); the two runtime slots stay callable.
 *      Vitest strips types without checking them, so these mean something only
 *      under `tsc -p packages/types/tsconfig.test.json` (chained off the
 *      package's `type-check` script). A green vitest run is NOT evidence about
 *      them.
 *   2. RUNTIME — the ruling's three accept-set pins, through
 *      `safeValidateSchema` itself (the union the CLI applies): an
 *      `objectName` / `groupBy` board passes; a static `columns[].cards[]`
 *      board in the plugin dialect passes; a board in the retired dialect is
 *      REFUSED, and the refusal names the retired shape at the key that
 *      betrayed it. `z.union` nests a failing arm's issues under
 *      `invalid_union.errors`, so the reader below walks that tree — the CLI's
 *      arm-selection reader (`packages/cli/src/utils/union-arm-diagnostics.ts`)
 *      is the production counterpart.
 *   3. CENSUS — the declared body is MEASURED off `complex.ts` with the
 *      TypeScript parser, not inherited: the ruling quoted "the 18-member
 *      `KanbanSchema`", an AST census on the same day read 19 (it counts
 *      `type`), and this file was told to trust neither. Pinned at 19 live
 *      members plus the 3 tombstones, by name.
 *
 * ## Why the refusal keys are `draggable` and a column's `color`, not `columns`
 *
 * The ruling's pin reads "a `columns` / `cards` board is refused". Read
 * literally that contradicts the ruled shape: the plugin dialect DECLARES
 * `columns[].cards[]` (a static board — the two catalog entries, pinned in
 * `examples/schema-catalog/test/kanban-column-cards-6939.test.tsx`, are exactly
 * that and render every card). What distinguishes a board written in the
 * RETIRED dialect is the keys it had and this one does not, and every one of
 * them was measured inert in the plugin: the board's `draggable` and a
 * column's `color` have zero read sites, so both are `?: never` tombstones
 * refused by name. The retired CARD keys (`labels`, `assignees`, `dueDate`,
 * `priority`, `content`) are deliberately NOT refused: a card is an open record
 * (`[key: string]: any` — `bucketCardsIntoColumns` pushes raw records into
 * lanes, and a task record legitimately carries `priority` or `dueDate`), so
 * refusing those names would refuse real data. A retired-dialect board that
 * uses none of the refused keys is, member for member, a valid static board of
 * this dialect — and renders.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import type {
  SchemaRegistry,
  ComponentType,
  ComplexSchema,
  KanbanSchema,
  KanbanColumn,
  KanbanCard,
} from '../index';
import {
  BaseSchema as BaseZod,
  KanbanSchema as KanbanZod,
  KanbanColumnSchema as KanbanColumnZod,
  ComplexSchema as ComplexZod,
  safeValidateSchema,
} from '../zod/index.zod';

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
/** `?: never` reads as exactly `undefined` off the interface (the 6124 spelling). */
type RetiredIsNever<T> = Equal<T, undefined>;
/** A runtime slot keeps a callable member: some function type survives the `Extract`. */
type KeepsFunction<T> = [Extract<NonNullable<T>, (...args: never[]) => unknown>] extends [never]
  ? false
  : true;

// Non-vacuity controls: `any` on either side satisfies every `extends` below
// while checking nothing, and `Equal<any, X>` is `false`.
type _RegistryIsReal = Assert<Equal<IsAny<SchemaRegistry>, false>>;
type _DeclaredIsReal = Assert<Equal<IsAny<KanbanSchema>, false>>;

// 1. The published union still yields `'kanban'` — `_KeyKept`, carried forward
//    from the retired objectui#7645 pin. `Extract` collapses to `never` if the
//    key is ever removed, which fails this loudly.
type _KeyKept = Assert<Equal<Extract<ComponentType, 'kanban'>, 'kanban'>>;

// 2. The value IS the declared arm — not the 7645 interim `BaseSchema & { type }`
//    (which `Equal` would reject: it lacks every kanban member), and not the
//    retired declarative face (gone from the package).
type _ValueIsTheDeclaredArm = Assert<Equal<SchemaRegistry['kanban'], KanbanSchema>>;

// 3. `safeValidateSchema`'s type-level counterpart: the `'kanban'` arm of the
//    `ComplexSchema` union is the same declaration.
type _ComplexArmIsTheDeclaredArm = Assert<Equal<Extract<ComplexSchema, { type: 'kanban' }>, KanbanSchema>>;

// 4. The retired dialect's own keys are tombstoned on the TypeScript face
//    (`Equal`, not `extends`: `BaseSchema`'s index signature makes a DELETED
//    member read `any`, which a one-way check would accept).
type _DraggableRetired = Assert<RetiredIsNever<KanbanSchema['draggable']>>;
type _ColumnColorRetired = Assert<RetiredIsNever<KanbanColumn['color']>>;
type _OnColumnAddStillRetired = Assert<RetiredIsNever<KanbanSchema['onColumnAdd']>>;
type _OnCardAddStillRetired = Assert<RetiredIsNever<KanbanSchema['onCardAdd']>>;

// 5. The two runtime slots the board forwards stay callable.
type _OnCardMoveCallable = Assert<KeepsFunction<KanbanSchema['onCardMove']>>;
type _OnQuickAddCallable = Assert<KeepsFunction<KanbanSchema['onQuickAdd']>>;

// 6. A card is an open record — the index signature survived the move, so a
//    raw record field reads `any` rather than failing.
type _CardIsAnOpenRecord = Assert<Equal<IsAny<KanbanCard['priority']>, true>>;
// …and the helpers can fail (synthetic controls, both directions).
type _RetiredIsNeverCanFail = Assert<Equal<RetiredIsNever<(() => void) | undefined>, false>>;
type _KeepsFunctionCanFail = Assert<Equal<KeepsFunction<undefined>, false>>;

/* -------------------------------------------------------------------------- */
/* Runtime pins                                                                */
/* -------------------------------------------------------------------------- */

/** Zod 4 nests a failing `z.union` arm's issues under `invalid_union.errors`. */
type IssueLike = { path: PropertyKey[]; message: string; errors?: IssueLike[][] };
function flattenIssues(issues: IssueLike[]): Array<{ path: string; message: string }> {
  return issues.flatMap((i) =>
    i.errors ? i.errors.flat().flatMap((nested) => flattenIssues([nested])) : [{ path: i.path.join('.'), message: i.message }],
  );
}
function refusals(schema: unknown): Array<{ path: string; message: string }> {
  const r = safeValidateSchema(schema);
  return r.success ? [] : flattenIssues(r.error.issues as unknown as IssueLike[]);
}

/** The ruling's first pin: an object-bound board, as `skills/objectui` teaches it. */
const OBJECT_BOUND_BOARD = {
  type: 'kanban',
  objectName: 'tasks',
  groupBy: 'status',
  cardTitle: 'title',
  cardFields: ['assignee', 'priority'],
  bind: 'tasks',
};

/** A static board in the plugin dialect — the catalog entries' shape, badges included. */
const STATIC_BOARD = {
  type: 'kanban',
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [{ id: '1', title: 'Design', description: 'Wireframes', badges: [{ label: 'High', variant: 'destructive' }] }],
    },
    { id: 'done', title: 'Done', limit: 3, cards: [] },
  ],
};

/** The retired declarative dialect — `schema-reference.md`'s example before this card. */
const RETIRED_DIALECT_BOARD = {
  type: 'kanban',
  draggable: true,
  columns: [
    { id: 'todo', title: 'To Do', color: '#6366f1', cards: [{ id: 'task-1', title: 'Design mockups' }] },
  ],
};

describe("the 'kanban' validator arm accepts what the registered renderer reads (objectui#7664)", () => {
  it('the compile-time pins above are read by tsc, not by this run', () => {
    expect(true).toBe(true);
  });

  it('an objectName / groupBy board passes safeValidateSchema', () => {
    expect(refusals(OBJECT_BOUND_BOARD)).toEqual([]);
  });

  it('a static columns[].cards[] board in the plugin dialect passes safeValidateSchema', () => {
    expect(refusals(STATIC_BOARD)).toEqual([]);
  });

  it('the arm the union selects is the declared one, with every ruled member on its shape', () => {
    // The declaration pin is `.shape`, not `safeParse`: `BaseSchema` is
    // `.passthrough()`, so a DELETED key still parses green.
    const declared = Object.keys(KanbanZod.shape);
    for (const key of [
      'objectName', 'groupBy', 'swimlaneField', 'cardTitle', 'cardFields', 'data', 'limit', 'columns',
      'onCardMove', 'className', 'quickAdd', 'onQuickAdd', 'coverImageField', 'allowCollapse',
      'conditionalFormatting', 'cardTemplates', 'columnWidths', 'grouping',
    ]) {
      expect(declared, `\`${key}\` missing from the kanban mirror's shape`).toContain(key);
    }
    expect(KanbanZod.shape.type.value).toBe('kanban');
    // The refusal arms exist as declared keys — a stripped key would not appear here.
    expect(KanbanZod.shape.draggable).toBeDefined();
    expect(KanbanColumnZod.shape.color).toBeDefined();
  });
});

describe('a board in the retired declarative dialect is refused, naming the retired shape (objectui#7664)', () => {
  it('safeValidateSchema refuses it at `draggable` and at the column `color`', () => {
    const found = refusals(RETIRED_DIALECT_BOARD);
    expect(found).not.toEqual([]);
    const at = (path: string) => found.filter((f) => f.path === path).map((f) => f.message);
    for (const path of ['draggable', 'columns.0.color']) {
      const messages = at(path);
      expect(messages, `no refusal at \`${path}\`: ${JSON.stringify(found)}`).not.toEqual([]);
      for (const message of messages) {
        expect(message).toContain('DeclarativeKanbanSchema');
        expect(message).toContain('objectui#7664');
        expect(message).toContain('RETIRED');
      }
    }
    // The message says what to write instead — the named-refusal payload, not
    // zod's bare `expected never`.
    expect(at('draggable')[0]).toContain('`objectName` + `groupBy`');
    expect(at('columns.0.color')[0]).toContain('`className`');
  });

  it('the same document is refused by the ComplexSchema arm directly, on the same two keys', () => {
    // No union nesting here: the discriminated union selects the arm by `type`.
    const r = ComplexZod.safeParse(RETIRED_DIALECT_BOARD);
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join('.')).sort();
    expect(paths).toEqual(['columns.0.color', 'draggable']);
  });

  it('control: the refusal is about those two keys — removing them makes the same board a valid static one', () => {
    const { draggable: _d, ...board } = RETIRED_DIALECT_BOARD;
    void _d;
    const withoutColor = {
      ...board,
      columns: board.columns.map(({ color: _c, ...col }) => (void _c, col)),
    };
    expect(refusals(withoutColor)).toEqual([]);
  });

  it('the retired handler keys carried over from the declarative face are still refused by name', () => {
    const found = refusals({ ...OBJECT_BOUND_BOARD, onColumnAdd: { action: 'toast' } });
    expect(found.filter((f) => f.path === 'onColumnAdd').map((f) => f.message).join('\n')).toContain('RETIRED (objectui#6124');
  });
});

/* -------------------------------------------------------------------------- */
/* Census — the declared body, measured off the source, not quoted             */
/* -------------------------------------------------------------------------- */

describe('the declared body is measured, not inherited (objectui#7664)', () => {
  const COMPLEX_TS = join(dirname(fileURLToPath(import.meta.url)), '..', 'complex.ts');

  function membersOf(interfaceName: string): Array<{ name: string; never: boolean }> {
    const sf = ts.createSourceFile(COMPLEX_TS, readFileSync(COMPLEX_TS, 'utf8'), ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS);
    const decl = sf.statements.find(
      (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === interfaceName,
    );
    if (!decl) throw new Error(`no top-level interface ${interfaceName} in ${COMPLEX_TS}`);
    return decl.members.filter(ts.isPropertySignature).map((m) => ({
      name: ts.isIdentifier(m.name) || ts.isStringLiteral(m.name) ? m.name.text : m.name.getText(sf),
      never: m.type?.kind === ts.SyntaxKind.NeverKeyword,
    }));
  }

  it('KanbanSchema declares 19 live members (the ruling said 18; a same-day census said 19 — `type` is the difference) and exactly 3 tombstones', () => {
    const members = membersOf('KanbanSchema');
    const live = members.filter((m) => !m.never).map((m) => m.name);
    const tombstoned = members.filter((m) => m.never).map((m) => m.name);
    expect(live).toEqual([
      'type', 'objectName', 'groupBy', 'swimlaneField', 'cardTitle', 'cardFields', 'data', 'limit', 'columns',
      'onCardMove', 'className', 'quickAdd', 'onQuickAdd', 'coverImageField', 'allowCollapse',
      'conditionalFormatting', 'cardTemplates', 'columnWidths', 'grouping',
    ]);
    expect(live).toHaveLength(19);
    expect(tombstoned).toEqual(['draggable', 'onColumnAdd', 'onCardAdd']);
    // Both directions against the mirror, so the number above is the mirror's
    // too: every declared member is a key of the shape, and every shape key the
    // arm ADDS over `BaseSchema` is a declared member. (The parity ratchet,
    // `zod-mirror-parity.test.ts`, holds the TYPES; this holds the key sets.)
    const declared = new Set([...live, ...tombstoned]);
    for (const key of declared) expect(Object.keys(KanbanZod.shape), `\`${key}\` is declared but not mirrored`).toContain(key);
    const baseKeys = new Set(Object.keys(BaseZod.shape));
    const addedByTheArm = Object.keys(KanbanZod.shape).filter((k) => !baseKeys.has(k)).sort();
    expect(addedByTheArm).toEqual([...declared].filter((k) => !baseKeys.has(k)).sort());
  });

  it('KanbanColumn carries the one retired declarative key as its only tombstone', () => {
    const members = membersOf('KanbanColumn');
    expect(members.filter((m) => m.never).map((m) => m.name)).toEqual(['color']);
    expect(members.filter((m) => !m.never).map((m) => m.name)).toEqual(['id', 'title', 'cards', 'limit', 'className', 'collapsed']);
  });

  it('the census reader can fail — a name that is not there throws rather than reading empty', () => {
    expect(() => membersOf('DeclarativeKanbanSchema')).toThrow(/no top-level interface DeclarativeKanbanSchema/);
  });
});
