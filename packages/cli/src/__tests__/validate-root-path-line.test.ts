/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `objectui validate` and the ROOT-LEVEL issue (objectui#7004, mechanical half).
 *
 * The arm-selection half of the same card landed later, on the 2026-09-02
 * ruling; its contract lives in `validate-union-arm-selection.test.ts`. The last
 * describe block here was the boundary pin that made that landing an explicit
 * edit, and now restates the new semantics from this file's point of view.
 *
 * The printer used to guard its Path line with `issue.path.length > 0`, so an
 * issue at the document root (`path: []`) printed no Path line at all — silent
 * in precisely the case a reader most needs oriented.
 *
 * That case is the common one, not an edge: `safeValidateSchema` runs
 * `AnyComponentSchema`, a `z.union` over every component arm, so any document
 * matching no arm yields ONE top-level issue — `invalid_union` · `Invalid
 * input` · `path: []`. Measured on the parent commit of this file, a menu
 * carrying the retired `{ type: 'separator' }` divider spelling printed:
 *
 *     1. Invalid input
 *        Code: invalid_union
 *
 * — a bare verdict on a whole document, with nothing saying which node had
 * been judged.
 *
 * ⚠️ These cases are written against BOTH sides of the guard on purpose. A fix
 * that printed `(root)` unconditionally would satisfy a root-only test while
 * destroying the real paths authors depend on, so the non-root control below
 * is load-bearing, not decoration.
 *
 * Harness (fixtures under `os.tmpdir()`, `process.exit` recorded rather than
 * taken) follows `validate-widget-namespace.test.ts`; see its header for why
 * fixtures never live in the repo tree.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validate } from '../commands/validate.js';

/**
 * The CSI sequences chalk may add. The escape byte is built with
 * `String.fromCharCode` rather than spelled into the source, so this file holds
 * no raw control character and no escape a tooling pass could materialise into
 * one (objectui AGENTS.md byte discipline).
 */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/**
 * A menu whose item uses the divider spelling retired in objectui#6523. This
 * is the document the finding was measured on: `MenuItemSchema` is a union, so
 * its diagnosis rides the per-arm issues while the top-level issue stays at the
 * root.
 */
const MENU_WITH_RETIRED_DIVIDER = {
  type: 'dropdown-menu',
  items: [{ label: 'New Tab', type: 'separator' }],
};

/** A document from an entirely foreign vocabulary — the other root producer. */
const FOREIGN_DOCUMENT = { type: 'module', main: './index.js' };

/**
 * The non-root control, lifted from `validate-widget-namespace.test.ts` so both
 * files pin the same observed path for the same input.
 */
const FORM_WITH_UNRESOLVABLE_WIDGET = {
  type: 'form',
  fields: [{ name: 'pw', widget: 'ui:password' }],
};

let dir: string;
let out: string[];
let exitCodes: number[];
let restore: () => void;

/** Everything the command printed, chalk colour codes stripped. */
function printed(): string {
  return out.join('\n').replace(ANSI, '');
}

function writeSchema(name: string, schema: unknown): string {
  const file = join(dir, name);
  writeFileSync(file, JSON.stringify(schema, null, 2), 'utf-8');
  return file;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'objectui-validate-7004-'));
  out = [];
  exitCodes = [];
  const originalLog = console.log;
  const originalError = console.error;
  const capture = (...args: unknown[]) => {
    out.push(args.map(String).join(' '));
  };
  console.log = capture;
  console.error = capture;
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as never);
  restore = () => {
    console.log = originalLog;
    console.error = originalError;
    exitSpy.mockRestore();
  };
});

afterEach(() => {
  restore();
  rmSync(dir, { recursive: true, force: true });
});

describe('objectui validate — a root-level issue says it is at the root', () => {
  it('prints a Path line for the union failure that used to print none', async () => {
    await validate(writeSchema('menu.json', MENU_WITH_RETIRED_DIVIDER));

    expect(exitCodes).toEqual([1]);
    const text = printed();
    // The three fields, in the order the printer emits them. The middle one is
    // the whole card: before this change the message and Code lines were
    // adjacent, with nothing between them.
    expect(text).toContain('1. Invalid input');
    expect(text).toContain('Path: (root)');
    expect(text).toContain('Code: invalid_union');
  });

  it('does the same for a document from a foreign vocabulary', async () => {
    await validate(writeSchema('package.json', FOREIGN_DOCUMENT));

    expect(exitCodes).toEqual([1]);
    expect(printed()).toContain('Path: (root)');
  });

  it('gives EVERY reported issue a Path line, root or not', async () => {
    // Structural rather than by-example: the defect was an absence, and the
    // repair is "no numbered issue is ever printed without a Path". Asserting
    // one example line would not catch a future guard reintroducing the hole
    // on some other issue shape.
    await validate(writeSchema('menu.json', MENU_WITH_RETIRED_DIVIDER));

    const lines = printed().split('\n');
    const numbered = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /^\d+\. /.test(line.trim()));
    expect(numbered.length).toBeGreaterThan(0);
    for (const { line, i } of numbered) {
      expect(
        lines[i + 1]?.trim().startsWith('Path: '),
        `issue "${line.trim()}" printed no Path line`,
      ).toBe(true);
    }
  });
});

describe('objectui validate — a real path is still a real path', () => {
  it('prints the authored path unchanged, and does not call it the root', async () => {
    // The guard against the fix that "passes" by printing (root) for
    // everything.
    await validate(writeSchema('form.json', FORM_WITH_UNRESOLVABLE_WIDGET));

    expect(exitCodes).toEqual([1]);
    const text = printed();
    expect(text).toContain('Path: fields → 0 → widget');
    expect(text).not.toContain('(root)');
  });

  it('still exits 0 and prints no Path line on a document that validates', async () => {
    await validate(
      writeSchema('ok.json', { type: 'form', fields: [{ name: 'pw', type: 'password' }] }),
    );

    expect(exitCodes).toEqual([0]);
    const text = printed();
    expect(text).toContain('Schema is valid!');
    expect(text).not.toContain('Path:');
  });
});

describe('objectui validate — the arm-selection half, now that it is ruled', () => {
  /**
   * ⚠️ This case USED to pin the opposite. It was written as a deliberate
   * boundary: while the arm-selection question was with the maintainer, it
   * asserted that the printer walked only the top level — `not.toContain
   * ('RETIRED (objectui#6523)')`, `not.toContain('Path: items')` — so that when
   * the ruling landed it would land as an explicit edit against a RED test
   * rather than as a silent widening.
   *
   * The 2026-09-02 ruling landed (option B: the arm the document's `type`
   * selects, nothing from the others), so the boundary moved and these
   * assertions are inverted. That is the mechanism working, not a test being
   * loosened: the pin forced this file to be opened and the semantics restated
   * by hand.
   *
   * The full contract lives in `validate-union-arm-selection.test.ts`. What
   * stays HERE is the part this file has always been about — that widening the
   * printer did not cost the root-path line, and did not turn one top-level
   * issue into many.
   */
  it('surfaces the selected arm\'s diagnosis without multiplying top-level entries', async () => {
    await validate(writeSchema('menu.json', MENU_WITH_RETIRED_DIVIDER));

    const text = printed();
    // Was `not.toContain` until the ruling. The objectui#6523 tombstone text
    // rides the per-arm issues, which is exactly why it never reached an author.
    expect(text).toContain('RETIRED (objectui#6523)');
    expect(text).toContain('Path: items → 0 → type');
    // Unchanged, and load-bearing: the top-level entry still carries the root
    // path line this file exists for.
    expect(text).toContain('Path: (root)');
    // Still exactly one NUMBERED issue. Arm entries are `1.1`-shaped, so a
    // reader (and this assertion) can still count the top-level failures — an
    // arm walk that emitted them as `2.`, `3.` … would have multiplied this.
    const numbered = printed()
      .split('\n')
      .filter((line) => /^\d+\. /.test(line.trim()));
    expect(numbered).toHaveLength(1);
  });
});
