/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5126 / objectui#5337 — three published skill guides taught a
 * `data-table` bound with `bind`, and `data-table` reads no such key.
 *
 * `DataTableRenderer` takes its rows from `data: rawData = EMPTY_ROWS` off the
 * node (`renderers/complex/data-table.tsx`); the file contains neither `bind`
 * nor `useDataScope`. Copying the old example therefore produced no error and
 * no warning — a table with a correct-looking header over the "No results
 * found" empty state, which is the hardest failure shape for an AI author to
 * self-check. The guides also asserted a mechanism that belongs to a different
 * component: "the table component calls `useDataScope("customers")`".
 *
 * Direction was settled by objectui#5125 (merged PR #5338): the only
 * bind-reading table renderer was DELETED under enforce-or-remove rather than
 * promoted, so `data-table` does not gain `bind` — the teaching is what
 * changes. Today `useDataScope` is called by `list` and `tree-view` in this
 * package, plus the `object-*` widgets in the plugin packages.
 *
 * Three halves, and the first two are what make the third mean anything:
 *
 *   - COUNTER-PROBE. Each guide is asserted to still contain a `bind` key in a
 *     JSON block at all. Without it, "no `data-table` block carries `bind`"
 *     would also pass against a file whose fences this extractor cannot see,
 *     or one that stopped teaching `bind` altogether. A zero is not a reading
 *     until a known-present term proves the method works.
 *   - DOC-SAMENESS. The pin is on the guide bytes, not on a copy: the blocks
 *     are lifted out of the real files at run time, so re-introducing the
 *     defect in any of the three sites fails here.
 *   - BEHAVIOUR. The blocks the guides now teach are fed to the REAL
 *     `SchemaRenderer` and asserted to put rows on screen, and the retired
 *     `bind` form is fed to the same renderer and asserted to produce the
 *     empty state. The correction is verified against the renderer rather
 *     than against a reading of it.
 *
 * The `columns` entries in these examples are deliberately untouched: their
 * `{ name, label }` spelling is the separate open question on objectui#5120
 * (the undeclared `col.name` / `col.label` alias at `data-table.tsx:776-777`),
 * parked with the maintainer. This file pins the BINDING only, and stays true
 * whichever way that one lands — nothing below asserts a column key spelling.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';

// The REAL renderers, imported at module scope so `data-table` / `list` are in
// the registry before the first render (AGENTS.md §测试纪律 — never behind a
// lazy boundary inside a bounded window). The relative path is required: this
// file lives INSIDE `@object-ui/components`, and the bare specifier would be a
// package self-import (`scripts/check-package-self-import.mjs`).
import '../renderers';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

const GUIDES = {
  'skills/objectui/guides/schema-expressions.md': 'schema-expressions',
  'skills/objectui/rules/protocol.md': 'protocol',
  'skills/objectui/guides/data-integration.md': 'data-integration',
} as const;

const GUIDE_PATHS = Object.keys(GUIDES) as (keyof typeof GUIDES)[];

function readGuide(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

/** Every fenced ```json block body in a markdown file, in document order. */
function jsonBlocks(md: string): string[] {
  const out: string[] = [];
  const fence = /```json\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(md)) !== null) out.push(m[1]);
  return out;
}

/**
 * Parse a doc block that may carry `//` comments (the guides annotate their
 * examples inline). Only `//` at line start or after whitespace is stripped,
 * so a `https://` inside a string value is safe. Returns undefined for blocks
 * that are illustrative rather than complete (e.g. `"columns": [...]`).
 */
function parseBlock(body: string): unknown {
  const stripped = body.replace(/(^|\s)\/\/[^\n]*/g, '$1');
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    return undefined;
  }
}

function blocksOfType(md: string, type: string): Record<string, unknown>[] {
  return jsonBlocks(md)
    .map(parseBlock)
    .filter(
      (node): node is Record<string, unknown> =>
        !!node && typeof node === 'object' && (node as Record<string, unknown>).type === type,
    );
}

/** Every rendered body cell's text, row-major. */
function bodyCells(): string[] {
  return Array.from(document.querySelectorAll('tbody td')).map((td) => (td.textContent ?? '').trim());
}

function renderNode(schema: unknown, dataSource: unknown) {
  return render(
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={schema as never} />
    </SchemaRendererProvider>,
  );
}

describe('skill guides — counter-probe before the zero (#5126)', () => {
  it.each(GUIDE_PATHS)('%s still teaches `bind` in a JSON block', (rel) => {
    const md = readGuide(rel);
    const blocks = jsonBlocks(md);

    // The extractor sees this file at all...
    expect(blocks.length).toBeGreaterThan(0);
    // ...and a `bind` key is present in one of the blocks it sees. This is the
    // known-present term: the "no `data-table` block binds" assertion below is
    // only a reading because this one passes.
    expect(blocks.some((b) => /"bind"\s*:/.test(b))).toBe(true);
  });
});

describe('skill guides — no `data-table` example is bound with `bind` (#5126, #5337)', () => {
  it.each(GUIDE_PATHS)('%s', (rel) => {
    const md = readGuide(rel);
    const offenders = jsonBlocks(md).filter(
      (b) => /"type"\s*:\s*"data-table"/.test(b) && /"bind"\s*:/.test(b),
    );
    expect(offenders).toEqual([]);
  });

  it('no guide claims a table component calls useDataScope', () => {
    for (const rel of GUIDE_PATHS) {
      const md = readGuide(rel);
      // The exact retired sentence and its shape: a `data-table` cannot be the
      // subject of a useDataScope claim, because it never calls it.
      expect(md).not.toMatch(/table component calls\s+`?useDataScope/i);
    }
  });
});

describe('skill guides — the taught `data-table` form renders rows (#5126)', () => {
  // A decoy dataSource: it holds exactly the path the retired example bound to.
  // Rows appearing while this is in scope proves they came from the node's
  // inline `data`, not from the provider.
  const DECOY = { customers: [{ name: 'Should Not Appear', email: 'decoy@example.com' }] };

  it.each(['skills/objectui/guides/schema-expressions.md', 'skills/objectui/guides/data-integration.md'] as const)(
    '%s: the inline-`data` table puts its rows on screen',
    (rel) => {
      const [node, ...extra] = blocksOfType(readGuide(rel), 'data-table');
      expect(node, 'the guide must carry a parseable data-table example').toBeTruthy();
      expect(extra).toEqual([]);

      renderNode(node, DECOY);

      expect(screen.queryByText('No results found')).not.toBeInTheDocument();
      expect(screen.queryByText('Should Not Appear')).not.toBeInTheDocument();
      expect(bodyCells()).toEqual([
        'Ada Lovelace',
        'ada@example.com',
        'Grace Hopper',
        'grace@example.com',
      ]);
    },
  );

  it('the retired `bind` form renders the empty state — the defect this card closes', () => {
    // Same node, `data` swapped for the `bind` the guides used to teach, and a
    // provider that really does hold the array. This is the measurement that
    // rules the old teaching false; it is not a claim about the docs.
    const [taught] = blocksOfType(readGuide('skills/objectui/guides/schema-expressions.md'), 'data-table');
    const { data: _rows, ...withoutData } = taught;
    const bound = { ...withoutData, bind: 'customers' };

    renderNode(bound, { customers: _rows });

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    // One body row, and it is the empty state spanning the table — measured,
    // not assumed: the bound array never reaches the renderer at all.
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(bodyCells()).toEqual(['No results foundTry adjusting your filters or search query.']);
  });
});

describe('skill guides — the taught `bind` form renders bound entries (#5126)', () => {
  it.each(GUIDE_PATHS)('%s: its `list` example renders one entry per bound item', (rel) => {
    // Selected by its bound path, not by document order: these guides carry
    // several `list` examples (the data-as-nodes section adds more).
    const node = blocksOfType(readGuide(rel), 'list').find((n) => n.bind === 'customerNames');
    expect(node, 'the guide must carry a parseable list example bound with `bind`').toBeTruthy();

    renderNode(node, { customerNames: ['Ada Lovelace', 'Grace Hopper'] });

    const items = Array.from(document.querySelectorAll('li')).map((li) => (li.textContent ?? '').trim());
    expect(items).toEqual(['Ada Lovelace', 'Grace Hopper']);
  });
});

/**
 * The guides name seven `object-*` widgets as `bind` readers. That list is a
 * claim about the registry, and a wrong entry there is the same silent failure
 * this card exists to close — an author writes the type, nothing is registered
 * under it, and the red "Unknown component type" box is the *good* case.
 *
 * Caught one on the way in: the widget file is `ObjectPivotTable.tsx`, but the
 * key it registers is `object-pivot`.
 *
 * Granularity: the key must be registered by exactly one package, and that
 * package must read `schema.bind` through `useDataScope`. Package-level rather
 * than file-level on purpose — `object-pivot` and `object-data-table` are
 * registered in their package's `index.tsx` around a component that lives in a
 * sibling file, so a same-file assertion would fail on correct code.
 */
describe('skill guides — the `object-*` reader list is not stale (#5126)', () => {
  const pluginRoots = fs
    .readdirSync(path.join(repoRoot, 'packages'))
    .filter((name) => name.startsWith('plugin-'))
    .map((name) => ({ pkg: name, dir: path.join(repoRoot, 'packages', name, 'src') }))
    .filter(({ dir }) => fs.existsSync(dir));

  function sourceText(dir: string): string {
    let out = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        out += sourceText(full);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out += fs.readFileSync(full, 'utf8');
      }
    }
    return out;
  }

  const PACKAGE_TEXT = new Map(pluginRoots.map(({ pkg, dir }) => [pkg, sourceText(dir)]));

  it.each([
    'skills/objectui/guides/schema-expressions.md',
    'skills/objectui/guides/data-integration.md',
  ] as const)('%s names only registered widgets that read `bind`', (rel) => {
    const md = readGuide(rel);
    const paragraph = /the plugin packages register \(([^)]*)\)/.exec(md);
    expect(paragraph, 'the guide must carry the reader list this test judges').toBeTruthy();

    const listed = [...paragraph![1].matchAll(/`(object-[a-z-]+)`/g)].map((m) => m[1]);
    // Counter-probe: a per-key loop over an empty list passes vacuously.
    expect(listed.length).toBeGreaterThan(0);

    for (const key of listed) {
      const registrar = new RegExp(`ComponentRegistry\\.register\\(\\s*'${key}'`);
      const owners = [...PACKAGE_TEXT.entries()].filter(([, text]) => registrar.test(text));
      expect(owners.map(([pkg]) => pkg), `\`${key}\` must be registered by exactly one plugin package`).toHaveLength(1);
      expect(owners[0][1], `\`${key}\`'s package must read schema.bind`).toContain('useDataScope(schema.bind)');
    }
  });
});
