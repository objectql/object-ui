import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sweep, textFootprint } from '../check-i18n-dead-keys.mjs';

/**
 * objectui#4658 — the behaviour test for `scripts/check-i18n-dead-keys.mjs`,
 * the reverse sweep: pack key set MINUS referenced key set.
 *
 * `scripts/__tests__/check-i18n-call-site-keys.test.ts` already pins the
 * forward direction (call site -> pack) against synthetic repos of the same
 * shape; this file pins the mirror question (pack -> call site) the same way,
 * using `sweep()`/`textFootprint()` directly rather than a second AST walker,
 * because there is no second walker — `analyze()` (extended for this card, not
 * duplicated) supplies both directions from one pass. What is worth pinning
 * here is specific to THIS file's own logic: which of the three "still live"
 * escape hatches (literal + plural-suffix, `returnObjects` branch, dynamic
 * template head) keeps a referenced key out of the candidate set, and whether
 * the text safety net correctly tells a truly-dead key (CONFIRMED) apart from
 * one some other file merely mentions in passing (NEEDS-REVIEW) — including
 * the one case that would silently break both tiers at once: a key's own
 * definition line, inside the locale pack itself, must never count as
 * evidence that the key is referenced.
 */

const tempRoots: string[] = [];

/**
 * Interpolated into the fixture SOURCES below rather than written out —
 * `scripts-type-check.test.ts` greps this directory for import statements
 * naming a workspace package, to pin that `scripts/` needs no workspace
 * build, and its regex cannot tell a string literal (or a template literal's
 * static text) from a real import statement. Same reason
 * `check-i18n-call-site-keys.test.ts` does this for the same specifier.
 */
const I18N_PKG = '@object-ui/i18n';

/** Materialises `{ 'packages/x/src/a.tsx': '…' }` into a throwaway repo root —
 *  same helper as check-i18n-call-site-keys.test.ts, duplicated rather than
 *  imported: each gate's test suite owns its own fixtures. */
function repoWith(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'check-i18n-dead-keys-'));
  tempRoots.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return root;
}

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * A fixture pack with one key of each shape this file's escape hatches must
 * recognise, plus two that must NOT be recognised (the actual dead ones).
 */
const EN_FIXTURE = `const en = {
  common: {
    save: 'Save',
    deadLabel: 'Nobody asks for this',
    deadButMentioned: 'Nobody calls t() for this either',
  },
  plural: { count_one: '{{count}} item', count_other: '{{count}} items' },
  bulk: { a: 'A', b: 'B' },
  dynamic: { category: { electronics: 'Electronics', books: 'Books' } },
} as const;
export default en;
`;

/** A component exercising every "still live" shape: a plain literal call, a
 *  `returnObjects` branch consumption, a plural-suffixed key referenced by its
 *  base name, and a template-built dynamic key. */
const CONSUMER_SOURCE = `
import { useObjectTranslation } from '${I18N_PKG}';
export function Widget({ categoryId }: { categoryId: string }) {
  const { t } = useObjectTranslation();
  return [
    t('common.save'),
    t('bulk', { returnObjects: true }),
    t('plural.count', { count: 3 }),
    t(\`dynamic.category.\${categoryId}\`),
  ];
}
`;

/** A SECOND, unrelated component that mentions \`common.deadButMentioned\` as a
 *  plain string property — never as an argument of t()/tt() — the indirect
 *  reference shape (\`{ labelKey: '…', … }\`, consumed elsewhere through a
 *  variable) that the AST pass structurally cannot see and the text safety
 *  net exists to catch. */
const INDIRECT_MENTION_SOURCE = `
export const FIELD_CONFIG = [
  { name: 'save', labelKey: 'common.save' },
  { name: 'dead', labelKey: 'common.deadButMentioned' },
];
`;

function fixtureRoot() {
  return repoWith({
    'packages/i18n/src/locales/en.ts': EN_FIXTURE,
    'packages/x/src/Widget.tsx': CONSUMER_SOURCE,
    'packages/x/src/fieldConfig.ts': INDIRECT_MENTION_SOURCE,
  });
}

describe('sweep()', () => {
  it('excludes a key referenced by a plain literal call site', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('common.save');
    expect(needsReview.map((f) => f.key)).not.toContain('common.save');
  });

  it('excludes every leaf under a branch consumed via returnObjects', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('bulk.a');
    expect(confirmed).not.toContain('bulk.b');
    expect(needsReview.map((f) => f.key)).not.toContain('bulk.a');
    expect(needsReview.map((f) => f.key)).not.toContain('bulk.b');
  });

  it('excludes both plural-suffixed leaves when the base key is referenced', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('plural.count_one');
    expect(confirmed).not.toContain('plural.count_other');
    expect(needsReview.map((f) => f.key)).not.toContain('plural.count_one');
    expect(needsReview.map((f) => f.key)).not.toContain('plural.count_other');
  });

  it('excludes every leaf sharing a dynamic template key\'s static head', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('dynamic.category.electronics');
    expect(confirmed).not.toContain('dynamic.category.books');
    expect(needsReview.map((f) => f.key)).not.toContain('dynamic.category.electronics');
    expect(needsReview.map((f) => f.key)).not.toContain('dynamic.category.books');
  });

  it('CONFIRMS a key with no call site and no textual footprint anywhere else', () => {
    const { confirmed } = sweep(fixtureRoot());
    expect(confirmed).toContain('common.deadLabel');
  });

  it('does NOT confirm a key merely because its own definition line exists in the pack', () => {
    // Every candidate's defining line lives in `packages/i18n/src/locales/en.ts`
    // by construction — if that line counted as a textual hit, EVERY dead key
    // would land in needsReview and `confirmed` would always be empty.
    const { confirmed } = sweep(fixtureRoot());
    expect(confirmed.length).toBeGreaterThan(0);
  });

  it('demotes a key to NEEDS-REVIEW when its literal string appears outside a t() call', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('common.deadButMentioned');
    const entry = needsReview.find((f) => f.key === 'common.deadButMentioned');
    expect(entry, 'common.deadButMentioned should be in needsReview').toBeDefined();
    expect(entry!.hits).toEqual(['packages/x/src/fieldConfig.ts']);
  });

  it('is not a trivially-empty comparison', () => {
    const { totalPackKeys, referencedKeyCount } = sweep(fixtureRoot());
    expect(totalPackKeys).toBeGreaterThan(0);
    expect(referencedKeyCount).toBeGreaterThan(0);
  });

  it('buckets by two segments once a key is at least three deep, else by its own top segment', () => {
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': `const en = {
        console: { objectView: { deadOne: 'One', deadTwo: 'Two' } },
        common: { deadThree: 'Three' },
      } as const;
      export default en;`,
      'packages/x/src/empty.ts': 'export const noop = 1;',
    });
    const { byNamespace } = sweep(root);
    expect(byNamespace.get('console.objectView')?.confirmed.sort()).toEqual([
      'console.objectView.deadOne',
      'console.objectView.deadTwo',
    ]);
    expect(byNamespace.get('common')?.confirmed).toEqual(['common.deadThree']);
  });
});

describe('textFootprint()', () => {
  it('returns an empty hit list for a key present nowhere but the locale packs', () => {
    const root = fixtureRoot();
    const result = textFootprint(root, ['common.deadLabel']);
    expect(result.get('common.deadLabel')).toEqual([]);
  });

  it('finds the file for a key mentioned as plain text outside a t() call', () => {
    const root = fixtureRoot();
    const result = textFootprint(root, ['common.deadButMentioned']);
    expect(result.get('common.deadButMentioned')).toEqual(['packages/x/src/fieldConfig.ts']);
  });

  it('excludes the locale pack directory itself from the hit list', () => {
    // `common.save` appears in en.ts (its own definition), in Widget.tsx (a
    // real `t('common.save')` call), AND in fieldConfig.ts (the
    // indirect-reference fixture) — only the latter two must be reported; the
    // first is the definition, not a reference, and would swamp every key's
    // hit list with a false "confirmed dead things are actually referenced"
    // signal if it were not excluded.
    const root = fixtureRoot();
    const result = textFootprint(root, ['common.save']);
    expect(result.get('common.save')).toEqual(['packages/x/src/Widget.tsx', 'packages/x/src/fieldConfig.ts'].sort());
  });

  it('returns an empty map without invoking grep when given no keys', () => {
    const root = fixtureRoot();
    expect(textFootprint(root, [])).toEqual(new Map());
  });
});

describe('the collapse guard lives in the CLI block, not in sweep() itself', () => {
  it('sweep() runs against a small synthetic fixture without throwing', () => {
    // Unlike the CLI entry point (which exits 1 below ~2000 keys on the REAL
    // repo — see the header), `sweep()` itself must stay usable against small
    // fixtures, which is exactly what every test above already relies on.
    expect(() => sweep(fixtureRoot())).not.toThrow();
  });
});

describe('the script is wired for discovery, not for enforcement', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  it('package.json exposes it as a named script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:i18n-dead-keys']).toBe('node scripts/check-i18n-dead-keys.mjs');
  });

  it('is NOT invoked by any GitHub workflow — report-only, per its own header', () => {
    const workflowsDir = path.join(repoRoot, '.github/workflows');
    for (const file of fs.readdirSync(workflowsDir)) {
      if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
      const contents = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
      expect(contents, `${file} must not run check:i18n-dead-keys`).not.toMatch(/check:i18n-dead-keys/);
      expect(contents, `${file} must not run check-i18n-dead-keys.mjs directly`).not.toMatch(
        /check-i18n-dead-keys\.mjs/,
      );
    }
  });
});
