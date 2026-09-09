import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DESIGNER_TABLE,
  collectDesignerKeys,
  propertyChainProbe,
  sweep,
  sweepDesignerTable,
  textFootprint,
} from '../check-i18n-dead-keys.mjs';

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
 * The workspace specifier the fixture SOURCES below import, in a constant so
 * this suite and `check-i18n-call-site-keys.test.ts` spell it one way.
 *
 * It is NOT held here to keep the specifier away from a text-level scan, which
 * is what this comment used to say. That reason expired:
 * `workspaceImportSpecifiers()` in `scripts-type-check.test.ts` reads import
 * edges from the AST, so a specifier sitting in a string or a template
 * literal's static text is not an edge to it — that function's docstring is the
 * authoritative account, and a `describe` block beside it pins the
 * string-literal case directly. Writing these fixtures out plainly would be
 * green; the constant is kept for one spelling, not for concealment.
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
  boundary: {
    onlyPrefix: 'A candidate a longer key merely STARTS with',
    onlyDotted: 'A candidate a longer DOTTED key merely starts with',
    onlySuffix: 'A candidate a longer key merely ENDS with',
    realHit: 'A candidate something really does spell',
  },
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

/**
 * Text that is evidence about a DIFFERENT key than the one it contains — the
 * three shapes `textFootprint()`'s key-boundary requirement must refuse
 * (objectui#8701) — plus one occurrence that is genuine evidence and must
 * still count. Deliberately NOT `t()` calls: the point is what the whole-repo
 * text net does with the bytes, and a call site would take these keys out of
 * the candidate set through the AST leg instead.
 */
const LONGER_KEY_MENTIONS_SOURCE = `
export const NOT_ABOUT_THESE_KEYS = [
  'boundary.onlyPrefixExtended',
  'boundary.onlyDotted.detail',
  'otherNamespace.boundary.onlySuffix',
];
export const ABOUT_THIS_ONE = { labelKey: 'boundary.realHit' };
`;

function fixtureRoot() {
  return repoWith({
    'packages/i18n/src/locales/en.ts': EN_FIXTURE,
    'packages/x/src/Widget.tsx': CONSUMER_SOURCE,
    'packages/x/src/fieldConfig.ts': INDIRECT_MENTION_SOURCE,
    'packages/x/src/longerKeys.ts': LONGER_KEY_MENTIONS_SOURCE,
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

  it('CONFIRMS a candidate a longer key merely STARTS with (objectui#8701)', () => {
    // The pack sweep's own tier split, not just the predicate: these three
    // shapes are the ones that were reported as textual hits for the shorter
    // key before the boundary became `textFootprint()`'s default, sending a
    // reader to a line that never mentions the key they are hunting.
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).toContain('boundary.onlyPrefix');
    expect(needsReview.map((f) => f.key)).not.toContain('boundary.onlyPrefix');
  });

  it('CONFIRMS a candidate a longer DOTTED key merely starts with (objectui#8701)', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).toContain('boundary.onlyDotted');
    expect(needsReview.map((f) => f.key)).not.toContain('boundary.onlyDotted');
  });

  it('CONFIRMS a candidate a longer key merely ENDS with (objectui#8701)', () => {
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).toContain('boundary.onlySuffix');
    expect(needsReview.map((f) => f.key)).not.toContain('boundary.onlySuffix');
  });

  it('still demotes a candidate a file really does spell (objectui#8701)', () => {
    // The other direction of the same predicate: the boundary must not empty
    // the NEEDS-REVIEW tier. Without this, a `textFootprint()` that found
    // nothing anywhere would pass the three pins above.
    const { confirmed, needsReview } = sweep(fixtureRoot());
    expect(confirmed).not.toContain('boundary.realHit');
    expect(needsReview.find((f) => f.key === 'boundary.realHit')?.hits).toEqual([
      'packages/x/src/longerKeys.ts',
    ]);
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

describe('the key-builder leg reaches the sweep end to end (objectui#7592)', () => {
  // The class the property-chain leg does NOT cover: the consumer never spells
  // the key AND never calls t() — it builds the key in a helper and hands it to
  // a translator it was given as a value. Before the key-builder leg all three
  // legs were blind at once and every member of the family landed in CONFIRMED,
  // the tier this file's header discusses deleting from.
  const EN_TOOLS = `const en = {
  chatbot: { tool: { apply_edit: 'Apply edit', list_objects: 'List objects' } },
  orphan: { group: { leaf: 'Nobody reads this' } },
} as const;
export default en;
`;
  const BUILDER_CONSUMER = `
export function toolTitleKey(name: string): string {
  return \`chatbot.tool.\${String(name).trim()}\`;
}
export function humanize(name: string, translate?: (k: string, f: string) => string): string {
  const english = name.replace(/_/g, ' ');
  return translate ? translate(toolTitleKey(name), english) : english;
}
`;
  const builderRoot = () =>
    repoWith({
      'packages/i18n/src/locales/en.ts': EN_TOOLS,
      'packages/x/src/tool-display.ts': BUILDER_CONSUMER,
    });

  it('POSITIVE: a helper-built family is no longer a candidate at all', () => {
    const { confirmed, needsReview } = sweep(builderRoot());
    const asCandidate = [...confirmed, ...needsReview.map((e: { key: string }) => e.key)].filter((k: string) =>
      k.startsWith('chatbot.tool.'),
    );
    expect(asCandidate, 'a live helper-built key is still being offered for deletion').toEqual([]);
  });

  it('NEGATIVE: the leg does not hollow out the tier — a key nothing reads is STILL CONFIRMED', () => {
    // Without this, "no chatbot.tool key is confirmed" would also pass on a
    // sweep that confirmed nothing at all.
    expect(sweep(builderRoot()).confirmed).toEqual(['orphan.group.leaf']);
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

/* ────────────────────────────────────────────────────────────────────────────
 * objectui#8388 — the SECOND corpus: the metadata-admin designer's module-local
 * `ENGINE_STRINGS_EN` / `ENGINE_STRINGS_ZH` table.
 *
 * Same synthetic-fixture discipline as the pack suite above, and one extra
 * constraint it does not have: ⛔ no assertion here may spell a key that the
 * REAL table actually declares. `textFootprint()` greps the whole repository,
 * so a test file naming a real candidate becomes a textual hit for it and
 * silently demotes that key from CONFIRMED to NEEDS-REVIEW in the real report —
 * the report these tests exist to keep trustworthy. Every key below therefore
 * lives under a namespace segment the real table has no entry for. (This is not
 * hypothetical: a scratch probe placed inside the repo during this card's own
 * development demoted all four of objectui#8547's dead keys, and the reading
 * only came back right once the probe was moved out of the scanned tree.)
 *
 * There is deliberately NO real-repo assertion here that names a key or pins a
 * candidate COUNT. Both would turn a report-only instrument into an enforcing
 * one through the back door: the count moves whenever anyone adds a string, and
 * the four keys this card's positive control uses are themselves scheduled for
 * deletion by objectui#8547 — a pin on either would red an unrelated PR. The
 * real-repo readings are taken by running the script, and they live in the PR
 * body and the issue report, which is what a report-only shape means.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The fixture table, written to the exact path `DESIGNER_TABLE` names.
 *  `engine.fx.*` / `designer.fx.*` are chosen so no assertion in this file
 *  spells a key the real table declares — see the block comment above. */
const DESIGNER_TABLE_FIXTURE = `
/**
 * Fixture module docblock that QUOTES a key in prose: t('engine.fx.quotedInDoc').
 * A whole-file grep would read this sentence as a reader; the AST walk must not.
 */
const ENGINE_STRINGS_EN: Record<string, string> = {
  'engine.fx.spelled': 'Spelled at a call site',
  'engine.fx.quotedInDoc': 'Only this file mentions it, and only in a comment',
  'engine.fx.builtHead.alpha': 'Reached by a template head',
  'engine.fx.builtHead.beta': 'Reached by the same template head',
  'engine.fx.prefix': 'A strict prefix of the next key',
  'engine.fx.prefix.longer': 'The longer sibling, spelled at a call site',
  'engine.fx.mentionedInTest': 'Only a test file spells this',
  'engine.fx.dead': 'Nothing reads this at all',
  'designer.fx.dead': 'Nothing reads this either',
};

const ENGINE_STRINGS_ZH: Record<string, string> = {
  'engine.fx.spelled': '调用点拼写',
  'engine.fx.quotedInDoc': '仅注释提及',
  'engine.fx.builtHead.alpha': '模板头可达',
  'engine.fx.builtHead.beta': '同一模板头',
  'engine.fx.prefix': '更长键的前缀',
  'engine.fx.prefix.longer': '更长的兄弟键',
  'engine.fx.mentionedInTest': '仅测试提及',
  'engine.fx.dead': '无人读取',
  'designer.fx.dead': '也无人读取',
  'engine.fx.zhOnly': '只有中文表里有',
};

function pickTable(locale?: string) {
  return { strings: locale === 'zh-CN' ? ENGINE_STRINGS_ZH : ENGINE_STRINGS_EN };
}

export function t(key: string, locale?: string): string {
  return pickTable(locale).strings[key] ?? key;
}

/** The in-module reader shape no call-site walker can see: a template-built key
 *  indexed straight into the table, with no t() call anywhere near it. */
export function translateZhOnly(kind: string, locale?: string): string | undefined {
  return pickTable(locale).strings[\`engine.fx.zhOnly\${kind}\`];
}
`;

/** A shipped consumer: one literal call site, one template-built family, and
 *  the LONGER sibling of a key that is a strict prefix of it. */
const DESIGNER_CONSUMER = `
import { t } from './i18n';
export function Panel({ variant, locale }: { variant: string; locale?: string }) {
  return [
    t('engine.fx.spelled', locale),
    t(\`engine.fx.builtHead.\${variant}\`, locale),
    t('engine.fx.prefix.longer', locale),
  ];
}
`;

/** A test file — out of the AST walk's population, in the text net's. */
const DESIGNER_TEST_MENTION = `
it('renders', () => {
  expect(labels).toContain('engine.fx.mentionedInTest');
});
`;

function designerRoot(overrides: Record<string, string> = {}): string {
  return repoWith({
    [DESIGNER_TABLE]: DESIGNER_TABLE_FIXTURE,
    'packages/app-shell/src/views/metadata-admin/Panel.tsx': DESIGNER_CONSUMER,
    'packages/app-shell/src/views/metadata-admin/__tests__/Panel.test.tsx': DESIGNER_TEST_MENTION,
    ...overrides,
  });
}

const keysOf = (entries: Array<{ key: string }>): string[] => entries.map((e) => e.key);

describe('collectDesignerKeys()', () => {
  it('reads both tables and unions them, so a zh-only key is still in the corpus', () => {
    const { tables, corpus } = collectDesignerKeys(designerRoot());
    expect(tables.get('ENGINE_STRINGS_EN')!.size).toBe(9);
    expect(tables.get('ENGINE_STRINGS_ZH')!.size).toBe(10);
    expect(corpus.size).toBe(10);
    expect(corpus.has('engine.fx.zhOnly')).toBe(true);
  });

  it('throws when a table constant is missing, rather than sweeping an empty corpus', () => {
    const root = repoWith({
      [DESIGNER_TABLE]: "const ENGINE_STRINGS_EN: Record<string, string> = { 'engine.fx.dead': 'x' };\n",
    });
    // A silent empty ZH table would make every en key read as "en-only" and
    // every zh key vanish from the corpus — a stale extractor must be loud.
    expect(() => collectDesignerKeys(root)).toThrow(/ENGINE_STRINGS_ZH/);
  });
});

describe('sweepDesignerTable()', () => {
  it('excludes a key spelled as a literal at a call site', () => {
    const result = sweepDesignerTable(designerRoot());
    expect(keysOf(result.confirmed)).not.toContain('engine.fx.spelled');
    expect(keysOf(result.needsReview)).not.toContain('engine.fx.spelled');
  });

  it('excludes every key a dynamic template head can reach — the negative control', () => {
    const result = sweepDesignerTable(designerRoot());
    const listed = [...keysOf(result.confirmed), ...keysOf(result.needsReview)];
    expect(listed).not.toContain('engine.fx.builtHead.alpha');
    expect(listed).not.toContain('engine.fx.builtHead.beta');
    // …and the head is REPORTED with the count of keys it alone holds live, so
    // a family that silently stops being template-built is visible as a row
    // falling to zero rather than as a longer candidate list.
    expect(result.dynamicHeads.has('engine.fx.builtHead.')).toBe(true);
    expect(result.headHeldCounts.get('engine.fx.builtHead.')).toBe(2);
  });

  it('reads template heads inside the table module itself, where there is no t() call at all', () => {
    // `translateZhOnly` indexes `pickTable(locale).strings[...]` directly. Every
    // call-site walker in this repo is blind to that shape by construction, and
    // it is how the real table's flow-node and enum families are reached.
    const result = sweepDesignerTable(designerRoot());
    expect(result.dynamicHeads.has('engine.fx.zhOnly')).toBe(true);
    expect([...keysOf(result.confirmed), ...keysOf(result.needsReview)]).not.toContain('engine.fx.zhOnly');
  });

  it('lists a key nothing reads as CONFIRMED — the positive control', () => {
    const result = sweepDesignerTable(designerRoot());
    expect(keysOf(result.confirmed)).toContain('engine.fx.dead');
    expect(keysOf(result.confirmed)).toContain('designer.fx.dead');
  });

  it('reports which table(s) declare each candidate', () => {
    const result = sweepDesignerTable(designerRoot());
    const dead = result.confirmed.find((c) => c.key === 'engine.fx.dead');
    expect(dead?.tables).toEqual(['ENGINE_STRINGS_EN', 'ENGINE_STRINGS_ZH']);
  });

  it('does not count the table module’s own docblock as a reader', () => {
    // The definition file is excluded from the text net wholesale, precisely so
    // a key quoted in the module header cannot masquerade as a call site.
    const result = sweepDesignerTable(designerRoot());
    expect(keysOf(result.confirmed)).toContain('engine.fx.quotedInDoc');
  });

  it('does not count a definition line as a reference', () => {
    // Both tables spell every key. If the reader walk descended into the table
    // initializers, the candidate list would always be empty.
    const result = sweepDesignerTable(designerRoot());
    expect(result.candidateCount).toBeGreaterThan(0);
  });

  it('keeps a candidate that is a strict PREFIX of a live sibling in CONFIRMED', () => {
    // `engine.fx.prefix.longer` is spelled at a call site; `engine.fx.prefix` is
    // not. A plain substring grep reads the sibling's line as a hit for the
    // shorter key and demotes it, sending a human to a line that never mentions
    // their key. The key-boundary check is what stops that.
    const result = sweepDesignerTable(designerRoot());
    expect(keysOf(result.confirmed)).toContain('engine.fx.prefix');
    expect(keysOf(result.needsReview)).not.toContain('engine.fx.prefix');
  });

  it('demotes a key that only a TEST file spells to NEEDS-REVIEW, with the file named', () => {
    const result = sweepDesignerTable(designerRoot());
    const entry = result.needsReview.find((c) => c.key === 'engine.fx.mentionedInTest');
    expect(entry, 'a test-only mention must land in NEEDS-REVIEW, not CONFIRMED').toBeDefined();
    expect(entry!.hits.join(' ')).toContain('__tests__/Panel.test.tsx');
  });

  it('reports a head too wide to apply instead of silently marking a namespace live', () => {
    const result = sweepDesignerTable(
      designerRoot({
        'packages/app-shell/src/views/metadata-admin/Wide.tsx':
          "import { t } from './i18n';\nexport const w = (x: string) => t(`engine.${x}`);\n",
      }),
    );
    expect(result.wideHeads).toContain('engine.');
    // …and it must NOT have been applied: the dead keys are still listed.
    expect(keysOf(result.confirmed)).toContain('engine.fx.dead');
  });
});

/**
 * The key-boundary requirement, pinned in BOTH directions (objectui#8701).
 *
 * The two halves catch opposite degenerate predicates, which is the point of
 * having both: every REJECTS case below reddens for a predicate that answers
 * `true` for everything (the shipped substring test is one such predicate, and
 * so is `() => true`), and every ACCEPTS case reddens for a predicate that
 * answers `false` for everything. Neither half alone is a pin — a `false`
 * predicate would sail through the rejections while reporting no evidence
 * about anything, which is strictly worse than the bug being fixed here.
 *
 * The ACCEPTS cases are also why the boundary is not "the key must be the whole
 * line" or "the key must be quoted": a real hit arrives inside a call, inside
 * an array, at end of line, and in prose that never quotes it, and each of
 * those spellings is pinned separately rather than represented by one.
 */
describe('textFootprint() key boundary', () => {
  const KEY = 'ns.group.leaf';
  /** `propertyChain: false` throughout: this leg is the FULL-KEY probe, and the
   *  chain probe would otherwise answer some of these cases for it. */
  const footprintOf = (files: Record<string, string>, options = {}) =>
    textFootprint(repoWith(files), [KEY], { propertyChain: false, ...options }).get(KEY);

  // ── REJECTS: text about a longer key is not evidence about this key ───────
  it('REJECTS a longer key that continues with an identifier character', () => {
    expect(footprintOf({ 'packages/x/src/a.ts': `export const k = '${KEY}Extended';\n` })).toEqual([]);
  });

  it('REJECTS a longer DOTTED key — the hole `occursAtPropertyBoundary` leaves open', () => {
    // `.` does not continue an IDENTIFIER, so the property-chain probe's guard
    // accepts this shape. The key-boundary class is wider by exactly `.` and `-`.
    expect(footprintOf({ 'packages/x/src/a.ts': `export const k = '${KEY}.detail';\n` })).toEqual([]);
  });

  it('REJECTS a longer key that continues with a hyphen', () => {
    expect(footprintOf({ 'packages/x/src/a.ts': `export const k = '${KEY}-compact';\n` })).toEqual([]);
  });

  it('REJECTS a longer key that merely ENDS with this key — the LEFT side', () => {
    // The other hole in the chain-probe guard, and the one that is not about
    // identifier characters at all: it checks nothing to the left. Measured on
    // the pack sweep, this shape alone accounted for 4 of the 13 keys the
    // boundary re-tiered, every one of them a designer-table key ending in a
    // pack key.
    expect(footprintOf({ 'packages/x/src/a.ts': `export const k = 'otherNs.${KEY}';\n` })).toEqual([]);
  });

  // ── ACCEPTS: a real occurrence is still evidence ──────────────────────────
  it('ACCEPTS a quoted call-site spelling', () => {
    expect(footprintOf({ 'packages/x/src/a.ts': `t('${KEY}');\n` })).toEqual(['packages/x/src/a.ts']);
  });

  it('ACCEPTS a double-quoted value in a data file', () => {
    expect(footprintOf({ 'packages/x/src/a.json': `{ "labelKey": "${KEY}" }\n` })).toEqual(['packages/x/src/a.json']);
  });

  it('ACCEPTS an unquoted prose mention with ordinary sentence punctuation', () => {
    expect(footprintOf({ 'content/docs/x.md': `See ${KEY}, which nothing renders.\n` })).toEqual([
      'content/docs/x.md',
    ]);
  });

  it('REJECTS the same prose mention when a full stop follows the key', () => {
    // The cost the docstring states rather than discovers, pinned so it is a
    // known price and not a surprise: `.` is a key character, so a sentence
    // that ends ON the key reads as a longer key and stops counting. This is
    // the one direction in which the boundary claims MORE evidence of deadness
    // than the substring test did.
    expect(footprintOf({ 'content/docs/x.md': `Nothing renders ${KEY}.\n` })).toEqual([]);
  });

  it('ACCEPTS an occurrence at end of line with no trailing character at all', () => {
    expect(footprintOf({ 'packages/x/src/a.ts': `// ${KEY}` })).toEqual(['packages/x/src/a.ts']);
  });

  it('ACCEPTS an occurrence at the very start of a line', () => {
    expect(footprintOf({ 'content/docs/x.md': `${KEY} — the label key\n` })).toEqual(['content/docs/x.md']);
  });

  it('ACCEPTS a real hit on a line that ALSO carries a longer key', () => {
    // Every occurrence is checked, not just the first: one line can hold both
    // shapes, and stopping at the first rejection would drop real evidence.
    expect(footprintOf({ 'packages/x/src/a.ts': `const m = { '${KEY}.detail': 1, '${KEY}': 2 };\n` })).toEqual([
      'packages/x/src/a.ts',
    ]);
  });

  // ── the escape hatch, kept measurable ─────────────────────────────────────
  it('reproduces the pre-objectui#8701 substring behaviour when opted out', () => {
    expect(footprintOf({ 'packages/x/src/a.ts': `export const k = '${KEY}.detail';\n` }, { keyBoundary: false })).toEqual([
      'packages/x/src/a.ts',
    ]);
  });
});
