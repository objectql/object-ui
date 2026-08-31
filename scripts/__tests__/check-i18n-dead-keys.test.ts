import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { propertyChainProbe, sweep, textFootprint } from '../check-i18n-dead-keys.mjs';

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

/**
 * objectui#6666 — the property-chain leg.
 *
 * A consumer that imports a locale PACK OBJECT and reads it by property access
 * spells neither a `t()` call nor the dotted key, so BOTH of the gate's legs
 * were blind to it and the key landed in CONFIRMED — the tier documented as
 * the safest thing to delete — with a shipping screen rendering it.
 *
 * What is pinned below is not "the leg detects things" but that it
 * DISCRIMINATES: a key a pack-object consumer really reads is found, and a key
 * with no reader at all is still reported CONFIRMED. A leg that demoted
 * everything would pass a detection-only test while destroying the top tier,
 * which is the failure mode this file exists to make impossible to ship.
 */

/** A pack shaped like the real bootstrap case: a namespace read through a
 *  local binding, siblings that nobody reads, and the two shapes the leg's own
 *  boundaries turn on (a two-segment key, and a leaf that PREFIXES a longer
 *  sibling leaf). */
const PACK_READER_EN = `const en = {
  splash: {
    steps: { connecting: 'Connecting', loadingConfig: 'Loading configuration', connect: 'Connect' },
    failure: { unreachable: 'Server unreachable', giveUp: 'Giving up' },
  },
  short: { ok: 'OK' },
} as const;
export default en;
`;

/** The LoadingScreen shape: imports the pack object, binds a namespace to a
 *  local, reads leaves off it. No `t()`/`tt()` call anywhere, so the AST pass
 *  visits nothing; the dotted key is never spelled, so the full-key probe
 *  finds nothing. `response.ok` is the two-segment trap — the chain of
 *  `short.ok` is exactly `.ok`, and it is present in this source. */
const PACK_PROPERTY_READER = `
import { en as enLocale } from '${I18N_PKG}';
export function Splash(response: { ok: boolean }) {
  const strings = enLocale.splash;
  if (!response.ok) return null;
  return [strings.steps.connecting, strings.steps.loadingConfig];
}
`;

function packReaderRoot() {
  return repoWith({
    'packages/i18n/src/locales/en.ts': PACK_READER_EN,
    'packages/x/src/Splash.tsx': PACK_PROPERTY_READER,
  });
}

describe('propertyChainProbe()', () => {
  it('drops the leading namespace segment and keeps the dot', () => {
    expect(propertyChainProbe('ns.group.leaf')).toBe('.group.leaf');
    expect(propertyChainProbe('ns.a.b.c')).toBe('.a.b.c');
  });

  it('returns null below three segments — the leg must NOT apply to two-segment keys', () => {
    // A two-segment key's chain is a single generic word (`.ok`, `.no`,
    // `.empty`). Probing on it would demote most of the pack on incidental
    // property accesses and hollow out CONFIRMED instead of correcting it.
    // Two-segment keys are checked against the enumerated importer list in the
    // script header by hand — see objectui#6662, which did exactly that.
    expect(propertyChainProbe('ns.leaf')).toBeNull();
    expect(propertyChainProbe('leaf')).toBeNull();
  });
});

describe('the property-chain leg discriminates (objectui#6666)', () => {
  it('POSITIVE control: a key read only by property access is no longer CONFIRMED', () => {
    const { confirmed, needsReview } = sweep(packReaderRoot());
    expect(confirmed).not.toContain('splash.steps.connecting');
    expect(confirmed).not.toContain('splash.steps.loadingConfig');
    const entry = needsReview.find((f) => f.key === 'splash.steps.connecting');
    expect(entry, 'splash.steps.connecting should be in needsReview').toBeDefined();
    expect(entry!.hits).toEqual(['packages/x/src/Splash.tsx (via property chain)']);
  });

  it('NEGATIVE control: a key with no reader at all is STILL CONFIRMED', () => {
    // The half that makes this a discriminator rather than a blanket
    // demotion. These two live in the same pack, under a sibling namespace of
    // the one the consumer binds, and nothing reads them by any route.
    const { confirmed } = sweep(packReaderRoot());
    expect(confirmed).toContain('splash.failure.unreachable');
    expect(confirmed).toContain('splash.failure.giveUp');
  });

  it('does not demote a two-segment key whose one-word chain IS present in source', () => {
    // `short.ok`'s chain would be `.ok`, and `PACK_PROPERTY_READER` spells
    // `response.ok`. If the leg ever starts applying below three segments this
    // is the assertion that catches it.
    const { confirmed } = sweep(packReaderRoot());
    expect(confirmed).toContain('short.ok');
  });

  it('does not demote a leaf merely because a LONGER sibling leaf is read', () => {
    // `splash.steps.connect`'s chain `.steps.connect` is a prefix of the
    // `.steps.connecting` the consumer actually reads. Without the
    // property-boundary check, reading one leaf would demote the other.
    const { confirmed } = sweep(packReaderRoot());
    expect(confirmed).toContain('splash.steps.connect');
  });

  it('does not shrink the CONFIRMED tier to nothing', () => {
    // The blunt guard against "make the tool conservative by demoting
    // everything": that would pass every detection assertion above while
    // making the strongest tier meaningless.
    const { confirmed } = sweep(packReaderRoot());
    expect(confirmed.length).toBeGreaterThan(0);
  });
});

describe('textFootprint() marks a chain-only hit so the report cannot mislead', () => {
  it('suffixes a file the full key does not appear in', () => {
    const result = textFootprint(packReaderRoot(), ['splash.steps.connecting']);
    expect(result.get('splash.steps.connecting')).toEqual([
      'packages/x/src/Splash.tsx (via property chain)',
    ]);
  });

  it('reports a file plainly when the literal key appears in it, even if the chain also does', () => {
    // The literal spelling is the stronger evidence and needs no explanation;
    // a suffix there would send the reader looking for a property access that
    // is not the reason the file matched.
    const root = repoWith({
      'packages/i18n/src/locales/en.ts': PACK_READER_EN,
      'packages/x/src/config.ts': `export const C = [{ labelKey: 'splash.steps.connecting' }];`,
    });
    expect(textFootprint(root, ['splash.steps.connecting']).get('splash.steps.connecting')).toEqual([
      'packages/x/src/config.ts',
    ]);
  });
});

describe('both control groups from the card, measured on THIS repository (objectui#6666)', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  /**
   * Assembled from segments rather than written as dotted strings ON PURPOSE,
   * and it must stay that way. `textFootprint()` greps the whole repo
   * including `scripts/`, so a dotted key spelled here would make THIS FILE a
   * textual hit for it — the negative controls below would stop being
   * reader-less because the test asserting they are reader-less mentioned
   * them. `check-i18n-dead-keys.mjs` records the same trap on
   * `textFootprint()` itself, where an earlier draft self-polluted a real key.
   * Joining on the segment boundary keeps BOTH probes' spellings out of this
   * file: neither the dotted key nor its property chain occurs contiguously.
   */
  const key = (group: string, leaf: string) => ['console', group, leaf].join('.');

  /** Read by `packages/app-shell/src/chrome/LoadingScreen.tsx` through a local
   *  binding — the five the card measured, plus two more the leg turned up
   *  that the card did not list (the same file reads them the same way). */
  const READ_BY_PROPERTY_ACCESS = [
    key('loadingSteps', 'connecting'),
    key('loadingSteps', 'loadingConfig'),
    key('loadingSteps', 'preparingWorkspace'),
    key('error', 'connectionFailed'),
    key('error', 'checkServer'),
    key('actions', 'retry'),
    key('actions', 'retrying'),
  ];

  /** Sibling keys under the same namespace with no reader by any route. */
  const READ_BY_NOBODY = [key('error', 'serverUnreachable'), key('error', 'timeout')];

  it('POSITIVE: every property-access-read key names LoadingScreen.tsx as a hit', () => {
    const found = textFootprint(repoRoot, READ_BY_PROPERTY_ACCESS);
    for (const k of READ_BY_PROPERTY_ACCESS) {
      expect(
        found.get(k),
        `${k} is rendered by LoadingScreen.tsx through a local binding, and the property-chain leg ` +
          'is the only probe that can see that read',
      ).toContain('packages/app-shell/src/chrome/LoadingScreen.tsx (via property chain)');
    }
  });

  it('NEGATIVE: keys nothing reads still have no textual footprint at all', () => {
    // The half that keeps the leg honest on the real tree. If someone
    // "hardens" it into a blanket demotion this is what fails. If it ever
    // fails honestly — a real reader for one of these appeared — the fix is to
    // pick a still-reader-less sibling, never to loosen the assertion.
    const found = textFootprint(repoRoot, READ_BY_NOBODY);
    for (const k of READ_BY_NOBODY) expect(found.get(k), `${k} must have no reader`).toEqual([]);
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
