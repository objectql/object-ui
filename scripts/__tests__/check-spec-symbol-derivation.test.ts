import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Plain-JS CI helper. Its types are INFERRED from the .mjs source by
// `tsconfig.scripts.json` (`allowJs`), so no `@ts-expect-error` here.
import {
  CLAIM_ALLOW,
  CLAIM_PATTERNS,
  CLAIM_WINDOW,
  findClaim,
  normalizeDoc,
  scanFileForClaims,
} from '../check-spec-symbol-derivation.mjs';

/**
 * objectui#4592. `check:spec-symbols` matches BY NAME, so a hand copy that was
 * RENAMED away from the spec's symbol has nothing for it to match.
 * `ViewNavigationConfig` (objectui#4588) was exactly that — the spec's six
 * navigation keys, hand-written, drifted on `mode`, under the comment "Aligned
 * with @objectstack/spec ListView.navigation" — and it passed every CI run
 * until a manual census found it.
 *
 * Rule 2 is the cheap instrument that sees it: the CLAIM in the doc comment,
 * with nothing structural behind it. This file is that rule's discrimination
 * proof — the shape it must catch, and the five shapes it must NOT.
 *
 * The structural alternative ("does this local type mirror a spec object's key
 * set, whatever it is called") was measured and rejected in the same card: 38
 * sites at >= 0.80 key overlap on the tree, nearly all legitimately distinct
 * layers. False-positive honesty matters more than catch rate here, which is
 * why the green cases below outnumber the red one five to one.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Writes fixture sources to a throwaway dir and runs the REAL scanner over them. */
function withFixture<T>(files: Record<string, string>, run: (paths: Record<string, string>) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-symbol-claims-'));
  try {
    const paths: Record<string, string> = {};
    for (const [name, contents] of Object.entries(files)) {
      const full = path.join(dir, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, contents);
      paths[name] = full;
    }
    return run(paths);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The spec export names the fixtures below refer to, faithful to the pinned
 * 17.0.0-rc.6: every name a fixture CITES and the spec really exports is here,
 * and the retired ones (`ReactionSchema`, `FeedItemSchema`, …) are deliberately
 * absent.
 *
 * Faithfulness became load-bearing in objectui#4607 and was not before. Until
 * then `specNames` was consulted only to decorate the message of a declaration
 * that had ALREADY failed the tie test, so a name missing from this map changed
 * nothing; now it decides whether the tie test applies at all. `ListView` is the
 * instance — cited by two green fixtures below, really exported by
 * `@objectstack/spec/ui`, and absent from this map until #4607 measured it.
 * Omitting a live name here makes a green fixture red for a reason that exists
 * nowhere but this map.
 */
const SPEC_NAMES = new Map<string, Set<string>>([
  ['NavigationConfig', new Set(['@objectstack/spec/ui'])],
  ['NavigationConfigSchema', new Set(['@objectstack/spec/ui'])],
  ['ListView', new Set(['@objectstack/spec/ui'])],
  // Kept when the 16.0.0 major removed the rest of the feed surface — the live
  // half of the objectui#4607 specimen.
  ['FeedItemType', new Set(['@objectstack/spec/data'])],
  ['FeedFilterMode', new Set(['@objectstack/spec/data'])],
]);

const scan = (file: string) => scanFileForClaims(file, SPEC_NAMES);

// ── The shape rule 1 cannot see ──────────────────────────────────────────────

describe('rule 2 catches a renamed hand-copy through its own alignment claim', () => {
  /**
   * objectui#4588's declaration, renamed. `mode` is REQUIRED here while the spec
   * publishes it input-optional (`NavigationModeSchema.default('page')`) — the
   * drift the comment's canonical claim hides.
   */
  const RENAMED_COPY = `
/**
 * Navigation configuration for row/item click behavior.
 * Aligned with @objectstack/spec ListView.navigation.
 */
export interface ViewNavigationConfig {
  mode: 'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none';
  view?: string;
  preventNavigation?: boolean;
  openNewTab?: boolean;
  size?: 'auto' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  width?: string | number;
}
`;

  it('flags it, and names the declaration and the claim phrase', () => {
    withFixture({ 'objectql.ts': RENAMED_COPY }, ({ 'objectql.ts': file }) => {
      const found = scan(file);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('ViewNavigationConfig');
      expect(found[0].phrase.toLowerCase()).toBe('aligned with');
      expect(found[0].line).toBe(6);
    });
  });

  it('reports a claimed spec symbol the spec does not actually export', () => {
    withFixture(
      {
        'views.ts': `
/**
 * Reaction — An emoji reaction on a feed item.
 * Aligned with @objectstack/spec ReactionSchema.
 */
export interface Reaction {
  emoji: string;
  count: number;
  reacted?: boolean;
}
`,
      },
      ({ 'views.ts': file }) => {
        const found = scan(file);
        expect(found).toHaveLength(1);
        // The purest form of the planted premise: a canonical-sounding pointer
        // to a symbol that does not exist. No key-set comparison can see this,
        // because there is nothing on the other side to compare against.
        expect(found[0].dangling).toContain('ReactionSchema');
      }
    );
  });

  it('sees a claim split across doc-comment lines', () => {
    withFixture(
      {
        'wrapped.ts': `
/**
 * Navigation configuration for row/item click behavior, aligned
 * with @objectstack/spec ListView.navigation.
 */
export interface WrappedClaimConfig {
  mode: string;
  view?: string;
}
`,
      },
      ({ 'wrapped.ts': file }) => {
        expect(scan(file).map((f) => f.name)).toEqual(['WrappedClaimConfig']);
      }
    );
  });
});

// ── The shapes it must NOT flag ──────────────────────────────────────────────

describe('rule 2 stays green on everything that is not the defect', () => {
  it('a genuine z.infer derivation', () => {
    withFixture(
      {
        'derived.ts': `
import type { z } from 'zod';
import { NavigationConfigSchema } from '@objectstack/spec/ui';

/**
 * Navigation configuration for row/item click behavior.
 * Aligned with @objectstack/spec ListView.navigation.
 */
export type ViewNavigationConfig = z.infer<typeof NavigationConfigSchema>;
`,
      },
      ({ 'derived.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a SpecAuthoredInput derivation', () => {
    // `SpecAuthoredInput` is recognised by NAME (it is the repo's own helper for
    // binding a local type to a spec schema's authoring input), so the module it
    // comes from does not change the verdict. Spelled as the relative import a
    // file inside the react package would really use, and deliberately not as a
    // bare workspace specifier: `scripts-type-check.test.ts` pins that no file in
    // the scripts tsconfig program imports an `@object-ui` package, and it looks
    // for that import TEXT — so a fixture string carrying one trips it and would
    // move a CI step below the workspace build for no real dependency.
    withFixture(
      {
        'authored.ts': `
import type { SpecAuthoredInput } from '../spec-input';
import { NavigationConfigSchema } from '@objectstack/spec/ui';

/** Mirrors @objectstack/spec NavigationConfigSchema, on its authoring input. */
export type AuthoredNavigation = SpecAuthoredInput<typeof NavigationConfigSchema>;
`,
      },
      ({ 'authored.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('an interface that merely USES a spec type on a member', () => {
    // Deliberately weaker than rule 1, which requires a structural position.
    // Rule 2 asks only whether the declaration has ANY compile-time tie to what
    // it claims — a spec type on a member is a tie a spec change can break.
    withFixture(
      {
        'uses.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** List view node. Aligned with @objectstack/spec ListView. */
export interface ListViewNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'uses.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a similarly shaped local type that claims nothing', () => {
    withFixture(
      {
        'resolved.ts': `
/** Fully resolved navigation state after defaults are applied. */
export interface ResolvedNavigationConfig {
  mode: 'page' | 'drawer' | 'modal';
  view?: string;
  preventNavigation?: boolean;
  openNewTab?: boolean;
  width?: string | number;
}
`,
      },
      ({ 'resolved.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a claim phrase that belongs to a DIFFERENT sentence than the spec mention', () => {
    // `ChartDataSeries` (packages/types/src/data-display.ts) is the live case: a
    // model citizen that documents its own rename, which a bare co-occurrence
    // test flags. The measured run confirmed both halves — proximity alone was
    // not enough, and the sentence test is what makes it green.
    withFixture(
      {
        'chart.ts': `
/**
 * One inline-data series — a display name plus the literal numbers to plot,
 * positionally aligned with the chart's \`categories\`. Renamed off
 * \`ChartSeries\`: \`@objectstack/spec/ui\` owns that name for a dataset-bound
 * series descriptor, which carries no \`data\` at all.
 */
export interface ChartDataSeries {
  name: string;
  data: number[];
  color?: string;
}
`,
      },
      ({ 'chart.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a renderer — a component is not a second declaration of the shape it draws', () => {
    // The judgement the rule-1 ALLOW entries for `AuthProvider` / `ListView` /
    // `UserFilters` already make, applied to prose.
    withFixture(
      {
        'ReactionPicker.tsx': `
/**
 * ReactionPicker — Emoji reaction selector and display.
 * Aligned with @objectstack/spec ReactionSchema.
 */
export function ReactionPicker() {
  return null;
}

/** Reaction badge. Aligned with @objectstack/spec ReactionSchema. */
export const ReactionBadge = () => null;
`,
      },
      ({ 'ReactionPicker.tsx': file }) => expect(scan(file)).toEqual([])
    );
  });

  it("a file licence banner cannot supply the claim for the file's first declaration", () => {
    withFixture(
      {
        'banner.ts': `
/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Types in this module are aligned with @objectstack/spec where they say so.
 */

export interface UnrelatedLocalShape {
  id: string;
  label?: string;
}
`,
      },
      ({ 'banner.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('an unexported declaration — it publishes no surface to be mistaken for the spec', () => {
    withFixture(
      {
        'internal.ts': `
/** Internal. Aligned with @objectstack/spec ListView.navigation. */
interface InternalNavigationConfig {
  mode: string;
  view?: string;
}
export const NAVIGATION_MODES = ['page', 'drawer'] as const;
export type { InternalNavigationConfig };
`,
      },
      ({ 'internal.ts': file }) => expect(scan(file)).toEqual([])
    );
  });
});

// ── The tie is judged against the symbols the claim CITES (objectui#4607) ────

/**
 * The tie test above is symbol-AGNOSTIC: it asks whether the declaration
 * references ANY spec-bound identifier. So a claim about symbol X passed on an
 * incidental reference to unrelated symbol Y — and the more spec-integrated a
 * declaration was, the weaker the check on its prose became.
 *
 * `FeedItem` (packages/types/src/views.ts) was the live specimen: it cited
 * `FeedItemSchema`, removed from `@objectstack/spec/data` in the 16.0.0 major,
 * and never appeared in a single gate run because one member is typed
 * `FeedItemType` — the one feed symbol the removal kept. Measured on
 * origin/main@92876f097 before this change, the scanner returned `0 findings`
 * for the fixture below; it returns the finding asserted here after it.
 */
describe('a claim citing only symbols the spec does not export is flagged despite a live tie', () => {
  /** The objectui#4607 specimen: dangling citation, live tie to a DIFFERENT symbol. */
  const FEED_ITEM_SPECIMEN = `
import type { FeedItemType } from '@objectstack/spec/data';

/**
 * FeedItem — A single item in the unified activity feed.
 * Aligned with @objectstack/spec FeedItemSchema.
 */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  body?: string;
  createdAt: string;
}
`;

  it('(a) flags the specimen, and names the symbol the spec has dropped', () => {
    withFixture({ 'views.ts': FEED_ITEM_SPECIMEN }, ({ 'views.ts': file }) => {
      const found = scan(file);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('FeedItem');
      expect(found[0].phrase.toLowerCase()).toBe('aligned with');
      expect(found[0].dangling).toEqual(['FeedItemSchema']);
    });
  });

  it('(a) the tie itself is real — only the CITATION differs from a green declaration', () => {
    // The discrimination proof's other half, and the reason this rule is not
    // just "flag anything with a retired name in the comment": the fixture is
    // byte-identical to the one above except that the claim cites the symbol the
    // declaration is actually tied to. Same import, same member, same claim
    // phrase — green.
    withFixture(
      { 'views.ts': FEED_ITEM_SPECIMEN.replace('FeedItemSchema', 'FeedItemType') },
      ({ 'views.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('(c) a claim citing a LIVE symbol the declaration is tied to stays green', () => {
    withFixture(
      {
        'tied.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** Navigation node. Aligned with @objectstack/spec NavigationConfig. */
export interface TiedNavigationNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'tied.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('(d) a claim citing a LIVE symbol while tied to a DIFFERENT live one stays green', () => {
    // The KNOWN NON-GOAL recorded on objectui#4607. This is a claim-vs-tie
    // MISMATCH, not a dangling citation: both symbols exist, so the claim points
    // at something real and the reader can check it. Judging these needs a
    // name-relatedness allowance for the legitimate `type: FeedItemType` shape,
    // where citation and tie are genuinely different-but-related symbols — a
    // different instrument, deliberately not built here.
    withFixture(
      {
        'mismatch.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** List view node. Aligned with @objectstack/spec ListView. */
export interface MismatchedListViewNode {
  navigation?: NavigationConfig;
  columns?: string[];
}
`,
      },
      ({ 'mismatch.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('a claim naming no symbol at all is still governed by the tie test', () => {
    withFixture(
      {
        'unnamed.ts': `
import type { NavigationConfig } from '@objectstack/spec/ui';

/** Navigation node, aligned with @objectstack/spec. */
export interface UnnamedClaimNode {
  navigation?: NavigationConfig;
}
`,
      },
      ({ 'unnamed.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('with no spec export set to check against, the rule stays out of the way', () => {
    // "Dangling" is a statement about the installed spec. Given no export set,
    // every citation would read as dangling and the rule would flag every claim
    // in the repo at once — a verdict manufactured from ignorance of the spec.
    withFixture({ 'views.ts': FEED_ITEM_SPECIMEN }, ({ 'views.ts': file }) => {
      expect(scanFileForClaims(file, new Map())).toEqual([]);
    });
  });
});

// ── The retirement-record idiom must never re-trigger the gate (#4597/#4606) ─

describe('(b) an honest provenance note is not a claim', () => {
  /**
   * PR #4606 rewrote eight comments that cited retired spec symbols so they
   * RECORD the retirement instead of vouching for the symbol. That idiom names
   * the dead symbol on purpose — it is the provenance a reader needs — so a rule
   * that turned on it would punish exactly the fix it is meant to produce. What
   * makes these green is that they claim nothing: no alignment phrase sits next
   * to a `@objectstack/spec` mention, so there is no claim to have anything
   * behind.
   */
  it('the @object-ui/i18n idiom — "authored against the protocol\'s X, retired in …"', () => {
    withFixture(
      {
        'spec-formatters.ts': `
/**
 * Plural forms for a single translation key, in CLDR categories.
 *
 * Local shape — authored against the protocol's \`PluralRuleSchema\`, retired in
 * 17.0.0-rc.6 (see the module doc), so there is nothing upstream to derive from.
 */
export interface SpecPluralRule {
  key: string;
  zero?: string;
  one?: string;
  other: string;
}
`,
      },
      ({ 'spec-formatters.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  it('the @object-ui/types idiom — "its cited X went with the 16.0.0 feed removal"', () => {
    withFixture(
      {
        'views.ts': `
import type { FeedItemType } from '@objectstack/spec/data';

/**
 * FeedItem — A single item in the unified activity feed.
 *
 * Local shape; its cited \`FeedItemSchema\` went with the 16.0.0 feed removal
 * (see the section banner). Only \`type\` is still protocol-bound, through the
 * \`FeedItemType\` import above.
 */
export interface FeedItem {
  id: string;
  type: FeedItemType;
  createdAt: string;
}
`,
      },
      ({ 'views.ts': file }) => expect(scan(file)).toEqual([])
    );
  });

  /**
   * The fixtures above are a copy of the idiom; these two are the REAL FILES.
   * A copy can drift from what shipped, and the guarantee #4607 owes #4606 is
   * about the tree, not about a paraphrase of it: the sharpened rule must be
   * green on the very comments that card wrote.
   *
   * If one of these ever fails, read it as a defect in the RULE first. The
   * rewordings are the honest retirement record the guard exists to produce, so
   * a rule that flags them has turned on its own remedy.
   */
  const REWORDED_BY_4606 = [
    '../../packages/types/src/views.ts',
    '../../packages/i18n/src/utils/spec-formatters.ts',
  ];

  it.each(REWORDED_BY_4606)('stays green on the real tree: %s', (rel) => {
    expect(scan(path.join(here, rel))).toEqual([]);
  });

  it('and those files still carry the provenance the pin is about', () => {
    // Deleting the comments outright would satisfy the pin above while throwing
    // away the record. Pin the idiom's load-bearing phrases too.
    const views = fs.readFileSync(path.join(here, REWORDED_BY_4606[0]), 'utf8');
    const i18n = fs.readFileSync(path.join(here, REWORDED_BY_4606[1]), 'utf8');
    expect(views).toContain('went with the 16.0.0 feed removal');
    expect(views).toContain('`FeedItemType` and `FeedFilterMode` were deliberately KEPT');
    expect(i18n).toContain('authored against the protocol');
    expect(i18n).toContain('retired in');
  });
});

// ── The claim detector itself ────────────────────────────────────────────────

describe('findClaim', () => {
  it('requires an @objectstack/spec mention — a bare claim phrase is not a spec claim', () => {
    expect(findClaim('/** Aligned with the column order used by the grid. */')).toBeNull();
  });

  it('requires the claim and the mention to be within CLAIM_WINDOW of each other', () => {
    const near = findClaim('/** Aligned with @objectstack/spec ListView.navigation */');
    expect(near).not.toBeNull();
    expect(near!.distance).toBeLessThanOrEqual(CLAIM_WINDOW);

    const filler = 'x'.repeat(CLAIM_WINDOW + 20);
    expect(findClaim(`/** Aligned with ${filler} @objectstack/spec ListView */`)).toBeNull();
  });

  it('reads the claim when the mention comes FIRST', () => {
    const claim = findClaim('/** Uses @objectstack/spec types and mirrors their key set */');
    expect(claim).not.toBeNull();
    expect(claim!.phrase.toLowerCase()).toBe('mirrors');
  });

  it('matches case-insensitively across the documented phrase family', () => {
    const phrases = [
      'Aligned with @objectstack/spec X',
      'aligns with @objectstack/spec X',
      'Spec-aligned X (mirrors @objectstack/spec XSchema)',
      'Mirrors `X` from @objectstack/spec/cloud',
      'matches `@objectstack/spec` `XSchema`',
      'identical to @objectstack/spec X',
      'kept in sync with @objectstack/spec X',
      'the canonical definition from @objectstack/spec',
      'the single source of truth in @objectstack/spec',
      'a copy of @objectstack/spec X',
      'conforms to @objectstack/spec X',
    ];
    for (const p of phrases) expect(findClaim(`/** ${p} */`), p).not.toBeNull();
  });

  it('every documented pattern is case-insensitive', () => {
    for (const pattern of CLAIM_PATTERNS) expect(pattern.flags, String(pattern)).toContain('i');
  });

  it("takes cited symbols from the mention's own sentence, not the next one", () => {
    // Live case: `ActionDef` (packages/core/src/actions/ActionRunner.ts) reads
    // "…mirroring `@objectstack/spec`'s `ActionSchema`. Open key set on a data
    // bag is correct". `Open` opens the NEXT sentence and is prose, not a
    // citation. This was harmless while `symbols` only decorated the failure
    // message; since objectui#4607 it decides whether the tie test applies, so a
    // scraped prose word could make a green declaration read as citing nothing
    // but symbols the spec does not export.
    const claim = findClaim(
      "/** A declared metadata contract mirroring `@objectstack/spec`'s `ActionSchema`. Open key set on a data bag is correct. */"
    );
    expect(claim).not.toBeNull();
    expect(claim!.symbols).toEqual(['ActionSchema']);
  });

  it('still reads a symbol followed by a dotted member path', () => {
    // The truncation must not fire on `ListView.navigation` — the `.` there is a
    // member separator, not a sentence end, which is why the test is
    // "terminator followed by whitespace or end", the same shape the
    // claim/mention sentence test uses.
    expect(findClaim('/** Aligned with @objectstack/spec ListView.navigation. */')!.symbols).toEqual(['ListView']);
  });

  it('KNOWN LIMITATION: a sentence that never terminates still donates prose words', () => {
    // `PageNodeSchema` (packages/types/src/layout.ts) is the live instance: the
    // claim line ends without punctuation and the next line continues "This is
    // the SDUI NODE, not the authored page DOCUMENT", so `normalizeDoc` joins
    // them into ONE sentence and the window scrapes three prose words.
    //
    // Pinned rather than fixed, and it costs nothing today: the claim also cites
    // `PageSchema`, which the spec DOES export, so the declaration is governed
    // by the tie test exactly as before. It would only matter for a comment that
    // cites no real symbol at all AND has an incidental live tie — measured at
    // zero instances repo-wide (objectui#4607). Tightening it further means
    // deciding what a citation LOOKS like, which is a different instrument.
    const claim = findClaim(
      '/**\n * Aligned with @objectstack/spec PageSchema\n *\n * This is the SDUI NODE, not the authored page DOCUMENT\n */'
    );
    expect(claim!.symbols).toEqual(['PageSchema', 'This', 'SDUI', 'NODE']);
  });
});

describe('normalizeDoc', () => {
  it('collapses comment syntax so a wrapped sentence reads as one line', () => {
    expect(normalizeDoc('/**\n * Aligned with\n * @objectstack/spec X.\n */')).toBe('Aligned with @objectstack/spec X.');
  });
});

// ── Governance, mirroring rule 1's ALLOW map ─────────────────────────────────

describe('CLAIM_ALLOW governance', () => {
  it('every entry is keyed package:symbol and carries a reason and an issue', () => {
    for (const [key, entry] of Object.entries(CLAIM_ALLOW)) {
      expect(key, key).toMatch(/^@[\w-]+\/[\w-]+:[A-Za-z_][\w]*$/);
      expect(entry.reason.length, key).toBeGreaterThan(80);
      expect(typeof entry.issue, key).toBe('number');
    }
  });

  it('stays small — a large allowlist is a second copy of the codebase, not a guard', () => {
    // The STOP condition recorded on objectui#4592: an instrument that needs
    // more than a handful of standing exemptions is bigger than the disease.
    expect(Object.keys(CLAIM_ALLOW).length).toBeLessThanOrEqual(10);
  });
});

describe('the guard file itself', () => {
  it('documents every claim pattern it matches in its header', () => {
    const source = fs.readFileSync(path.join(here, '../check-spec-symbol-derivation.mjs'), 'utf8');
    const header = source.slice(0, source.indexOf('import ts from'));
    for (const fragment of ['aligned with', 'mirrors', 'canonical', 'source of truth', 'conforms to']) {
      expect(header.toLowerCase(), fragment).toContain(fragment);
    }
  });
});
