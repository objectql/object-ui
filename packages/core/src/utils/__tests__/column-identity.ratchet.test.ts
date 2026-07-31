/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Ratchet — the column-identity dual read (`field` ?? `name`) may only shrink.
 *
 * objectui#3104. A column's identity is read in two incompatible precedences
 * across the repo, and the two halves land on different fields for the same
 * column (see `ListView.columnIdentity.test.tsx` for the live repro). This file
 * freezes the inventory so the family cannot grow while it is being retired:
 * a new dual read in a new file fails, and an extra one in a listed file fails.
 *
 * Shrinking also fails, deliberately — lower the number here in the same commit
 * that removes the read, so the count in the tree and the count on record never
 * drift apart.
 *
 * If this fails because you added a read: don't. Call `columnIdentity()` from
 * `@object-ui/core` — it resolves canonical-first, so it agrees with the data
 * request instead of racing it. If you genuinely need a new one, add it here
 * WITH a verdict and say why in the PR.
 *
 * The scanner is a line-level heuristic, not a parser: an alternation chain
 * (`||` / `??`) mentioning two or more distinct identity keys as property
 * accesses. That is precise enough to ratchet and loose enough to catch
 * spellings nobody has written yet; it is NOT a judgement that every hit is a
 * defect, which is what `verdict` below records.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/core/src/utils/__tests__ → packages */
const packagesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Keys whose presence in an alternation chain makes it a column-identity read.
 * Two or more DISTINCT ones must appear for a line to count.
 */
const IDENTITY_KEYS = ['field', 'name', 'fieldName'] as const;

/**
 * Keys that count as further members of a chain that already qualifies, but
 * never qualify one on their own. `accessorKey` is TanStack Table's column key
 * and `key` is a generic entry key — neither is ObjectStack metadata identity,
 * and a chain built only from them is not this family.
 */
const COMPANION_KEYS = ['key', 'accessorKey'] as const;

const ACCESS = new RegExp(
  String.raw`(?:\?\.|\.)(${[...IDENTITY_KEYS, ...COMPANION_KEYS].join('|')})\b`,
  'g',
);
const ALTERNATION = /\|\||\?\?/;

type Verdict =
  /** Same concept, two spellings — the family this battle retires (PR2). */
  | 'column-identity'
  /**
   * Two LAYERS, not two spellings: both keys are declared, mean different
   * things, and both precedences are correct. Counted so the inventory is
   * honest and so these files cannot quietly grow a real dual read, but they
   * are NOT convergence targets.
   */
  | 'two-layer'
  /** The form-field cluster — a separate battle, settled the other way (#3090). */
  | 'form-cluster'
  /** Not an identity read at all (a join, or an unrelated fallback). */
  | 'unrelated';

interface Entry {
  count: number;
  /** Which key wins, for the reads that are a column identity. */
  order?: 'field-first' | 'name-first' | 'adapter-first';
  verdict: Verdict;
  why: string;
}

/**
 * The inventory, as of objectui#3104 PR1.
 *
 * The headline is not that two precedences exist — it is that ListView and
 * ObjectGrid each disagree with THEMSELVES. Both build their `$expand` /
 * `$select` from `f?.field` alone (a single-key read the scanner cannot see,
 * because it is not an alternation) while every render-side read in the same
 * file is name-first. That is the mechanism behind "relation column shows a
 * bare id": the request asks for one field, the renderer shows another.
 */
const INVENTORY: Record<string, Entry> = {
  // ── the column-identity family (24) ──────────────────────────────────────
  'plugin-list/src/ListView.tsx': {
    count: 9,
    order: 'name-first',
    verdict: 'column-identity',
    why: 'FLS gate, hidden-field filter, fieldOrder, export ×2, hide-fields list — all name-first, while $expand/$select in the same file read `f?.field` only.',
  },
  'plugin-detail/src/RelatedList.tsx': {
    count: 8,
    order: 'adapter-first',
    verdict: 'column-identity',
    why: '`accessorKey || field || name` — merges TanStack\'s column key with metadata identity. The adapter key is out of scope; the `field || name` tail is not.',
  },
  'core/src/utils/expand-fields.ts': {
    count: 1,
    order: 'field-first',
    verdict: 'column-identity',
    why: 'The request path. Canonical-first, so it is the side the renderers must converge ONTO.',
  },
  'plugin-grid/src/ObjectGrid.tsx': {
    count: 1,
    order: 'name-first',
    verdict: 'column-identity',
    why: 'The `ensureId` probe is name-first while `getSelectFields` right below it reads `c.field` only — the same self-disagreement as ListView.',
  },
  'plugin-tree/src/ObjectTree.tsx': {
    count: 1,
    order: 'name-first',
    verdict: 'column-identity',
    why: 'Tree column identity.',
  },
  'plugin-detail/src/renderers/record-details.tsx': {
    count: 1,
    order: 'field-first',
    verdict: 'column-identity',
    why: 'Detail field entry identity.',
  },
  'plugin-detail/src/renderers/record-related-list.tsx': {
    count: 1,
    order: 'field-first',
    verdict: 'column-identity',
    why: 'Related-list column identity.',
  },
  'app-shell/src/views/metadata-admin/previews/ViewPreview.tsx': {
    count: 1,
    order: 'field-first',
    verdict: 'column-identity',
    why: 'Studio preview column identity.',
  },
  'app-shell/src/views/metadata-admin/SchemaForm.tsx': {
    count: 1,
    order: 'field-first',
    verdict: 'column-identity',
    why: 'Renders a column array into a summary string.',
  },

  // ── two layers, not two spellings (6) ────────────────────────────────────
  'app-shell/src/utils/resolveActionParams.ts': {
    count: 3,
    verdict: 'two-layer',
    why: 'BOTH orders appear here and both are right: `field ?? name` picks the key to read off the ROW (row data is keyed by object field), `name ?? field` names the PARAM in the action payload, defaulting to the field it binds. Two concepts, not two spellings.',
  },
  'core/src/utils/dashboard-filters.ts': {
    count: 1,
    verdict: 'two-layer',
    why: '`DashboardFilterDef` declares both: `name` is the filter variable\'s handle, `field` is the object field it targets. `name || field` defaults an unnamed filter\'s handle to its field — a derivation, not a dual read.',
  },
  'app-shell/src/views/metadata-admin/previews/ActionPreview.tsx': {
    count: 1,
    verdict: 'two-layer',
    why: 'Action param name, same layering as resolveActionParams.',
  },
  'plugin-grid/src/resolveBulkActions.ts': {
    count: 1,
    verdict: 'two-layer',
    why: 'Action param name, same layering as resolveActionParams.',
  },

  // ── the form cluster — settled the other way (#3090) (2) ─────────────────
  'plugin-form/src/ObjectForm.tsx': {
    count: 1,
    verdict: 'form-cluster',
    why: '#3090 established that spec FormField (`field`) and runtime FormField (`name`) are two LAYERS; the join is deliberate and lives in `normalizeSectionField`.',
  },
  'plugin-form/src/sectionFields.ts': {
    count: 1,
    verdict: 'form-cluster',
    why: 'The #3090 hub itself.',
  },

  // ── not identity reads (2) ───────────────────────────────────────────────
  'app-shell/src/views/metadata-admin/widgets.tsx': {
    count: 1,
    verdict: 'unrelated',
    why: '`fields.find(f => f.name === r.field)` — a join between a field list and a rule\'s field reference, matched only because both keys share a line.',
  },
  'plugin-chatbot/src/ChatbotEnhanced.tsx': {
    count: 1,
    verdict: 'unrelated',
    why: '`c.object ?? c.name` — a citation label fallback that happens to sit on a line mentioning `c.field`.',
  },
};

function collectSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = entry.name;
      if (name === 'node_modules' || name === 'dist' || name === '__tests__') continue;
      const full = path.join(dir, name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.(test|spec|d)\.tsx?$/.test(name)) out.push(full);
    }
  };
  for (const pkg of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = path.join(packagesRoot, pkg.name, 'src');
    try {
      walk(src);
    } catch {
      // A package without a `src` directory — nothing to scan.
    }
  }
  return out;
}

/** `{ 'pkg/src/File.tsx': ['pkg/src/File.tsx:12 :: <line>'] }` */
function scan(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of collectSourceFiles()) {
    const rel = path.relative(packagesRoot, file).split(path.sep).join('/');
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (!ALTERNATION.test(line)) return;
      const keys = [...line.matchAll(ACCESS)].map((m) => m[1] as string);
      const distinct = new Set(keys.filter((k) => (IDENTITY_KEYS as readonly string[]).includes(k)));
      if (distinct.size < 2) return;
      const list = found.get(rel) ?? [];
      list.push(`${rel}:${i + 1} :: ${line.trim().slice(0, 120)}`);
      found.set(rel, list);
    });
  }
  return found;
}

const sum = (pick: (e: Entry) => boolean) =>
  Object.values(INVENTORY).filter(pick).reduce((n, e) => n + e.count, 0);

describe('column identity dual-read ratchet (#3104)', () => {
  it('scans a plausible number of package source files (guards a broken scan path)', () => {
    expect(collectSourceFiles().length).toBeGreaterThan(500);
  });

  it('finds no dual read in a file the inventory does not list', () => {
    const unlisted = [...scan().entries()]
      .filter(([file]) => !(file in INVENTORY))
      .flatMap(([, lines]) => lines);
    // If this fails: read `columnIdentity()` from `@object-ui/core` instead of
    // spelling out another `field ?? name`. That is the whole point of #3104.
    expect(unlisted).toEqual([]);
  });

  it('matches the recorded count in every listed file', () => {
    const found = scan();
    const drift: string[] = [];
    for (const [file, entry] of Object.entries(INVENTORY)) {
      const actual = found.get(file)?.length ?? 0;
      if (actual === entry.count) continue;
      drift.push(
        actual > entry.count
          ? `${file}: ${actual} dual reads, inventory says ${entry.count} — converge it onto columnIdentity() instead of adding another.`
          : `${file}: ${actual} dual reads, inventory says ${entry.count} — good news; lower the count in this file to match.`,
      );
    }
    expect(drift).toEqual([]);
  });

  it('keeps the family total from growing', () => {
    // The number that has to reach zero. The other verdicts are inventory, not
    // worklist: `two-layer` and `form-cluster` are settled decisions, and
    // `unrelated` is scanner noise recorded so it cannot hide a real one.
    expect(sum((e) => e.verdict === 'column-identity')).toBe(24);
    expect(sum(() => true)).toBe(34);
  });

  it('records a precedence for every read in the family', () => {
    const missing = Object.entries(INVENTORY)
      .filter(([, e]) => e.verdict === 'column-identity' && !e.order)
      .map(([file]) => file);
    expect(missing).toEqual([]);
  });

  it('still shows both precedences in the family — the pollution this closes', () => {
    const orders = new Set(
      Object.values(INVENTORY)
        .filter((e) => e.verdict === 'column-identity')
        .map((e) => e.order),
    );
    // When PR2 lands this becomes a single order and this assertion inverts.
    expect(orders.size).toBeGreaterThan(1);
  });
});
